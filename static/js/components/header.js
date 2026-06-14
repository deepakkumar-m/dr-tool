/**
 * K8s DR Orchestrator — Header Bar Component
 */

export function renderHeader(container) {
    const headerHtml = `
        <header class="header">
            <div class="search-bar">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" id="global-search" placeholder="Search clusters, applications..." />
            </div>
            
            <div class="user-profile">
                <div class="flex-col text-right">
                    <span class="text-sm font-semibold text-primary">Deepak</span>
                    <span class="text-xs text-muted">Platform Admin</span>
                </div>
                <div class="user-avatar">D</div>
            </div>
        </header>
    `;
    container.innerHTML = headerHtml;

    // Search events
    const searchInput = document.getElementById("global-search");
    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.trim().toLowerCase();
        
        // Dispatch global event that pages can listen to
        const event = new CustomEvent("globalSearch", { detail: query });
        window.dispatchEvent(event);
    });
}
