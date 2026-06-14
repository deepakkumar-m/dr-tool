"""Runbook API endpoints."""

import json
import uuid
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from models import Runbook, RunbookStep, db

runbooks_bp = Blueprint("runbooks", __name__)


@runbooks_bp.route("/api/runbooks", methods=["GET"])
def list_runbooks():
    """List all runbook templates."""
    runbooks = Runbook.query.order_by(Runbook.name).all()
    return jsonify([rb.to_dict(include_steps=False) for rb in runbooks])


@runbooks_bp.route("/api/runbooks/<runbook_id>", methods=["GET"])
def get_runbook(runbook_id):
    """Get a runbook with all its steps."""
    runbook = db.session.get(Runbook, runbook_id)
    if not runbook:
        return jsonify({"error": "Runbook not found"}), 404
    return jsonify(runbook.to_dict(include_steps=True))


@runbooks_bp.route("/api/runbooks", methods=["POST"])
def create_runbook():
    """Create a new runbook."""
    data = request.get_json()
    rb_id = f"rb-{uuid.uuid4().hex[:8]}"

    runbook = Runbook(
        id=rb_id,
        name=data["name"],
        dr_type=data["dr_type"],
        description=data.get("description", ""),
        is_template=data.get("is_template", True),
    )
    db.session.add(runbook)

    for i, step_data in enumerate(data.get("steps", [])):
        step = RunbookStep(
            id=f"{rb_id}-step-{i + 1:02d}",
            runbook_id=rb_id,
            order=i + 1,
            name=step_data["name"],
            description=step_data.get("description", ""),
            step_type=step_data.get("step_type", "automated"),
            estimated_seconds=step_data.get("estimated_seconds", 60),
            command=step_data.get("command", ""),
            rollback_command=step_data.get("rollback_command", ""),
            depends_on=json.dumps(step_data.get("depends_on", [])),
        )
        db.session.add(step)

    db.session.commit()
    return jsonify(runbook.to_dict(include_steps=True)), 201


@runbooks_bp.route("/api/runbooks/<runbook_id>", methods=["PUT"])
def update_runbook(runbook_id):
    """Update a runbook."""
    runbook = db.session.get(Runbook, runbook_id)
    if not runbook:
        return jsonify({"error": "Runbook not found"}), 404

    data = request.get_json()
    if "name" in data:
        runbook.name = data["name"]
    if "description" in data:
        runbook.description = data["description"]
    if "dr_type" in data:
        runbook.dr_type = data["dr_type"]

    runbook.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(runbook.to_dict(include_steps=True))


@runbooks_bp.route("/api/runbooks/<runbook_id>", methods=["DELETE"])
def delete_runbook(runbook_id):
    """Delete a runbook and its steps."""
    runbook = db.session.get(Runbook, runbook_id)
    if not runbook:
        return jsonify({"error": "Runbook not found"}), 404

    RunbookStep.query.filter_by(runbook_id=runbook_id).delete()
    db.session.delete(runbook)
    db.session.commit()
    return jsonify({"message": "Runbook deleted"}), 200
