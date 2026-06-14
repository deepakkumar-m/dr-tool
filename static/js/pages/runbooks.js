/**
 * K8s DR Orchestrator — Runbooks Page
 */

import { api } from "../api.js";
import { Modal } from "../components/modal.js";

export async function renderRunbooks(container) {
    container.innerHTML = `
        <div class="page-container flex-col gap-lg animate-slide-up">
            <div class="flex justify-between items-center">
                <div class="flex-col">
                    <h1 class="page-title">DR Runbook Templates</h1>
                    <p class="page-subtitle">Standardized procedures for Stretched and Split Kubernetes clusters</p>
                </div>
            </div>

            <!-- Runbook Cards Display Grid -->
            <div class="runbook-grid stagger-children" id="runbook-templates-grid">
                <!-- Loaded dynamically -->
            </div>
        </div>
    `;

    const grid = document.getElementById("runbook-templates-grid");

    const fetchRunbooks = async () => {
        try {
            const runbooks = await api.runbooks.list();
            
            if (runbooks.length === 0) {
                grid.innerHTML = `<p class="text-secondary text-center w-full">No runbook templates loaded.</p>`;
                return;
            }

            grid.innerHTML = runbooks.map(r => `
                <div class="glass-panel glass-panel-hover runbook-card" id="runbook-${r.id}">
                    <div class="flex-col mb-md">
                        <div class="flex justify-between items-center">
                            <span class="text-xs uppercase font-mono text-cyan">${r.dr_type} cluster</span>
                            <span class="badge badge-maintenance text-xs">${r.step_count} steps</span>
                        </div>
                        <h3 class="text-md font-bold mt-sm text-primary">${r.name}</h3>
                        <p class="text-xs text-secondary mt-sm" style="min-height: 48px">${r.description || 'No description provided'}</p>
                    </div>

                    <div class="flex justify-between text-xs text-secondary mb-md font-mono" style="border-top:1px dashed var(--border-subtle); padding-top:8px">
                        <span>Est. Duration:</span>
                        <span class="font-semibold text-amber">${Math.round(r.estimated_duration / 60)} minutes</span>
                    </div>

                    <div class="flex gap-sm">
                        <button class="btn btn-secondary flex-1 view-steps-btn" data-id="${r.id}">View Steps</button>
                    </div>
                </div>
            `).join("");

            // Event listeners
            grid.querySelectorAll(".view-steps-btn").forEach(btn => {
                btn.addEventListener("click", () => {
                    const id = btn.getAttribute("data-id");
                    showRunbookSteps(id);
                });
            });

        } catch (err) {
            console.error("Error fetching runbook templates:", err);
        }
    };

    fetchRunbooks();
}

async function showRunbookSteps(id) {
    try {
        const r = await api.runbooks.get(id);
        
        let stepsHtml = "";
        r.steps.forEach(s => {
            let typeLabel = s.step_type.toUpperCase();
            let typeColor = "var(--cyan)";
            if (s.step_type === "manual") typeColor = "var(--amber)";
            if (s.step_type === "approval") typeColor = "var(--purple)";
            if (s.step_type === "notification") typeColor = "var(--blue)";

            stepsHtml += `
                <div class="flex gap-md py-sm" style="border-bottom: 1px solid var(--border-subtle)">
                    <div class="font-mono text-sm text-secondary" style="min-width: 30px;">#${s.order}</div>
                    <div class="flex-col flex-1">
                        <div class="flex justify-between items-center">
                            <span class="text-sm font-bold text-white">${s.name}</span>
                            <span class="text-xs font-semibold px-xs rounded font-mono" style="border: 1px solid ${typeColor}30; background: ${typeColor}10; color: ${typeColor}">${typeLabel}</span>
                        </div>
                        <p class="text-xs text-secondary mt-xs">${s.description || 'No description'}</p>
                        ${s.command ? `<pre class="font-mono text-xs mt-xs p-xs rounded text-cyan" style="background:#02040a; overflow-x:auto">$ ${s.command}</pre>` : ""}
                    </div>
                    <div class="font-mono text-xs text-muted" style="min-width: 65px; text-align:right">est: ${s.estimated_seconds}s</div>
                </div>
            `;
        });

        const body = `
            <div class="flex-col gap-md">
                <div class="flex justify-between items-center text-xs text-secondary font-mono" style="border-bottom:1px solid var(--border-subtle); padding-bottom:8px">
                    <span>Type: ${r.dr_type.toUpperCase()}</span>
                    <span>Total Estimated: ${Math.round(r.estimated_duration / 60)}m (${r.estimated_duration}s)</span>
                </div>
                <div class="flex-col gap-sm" style="max-height: 400px; overflow-y:auto; padding-right:8px">
                    ${stepsHtml}
                </div>
            </div>
        `;

        const modal = new Modal(`Runbook Structure: ${r.name}`, body);
        modal.open();

    } catch (err) {
        console.error("Error loading runbook steps:", err);
    }
}
