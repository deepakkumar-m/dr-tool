"""Audit trail service — logs every DR action."""

import json
from datetime import datetime, timezone

from models import AuditLog, db


def log_event(action, resource_type, resource_id=None, user="system",
              details=None, cluster_name=None, severity="info"):
    """Create an immutable audit log entry."""
    entry = AuditLog(
        timestamp=datetime.now(timezone.utc),
        user=user,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=json.dumps(details) if details else None,
        cluster_name=cluster_name,
        severity=severity,
    )
    db.session.add(entry)
    db.session.commit()
    return entry
