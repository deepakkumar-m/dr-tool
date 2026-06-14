"""Execution API endpoints — start, monitor, and control DR executions."""

import uuid
from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request

from models import (
    Cluster,
    Execution,
    ExecutionStep,
    Runbook,
    RunbookStep,
    db,
)
from services.audit_service import log_event
from services.execution_engine import (
    is_running,
    pause_execution,
    resume_execution,
    rollback_execution,
    start_execution,
)

executions_bp = Blueprint("executions", __name__)


@executions_bp.route("/api/executions", methods=["GET"])
def list_executions():
    """List executions, optionally filtered by status."""
    query = Execution.query

    status = request.args.get("status")
    if status:
        query = query.filter(Execution.status == status)

    cluster_id = request.args.get("cluster_id")
    if cluster_id:
        query = query.filter(Execution.cluster_id == cluster_id)

    executions = query.order_by(Execution.started_at.desc()).all()
    return jsonify([e.to_dict() for e in executions])


@executions_bp.route("/api/executions/<exec_id>", methods=["GET"])
def get_execution(exec_id):
    """Get a single execution with all step statuses."""
    execution = db.session.get(Execution, exec_id)
    if not execution:
        return jsonify({"error": "Execution not found"}), 404
    return jsonify(execution.to_dict(include_steps=True))


@executions_bp.route("/api/executions", methods=["POST"])
def create_execution():
    """Start a new DR execution."""
    data = request.get_json()
    runbook_id = data.get("runbook_id")
    cluster_id = data.get("cluster_id")
    started_by = data.get("started_by", "operator")

    # Validate
    runbook = db.session.get(Runbook, runbook_id)
    if not runbook:
        return jsonify({"error": "Runbook not found"}), 404

    cluster = db.session.get(Cluster, cluster_id)
    if not cluster:
        return jsonify({"error": "Cluster not found"}), 404

    # Check DR type compatibility
    if runbook.dr_type != cluster.dr_type:
        return jsonify({
            "error": f"Runbook is for '{runbook.dr_type}' clusters but target cluster is '{cluster.dr_type}'"
        }), 400

    # Get runbook steps
    rb_steps = RunbookStep.query.filter_by(runbook_id=runbook_id).order_by(RunbookStep.order).all()

    # Create execution
    exec_id = f"exec-{uuid.uuid4().hex[:8]}"
    execution = Execution(
        id=exec_id,
        runbook_id=runbook_id,
        cluster_id=cluster_id,
        status="pending",
        started_by=started_by,
        total_steps=len(rb_steps),
        completed_steps=0,
    )
    db.session.add(execution)

    # Create execution steps
    for rs in rb_steps:
        es = ExecutionStep(
            id=f"{exec_id}-step-{rs.order:02d}",
            execution_id=exec_id,
            runbook_step_id=rs.id,
            order=rs.order,
            name=rs.name,
            step_type=rs.step_type,
            status="pending",
            estimated_seconds=rs.estimated_seconds,
            command=rs.command,
        )
        db.session.add(es)

    # Update cluster status
    cluster.status = "failover-active"
    db.session.commit()

    # Audit log
    log_event(
        action="execution.started",
        resource_type="execution",
        resource_id=exec_id,
        user=started_by,
        details={"runbook": runbook.name, "cluster": cluster.name},
        cluster_name=cluster.name,
        severity="warning",
    )

    # Start execution engine
    start_execution(current_app._get_current_object(), exec_id)

    return jsonify(execution.to_dict(include_steps=True)), 201


@executions_bp.route("/api/executions/<exec_id>/pause", methods=["POST"])
def pause_exec(exec_id):
    """Pause a running execution."""
    execution = db.session.get(Execution, exec_id)
    if not execution:
        return jsonify({"error": "Execution not found"}), 404

    if pause_execution(exec_id):
        log_event("execution.paused", "execution", exec_id,
                  cluster_name=execution.cluster.name if execution.cluster else None)
        return jsonify({"message": "Execution paused"})
    return jsonify({"error": "Execution is not running"}), 400


@executions_bp.route("/api/executions/<exec_id>/resume", methods=["POST"])
def resume_exec(exec_id):
    """Resume a paused execution."""
    execution = db.session.get(Execution, exec_id)
    if not execution:
        return jsonify({"error": "Execution not found"}), 404

    if resume_execution(exec_id):
        log_event("execution.resumed", "execution", exec_id,
                  cluster_name=execution.cluster.name if execution.cluster else None)
        return jsonify({"message": "Execution resumed"})
    return jsonify({"error": "Execution is not paused"}), 400


@executions_bp.route("/api/executions/<exec_id>/rollback", methods=["POST"])
def rollback_exec(exec_id):
    """Emergency rollback."""
    execution = db.session.get(Execution, exec_id)
    if not execution:
        return jsonify({"error": "Execution not found"}), 404

    if rollback_execution(exec_id):
        log_event("execution.rollback", "execution", exec_id,
                  cluster_name=execution.cluster.name if execution.cluster else None,
                  severity="critical")
        # Restore cluster status
        cluster = db.session.get(Cluster, execution.cluster_id)
        if cluster:
            cluster.status = "healthy"
            db.session.commit()
        return jsonify({"message": "Rollback initiated"})
    return jsonify({"error": "Execution is not running"}), 400


@executions_bp.route("/api/executions/<exec_id>/steps/<step_id>/confirm", methods=["POST"])
def confirm_step(exec_id, step_id):
    """Confirm a manual/approval step."""
    step = db.session.get(ExecutionStep, step_id)
    if not step or step.execution_id != exec_id:
        return jsonify({"error": "Step not found"}), 404

    if step.status != "waiting":
        return jsonify({"error": f"Step is not waiting for confirmation (status: {step.status})"}), 400

    step.status = "completed"
    step.completed_at = datetime.now(timezone.utc)
    step.output = "Manually confirmed by operator"
    db.session.commit()

    log_event("step.confirmed", "execution_step", step_id,
              details={"execution_id": exec_id, "step_name": step.name})

    return jsonify({"message": "Step confirmed"})


@executions_bp.route("/api/executions/<exec_id>/logs", methods=["GET"])
def get_logs(exec_id):
    """Get all step outputs as a log stream."""
    steps = (
        ExecutionStep.query
        .filter_by(execution_id=exec_id)
        .order_by(ExecutionStep.order)
        .all()
    )
    logs = []
    for s in steps:
        if s.output:
            logs.append({
                "step_order": s.order,
                "step_name": s.name,
                "status": s.status,
                "output": s.output,
                "timestamp": s.started_at.isoformat() if s.started_at else None,
            })
        if s.error:
            logs.append({
                "step_order": s.order,
                "step_name": s.name,
                "status": "error",
                "output": s.error,
                "timestamp": s.completed_at.isoformat() if s.completed_at else None,
            })
    return jsonify(logs)
