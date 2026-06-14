/**
 * K8s DR Orchestrator — SVG Chart Components
 */

export const charts = {
    /**
     * Render a Donut Chart representing success rate breakdown
     */
    renderDonut: (containerId, data) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const { completed, failed, rolled_back, total } = data;
        if (total === 0) {
            container.innerHTML = `<p class="text-secondary text-center">No data available</p>`;
            return;
        }

        // Percentages
        const compPct = (completed / total) * 100;
        const failPct = (failed / total) * 100;
        const rollPct = (rolled_back / total) * 100;

        // Circumference of radius 40 is 2 * pi * r = 251.2
        const circ = 251.2;
        const compStroke = (compPct / 100) * circ;
        const failStroke = (failPct / 100) * circ;
        const rollStroke = (rollPct / 100) * circ;

        container.innerHTML = `
            <div class="flex items-center justify-between w-full gap-lg">
                <svg width="150" height="150" viewBox="0 0 100 100" class="svg-chart">
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.05)" stroke-width="12"/>
                    <!-- Completed (Emerald) -->
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--emerald)" stroke-width="12"
                        stroke-dasharray="${compStroke} ${circ - compStroke}"
                        stroke-dashoffset="0"
                        transform="rotate(-90 50 50)"
                    />
                    <!-- Failed (Red) -->
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--red)" stroke-width="12"
                        stroke-dasharray="${failStroke} ${circ - failStroke}"
                        stroke-dashoffset="-${compStroke}"
                        transform="rotate(-90 50 50)"
                    />
                    <!-- Rolled Back (Amber) -->
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--amber)" stroke-width="12"
                        stroke-dasharray="${rollStroke} ${circ - rollStroke}"
                        stroke-dashoffset="-${compStroke + failStroke}"
                        transform="rotate(-90 50 50)"
                    />
                    <text x="50" y="55" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="700">
                        ${Math.round(compPct)}%
                    </text>
                </svg>
                <div class="flex-col gap-sm flex-1 text-sm">
                    <div class="flex items-center gap-sm">
                        <span style="width: 12px; height: 12px; border-radius: 50%; background: var(--emerald);"></span>
                        <span>Completed: <strong class="text-emerald">${completed}</strong></span>
                    </div>
                    <div class="flex items-center gap-sm">
                        <span style="width: 12px; height: 12px; border-radius: 50%; background: var(--red);"></span>
                        <span>Failed: <strong class="text-red">${failed}</strong></span>
                    </div>
                    <div class="flex items-center gap-sm">
                        <span style="width: 12px; height: 12px; border-radius: 50%; background: var(--amber);"></span>
                        <span>Rolled Back: <strong class="text-amber">${rolled_back}</strong></span>
                    </div>
                    <div class="flex items-center gap-sm mt-sm border-top pt-sm" style="border-top: 1px solid var(--border-subtle)">
                        <span>Total Executions: <strong>${total}</strong></span>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render a bar chart comparing RTO vs RTA for top clusters
     */
    renderRtoBar: (containerId, data) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Take top 8 clusters with longest RTA for display
        const displayData = data.slice(0, 8);
        if (displayData.length === 0) {
            container.innerHTML = `<p class="text-secondary text-center">No compliance data available. Run some tests first.</p>`;
            return;
        }

        const maxVal = Math.max(...displayData.map(d => Math.max(d.rto_minutes, d.rta_minutes)));
        const barHeightLimit = 160;

        let barsHtml = "";
        displayData.forEach((d) => {
            const rtoH = (d.rto_minutes / maxVal) * barHeightLimit;
            const rtaH = (d.rta_minutes / maxVal) * barHeightLimit;
            const isCompliant = d.rta_minutes <= d.rto_minutes;

            barsHtml += `
                <div class="flex-col items-center gap-sm" style="flex: 1; min-width: 40px;">
                    <div class="flex items-end gap-xs" style="height: ${barHeightLimit}px; width: 100%; justify-content: center;">
                        <!-- RTO Bar -->
                        <div class="bar-rto" style="height: ${rtoH}px; width: 10px; background: rgba(255,255,255,0.15); border-radius: 3px;" title="RTO Target: ${d.rto_minutes} min"></div>
                        <!-- RTA Bar -->
                        <div class="bar-rta" style="height: ${rtaH}px; width: 10px; background: ${isCompliant ? 'var(--emerald)' : 'var(--red)'}; border-radius: 3px; box-shadow: 0 0 10px ${isCompliant ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'};" title="Actual RTA: ${d.rta_minutes} min"></div>
                    </div>
                    <span class="text-xs text-secondary text-center font-mono" style="max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${d.cluster_name.split("-").slice(-2).join("-")}
                    </span>
                </div>
            `;
        });

        container.innerHTML = `
            <div class="flex-col w-full h-full justify-between">
                <div class="flex items-end justify-between gap-md w-full" style="height: ${barHeightLimit}px;">
                    ${barsHtml}
                </div>
                <div class="flex justify-center gap-lg mt-md text-xs text-secondary pt-sm" style="border-top: 1px solid var(--border-subtle)">
                    <div class="flex items-center gap-xs">
                        <span style="display:inline-block; width: 8px; height: 8px; background: rgba(255,255,255,0.25); border-radius: 2px;"></span>
                        <span>RTO Target (Objective)</span>
                    </div>
                    <div class="flex items-center gap-xs">
                        <span style="display:inline-block; width: 8px; height: 8px; background: var(--emerald); border-radius: 2px;"></span>
                        <span>RTA Compliant (Actual)</span>
                    </div>
                    <div class="flex items-center gap-xs">
                        <span style="display:inline-block; width: 8px; height: 8px; background: var(--red); border-radius: 2px;"></span>
                        <span>RTA Breached</span>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Render a simple bar chart showing execution MTTR trends over months
     */
    renderMttrTrends: (containerId, trends) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (trends.length === 0) {
            container.innerHTML = `<p class="text-secondary text-center">No trend data available</p>`;
            return;
        }

        const maxVal = Math.max(...trends.map(t => t.avg_minutes));
        const barHeightLimit = 160;

        let barsHtml = "";
        trends.forEach((t) => {
            const h = (t.avg_minutes / maxVal) * barHeightLimit;
            barsHtml += `
                <div class="flex-col items-center gap-sm" style="flex: 1;">
                    <div class="flex items-end justify-center" style="height: ${barHeightLimit}px; width: 100%;">
                        <div style="height: ${h}px; width: 20px; background: linear-gradient(to top, var(--purple), var(--cyan)); border-radius: 3px; box-shadow: var(--shadow-glow-cyan);" title="Average MTTR: ${t.avg_minutes} min (${t.count} runs)"></div>
                    </div>
                    <span class="text-xs text-secondary font-mono">${t.month.split("-")[1]}/${t.month.split("-")[0].slice(2)}</span>
                </div>
            `;
        });

        container.innerHTML = `
            <div class="flex-col w-full h-full justify-between">
                <div class="flex items-end justify-between gap-md w-full" style="height: ${barHeightLimit}px;">
                    ${barsHtml}
                </div>
                <div class="flex justify-center gap-md mt-md text-xs text-secondary pt-sm" style="border-top: 1px solid var(--border-subtle)">
                    <span>Mean Time to Recover (MTTR) monthly averages (minutes)</span>
                </div>
            </div>
        `;
    }
};
