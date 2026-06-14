/**
 * K8s DR Orchestrator — Live DR Execution Page
 */

import { api } from "../api.js";
import { renderTimeline } from "../components/timeline.js";

export async function renderExecution(container, params) {
    const execId = params.id;
    if (!execId) {
        container.innerHTML = `<div class="page-container text-center"><h2 class="text-red">Invalid Execution ID</h2></div>`;
        return;
    }

    container.innerHTML = `
        <div class="page-container flex-col gap-lg animate-slide-up">
            <div class="flex justify-between items-start flex-wrap gap-md">
                <div class="flex-col">
                    <div class="flex items-center gap-sm">
                        <span class="text-xs font-mono text-cyan" id="exec-cluster-region">LOADING...</span>
                        <span class="badge badge-pending" id="exec-status-badge">pending</span>
                    </div>
                    <h1 class="page-title" id="exec-title">DR Execution Monitor</h1>
                    <p class="page-subtitle" id="exec-subtitle">Initiated by operator</p>
                </div>
                
                <!-- Controls Row -->
                <div class="flex items-center gap-sm">
                    <button class="btn btn-secondary" id="exec-pause-btn" disabled>Pause</button>
                    <button class="btn btn-secondary" id="exec-resume-btn" style="display:none">Resume</button>
                    <button class="btn btn-danger" id="exec-rollback-btn" disabled>Rollback</button>
                </div>
            </div>

            <!-- Progress Header -->
            <div class="glass-panel flex justify-between items-center gap-lg">
                <div class="flex-col flex-1 gap-xs">
                    <div class="flex justify-between text-xs text-secondary font-mono">
                        <span>Workflow Progress</span>
                        <span id="exec-progress-percent">0%</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar" id="exec-progress-bar" style="width: 0%"></div>
                    </div>
                </div>
                
                <div class="flex gap-lg text-sm font-mono border-left pl-lg" style="border-left:1px solid var(--border-subtle)">
                    <div class="flex-col">
                        <span class="text-muted text-xs">ELAPSED TIME</span>
                        <span class="text-lg font-bold text-white" id="exec-elapsed-time">00:00:00</span>
                    </div>
                    <div class="flex-col">
                        <span class="text-muted text-xs">STEPS</span>
                        <span class="text-lg font-bold text-cyan" id="exec-steps-ratio">0/0</span>
                    </div>
                </div>
            </div>

            <!-- Two Column Timeline + Logs Layout -->
            <div class="execution-layout">
                <!-- Left: Timeline -->
                <div class="glass-panel flex-col">
                    <h2 class="section-title">Execution Steps</h2>
                    <div id="execution-timeline-mount">
                        <!-- Loaded dynamically -->
                    </div>
                </div>
                
                <!-- Right: Console logs -->
                <div class="flex-col gap-lg" style="position: sticky; top: 90px;">
                    <div class="glass-panel flex-col" style="padding: 18px;">
                        <div class="flex justify-between items-center mb-sm">
                            <h2 class="section-title mb-0" style="font-size:0.95rem">Log Stream & CLI Output</h2>
                            <span class="text-xs text-muted font-mono" id="selected-step-label">All Logs</span>
                        </div>
                        <div class="terminal-view" id="exec-terminal-logs">
                            [System] Initializing console logs...
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const statusBadge = document.getElementById("exec-status-badge");
    const title = document.getElementById("exec-title");
    const subtitle = document.getElementById("exec-subtitle");
    const progressPercent = document.getElementById("exec-progress-percent");
    const progressBar = document.getElementById("exec-progress-bar");
    const elapsedTime = document.getElementById("exec-elapsed-time");
    const stepsRatio = document.getElementById("exec-steps-ratio");
    const regionLabel = document.getElementById("exec-cluster-region");
    const terminal = document.getElementById("exec-terminal-logs");
    const stepLabel = document.getElementById("selected-step-label");

    // Controls
    const pauseBtn = document.getElementById("exec-pause-btn");
    const resumeBtn = document.getElementById("exec-resume-btn");
    const rollbackBtn = document.getElementById("exec-rollback-btn");

    let pollInterval = null;
    let elapsedSeconds = 0;
    let elapsedTimer = null;
    let selectedStepId = null;
    let lastKnownLogs = "";

    const formatTime = (secs) => {
        const h = Math.floor(secs / 3600).toString().padStart(2, '0');
        const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    const updateControls = (status) => {
        if (status === "running") {
            pauseBtn.style.display = "inline-flex";
            pauseBtn.disabled = false;
            resumeBtn.style.display = "none";
            rollbackBtn.disabled = false;
        } else if (status === "paused") {
            pauseBtn.style.display = "none";
            resumeBtn.style.display = "inline-flex";
            resumeBtn.disabled = false;
            rollbackBtn.disabled = false;
        } else {
            // completed, failed, rolled-back, pending
            pauseBtn.style.display = "inline-flex";
            pauseBtn.disabled = true;
            resumeBtn.style.display = "none";
            rollbackBtn.disabled = true;
        }
    };

    const fetchStatus = async () => {
        try {
            const execution = await api.executions.get(execId);
            
            // Render Header info
            title.innerText = `${execution.runbook_name}`;
            subtitle.innerText = `Target: ${execution.cluster_name} | Triggered by: ${execution.started_by}`;
            regionLabel.innerText = `${execution.dr_type.toUpperCase()} CLUSTER`;
            
            // Badge status
            statusBadge.className = `badge badge-${execution.status}`;
            statusBadge.innerText = execution.status;
            
            // Progress details
            progressPercent.innerText = `${execution.progress}%`;
            progressBar.style.width = `${execution.progress}%`;
            stepsRatio.innerText = `${execution.completed_steps}/${execution.total_steps}`;

            updateControls(execution.status);

            // Timeline rendering
            renderTimeline(
                execution.steps, 
                "execution-timeline-mount", 
                (stepId) => {
                    selectedStepId = stepId;
                    const step = execution.steps.find(s => s.id === stepId);
                    if (step) {
                        stepLabel.innerText = `Step #${step.order} Logs`;
                        terminal.innerText = step.output || step.error || "No logs available for this step yet.";
                    }
                },
                execution.current_step_id
            );

            // Fetch logs stream
            const logs = await api.executions.logs(execId);
            const logsText = logs.map(l => {
                const tsStr = l.timestamp ? `[${new Date(l.timestamp).toLocaleTimeString([], { hour12: false })}] ` : "";
                return `${tsStr}${l.output || l.error}`;
            }).join("\n");

            // Only update log text if not focusing on a single step
            if (!selectedStepId && logsText !== lastKnownLogs) {
                terminal.innerText = logsText || "[System] Initializing console logs...";
                terminal.scrollTop = terminal.scrollHeight; // Auto scroll
                lastKnownLogs = logsText;
            }

            // Stop polling if done
            if (["completed", "failed", "rolled-back"].includes(execution.status)) {
                clearInterval(pollInterval);
                clearInterval(elapsedTimer);
                window.showToast(`DR activity ended with status: ${execution.status}`, "info");
            }

        } catch (err) {
            console.error("Error polling execution status:", err);
            clearInterval(pollInterval);
        }
    };

    // Attach step action handlers inside timeline
    container.addEventListener("click", async (e) => {
        if (e.target.classList.contains("confirm-step-btn")) {
            const stepId = e.target.getAttribute("data-step-id");
            try {
                window.showToast("Confirming manual step...", "info");
                await api.executions.confirmStep(execId, stepId);
                window.showToast("Step action confirmed. Workflow resuming.", "success");
                fetchStatus(); // immediate check
            } catch (err) {
                console.error("Error confirming step:", err);
            }
        }
    });

    // Control buttons event listeners
    pauseBtn.addEventListener("click", async () => {
        try {
            await api.executions.pause(execId);
            window.showToast("Pausing workflow execution...", "warning");
            fetchStatus();
        } catch (err) {}
    });

    resumeBtn.addEventListener("click", async () => {
        try {
            await api.executions.resume(execId);
            window.showToast("Resuming workflow execution...", "success");
            fetchStatus();
        } catch (err) {}
    });

    rollbackBtn.addEventListener("click", async () => {
        if (confirm("Are you sure you want to trigger emergency rollback? This action cannot be undone.")) {
            try {
                await api.executions.rollback(execId);
                window.showToast("Emergency rollback requested!", "error");
                fetchStatus();
            } catch (err) {}
        }
    });

    // Start timer & polling
    fetchStatus();
    pollInterval = setInterval(fetchStatus, 2000);

    elapsedTimer = setInterval(() => {
        elapsedSeconds++;
        elapsedTime.innerText = formatTime(elapsedSeconds);
    }, 1000);

    // Click terminal title to return to full log stream
    stepLabel.addEventListener("click", () => {
        selectedStepId = null;
        stepLabel.innerText = "All Logs";
        terminal.innerText = lastKnownLogs;
        terminal.scrollTop = terminal.scrollHeight;
    });
}
