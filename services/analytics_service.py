"""Analytics service — computes aggregated metrics for dashboards."""

import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from models import Cluster, Execution, ExecutionStep, db


def get_rto_compliance():
    """Return RTO vs RTA data for each cluster that has been tested."""
    clusters = Cluster.query.filter(Cluster.rta_minutes.isnot(None)).all()
    data = []
    for c in clusters:
        data.append({
            "cluster_id": c.id,
            "cluster_name": c.name,
            "region": c.region,
            "dr_type": c.dr_type,
            "rto_minutes": c.rto_minutes,
            "rta_minutes": c.rta_minutes,
            "compliant": c.rta_minutes <= c.rto_minutes if c.rta_minutes else False,
        })
    return data


def get_test_frequency():
    """Return DR test frequency per cluster (executions in last 12 months)."""
    twelve_months_ago = datetime.now(timezone.utc) - timedelta(days=365)
    executions = (
        Execution.query
        .filter(Execution.started_at >= twelve_months_ago)
        .all()
    )
    freq = defaultdict(int)
    cluster_names = {}
    for e in executions:
        freq[e.cluster_id] += 1
        if e.cluster:
            cluster_names[e.cluster_id] = e.cluster.name

    return [
        {
            "cluster_id": cid,
            "cluster_name": cluster_names.get(cid, cid),
            "test_count": count,
        }
        for cid, count in sorted(freq.items(), key=lambda x: x[1], reverse=True)
    ]


def get_success_rate():
    """Return execution success/failure breakdown."""
    executions = Execution.query.all()
    total = len(executions)
    if total == 0:
        return {"total": 0, "completed": 0, "failed": 0, "rolled_back": 0, "success_rate": 0}

    completed = sum(1 for e in executions if e.status == "completed")
    failed = sum(1 for e in executions if e.status == "failed")
    rolled_back = sum(1 for e in executions if e.status == "rolled-back")
    running = sum(1 for e in executions if e.status in ("running", "paused", "pending"))

    return {
        "total": total,
        "completed": completed,
        "failed": failed,
        "rolled_back": rolled_back,
        "running": running,
        "success_rate": round(completed / total * 100, 1) if total > 0 else 0,
    }


def get_mttr_trends():
    """Return Mean Time To Recover trends by month (last 12 months)."""
    twelve_months_ago = datetime.now(timezone.utc) - timedelta(days=365)
    executions = (
        Execution.query
        .filter(
            Execution.started_at >= twelve_months_ago,
            Execution.status == "completed",
            Execution.completed_at.isnot(None),
        )
        .all()
    )

    monthly = defaultdict(list)
    for e in executions:
        if e.started_at and e.completed_at:
            duration = (e.completed_at - e.started_at).total_seconds() / 60
            month_key = e.started_at.strftime("%Y-%m")
            monthly[month_key].append(duration)

    trends = []
    for month, durations in sorted(monthly.items()):
        trends.append({
            "month": month,
            "avg_minutes": round(sum(durations) / len(durations), 1),
            "min_minutes": round(min(durations), 1),
            "max_minutes": round(max(durations), 1),
            "count": len(durations),
        })
    return trends


def get_cluster_readiness():
    """Return a readiness score per cluster (0-100)."""
    clusters = Cluster.query.all()
    data = []
    now = datetime.now(timezone.utc)

    for c in clusters:
        score = 0

        # Health status (0-30 points)
        if c.status == "healthy":
            score += 30
        elif c.status == "degraded":
            score += 10

        # RTO compliance (0-30 points)
        if c.rta_minutes is not None and c.rta_minutes <= c.rto_minutes:
            score += 30
        elif c.rta_minutes is not None:
            # Partial credit
            ratio = c.rto_minutes / c.rta_minutes if c.rta_minutes > 0 else 0
            score += int(30 * min(ratio, 1))

        # Test recency (0-25 points)
        if c.last_dr_test:
            days_since = (now - c.last_dr_test).days
            if days_since <= 30:
                score += 25
            elif days_since <= 90:
                score += 15
            elif days_since <= 180:
                score += 5
        # else 0 — never tested

        # Has DR partner configured (0-15 points, split only)
        if c.dr_type == "stretched":
            score += 15  # Always has DR nodes
        elif c.dr_partner_id:
            score += 15

        data.append({
            "cluster_id": c.id,
            "cluster_name": c.name,
            "region": c.region,
            "dr_type": c.dr_type,
            "score": min(score, 100),
            "status": c.status,
            "last_test_days": (
                (now - c.last_dr_test).days if c.last_dr_test else None
            ),
        })

    return sorted(data, key=lambda x: x["score"], reverse=True)
