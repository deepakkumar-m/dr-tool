"""Audit trail API endpoints."""

import csv
import io
from datetime import datetime, timezone

from flask import Blueprint, Response, jsonify, request

from models import AuditLog, db

audit_bp = Blueprint("audit", __name__)


@audit_bp.route("/api/audit", methods=["GET"])
def list_audit():
    """List audit logs with optional filters."""
    query = AuditLog.query

    cluster = request.args.get("cluster")
    if cluster:
        query = query.filter(AuditLog.cluster_name.ilike(f"%{cluster}%"))

    action = request.args.get("action")
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))

    severity = request.args.get("severity")
    if severity:
        query = query.filter(AuditLog.severity == severity)

    user = request.args.get("user")
    if user:
        query = query.filter(AuditLog.user.ilike(f"%{user}%"))

    # Date range
    from_date = request.args.get("from")
    if from_date:
        try:
            dt = datetime.fromisoformat(from_date)
            query = query.filter(AuditLog.timestamp >= dt)
        except ValueError:
            pass

    to_date = request.args.get("to")
    if to_date:
        try:
            dt = datetime.fromisoformat(to_date)
            query = query.filter(AuditLog.timestamp <= dt)
        except ValueError:
            pass

    limit = request.args.get("limit", 100, type=int)
    logs = query.order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return jsonify([log.to_dict() for log in logs])


@audit_bp.route("/api/audit/export", methods=["GET"])
def export_audit():
    """Export audit logs as CSV."""
    logs = AuditLog.query.order_by(AuditLog.timestamp.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Timestamp", "User", "Action", "Resource Type",
                     "Resource ID", "Cluster", "Severity", "Details"])

    for log in logs:
        writer.writerow([
            log.id,
            log.timestamp.isoformat() if log.timestamp else "",
            log.user,
            log.action,
            log.resource_type,
            log.resource_id or "",
            log.cluster_name or "",
            log.severity,
            log.details or "",
        ])

    csv_data = output.getvalue()
    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_trail.csv"},
    )
