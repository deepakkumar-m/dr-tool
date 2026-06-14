# Kubernetes DR Orchestrator

A lightweight, self-contained web application for Kubernetes Disaster Recovery planning, testing, and execution. This tool provides operations and SRE teams with a visual Command Center to coordinate and monitor failover/failback workflows for Rancher-managed clusters.

![Command Center Screen](static/css/pages.css) <!-- Placeholder tag or reference -->

---

## 🚀 Key Features

* **Command Center Dashboard:** A central panel featuring aggregate cluster health cards, active recovery workflows, recent audit logs, and an interactive geographic cluster health map.
* **Cluster Inventory Management:** View and manage Rancher-managed Kubernetes clusters. Supports filtering by region, status, and environment, plus targets for RTO (Recovery Time Objective) compliance and custom metadata tags.
* **Disaster Recovery Runbooks:** Declaratively model recovery steps. Includes templates for:
  * **Stretched Cluster Failover / Failback** (cordoning production nodes, scaling up DR nodes).
  * **Split Cluster Failover / Failback** (scaling down production, switching ingress routes, launching secondary DR clusters).
* **Live Execution Engine:** Monitor failover workflows step-by-step. Features a real-time console logger with simulated standard output, pause/resume flags, and an emergency rollback button. Includes support for manual tasks requiring operator validation.
* **Compliance & Analytics Center:** Automatically calculates cluster readiness scores (0-100), MTTR (Mean Time to Recover) trends, test frequency graphs, and RTO compliance percentages.
* **Immutable Audit Trail:** Log system actions, user events, and severity levels. Includes a built-in tool to export the history directly to a CSV file.

---

## 🛠️ Technology Stack

* **Backend:** Python 3.x, Flask (3.1.1), Flask-SQLAlchemy (3.1.1), Flask-CORS (5.0.1)
* **Database:** SQLite (file-based database)
* **Frontend:** 
  * Semantic HTML5 structure (single-page application)
  * Vanilla CSS3 (modern glassmorphism theme, dark palette, smooth transitions)
  * Vanilla JavaScript (ES Modules, custom hash router, custom SVG charting, toast alerts)

---

## 📂 Project Structure

```
├── app.py                     # Flask application entry point
├── config.py                  # Environment & SQLite database configuration
├── models.py                  # SQLAlchemy Database Schema
├── seed_data.py               # Seeds 70 clusters, 4 runbooks & 20 historical runs
├── requirements.txt           # Python application dependencies
├── services/
│   ├── execution_engine.py    # Background thread execution runner
│   ├── audit_service.py       # Audit logging utility
│   └── analytics_service.py   # RTO, MTTR & readiness metrics calculator
├── routes/                    # API Endpoints Blueprints
│   ├── api_clusters.py
│   ├── api_runbooks.py
│   ├── api_executions.py
│   ├── api_audit.py
│   ├── api_analytics.py
│   └── api_settings.py
├── templates/
│   └── index.html             # SPA Main template
└── static/
    ├── css/                   # Design system and page stylesheets
    └── js/                    # Page components, router, and page controllers
```

---

## ⚙️ Quick Start

### 1. Prerequisites
Ensure you have Python 3.x installed.

### 2. Install Dependencies
Clone the repository and install the requirements:
```bash
pip install -r requirements.txt
```

### 3. Run the Application
Start the development server:
```bash
python app.py
```

Upon launching, the application will:
1. Initialize the SQLite database (`dr_orchestrator.db`).
2. Run database migrations (`db.create_all()`).
3. Seed mock data (70 regional clusters, 4 DR runbook templates, 20 historical execution records, and audit events).

### 4. Open the Interface
Navigate to your browser:
```
http://127.0.0.1:5000
```