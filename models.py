"""SQLAlchemy database models for the K8s DR Orchestrator."""

import json
from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Cluster(db.Model):
    """Kubernetes cluster registered in the DR orchestrator."""

    __tablename__ = "clusters"

    id = db.Column(db.String(64), primary_key=True)
    name = db.Column(db.String(128), nullable=False, unique=True)
    region = db.Column(db.String(64), nullable=False)
    datacenter = db.Column(db.String(64), nullable=False)
    environment = db.Column(db.String(32), nullable=False, default="Production")
    dr_type = db.Column(db.String(16), nullable=False)  # "stretched" or "split"
    dr_partner_id = db.Column(db.String(64), db.ForeignKey("clusters.id"), nullable=True)
    rancher_url = db.Column(db.String(512), nullable=True)
    status = db.Column(db.String(32), nullable=False, default="healthy")
    node_count = db.Column(db.Integer, nullable=False, default=0)
    dr_node_count = db.Column(db.Integer, nullable=False, default=0)
    applications = db.Column(db.Text, nullable=False, default="[]")  # JSON list
    last_dr_test = db.Column(db.DateTime, nullable=True)
    rto_minutes = db.Column(db.Integer, nullable=False, default=240)
    rta_minutes = db.Column(db.Integer, nullable=True)
    tags = db.Column(db.Text, nullable=False, default="[]")  # JSON list

    # Relationship
    dr_partner = db.relationship("Cluster", remote_side=[id], uselist=False)
    executions = db.relationship("Execution", backref="cluster", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "region": self.region,
            "datacenter": self.datacenter,
            "environment": self.environment,
            "dr_type": self.dr_type,
            "dr_partner_id": self.dr_partner_id,
            "rancher_url": self.rancher_url,
            "status": self.status,
            "node_count": self.node_count,
            "dr_node_count": self.dr_node_count,
            "applications": json.loads(self.applications),
            "last_dr_test": self.last_dr_test.isoformat() if self.last_dr_test else None,
            "rto_minutes": self.rto_minutes,
            "rta_minutes": self.rta_minutes,
            "tags": json.loads(self.tags),
        }


class Runbook(db.Model):
    """DR runbook template defining a sequence of steps."""

    __tablename__ = "runbooks"

    id = db.Column(db.String(64), primary_key=True)
    name = db.Column(db.String(256), nullable=False)
    dr_type = db.Column(db.String(16), nullable=False)  # "stretched" or "split"
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    is_template = db.Column(db.Boolean, default=True)

    steps = db.relationship(
        "RunbookStep", backref="runbook", lazy=True, order_by="RunbookStep.order"
    )
    executions = db.relationship("Execution", backref="runbook", lazy=True)

    def to_dict(self, include_steps=False):
        data = {
            "id": self.id,
            "name": self.name,
            "dr_type": self.dr_type,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "is_template": self.is_template,
            "step_count": len(self.steps),
            "estimated_duration": sum(s.estimated_seconds for s in self.steps),
        }
        if include_steps:
            data["steps"] = [s.to_dict() for s in self.steps]
        return data


class RunbookStep(db.Model):
    """Individual step within a runbook."""

    __tablename__ = "runbook_steps"

    id = db.Column(db.String(64), primary_key=True)
    runbook_id = db.Column(db.String(64), db.ForeignKey("runbooks.id"), nullable=False)
    order = db.Column(db.Integer, nullable=False)
    name = db.Column(db.String(256), nullable=False)
    description = db.Column(db.Text, nullable=True)
    step_type = db.Column(db.String(32), nullable=False)  # automated, manual, approval, notification
    estimated_seconds = db.Column(db.Integer, nullable=False, default=60)
    command = db.Column(db.Text, nullable=True)  # Simulated command
    rollback_command = db.Column(db.Text, nullable=True)
    depends_on = db.Column(db.Text, nullable=False, default="[]")  # JSON list of step IDs

    def to_dict(self):
        return {
            "id": self.id,
            "runbook_id": self.runbook_id,
            "order": self.order,
            "name": self.name,
            "description": self.description,
            "step_type": self.step_type,
            "estimated_seconds": self.estimated_seconds,
            "command": self.command,
            "rollback_command": self.rollback_command,
            "depends_on": json.loads(self.depends_on),
        }


