/**
 * K8s DR Orchestrator — Audit Trail Page
 */

import { api } from "../api.js";

export async function renderAudit(container) {
    container.innerHTML = `
        <div class="page-container flex-col gap-lg animate-slide-up">
            <div class="flex justify-between items-center flex-wrap gap-md">
                <div class="flex-col">
                    <h1 class="page-title">Compliance Audit Trail</h1>
                    <p class="page-subtitle">Immutable ledger recording all system-triggered and human-authorized DR activities</p>
                </div>
                <div class="flex items-center gap-sm">
                    <button class="btn btn-primary" id="audit-export-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:16px;height:16px">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export CSV
                    </button>
                </div>
            </div>

            <!-- Filters -->
            <div class="glass-panel filter-bar">
                <div class="flex gap-md flex-wrap items-center flex-1">
                    <div class="form-group mb-0">
                        <input type="text" id="audit-search-cluster" class="form-input" placeholder="Filter by cluster..."/>
                    </div>
                    <div class="form-group mb-0">
                        <select id="audit-filter-severity" class="form-select">
                            <option value="">All Severities</option>
                            <option value="info">Info</option>
                            <option value="warning">Warning</option>
                            <option value="critical">Critical</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Table View -->
            <div class="glass-panel" style="padding:0">
                <div class="audit-table-container">
                    <table class="audit-table">
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>User</th>
                                <th>Action</th>
                                <th>Target Cluster</th>
                                <th>Severity</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody id="audit-tbody">
                            <!-- Loaded dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    const tbody = document.getElementById("audit-tbody");
    const searchInput = document.getElementById("audit-search-cluster");
    const severitySelect = document.getElementById("audit-filter-severity");
    const exportBtn = document.getElementById("audit-export-btn");

    const fetchLogs = async () => {
        const filters = {
            cluster: searchInput.value.trim(),
            severity: severitySelect.value,
            limit: 50,
        };

        try {
            const logs = await api.audit.list(filters);
            
            if (logs.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center text-secondary py-lg">No audit events found matching filters.</td></tr>`;
                return;
            }

            tbody.innerHTML = logs.map(l => {
                const ts = new Date(l.timestamp).toLocaleString();
                const detailsStr = l.details ? JSON.stringify(l.details) : "";
                
                let sevColor = "badge-maintenance";
                if (l.severity === "warning") sevColor = "badge-degraded";
                if (l.severity === "critical") sevColor = "badge-failed";

                return `
                    <tr>
                        <td class="font-mono text-xs">${ts}</td>
                        <td><span class="font-semibold text-white">${l.user}</span></td>
                        <td><span class="text-cyan font-mono text-xs">${l.action}</span></td>
                        <td><span class="font-mono text-xs">${l.cluster_name || 'System'}</span></td>
                        <td>
                            <span class="badge ${sevColor}">
                                <span class="badge-dot"></span>
                                ${l.severity}
                            </span>
                        </td>
                        <td class="text-secondary text-xs" style="max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${detailsStr}">
                            ${detailsStr}
                        </td>
                    </tr>
                `;
            }).join("");

        } catch (err) {
            console.error("Error loading audit trail:", err);
        }
    };

    // Filters event listeners
    let searchTimeout = null;
    searchInput.addEventListener("input", () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(fetchLogs, 300);
    });

    severitySelect.addEventListener("change", fetchLogs);

    // Export button handler
    exportBtn.addEventListener("click", () => {
        window.location.href = api.audit.exportUrl();
        window.showToast("Downloading audit trail CSV...", "success");
    });

    // Initial load
    fetchLogs();
}
