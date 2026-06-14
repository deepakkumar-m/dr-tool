/**
 * K8s DR Orchestrator — Dashboard Page
 */

import { api } from "../api.js";

export async function renderDashboard(container) {
    container.innerHTML = `
        <div class="page-container flex-col gap-lg animate-slide-up">
            <div class="flex justify-between items-center">
                <div class="flex-col">
                    <h1 class="page-title">Command Center</h1>
                    <p class="page-subtitle">Real-time status overview of 70 Rancher-managed Kubernetes clusters</p>
                </div>
                <div class="flex items-center gap-sm">
                    <span class="text-xs text-secondary font-mono" id="last-refresh-time">Refreshed: Just now</span>
                    <button class="btn btn-secondary btn-icon" id="dashboard-refresh-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:18px;height:18px">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1-18 20" />
                        </svg>
                    </button>
                </div>
            </div>
            
            <!-- Hero Stats Grid -->
            <div class="hero-stats-grid" id="dashboard-stats">
                <!-- Loaded dynamically -->
            </div>

            <div class="flex-col gap-lg" style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
                <!-- Left: Cluster Health Map -->
                <div class="glass-panel flex-col">
                    <h2 class="section-title">Cluster Inventory Map (70 Clusters)</h2>
                    <p class="text-xs text-secondary mb-md">Hover over any cluster to view details. Click to view status.</p>
                    <div id="cluster-map-container" class="flex-col gap-lg">
                        <!-- Grouped by region dynamically -->
                    </div>
                </div>

                <!-- Right: Active Executions & Audit Log Summary -->
                <div class="flex-col gap-lg">
                    <!-- Active executions -->
                    <div class="glass-panel flex-col">
                        <h2 class="section-title">Active DR Workflows</h2>
                        <div class="flex-col gap-md" id="active-executions-list">
                            <p class="text-xs text-secondary">No active DR failover or failback events running.</p>
                        </div>
                    </div>
                    
                    <!-- Audit Summary -->
                    <div class="glass-panel flex-col">
                        <h2 class="section-title">Recent Activity Log</h2>
                        <div class="flex-col gap-sm" id="recent-logs-list" style="max-height: 250px; overflow-y:auto">
                            <!-- Loaded dynamically -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Refresh handler
    const loadDashboardData = async () => {
        try {
            document.getElementById("last-refresh-time").innerText = "Refreshed: Just now";
            const summary = await api.clusters.summary();
            const executions = await api.executions.list({ status: "running" });
            const auditLogs = await api.audit.list({ limit: 8 });
            const allClusters = await api.clusters.list();

            renderSummaryStats(summary);
            renderClusterMap(allClusters);
            renderActiveExecutions(executions);
            renderRecentLogs(auditLogs);
        } catch (err) {
            console.error("Error loading dashboard data:", err);
        }
    };

    loadDashboardData();

    document.getElementById("dashboard-refresh-btn").addEventListener("click", () => {
        const btn = document.getElementById("dashboard-refresh-btn");
        btn.querySelector("svg").style.animation = "spin 1s linear infinite";
        loadDashboardData().finally(() => {
            btn.querySelector("svg").style.animation = "";
        });
    });
}

function renderSummaryStats(s) {
    const statsContainer = document.getElementById("dashboard-stats");
    statsContainer.innerHTML = `
        <div class="glass-panel stat-card">
            <div class="stat-card-icon" style="background: var(--cyan-dim); color: var(--cyan)">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:24px;height:24px"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <div class="stat-card-info">
                <span class="text-2xl font-bold">${s.total}</span>
                <span class="text-xs text-secondary uppercase font-semibold">Total Clusters</span>
            </div>
        </div>
        <div class="glass-panel stat-card">
            <div class="stat-card-icon" style="background: var(--emerald-dim); color: var(--emerald)">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:24px;height:24px"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div class="stat-card-info">
                <span class="text-2xl font-bold text-emerald">${s.healthy}</span>
                <span class="text-xs text-secondary uppercase font-semibold">Healthy Clusters</span>
            </div>
        </div>
        <div class="glass-panel stat-card">
            <div class="stat-card-icon" style="background: var(--cyan-dim); color: var(--cyan)">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:24px;height:24px"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div class="stat-card-info">
                <span class="text-2xl font-bold text-cyan">${s.failover_active}</span>
                <span class="text-xs text-secondary uppercase font-semibold">Active Failovers</span>
            </div>
        </div>
        <div class="glass-panel stat-card">
            <div class="stat-card-icon" style="background: var(--amber-dim); color: var(--amber)">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:24px;height:24px"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <div class="stat-card-info">
                <span class="text-2xl font-bold text-amber">${s.rto_compliance_pct}%</span>
                <span class="text-xs text-secondary uppercase font-semibold">RTO Compliance</span>
            </div>
        </div>
    `;
}

function renderClusterMap(clusters) {
    const container = document.getElementById("cluster-map-container");
    
    // Group by region
    const regions = {};
    clusters.forEach(c => {
        if (!regions[c.region]) regions[c.region] = [];
        regions[c.region].push(c);
    });

    let mapHtml = "";
    Object.keys(regions).sort().forEach(rName => {
        const rClusters = regions[rName];
        let dotsHtml = "";
        
        rClusters.forEach(c => {
            const statusClass = `cluster-dot-${c.status}`;
            dotsHtml += `
                <div class="cluster-dot ${statusClass}" onclick="window.location.hash = '#/clusters?search=${c.name}'">
                    <div class="tooltip">
                        <strong class="text-cyan">${c.name}</strong><br/>
                        <span class="text-xs">Type: ${c.dr_type.toUpperCase()}</span><br/>
                        <span class="text-xs">Status: ${c.status}</span>
                    </div>
                </div>
            `;
        });

        mapHtml += `
            <div class="flex-col gap-xs">
                <div class="flex justify-between items-center">
                    <span class="text-xs font-semibold text-secondary font-mono">${rName} (${rClusters.length})</span>
                </div>
                <div class="cluster-health-map">
                    ${dotsHtml}
                </div>
            </div>
        `;
    });

    container.innerHTML = mapHtml;
}

function renderActiveExecutions(executions) {
    const container = document.getElementById("active-executions-list");
    
    if (executions.length === 0) {
        container.innerHTML = `<p class="text-xs text-secondary text-center">No active DR events currently running.</p>`;
        return;
    }

    let listHtml = "";
    executions.forEach(e => {
        listHtml += `
            <div class="flex-col gap-xs p-sm border rounded" style="border-color: var(--border-default); background: rgba(255,255,255,0.01)" onclick="window.location.hash = '#/execution/${e.id}'" style="cursor:pointer">
                <div class="flex justify-between items-center">
                    <span class="text-sm font-bold text-cyan">${e.cluster_name}</span>
                    <span class="text-xs font-mono text-purple">${e.progress}%</span>
                </div>
                <span class="text-xs text-secondary">${e.runbook_name}</span>
                <div class="progress-bar-container mt-xs">
                    <div class="progress-bar progress-bar-animated" style="width: ${e.progress}%"></div>
                </div>
            </div>
        `;
    });

    container.innerHTML = listHtml;
}

function renderRecentLogs(logs) {
    const container = document.getElementById("recent-logs-list");
    if (logs.length === 0) {
        container.innerHTML = `<p class="text-xs text-secondary text-center">No logs recorded.</p>`;
        return;
    }

    let logsHtml = "";
    logs.forEach(l => {
        const timeStr = new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const details = l.details ? JSON.stringify(l.details) : "";
        let colorClass = "text-secondary";
        if (l.severity === "critical") colorClass = "text-red";
        if (l.severity === "warning") colorClass = "text-amber";

        logsHtml += `
            <div class="flex justify-between text-xs gap-md py-xs" style="border-bottom: 1px solid rgba(255,255,255,0.02)">
                <span class="text-muted font-mono" style="min-width: 50px;">${timeStr}</span>
                <span class="flex-1 ${colorClass}" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${l.action}: ${details}">
                    [${l.cluster_name || 'System'}] ${l.action.replace("execution.", "").toUpperCase()} by ${l.user}
                </span>
            </div>
        `;
    });

    container.innerHTML = logsHtml;
}
