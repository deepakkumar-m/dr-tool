"""Cluster API endpoints."""

from flask import Blueprint, jsonify, request

from models import Cluster, db

clusters_bp = Blueprint("clusters", __name__)


@clusters_bp.route("/api/clusters", methods=["GET"])
def list_clusters():
    """List all clusters with optional filters."""
    query = Cluster.query

    # Filters
    region = request.args.get("region")
    if region:
        query = query.filter(Cluster.region == region)

    dr_type = request.args.get("dr_type")
    if dr_type:
        query = query.filter(Cluster.dr_type == dr_type)

    status = request.args.get("status")
    if status:
        query = query.filter(Cluster.status == status)

    search = request.args.get("search")
    if search:
        query = query.filter(Cluster.name.ilike(f"%{search}%"))

    clusters = query.order_by(Cluster.name).all()
    return jsonify([c.to_dict() for c in clusters])


@clusters_bp.route("/api/clusters/summary", methods=["GET"])
def cluster_summary():
    """Aggregated cluster stats for the dashboard."""
    clusters = Cluster.query.all()

    total = len(clusters)
    healthy = sum(1 for c in clusters if c.status == "healthy")
    degraded = sum(1 for c in clusters if c.status == "degraded")
    failover = sum(1 for c in clusters if c.status == "failover-active")
    maintenance = sum(1 for c in clusters if c.status == "maintenance")
    stretched = sum(1 for c in clusters if c.dr_type == "stretched")
    split = sum(1 for c in clusters if c.dr_type == "split")

    # RTO compliance
    tested = [c for c in clusters if c.rta_minutes is not None]
    compliant = sum(1 for c in tested if c.rta_minutes <= c.rto_minutes)
    compliance_pct = round(compliant / len(tested) * 100, 1) if tested else 0

    # Region breakdown
    regions = {}
    for c in clusters:
        if c.region not in regions:
            regions[c.region] = {"total": 0, "healthy": 0, "stretched": 0, "split": 0}
        regions[c.region]["total"] += 1
        if c.status == "healthy":
            regions[c.region]["healthy"] += 1
        if c.dr_type == "stretched":
            regions[c.region]["stretched"] += 1
        else:
            regions[c.region]["split"] += 1

    return jsonify({
        "total": total,
        "healthy": healthy,
        "degraded": degraded,
        "failover_active": failover,
        "maintenance": maintenance,
        "stretched": stretched,
        "split": split,
        "rto_compliance_pct": compliance_pct,
        "tested_count": len(tested),
        "regions": regions,
    })


@clusters_bp.route("/api/clusters/<cluster_id>", methods=["GET"])
def get_cluster(cluster_id):
    """Get a single cluster by ID."""
    cluster = db.session.get(Cluster, cluster_id)
    if not cluster:
        return jsonify({"error": "Cluster not found"}), 404
    return jsonify(cluster.to_dict())


@clusters_bp.route("/api/clusters/<cluster_id>", methods=["PUT"])
def update_cluster(cluster_id):
    """Update cluster metadata."""
    cluster = db.session.get(Cluster, cluster_id)
    if not cluster:
        return jsonify({"error": "Cluster not found"}), 404

    data = request.get_json()
    for field in ["status", "rto_minutes", "tags"]:
        if field in data:
            setattr(cluster, field, data[field])

    db.session.commit()
    return jsonify(cluster.to_dict())
