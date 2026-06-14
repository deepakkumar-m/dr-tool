/**
 * K8s DR Orchestrator — Reusable Modal Dialog Component
 */

export class Modal {
    constructor(title, bodyHtml, footerHtml = "") {
        this.title = title;
        this.bodyHtml = bodyHtml;
        this.footerHtml = footerHtml;
        
        this.overlay = null;
        this.init();
    }

    init() {
        this.overlay = document.createElement("div");
        this.overlay.className = "modal-overlay";
        
        this.overlay.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="text-lg font-bold text-cyan">${this.title}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    ${this.bodyHtml}
                </div>
                ${this.footerHtml ? `<div class="modal-footer">${this.footerHtml}</div>` : ""}
            </div>
        `;

        document.body.appendChild(this.overlay);

        // Bind events
        this.overlay.querySelector(".modal-close").addEventListener("click", () => this.close());
        this.overlay.addEventListener("click", (e) => {
            if (e.target === this.overlay) this.close();
        });
    }

    open() {
        // Force reflow
        this.overlay.offsetHeight;
        this.overlay.classList.add("active");
    }

    close() {
        this.overlay.classList.remove("active");
        setTimeout(() => {
            this.overlay.remove();
        }, 300); // match transition duration
    }

    updateBody(html) {
        this.overlay.querySelector(".modal-body").innerHTML = html;
    }
}
