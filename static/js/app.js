/**
 * K8s DR Orchestrator — Application Entry Point
 */

import { Router } from "./router.js";
import { initToast } from "./components/toast.js";
import { renderSidebar } from "./components/sidebar.js";
import { renderHeader } from "./components/header.js";

// Page Renderers
import { renderDashboard } from "./pages/dashboard.js";
import { renderClusters } from "./pages/clusters.js";
import { renderRunbooks } from "./pages/runbooks.js";
import { renderExecution } from "./pages/execution.js";
import { renderAnalytics } from "./pages/analytics.js";
import { renderAudit } from "./pages/audit.js";
import { renderSettings } from "./pages/settings.js";

document.addEventListener("DOMContentLoaded", () => {
    // 1. Initialize Toast Notifications
    initToast();

    // 2. Render Shell Components (Sidebar + Header)
    const sidebarMount = document.getElementById("sidebar-mount");
    const headerMount = document.getElementById("header-mount");
    
    if (sidebarMount) renderSidebar(sidebarMount);
    if (headerMount) renderHeader(headerMount);

    // 3. Define Routes mapping path to handler page renderer
    const routes = [
        { path: "/", handler: renderDashboard },
        { path: "/clusters", handler: renderClusters },
        { path: "/runbooks", handler: renderRunbooks },
        { path: "/execution/:id", handler: renderExecution },
        { path: "/analytics", handler: renderAnalytics },
        { path: "/audit", handler: renderAudit },
        { path: "/settings", handler: renderSettings },
    ];

    // 4. Start Router
    new Router(routes, "page-mount");
    
    window.showToast("K8s DR Orchestrator loaded successfully", "success");
});
