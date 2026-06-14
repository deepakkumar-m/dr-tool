/**
 * K8s DR Orchestrator — Client Side Hash Router
 */

export class Router {
    constructor(routes, containerId) {
        this.routes = routes;
        this.container = document.getElementById(containerId);
        window.addEventListener("hashchange", () => this.handleRoute());
        // Initial route
        this.handleRoute();
    }

    handleRoute() {
        const hash = window.location.hash || "#/";
        const parsed = this.parseRoute(hash);

        const route = this.matchRoute(parsed.path);
        if (route) {
            // Update sidebar navigation active links
            this.updateActiveNavLink(parsed.path);
            
            // Render the page
            route.handler(this.container, parsed.params);
        } else {
            console.warn(`No route match for: ${parsed.path}`);
            this.container.innerHTML = `<div class="page-container text-center"><h2 class="text-red">404 - Page Not Found</h2></div>`;
        }
    }

    parseRoute(hash) {
        // Strip # prefix
        const cleanHash = hash.replace(/^#/, "");
        
        // Separate path and query params (if any)
        const [pathAndParams, queryString] = cleanHash.split("?");
        
        // Split path into parts
        const parts = pathAndParams.split("/").filter(Boolean);
        
        // Construct clean path with slash separators
        const path = "/" + parts.join("/");

        const params = {};
        
        // Extract query parameters
        if (queryString) {
            const searchParams = new URLSearchParams(queryString);
            for (const [key, val] of searchParams.entries()) {
                params[key] = val;
            }
        }

        return { path, params };
    }

    matchRoute(path) {
        // Find exact or parameter matches (like /execution/:id)
        for (const route of this.routes) {
            const routeParts = route.path.split("/").filter(Boolean);
            const pathParts = path.split("/").filter(Boolean);

            if (routeParts.length !== pathParts.length) continue;

            let matches = true;
            const params = {};

            for (let i = 0; i < routeParts.length; i++) {
                if (routeParts[i].startsWith(":")) {
                    const paramName = routeParts[i].slice(1);
                    params[paramName] = pathParts[i];
                } else if (routeParts[i] !== pathParts[i]) {
                    matches = false;
                    break;
                }
            }

            if (matches) {
                return {
                    path: route.path,
                    handler: (container, queryParams) => route.handler(container, { ...queryParams, ...params }),
                };
            }
        }
        return null;
    }

    updateActiveNavLink(path) {
        // Find all links in the sidebar menu
        const menuItems = document.querySelectorAll(".sidebar-item");
        menuItems.forEach((item) => {
            const link = item.querySelector("a");
            if (!link) return;
            const href = link.getAttribute("href").replace(/^#/, "");
            
            // Check if active
            const linkPath = href.split("?")[0];
            const cleanPath = path.split("?")[0];
            
            if (linkPath === cleanPath || (linkPath !== "/" && cleanPath.startsWith(linkPath))) {
                item.classList.add("active");
            } else {
                item.classList.remove("active");
            }
        });
    }

    static navigate(hash) {
        window.location.hash = hash;
    }
}
