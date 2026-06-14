/**
 * K8s DR Orchestrator — Analytics Page
 */

import { api } from "../api.js";
import { charts } from "../components/charts.js";

export async function renderAnalytics(container) {
    container.innerHTML = `
        <div class="page-container flex-col gap-lg animate-slide-up">
            <div class="flex justify-between items-center">
                <div class="flex-col">
                    <h1 class="page-title">Analytics & Readiness</h1>
                    <p class="page-subtitle">Historical outcomes, RTO SLA metrics, and preparedness scoring</p>
                </div>
            </div>

            <div class="analytics-grid">
                <!-- Donut Chart: Success Rate -->
                <div class="glass-panel flex-col">
                    <h2 class="section-title">DR Execution Success Rate</h2>
                    <div id="chart-success-mount" class="chart-container justify-center items-center">
                        <div class="loader"></div>
                    </div>
                </div>

                <!-- RTO Compliance Bar Chart -->
                <div class="glass-panel flex-col">
                    <h2 class="section-title">RTO Compliance (Target vs. Actual)</h2>
                    <div id="chart-rto-mount" class="chart-container">
                        <div class="loader"></div>
                    </div>
                </div>

                <!-- MTTR Trend Chart -->
                <div class="glass-panel flex-col">
                    <h2 class="section-title">Mean Time to Recover (MTTR) Trends</h2>
                    <div id="chart-mttr-mount" class="chart-container">
                        <div class="loader"></div>
                    </div>
                </div>

                <!-- Readiness Scoring Leaderboard -->
                <div class="glass-panel flex-col">
                    <h2 class="section-title">Cluster Readiness Standings (Top 5)</h2>
                    <div class="flex-col gap-sm" id="readiness-leaderboard">
                        <div class="loader"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const loadAnalytics = async () => {
        try {
            const successRate = await api.analytics.successRate();
            const rtoCompliance = await api.analytics.rtoCompliance();
            const mttrTrends = await api.analytics.mttr();
            const readiness = await api.analytics.readiness();

            charts.renderDonut("chart-success-mount", successRate);
            charts.renderRtoBar("chart-rto-mount", rtoCompliance);
            charts.renderMttrTrends("chart-mttr-mount", mttrTrends);
            
            renderReadinessLeaderboard(readiness);
        } catch (err) {
            console.error("Error loading analytics:", err);
        }
    };

    loadAnalytics();
}

function renderReadinessLeaderboard(readinessList) {
    const container = document.getElementById("readiness-leaderboard");
    
    // Slice top 5
    const top5 = readinessList.slice(0, 5);
    if (top5.length === 0) {
        container.innerHTML = `<p class="text-secondary text-center">No cluster readiness statistics available.</p>`;
        return;
    }

    let boardHtml = "";
    top5.forEach((item, index) => {
        let scoreColor = "var(--text-secondary)";
        if (item.score >= 80) scoreColor = "var(--emerald)";
        else if (item.score >= 50) scoreColor = "var(--amber)";
        else scoreColor = "var(--red)";

        boardHtml += `
            <div class="flex justify-between items-center p-sm border rounded" style="border-color: var(--border-default); background: rgba(255,255,255,0.01)">
                <div class="flex items-center gap-md">
                    <span class="font-bold text-muted font-mono" style="min-width: 20px;">#${index + 1}</span>
                    <div class="flex-col">
                        <span class="text-sm font-bold text-white">${item.cluster_name}</span>
                        <span class="text-xs text-secondary font-mono">${item.region} | ${item.dr_type.toUpperCase()}</span>
                    </div>
                </div>
                
                <div class="flex items-center gap-md">
                    <div class="flex-col text-right">
                        <span class="text-sm font-bold" style="color: ${scoreColor}">${item.score}/100</span>
                        <span class="text-xs text-muted font-mono">${item.last_test_days !== null ? `${item.last_test_days}d ago` : 'Never Tested'}</span>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = boardHtml;
}
