"""Seed the database with 70 mock Kubernetes clusters, 4 runbook templates, and historical executions."""

import json
import random
import uuid
from datetime import datetime, timedelta, timezone

from models import (
    AuditLog,
    Cluster,
    Execution,
    ExecutionStep,
    Runbook,
    RunbookStep,
    db,
)

# ---------------------------------------------------------------------------
# Region / datacenter definitions
# ---------------------------------------------------------------------------
REGIONS = [
    {"region": "US-East", "dc": "DC-USE1", "prefix": "use1"},
    {"region": "US-West", "dc": "DC-USW2", "prefix": "usw2"},
    {"region": "Canada-Central", "dc": "DC-CAC1", "prefix": "cac1"},
    {"region": "EU-West", "dc": "DC-EUW1", "prefix": "euw1"},
    {"region": "APAC-Southeast", "dc": "DC-APS1", "prefix": "aps1"},
]

APP_POOL = [
    "payments-api",
    "auth-service",
    "gateway-proxy",
    "account-mgmt",
    "notification-svc",
    "fraud-detection",
    "reporting-engine",
    "card-processing",
    "loan-origination",
    "mobile-backend",
    "web-frontend",
    "batch-processor",
    "data-pipeline",
    "compliance-svc",
    "audit-trail-svc",
    "customer-portal",
    "merchant-portal",
    "fx-rates-engine",
    "risk-calculator",
    "document-mgmt",
]

TIERS = ["tier-1", "tier-2", "tier-3"]
TAGS_POOL = ["pci-compliant", "sox-compliant", "gdpr", "hipaa", "internal", "external-facing"]


def _uid():
    return str(uuid.uuid4())[:8]


def seed_clusters():
    """Create 70 clusters: ~40 stretched, ~30 split."""
    clusters = []
    idx = 1

    # Distribute across regions
    distribution = [
        ("US-East", 20),
        ("US-West", 16),
        ("Canada-Central", 14),
        ("EU-West", 12),
        ("APAC-Southeast", 8),
    ]

    for region_name, count in distribution:
        region_info = next(r for r in REGIONS if r["region"] == region_name)
        for i in range(count):
            cluster_id = f"cluster-{idx:03d}"
            app_name = random.choice(
                [
                    "payments",
                    "auth",
                    "gateway",
                    "accounts",
                    "fraud",
                    "reporting",
                    "cards",
                    "loans",
                    "mobile",
                    "portal",
                    "batch",
                    "compliance",
                    "fx",
                    "risk",
                ]
            )

            # First ~57% are stretched, rest are split
            is_stretched = idx <= 40
            dr_type = "stretched" if is_stretched else "split"

            name = f"prod-{region_info['prefix']}-{app_name}-{i + 1:02d}"
            node_count = random.randint(6, 24)
            dr_node_count = random.randint(2, 6) if is_stretched else 0

            # Random applications (3-7)
            apps = random.sample(APP_POOL, random.randint(3, 7))

            # Random last DR test (within last 6 months, some never tested)
            if random.random() > 0.1:
                days_ago = random.randint(1, 180)
                last_test = datetime.now(timezone.utc) - timedelta(days=days_ago)
            else:
                last_test = None

            tier = random.choice(TIERS)
            rto = {"tier-1": 30, "tier-2": 120, "tier-3": 240}[tier]
            rta = (
                random.randint(int(rto * 0.5), int(rto * 1.5))
                if last_test
                else None
            )

            tags = [tier] + random.sample(TAGS_POOL, random.randint(1, 3))

            status_weights = ["healthy"] * 85 + ["degraded"] * 10 + ["maintenance"] * 5
            status = random.choice(status_weights)

            cluster = Cluster(
                id=cluster_id,
                name=name,
                region=region_name,
                datacenter=region_info["dc"],
                environment="Production",
                dr_type=dr_type,
                dr_partner_id=None,  # Set later for split clusters
                rancher_url=f"https://rancher.internal.example.com/c/{cluster_id}",
                status=status,
                node_count=node_count,
                dr_node_count=dr_node_count,
                applications=json.dumps(apps),
                last_dr_test=last_test,
                rto_minutes=rto,
                rta_minutes=rta,
                tags=json.dumps(tags),
            )
            clusters.append(cluster)
            idx += 1

    # Create DR partner mappings for split clusters
    split_clusters = [c for c in clusters if c.dr_type == "split"]
    for i in range(0, len(split_clusters) - 1, 2):
        split_clusters[i].dr_partner_id = split_clusters[i + 1].id
        split_clusters[i + 1].dr_partner_id = split_clusters[i].id

    return clusters


