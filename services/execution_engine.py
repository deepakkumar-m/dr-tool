"""DR Execution Engine — runs runbook steps in a background thread."""

import json
import random
import threading
import time
import uuid
from datetime import datetime, timezone

from models import Cluster, Execution, ExecutionStep, RunbookStep, db


# Track running executions: exec_id → {"thread": Thread, "pause": Event, "stop": bool}
_running = {}


def _generate_log_output(step_name, step_type, command, cluster_name):
    """Generate realistic-looking log output for a step."""
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    lines = [f"[{ts}] ▶ Starting: {step_name}"]

    if command:
        lines.append(f"[{ts}] $ {command}")

    if step_type == "automated":
        fake_outputs = [
            f"[{ts}]   Connecting to cluster {cluster_name}...",
            f"[{ts}]   Authenticated successfully via service account",
            f"[{ts}]   Executing command on target cluster...",
            f"[{ts}]   Processing resources...",
            f"[{ts}]   Operation completed — 0 errors, 0 warnings",
        ]
        lines.extend(fake_outputs[:random.randint(3, 5)])
    elif step_type == "notification":
        lines.append(f"[{ts}]   📧 Notification dispatched to stakeholders")
        lines.append(f"[{ts}]   ✅ Delivery confirmed")
    elif step_type in ("manual", "approval"):
        lines.append(f"[{ts}]   ⏳ Awaiting manual confirmation from operator...")

    lines.append(f"[{ts}] ✅ Completed: {step_name}")
    return "\n".join(lines)


def _run_execution(app, exec_id):
    """Background thread that progresses through execution steps."""
    with app.app_context():
        execution = db.session.get(Execution, exec_id)
        if not execution:
            return

        cluster = db.session.get(Cluster, execution.cluster_id)
        cluster_name = cluster.name if cluster else "unknown"

        execution.status = "running"
        execution.started_at = datetime.now(timezone.utc)
        db.session.commit()

        steps = (
            ExecutionStep.query
            .filter_by(execution_id=exec_id)
            .order_by(ExecutionStep.order)
            .all()
        )

        for step in steps:
            ctrl = _running.get(exec_id, {})

            # Check for stop signal
            if ctrl.get("stop"):
                execution.status = "rolled-back"
                execution.completed_at = datetime.now(timezone.utc)
                step.status = "skipped"
                db.session.commit()
                break

            # Check for pause
            pause_event = ctrl.get("pause")
            if pause_event and not pause_event.is_set():
                execution.status = "paused"
                db.session.commit()
                pause_event.wait()  # Block until resumed
                execution.status = "running"
                db.session.commit()

            # Start the step
            execution.current_step_id = step.id
            step.status = "running"
            step.started_at = datetime.now(timezone.utc)
            db.session.commit()

            if step.step_type in ("manual", "approval"):
                # Wait for confirmation via API
                step.status = "waiting"
                step.output = f"Awaiting manual confirmation from operator..."
                db.session.commit()

                # Poll for confirmation (check every second, timeout 10 min)
                timeout = 600
                elapsed = 0
                while elapsed < timeout:
                    if ctrl.get("stop"):
                        break
                    db.session.refresh(step)
                    if step.status == "completed":
                        break
                    time.sleep(1)
                    elapsed += 1

                if step.status != "completed":
                    if ctrl.get("stop"):
                        step.status = "skipped"
                    else:
                        step.status = "failed"
                        step.error = "Timed out waiting for manual confirmation"
                        execution.status = "failed"
                        execution.completed_at = datetime.now(timezone.utc)
                        db.session.commit()
                        break
            else:
                # Automated / notification — simulate with a delay
                sim_duration = max(2, int(step.estimated_seconds * random.uniform(0.3, 0.6)))
                # Use shorter times for demo (cap at 8 seconds per step)
                sim_duration = min(sim_duration, 8)
                time.sleep(sim_duration)

                step.output = _generate_log_output(
                    step.name, step.step_type, step.command, cluster_name
                )
                step.status = "completed"

            step.completed_at = datetime.now(timezone.utc)
            execution.completed_steps += 1
            db.session.commit()

        # Finalize
        if execution.status == "running":
            execution.status = "completed"
            execution.completed_at = datetime.now(timezone.utc)

            # Update cluster RTA
            if cluster and execution.started_at:
                duration = (execution.completed_at - execution.started_at).total_seconds() / 60
                cluster.rta_minutes = int(duration)
                cluster.last_dr_test = execution.completed_at

            db.session.commit()

        # Cleanup
        _running.pop(exec_id, None)


def start_execution(app, execution_id):
    """Start a DR execution in a background thread."""
    pause_event = threading.Event()
    pause_event.set()  # Not paused initially

    ctrl = {
        "pause": pause_event,
        "stop": False,
    }

    thread = threading.Thread(
        target=_run_execution,
        args=(app, execution_id),
        daemon=True,
    )
    ctrl["thread"] = thread
    _running[execution_id] = ctrl
    thread.start()
    return True


def pause_execution(execution_id):
    """Pause a running execution."""
    ctrl = _running.get(execution_id)
    if ctrl and ctrl.get("pause"):
        ctrl["pause"].clear()
        return True
    return False


def resume_execution(execution_id):
    """Resume a paused execution."""
    ctrl = _running.get(execution_id)
    if ctrl and ctrl.get("pause"):
        ctrl["pause"].set()
        return True
    return False


def rollback_execution(execution_id):
    """Signal a running execution to stop and rollback."""
    ctrl = _running.get(execution_id)
    if ctrl:
        ctrl["stop"] = True
        # If paused, resume so the thread can see the stop signal
        if ctrl.get("pause"):
            ctrl["pause"].set()
        return True
    return False


def is_running(execution_id):
    """Check if an execution is currently running."""
    return execution_id in _running
