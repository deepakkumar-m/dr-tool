/**
 * K8s DR Orchestrator — Settings Configuration Page
 */

import { api } from "../api.js";

export async function renderSettings(container) {
    container.innerHTML = `
        <div class="page-container flex-col gap-lg animate-slide-up">
            <div class="flex justify-between items-center">
                <div class="flex-col">
                    <h1 class="page-title">Global Settings</h1>
                    <p class="page-subtitle">Configure thresholds, notification channels, and operational timeouts</p>
                </div>
            </div>

            <div class="settings-grid">
                <!-- Navigation Sub Menu -->
                <div class="flex-col gap-sm">
                    <div class="glass-panel flex-col gap-xs" style="padding:12px;">
                        <button class="btn btn-secondary text-left w-full text-cyan" style="justify-content: flex-start; background:rgba(0,212,255,0.05)">SLA & RTO Targets</button>
                        <button class="btn btn-secondary text-left w-full" style="justify-content: flex-start;" disabled>RBAC / Permissions</button>
                        <button class="btn btn-secondary text-left w-full" style="justify-content: flex-start;" disabled>Rancher Integrations</button>
                    </div>
                </div>

                <!-- Form Section -->
                <div class="flex-col gap-lg">
                    <form id="settings-form" class="glass-panel flex-col gap-md">
                        <h2 class="section-title">SLA Thresholds (Minutes)</h2>
                        
                        <div class="flex gap-md flex-wrap">
                            <div class="form-group flex-1">
                                <label class="form-label">Tier-1 RTO (Critical)</label>
                                <input type="number" id="settings-rto-t1" class="form-input" min="5" max="1440"/>
                            </div>
                            <div class="form-group flex-1">
                                <label class="form-label">Tier-2 RTO (High)</label>
                                <input type="number" id="settings-rto-t2" class="form-input" min="5" max="1440"/>
                            </div>
                            <div class="form-group flex-1">
                                <label class="form-label">Tier-3 RTO (Medium)</label>
                                <input type="number" id="settings-rto-t3" class="form-input" min="5" max="1440"/>
                            </div>
                        </div>

                        <h2 class="section-title mt-md">Simulated Slack Notification Hook</h2>
                        
                        <div class="form-group">
                            <label class="form-label">Slack Ops Channel</label>
                            <input type="text" id="settings-slack-chan" class="form-input" placeholder="#dr-ops"/>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Email Alert DL</label>
                            <input type="email" id="settings-email-dl" class="form-input" placeholder="dl-dr-team@example.com"/>
                        </div>

                        <h2 class="section-title mt-md">System Timeout Parameters</h2>
                        
                        <div class="flex gap-md flex-wrap">
                            <div class="form-group flex-1">
                                <label class="form-label">Auto Rollback Timeout (min)</label>
                                <input type="number" id="settings-rollback-timeout" class="form-input" min="5" max="120"/>
                            </div>
                            <div class="form-group flex-1">
                                <label class="form-label">Step Timeout Guard (min)</label>
                                <input type="number" id="settings-step-timeout" class="form-input" min="1" max="60"/>
                            </div>
                        </div>

                        <div class="flex gap-sm justify-end border-top pt-md" style="border-top:1px solid var(--border-subtle); margin-top:20px">
                            <button type="submit" class="btn btn-primary" id="save-settings-btn">Save Configurations</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    const form = document.getElementById("settings-form");
    const t1Input = document.getElementById("settings-rto-t1");
    const t2Input = document.getElementById("settings-rto-t2");
    const t3Input = document.getElementById("settings-rto-t3");
    const slackInput = document.getElementById("settings-slack-chan");
    const emailInput = document.getElementById("settings-email-dl");
    const rollbackInput = document.getElementById("settings-rollback-timeout");
    const stepInput = document.getElementById("settings-step-timeout");

    const loadSettings = async () => {
        try {
            const data = await api.settings.get();
            t1Input.value = data.rto_defaults["tier-1"];
            t2Input.value = data.rto_defaults["tier-2"];
            t3Input.value = data.rto_defaults["tier-3"];
            
            slackInput.value = data.notification_channels.slack.channel;
            emailInput.value = data.notification_channels.email.distribution_list;
            
            rollbackInput.value = data.auto_rollback_timeout_minutes;
            stepInput.value = data.execution_step_timeout_minutes;
        } catch (err) {
            console.error("Error loading settings:", err);
        }
    };

    loadSettings();

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const payload = {
            rto_defaults: {
                "tier-1": parseInt(t1Input.value),
                "tier-2": parseInt(t2Input.value),
                "tier-3": parseInt(t3Input.value),
            },
            notification_channels: {
                slack: { enabled: true, channel: slackInput.value },
                email: { enabled: true, distribution_list: emailInput.value },
                teams: { enabled: false, webhook_url: "" }
            },
            auto_rollback_timeout_minutes: parseInt(rollbackInput.value),
            execution_step_timeout_minutes: parseInt(stepInput.value)
        };

        try {
            window.showToast("Saving changes...", "info");
            await api.settings.update(payload);
            window.showToast("Settings updated successfully!", "success");
        } catch (err) {
            console.error("Error updating settings:", err);
        }
    });
}