def seed_runbooks():
    """Create 4 runbook templates."""
    runbooks = []
    all_steps = []

    # -----------------------------------------------------------------------
    # 1. Stretched Cluster Failover
    # -----------------------------------------------------------------------
    rb1_id = "rb-stretched-failover"
    rb1 = Runbook(
        id=rb1_id,
        name="Stretched Cluster Failover",
        dr_type="stretched",
        description="Failover a stretched cluster by cordoning production nodes, allowing workloads to migrate to DR nodes within the same cluster.",
        is_template=True,
    )
    rb1_steps = [
        ("Pre-flight cluster health check", "automated", 30,
         "kubectl get nodes -o wide && kubectl get pods --all-namespaces | grep -v Running",
         "Validate cluster health, check node readiness and pod status across all namespaces"),
        ("Notify stakeholders — DR activity starting", "notification", 10,
         "Send notification to #dr-ops Slack channel and email DL-DR-Team",
         "Alert all stakeholders that DR failover is commencing"),
        ("Verify DR nodes are ready", "automated", 20,
         "kubectl get nodes -l node-role=dr -o json | jq '.items[].status.conditions[] | select(.type==\"Ready\")'",
         "Ensure all DR-labeled nodes are in Ready state with sufficient resources"),
        ("Cordon production nodes", "automated", 45,
         "kubectl cordon -l node-role=production",
         "Mark all production nodes as unschedulable to prevent new pod scheduling"),
        ("Wait for pod migration to DR nodes", "automated", 120,
         "kubectl rollout restart deployment --all -n production && kubectl rollout status deployment --all -n production --timeout=300s",
         "Trigger rolling restart and wait for all deployments to reschedule on DR nodes"),
        ("Validate application health on DR nodes", "manual", 60,
         "Run health checks on all applications, verify endpoints respond correctly",
         "Manual verification that all application health endpoints return 200 OK"),
        ("Update monitoring and alerting rules", "automated", 20,
         "kubectl apply -f monitoring/dr-alerting-rules.yaml && curl -X POST http://prometheus:9090/-/reload",
         "Switch monitoring to DR-mode alerting thresholds"),
        ("Post-failover validation complete", "notification", 10,
         "Send completion notification to #dr-ops with RTA metrics",
         "Notify all stakeholders that DR failover completed successfully"),
    ]
    for i, (name, stype, dur, cmd, desc) in enumerate(rb1_steps):
        step = RunbookStep(
            id=f"{rb1_id}-step-{i + 1:02d}",
            runbook_id=rb1_id,
            order=i + 1,
            name=name,
            description=desc,
            step_type=stype,
            estimated_seconds=dur,
            command=cmd,
            rollback_command=None,
            depends_on=json.dumps([]),
        )
        all_steps.append(step)
    runbooks.append(rb1)

    # -----------------------------------------------------------------------
    # 2. Split Cluster Failover
    # -----------------------------------------------------------------------
    rb2_id = "rb-split-failover"
    rb2 = Runbook(
        id=rb2_id,
        name="Split Cluster Failover",
        dr_type="split",
        description="Failover from a production cluster to a separate DR cluster by stopping production workloads, switching ingress, and starting DR cluster workloads.",
        is_template=True,
    )
    rb2_steps = [
        ("Pre-flight checks — both clusters", "automated", 45,
         "kubectl --context=prod get nodes && kubectl --context=dr get nodes",
         "Validate health of both production and DR clusters"),
        ("Notify stakeholders — DR activity starting", "notification", 10,
         "Send notification to #dr-ops Slack channel",
         "Alert stakeholders that split cluster DR failover is commencing"),
        ("Verify DR cluster readiness", "automated", 30,
         "kubectl --context=dr get nodes -o wide && kubectl --context=dr top nodes",
         "Check DR cluster node readiness and available resources"),
        ("Scale down production deployments", "automated", 60,
         "kubectl --context=prod scale deployment --all --replicas=0 -n production",
         "Scale all production deployments to zero replicas"),
        ("Disable production ingress", "automated", 30,
         "kubectl --context=prod delete ingress --all -n production",
         "Remove all ingress rules from production cluster to stop incoming traffic"),
        ("Verify production traffic stopped", "manual", 45,
         "Confirm no active connections to production endpoints via monitoring dashboard",
         "Manual check that all production traffic has fully drained"),
        ("Enable DR cluster ingress", "automated", 30,
         "kubectl --context=dr apply -f ingress/dr-ingress-rules.yaml -n production",
         "Apply ingress rules to DR cluster to start accepting traffic"),
        ("Scale up DR deployments", "automated", 90,
         "kubectl --context=dr scale deployment --all --replicas=3 -n production && kubectl --context=dr rollout status deployment --all -n production --timeout=600s",
         "Scale up all deployments on DR cluster and wait for rollout completion"),
        ("Validate application health on DR cluster", "manual", 60,
         "Run end-to-end health checks against DR cluster endpoints",
         "Manual verification of all application health endpoints on DR cluster"),
        ("DNS / traffic switch verification", "automated", 30,
         "dig +short app.example.com && curl -s -o /dev/null -w '%{http_code}' https://app.example.com/health",
         "Verify DNS resolution points to DR cluster and health check passes"),
        ("Update monitoring and alerting", "automated", 20,
         "kubectl --context=dr apply -f monitoring/dr-alerting-rules.yaml",
         "Switch monitoring to DR cluster targets and alerting rules"),
        ("Post-failover validation complete", "notification", 10,
         "Send completion notification with RTA metrics and summary",
         "Notify all stakeholders that split cluster DR failover completed"),
    ]
    for i, (name, stype, dur, cmd, desc) in enumerate(rb2_steps):
        step = RunbookStep(
            id=f"{rb2_id}-step-{i + 1:02d}",
            runbook_id=rb2_id,
            order=i + 1,
            name=name,
            description=desc,
            step_type=stype,
            estimated_seconds=dur,
            command=cmd,
            rollback_command=None,
            depends_on=json.dumps([]),
        )
        all_steps.append(step)
    runbooks.append(rb2)

    # -----------------------------------------------------------------------
    # 3. Stretched Cluster Failback
    # -----------------------------------------------------------------------
    rb3_id = "rb-stretched-failback"
    rb3 = Runbook(
        id=rb3_id,
        name="Stretched Cluster Failback",
        dr_type="stretched",
        description="Return a stretched cluster from DR mode back to production nodes by uncordoning production nodes and migrating workloads back.",
        is_template=True,
    )
    rb3_steps = [
        ("Pre-flight — verify production nodes health", "automated", 30,
         "kubectl get nodes -l node-role=production -o json | jq '.items[].status.conditions[] | select(.type==\"Ready\")'",
         "Validate all production nodes are healthy and ready to accept workloads"),
        ("Notify stakeholders — failback starting", "notification", 10,
         "Send notification to #dr-ops Slack channel",
         "Alert stakeholders that failback to production is commencing"),
        ("Uncordon production nodes", "automated", 30,
         "kubectl uncordon -l node-role=production",
         "Mark production nodes as schedulable again"),
        ("Drain DR nodes gracefully", "automated", 120,
         "kubectl drain -l node-role=dr --ignore-daemonsets --delete-emptydir-data --grace-period=60",
         "Gracefully drain DR nodes to migrate pods back to production nodes"),
        ("Validate applications on production nodes", "manual", 60,
         "Verify all applications are healthy on production nodes",
         "Manual verification that all services are running correctly on production nodes"),
        ("Restore production monitoring rules", "automated", 20,
         "kubectl apply -f monitoring/prod-alerting-rules.yaml",
         "Switch monitoring back to production-mode alerting thresholds"),
        ("Failback complete — notify stakeholders", "notification", 10,
         "Send failback completion notification with metrics",
         "Notify all stakeholders that failback to production completed successfully"),
    ]
    for i, (name, stype, dur, cmd, desc) in enumerate(rb3_steps):
        step = RunbookStep(
            id=f"{rb3_id}-step-{i + 1:02d}",
            runbook_id=rb3_id,
            order=i + 1,
            name=name,
            description=desc,
            step_type=stype,
            estimated_seconds=dur,
            command=cmd,
            rollback_command=None,
            depends_on=json.dumps([]),
        )
        all_steps.append(step)
    runbooks.append(rb3)

    # -----------------------------------------------------------------------
    # 4. Split Cluster Failback
    # -----------------------------------------------------------------------
    rb4_id = "rb-split-failback"
    rb4 = Runbook(
        id=rb4_id,
        name="Split Cluster Failback",
        dr_type="split",
        description="Return from DR cluster back to the production cluster by stopping DR workloads, switching ingress back, and starting production workloads.",
        is_template=True,
    )
    rb4_steps = [
        ("Pre-flight — verify production cluster health", "automated", 45,
         "kubectl --context=prod get nodes && kubectl --context=prod top nodes",
         "Validate production cluster is healthy and has resources available"),
        ("Notify stakeholders — failback starting", "notification", 10,
         "Send failback notification to #dr-ops",
         "Alert stakeholders that failback to production cluster is commencing"),
        ("Scale up production deployments", "automated", 90,
         "kubectl --context=prod scale deployment --all --replicas=3 -n production && kubectl --context=prod rollout status deployment --all -n production",
         "Scale up production cluster deployments and wait for rollout"),
        ("Validate production applications", "manual", 60,
         "Verify production application health endpoints",
         "Manual verification that all services are healthy on production cluster"),
        ("Switch ingress back to production", "automated", 30,
         "kubectl --context=prod apply -f ingress/prod-ingress-rules.yaml -n production",
         "Apply production ingress rules to route traffic back to production"),
        ("Disable DR cluster ingress", "automated", 30,
         "kubectl --context=dr delete ingress --all -n production",
         "Remove ingress from DR cluster to stop it receiving traffic"),
        ("Scale down DR deployments", "automated", 45,
         "kubectl --context=dr scale deployment --all --replicas=0 -n production",
         "Scale DR cluster deployments to zero"),
        ("DNS / traffic verification", "automated", 30,
         "dig +short app.example.com && curl -s -o /dev/null -w '%{http_code}' https://app.example.com/health",
         "Verify DNS points back to production cluster"),
        ("Restore production monitoring", "automated", 20,
         "kubectl --context=prod apply -f monitoring/prod-alerting-rules.yaml",
         "Switch monitoring back to production targets"),
        ("Failback complete — notify stakeholders", "notification", 10,
         "Send failback completion notification",
         "Notify all stakeholders that failback completed successfully"),
    ]
    for i, (name, stype, dur, cmd, desc) in enumerate(rb4_steps):
        step = RunbookStep(
            id=f"{rb4_id}-step-{i + 1:02d}",
            runbook_id=rb4_id,
            order=i + 1,
            name=name,
            description=desc,
            step_type=stype,
            estimated_seconds=dur,
            command=cmd,
            rollback_command=None,
            depends_on=json.dumps([]),
        )
        all_steps.append(step)
    runbooks.append(rb4)

    return runbooks, all_steps


