/**
 * K8s DR Orchestrator — Clusters Inventory Page
 */

import { api } from "../api.js";
import { createClusterCard } from "../components/cluster-card.js";
import { Modal } from "../components/modal.js";

export async function renderClusters(container, queryParams = {}) {
    container.innerHTML = `
        <div class="page-container flex-col gap-lg animate-slide-up">
            <div class="flex justify-between items-center flex-wrap gap-md">
                <div class="flex-col">
                    <h1 class="page-title">Cluster Inventory</h1>
                    <p class="page-subtitle">Manage and trigger DR workflows across all registered clusters</p>
                </div>
                <div class="flex items-center gap-sm">
                    <span class="text-xs text-muted" id="total-results-count">Showing 0 clusters</span>
                </div>
            </div>

            <!-- Filter Controls -->
            <div class="glass-panel filter-bar">
                <div class="flex gap-md flex-wrap items-center flex-1">
                    <div class="form-group mb-0" style="min-width: 180px;">
                        <input type="text" id="cluster-search-input" class="form-input" placeholder="Search by name..." value="${queryParams.search || ''}" style="width:100%"/>
                    </div>
                    
                    <div class="form-group mb-0">
                        <select id="filter-region" class="form-select">
                            <option value="">All Regions</option>
                            <option value="US-East">US-East</option>
                            <option value="US-West">US-West</option>
                            <option value="Canada-Central">Canada-Central</option>
                            <option value="EU-West">EU-West</option>
                            <option value="APAC-Southeast">APAC-Southeast</option>
                        </select>
                    </div>

                    <div class="form-group mb-0">
                        <select id="filter-dr-type" class="form-select">
                            <option value="">All DR Types</option>
                            <option value="stretched">Stretched</option>
                            <option value="split">Split</option>
                        </select>
                    </div>

                    <div class="form-group mb-0">
                        <select id="filter-status" class="form-select">
                            <option value="">All Statuses</option>
                            <option value="healthy">Healthy</option>
                            <option value="degraded">Degraded</option>
                            <option value="failover-active">Failover Active</option>
                            <option value="maintenance">Maintenance</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Grid Container -->
            <div class="cluster-grid stagger-children" id="clusters-display-grid">
                <!-- Loaded dynamically -->
            </div>
        </div>
    `;

    const grid = document.getElementById("clusters-display-grid");
    const countLabel = document.getElementById("total-results-count");
    
    // Filters elements
    const searchInput = document.getElementById("cluster-search-input");
    const regionSelect = document.getElementById("filter-region");
    const drSelect = document.getElementById("filter-dr-type");
    const statusSelect = document.getElementById("filter-status");

    let allClustersList = [];

    const fetchAndFilter = async () => {
        const filters = {
            search: searchInput.value.trim(),
            region: regionSelect.value,
            dr_type: drSelect.value,
            status: statusSelect.value,
        };

        try {
            allClustersList = await api.clusters.list(filters);
            countLabel.innerText = `Showing ${allClustersList.length} clusters`;
            
            if (allClustersList.length === 0) {
                grid.innerHTML = `<div class="w-full text-center py-lg"><p class="text-secondary">No clusters match your filter criteria.</p></div>`;
                return;
            }

            grid.innerHTML = allClustersList.map(c => createClusterCard(c)).join("");
            
            // Attach card events
            attachCardEventListeners();
        } catch (err) {
            console.error("Error loading clusters list:", err);
        }
    };

    const attachCardEventListeners = () => {
        // Details btn click
        grid.querySelectorAll(".view-details-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const cluster = allClustersList.find(c => c.id === id);
                if (cluster) showClusterDetails(cluster);
            });
        });

        // Failover btn click
        grid.querySelectorAll(".start-dr-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const cluster = allClustersList.find(c => c.id === id);
                if (cluster) showFailoverTriggerDialog(cluster);
            });
        });
    };

    // Listen to filters change
    [regionSelect, drSelect, statusSelect].forEach(el => {
        el.addEventListener("change", fetchAndFilter);
    });

    let searchTimeout = null;
    searchInput.addEventListener("input", () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(fetchAndFilter, 300);
    });

    // Listen to globalSearch event (from top header search bar)
    window.addEventListener("globalSearch", (e) => {
        searchInput.value = e.detail;
        fetchAndFilter();
    });

    // Initial fetch
    fetchAndFilter();
}