class Execution(db.Model):
    """A single DR execution run (instance of a runbook against a cluster)."""

    __tablename__ = "executions"

    id = db.Column(db.String(64), primary_key=True)
    runbook_id = db.Column(db.String(64), db.ForeignKey("runbooks.id"), nullable=False)
    cluster_id = db.Column(db.String(64), db.ForeignKey("clusters.id"), nullable=False)
    status = db.Column(db.String(32), nullable=False, default="pending")
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    started_by = db.Column(db.String(128), nullable=False, default="operator")
    total_steps = db.Column(db.Integer, nullable=False, default=0)
    completed_steps = db.Column(db.Integer, nullable=False, default=0)
    current_step_id = db.Column(db.String(64), nullable=True)

    execution_steps = db.relationship(
        "ExecutionStep", backref="execution", lazy=True, order_by="ExecutionStep.order"
    )

    def to_dict(self, include_steps=False):
        data = {
            "id": self.id,
            "runbook_id": self.runbook_id,
            "cluster_id": self.cluster_id,
            "runbook_name": self.runbook.name if self.runbook else None,
            "cluster_name": self.cluster.name if self.cluster else None,
            "dr_type": self.cluster.dr_type if self.cluster else None,
            "status": self.status,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "started_by": self.started_by,
            "total_steps": self.total_steps,
            "completed_steps": self.completed_steps,
            "current_step_id": self.current_step_id,
            "progress": (
                round(self.completed_steps / self.total_steps * 100)
                if self.total_steps > 0
                else 0
            ),
        }
        if include_steps:
            data["steps"] = [s.to_dict() for s in self.execution_steps]
        return data


class ExecutionStep(db.Model):
    """Status of an individual step within an execution."""

    __tablename__ = "execution_steps"

    id = db.Column(db.String(64), primary_key=True)
    execution_id = db.Column(
        db.String(64), db.ForeignKey("executions.id"), nullable=False
    )
    runbook_step_id = db.Column(
        db.String(64), db.ForeignKey("runbook_steps.id"), nullable=False
    )
    order = db.Column(db.Integer, nullable=False)
    name = db.Column(db.String(256), nullable=False)
    step_type = db.Column(db.String(32), nullable=False)
    status = db.Column(db.String(32), nullable=False, default="pending")
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    output = db.Column(db.Text, nullable=True)
    error = db.Column(db.Text, nullable=True)
    estimated_seconds = db.Column(db.Integer, nullable=False, default=60)
    command = db.Column(db.Text, nullable=True)

    runbook_step = db.relationship("RunbookStep", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "execution_id": self.execution_id,
            "runbook_step_id": self.runbook_step_id,
            "order": self.order,
            "name": self.name,
            "step_type": self.step_type,
            "status": self.status,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "output": self.output,
            "error": self.error,
            "estimated_seconds": self.estimated_seconds,
            "command": self.command,
        }


class AuditLog(db.Model):
    """Immutable audit trail entry."""

    __tablename__ = "audit_log"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    timestamp = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    user = db.Column(db.String(128), nullable=False, default="system")
    action = db.Column(db.String(128), nullable=False)
    resource_type = db.Column(db.String(64), nullable=False)
    resource_id = db.Column(db.String(64), nullable=True)
    details = db.Column(db.Text, nullable=True)  # JSON
    cluster_name = db.Column(db.String(128), nullable=True)
    severity = db.Column(db.String(16), nullable=False, default="info")  # info, warning, critical

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "user": self.user,
            "action": self.action,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "details": json.loads(self.details) if self.details else None,
            "cluster_name": self.cluster_name,
            "severity": self.severity,
        }
