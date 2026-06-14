/**
 * K8s DR Orchestrator — Live Timeline Visualizer
 */

export function renderTimeline(steps, containerId, onStepClick, currentStepId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!steps || steps.length === 0) {
        container.innerHTML = `<p class="text-secondary text-center">No steps defined for this execution</p>`;
        return;
    }

    let stepsHtml = "";
    
    steps.forEach((step) => {
        const isCurrent = step.id === currentStepId;
        const statusClass = step.status; // pending, running, completed, failed, waiting
        const activeClass = isCurrent ? "active-step" : "";
        
        let timeDisplay = "";
        if (step.started_at) {
            const start = new Date(step.started_at);
            const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            timeDisplay = `<span class="text-xs text-muted font-mono">${timeStr}</span>`;
        }

        let durationText = `${step.estimated_seconds}s`;
        if (step.started_at && step.completed_at) {
            const diffSec = Math.round((new Date(step.completed_at) - new Date(step.started_at)) / 1000);
            durationText = `${diffSec}s actual / est: ${step.estimated_seconds}s`;
        }

        let typeIcon = "";
        switch (step.step_type) {
            case "automated":
                typeIcon = `<span class="text-cyan text-xs font-mono border rounded px-xs" style="border-color:var(--cyan-dim); background:var(--cyan-dim);">AUTO</span>`;
                break;
            case "manual":
                typeIcon = `<span class="text-amber text-xs font-mono border rounded px-xs" style="border-color:var(--amber-dim); background:var(--amber-dim);">MANUAL</span>`;
                break;
            case "approval":
                typeIcon = `<span class="text-purple text-xs font-mono border rounded px-xs" style="border-color:var(--purple-dim); background:var(--purple-dim);">GATE</span>`;
                break;
            case "notification":
                typeIcon = `<span class="text-blue text-xs font-mono border rounded px-xs" style="border-color:var(--blue-dim); background:var(--blue-dim);">NOTIFY</span>`;
                break;
        }

        let confirmBtnHtml = "";
        if (step.status === "waiting") {
            confirmBtnHtml = `
                <div class="flex gap-sm mt-sm">
                    <button class="btn btn-success btn-sm confirm-step-btn" data-step-id="${step.id}" style="padding: 5px 12px; font-size:0.8rem">
                        Confirm Step Action
                    </button>
                </div>
            `;
        }

        stepsHtml += `
            <div class="timeline-step ${statusClass} ${activeClass}" data-step-id="${step.id}">
                <div class="timeline-step-content flex justify-between items-start">
                    <div class="flex-col flex-1">
                        <div class="flex items-center gap-sm flex-wrap">
                            <span class="text-xs text-muted font-mono">#${step.order}</span>
                            ${typeIcon}
                            <span class="font-bold text-sm text-primary">${step.name}</span>
                        </div>
                        <p class="text-xs text-secondary mt-xs" style="max-width: 90%;">${step.command || 'No CLI instruction associated'}</p>
                        ${confirmBtnHtml}
                    </div>
                    
                    <div class="flex-col text-right gap-xs">
                        ${timeDisplay}
                        <span class="text-xs text-muted font-mono">${durationText}</span>
                        <span class="text-xs uppercase font-semibold text-cyan">${step.status}</span>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = `
        <div class="timeline-container">
            ${stepsHtml}
        </div>
    `;

    // Attach step click event listeners
    const stepElements = container.querySelectorAll(".timeline-step-content");
    stepElements.forEach((el) => {
        el.addEventListener("click", (e) => {
            // Ignore if clicked on the confirm button
            if (e.target.classList.contains("confirm-step-btn")) return;
            
            const stepId = el.closest(".timeline-step").getAttribute("data-step-id");
            if (onStepClick) onStepClick(stepId);
        });
    });
}
