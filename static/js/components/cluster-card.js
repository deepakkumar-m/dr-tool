/**
 * K8s DR Orchestrator — Cluster Card component
 */

export function createClusterCard(cluster, onStartDrClick) {
    const isStretched = cluster.dr_type === "stretched";
    const statusClass = `badge-${cluster.status}`;
    
    // Tag list
    const tagsHtml = cluster.tags.map(t => `<span class="cluster-app-tag">${t}</span>`).join(" ");

    // Target display details
    const drDetailsHtml = isStretched
        ? `<div><span class="text-muted text-xs">DR Nodes:</span> <span class="font-medium text-xs text-cyan">${cluster.dr_node_count} nodes</span></div>`
        : `<div><span class="text-muted text-xs">DR Partner:</span> <span class="font-medium text-xs text-purple">${cluster.dr_partner_id ? 'Configured' : 'Missing'}</span></div>`;

    return `
        <div class="glass-panel glass-panel-hover cluster-card flex-col justify-between" id="card-${cluster.id}">
            <div class="cluster-card-header flex justify-between items-start">
                <div class="flex-col">
                    <span class="text-xs text-muted font-mono">${cluster.region} / ${cluster.datacenter}</span>
                    <h3 class="text-md font-bold mt-xs">${cluster.name}</h3>
                </div>
                <span class="badge ${statusClass}">
                    <span class="badge-dot"></span>
                    ${cluster.status}
                </span>
            </div>
            
            <div class="flex-col gap-sm text-sm mb-md">
                <div class="flex justify-between">
                    <span class="text-secondary">DR Type:</span>
                    <span class="font-semibold text-cyan text-xs uppercase">${cluster.dr_type}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-secondary">Active Apps:</span>
                    <span class="font-mono text-xs">${cluster.applications.length} apps</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-secondary">Nodes:</span>
                    <span class="font-mono text-xs">${cluster.node_count} nodes</span>
                </div>
                <div class="flex justify-between items-center mt-xs" style="border-top: 1px dashed var(--border-subtle); padding-top: 8px;">
                    ${drDetailsHtml}
                    <div>
                        <span class="text-muted text-xs">RTO Target:</span>
                        <span class="font-semibold text-xs text-amber">${cluster.rto_minutes}m</span>
                    </div>
                </div>
            </div>
            
            <div class="flex gap-sm mb-md flex-wrap">
                ${tagsHtml}
            </div>

            <div class="flex gap-sm border-top pt-md" style="border-top: 1px solid var(--border-subtle)">
                <button class="btn btn-secondary flex-1 view-details-btn" data-id="${cluster.id}">Details</button>
                <button class="btn btn-primary flex-1 start-dr-btn" data-id="${cluster.id}" ${cluster.status === 'failover-active' ? 'disabled' : ''}>
                    Failover
                </button>
            </div>
        </div>
    `;
}
