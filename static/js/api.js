/**
 * K8s DR Orchestrator — API Client Service
 */

const API_BASE = "";

async function request(url, options = {}) {
    const defaultHeaders = {
        "Content-Type": "application/json",
    };

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    };

    if (config.body && typeof config.body === "object") {
        config.body = JSON.stringify(config.body);
    }

    try {
        const response = await fetch(`${API_BASE}${url}`, config);
        
        if (url.includes("/export")) {
            return response; // Return full response for file download
        }

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || "An error occurred");
        }
        
        return data;
    } catch (error) {
        console.error(`API Error on ${url}:`, error);
        if (window.showToast) {
            window.showToast(error.message, "error");
        }
        throw error;
    }
}

export const api = {
    clusters: {
        list: (filters = {}) => {
            const params = new URLSearchParams(filters).toString();
            return request(`/api/clusters?${params}`);
        },
        summary: () => request("/api/clusters/summary"),
        get: (id) => request(`/api/clusters/${id}`),
        update: (id, data) => request(`/api/clusters/${id}`, { method: "PUT", body: data }),
    },
    runbooks: {
        list: () => request("/api/runbooks"),
        get: (id) => request(`/api/runbooks/${id}`),
        create: (data) => request("/api/runbooks", { method: "POST", body: data }),
        update: (id, data) => request(`/api/runbooks/${id}`, { method: "PUT", body: data }),
        delete: (id) => request(`/api/runbooks/${id}`, { method: "DELETE" }),
    },
    executions: {
        list: (filters = {}) => {
            const params = new URLSearchParams(filters).toString();
            return request(`/api/executions?${params}`);
        },
        get: (id) => request(`/api/executions/${id}`),
        start: (runbookId, clusterId) => request("/api/executions", {
            method: "POST",
            body: { runbook_id: runbookId, cluster_id: clusterId, started_by: "operator" }
        }),
        pause: (id) => request(`/api/executions/${id}/pause`, { method: "POST" }),
        resume: (id) => request(`/api/executions/${id}/resume`, { method: "POST" }),
        rollback: (id) => request(`/api/executions/${id}/rollback`, { method: "POST" }),
        confirmStep: (execId, stepId) => request(`/api/executions/${execId}/steps/${stepId}/confirm`, { method: "POST" }),
        logs: (id) => request(`/api/executions/${id}/logs`),
    },
    audit: {
        list: (filters = {}) => {
            const params = new URLSearchParams(filters).toString();
            return request(`/api/audit?${params}`);
        },
        exportUrl: () => `/api/audit/export`,
    },
    analytics: {
        rtoCompliance: () => request("/api/analytics/rto-compliance"),
        testFrequency: () => request("/api/analytics/test-frequency"),
        successRate: () => request("/api/analytics/success-rate"),
        mttr: () => request("/api/analytics/mttr"),
        readiness: () => request("/api/analytics/readiness"),
    },
    settings: {
        get: () => request("/api/settings"),
        update: (data) => request("/api/settings", { method: "PUT", body: data }),
    }
};