function showClusterDetails(cluster) {
    const appsHtml = cluster.applications.map(a => `<span class="cluster-app-tag font-mono text-xs">${a}</span>`).join(" ");
    const tagsHtml = cluster.tags.map(t => `<span class="badge badge-maintenance text-xs">${t}</span>`).join(" ");

    const body = `
        <div class="flex-col gap-md">
            <div class="flex justify-between items-center" style="border-bottom:1px solid var(--border-subtle); padding-bottom:12px">
                <span class="text-xs text-secondary font-mono">${cluster.region} / ${cluster.datacenter}</span>
                <span class="badge badge-${cluster.status}"><span class="badge-dot"></span>${cluster.status}</span>
            </div>
            
            <div class="flex-col gap-sm text-sm">
                <div class="flex justify-between">
                    <span class="text-secondary">Rancher Cluster URL:</span>
                    <a href="${cluster.rancher_url}" target="_blank" class="font-mono text-xs text-cyan">${cluster.rancher_url}</a>
                </div>
                <div class="flex justify-between">
                    <span class="text-secondary">DR Type Pattern:</span>
                    <span class="font-bold text-cyan text-xs uppercase">${cluster.dr_type}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-secondary">Node Count (PROD):</span>
                    <span class="font-mono">${cluster.node_count} nodes</span>
                </div>
                ${cluster.dr_type === 'stretched' ? `
                <div class="flex justify-between">
                    <span class="text-secondary">DR Node Count:</span>
                    <span class="font-mono text-cyan">${cluster.dr_node_count} nodes</span>
                </div>` : `
                <div class="flex justify-between">
                    <span class="text-secondary">DR Partner Cluster ID:</span>
                    <span class="font-mono text-purple">${cluster.dr_partner_id || 'None configured'}</span>
                </div>`}
                <div class="flex justify-between">
                    <span class="text-secondary">RTO SLA Target:</span>
                    <span class="font-semibold text-amber">${cluster.rto_minutes} minutes</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-secondary">Last Recorded RTA:</span>
                    <span class="font-semibold text-emerald">${cluster.rta_minutes ? `${cluster.rta_minutes} minutes` : 'Never tested'}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-secondary">Last DR Test Run:</span>
                    <span class="font-mono text-xs">${cluster.last_dr_test ? new Date(cluster.last_dr_test).toLocaleString() : 'N/A'}</span>
                </div>
            </div>

            <div class="flex-col gap-xs mt-md">
                <span class="text-xs text-secondary font-semibold">Associated Applications:</span>
                <div class="flex gap-sm flex-wrap mt-xs">${appsHtml}</div>
            </div>

            <div class="flex-col gap-xs mt-md">
                <span class="text-xs text-secondary font-semibold">Assigned Tiers & Compliance Tags:</span>
                <div class="flex gap-sm flex-wrap mt-xs">${tagsHtml}</div>
            </div>
        </div>
    `;

    const modal = new Modal(`Cluster Details: ${cluster.name}`, body);
    modal.open();
}

async function showFailoverTriggerDialog(cluster) {
    try {
        // Fetch runbooks matching this cluster DR type
        const runbooksList = await api.runbooks.list();
        const compatibleRunbooks = runbooksList.filter(r => r.dr_type === cluster.dr_type);

        if (compatibleRunbooks.length === 0) {
            window.showToast("No compatible runbook templates found for cluster type: " + cluster.dr_type, "warning");
            return;
        }

        const runbookOptions = compatibleRunbooks.map(r => `
            <option value="${r.id}">${r.name} (~${Math.round(r.estimated_duration / 60)} mins, ${r.step_count} steps)</option>
        `).join("");

        const body = `
            <div class="flex-col gap-md">
                <div class="flex-col gap-xs" style="border-bottom: 1px solid var(--border-subtle); padding-bottom:12px">
                    <p class="text-sm text-secondary">You are initiating a DR Failover workflow for the cluster:</p>
                    <h4 class="text-md font-bold text-white">${cluster.name} (${cluster.dr_type.toUpperCase()})</h4>
                </div>
                
                <div class="form-group mt-sm">
                    <label class="form-label">Select Execution Runbook Template</label>
                    <select id="trigger-runbook-id" class="form-select">
                        ${runbookOptions}
                    </select>
                </div>

                <div class="p-sm rounded mt-sm" style="background: rgba(239, 68, 68, 0.05); border:1px solid rgba(239, 68, 68, 0.2)">
                    <span class="text-xs font-bold text-red">⚠️ CRITICAL ACTION WARNING</span>
                    <p class="text-xs text-secondary mt-xs">
                        Running this workflow will change the cluster status to failover-active. In a non-demo environment, this cordons cluster nodes or scales down production services. Please verify before proceeding.
                    </p>
                </div>
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary cancel-modal-btn">Cancel</button>
            <button class="btn btn-danger confirm-trigger-btn">Trigger Failover</button>
        `;

        const modal = new Modal("Trigger DR Activity", body, footer);
        modal.open();

        // Footer btn clicks
        modal.overlay.querySelector(".cancel-modal-btn").addEventListener("click", () => modal.close());
        modal.overlay.querySelector(".confirm-trigger-btn").addEventListener("click", async () => {
            const runbookId = document.getElementById("trigger-runbook-id").value;
            modal.close();
            
            try {
                window.showToast("Starting execution workflow...", "info");
                const execution = await api.executions.start(runbookId, cluster.id);
                window.showToast("DR failover workflow launched!", "success");
                
                // Navigate to execution view
                window.location.hash = `#/execution/${execution.id}`;
            } catch (err) {
                console.error("Error triggering failover:", err);
            }
        });

    } catch (err) {
        console.error("Error preparing failover trigger:", err);
    }
}