def seed_historical_executions(clusters, runbooks):
    """Create 20 historical executions with completed step data for analytics."""
    executions = []
    exec_steps = []
    audit_entries = []

    stretched_rb = next(r for r in runbooks if r.id == "rb-stretched-failover")
    split_rb = next(r for r in runbooks if r.id == "rb-split-failover")
    stretched_fb = next(r for r in runbooks if r.id == "rb-stretched-failback")
    split_fb = next(r for r in runbooks if r.id == "rb-split-failback")

    users = ["deepak", "admin", "operator-1", "operator-2", "sre-lead"]

    for i in range(20):
        cluster = random.choice(clusters)
        if cluster.dr_type == "stretched":
            rb = random.choice([stretched_rb, stretched_fb])
        else:
            rb = random.choice([split_rb, split_fb])

        days_ago = random.randint(5, 365)
        started = datetime.now(timezone.utc) - timedelta(days=days_ago, hours=random.randint(0, 12))

        # 85% success, 10% completed with warnings, 5% failed
        roll = random.random()
        if roll < 0.85:
            exec_status = "completed"
        elif roll < 0.95:
            exec_status = "completed"
        else:
            exec_status = "failed"

        rb_steps = [s for s in RunbookStep.query.filter_by(runbook_id=rb.id).all()] if False else []
        # We need to get steps from our local list since DB isn't populated yet
        local_steps = [s for s in seed_runbooks.__defaults__[0]] if False else []

        exec_id = f"exec-hist-{i + 1:03d}"
        step_count = rb.to_dict()["step_count"] if hasattr(rb, "steps") and rb.steps else 8

        # Since we haven't committed yet, count steps from the seed data
        runbook_steps_map = {}
        for rs in seed_historical_executions._all_steps:
            if rs.runbook_id == rb.id:
                runbook_steps_map[rs.order] = rs

        completed_count = len(runbook_steps_map) if exec_status != "failed" else random.randint(1, len(runbook_steps_map) - 1)
        step_time = started

        for order_num, rs in sorted(runbook_steps_map.items()):
            is_completed = order_num <= completed_count
            duration = int(rs.estimated_seconds * random.uniform(0.6, 1.4))
            step_start = step_time
            step_end = step_start + timedelta(seconds=duration) if is_completed else None

            es = ExecutionStep(
                id=f"{exec_id}-step-{order_num:02d}",
                execution_id=exec_id,
                runbook_step_id=rs.id,
                order=order_num,
                name=rs.name,
                step_type=rs.step_type,
                status="completed" if is_completed else ("failed" if order_num == completed_count + 1 and exec_status == "failed" else "pending"),
                started_at=step_start if is_completed or (order_num == completed_count + 1) else None,
                completed_at=step_end,
                output=f"Step completed successfully in {duration}s" if is_completed else None,
                error="Timeout waiting for pod readiness" if (not is_completed and order_num == completed_count + 1 and exec_status == "failed") else None,
                estimated_seconds=rs.estimated_seconds,
                command=rs.command,
            )
            exec_steps.append(es)
            if is_completed:
                step_time = step_end

        total_duration = (step_time - started).total_seconds() / 60
        completed_at = step_time if exec_status == "completed" else (step_time + timedelta(minutes=5) if exec_status == "failed" else None)

        execution = Execution(
            id=exec_id,
            runbook_id=rb.id,
            cluster_id=cluster.id,
            status=exec_status,
            started_at=started,
            completed_at=completed_at,
            started_by=random.choice(users),
            total_steps=len(runbook_steps_map),
            completed_steps=completed_count,
            current_step_id=None,
        )
        executions.append(execution)

        # Update cluster RTA if this execution is more recent than last_dr_test
        if exec_status == "completed" and (cluster.last_dr_test is None or started > cluster.last_dr_test):
            cluster.last_dr_test = started
            cluster.rta_minutes = int(total_duration)

        # Audit entries
        audit_entries.append(AuditLog(
            timestamp=started,
            user=execution.started_by,
            action=f"execution.started",
            resource_type="execution",
            resource_id=exec_id,
            details=json.dumps({"runbook": rb.name, "cluster": cluster.name}),
            cluster_name=cluster.name,
            severity="info",
        ))
        if completed_at:
            audit_entries.append(AuditLog(
                timestamp=completed_at,
                user="system",
                action=f"execution.{exec_status}",
                resource_type="execution",
                resource_id=exec_id,
                details=json.dumps({
                    "runbook": rb.name,
                    "cluster": cluster.name,
                    "duration_minutes": round(total_duration, 1),
                }),
                cluster_name=cluster.name,
                severity="info" if exec_status == "completed" else "critical",
            ))

    return executions, exec_steps, audit_entries


def seed_database():
    """Main seed function — call after db.create_all()."""
    # Check if already seeded
    if Cluster.query.first() is not None:
        return False

    print("🌱 Seeding database...")

    # 1. Clusters
    clusters = seed_clusters()
    for c in clusters:
        db.session.add(c)
    print(f"   ✅ Created {len(clusters)} clusters")

    # 2. Runbooks + Steps
    runbooks, steps = seed_runbooks()
    for rb in runbooks:
        db.session.add(rb)
    for s in steps:
        db.session.add(s)
    print(f"   ✅ Created {len(runbooks)} runbook templates with {len(steps)} steps")

    # 3. Historical executions
    # Store all steps reference for the historical execution builder
    seed_historical_executions._all_steps = steps
    executions, exec_steps, audit_entries = seed_historical_executions(clusters, runbooks)
    for e in executions:
        db.session.add(e)
    for es in exec_steps:
        db.session.add(es)
    for a in audit_entries:
        db.session.add(a)
    print(f"   ✅ Created {len(executions)} historical executions")
    print(f"   ✅ Created {len(audit_entries)} audit log entries")

    db.session.commit()
    print("🎉 Database seeded successfully!")
    return True
