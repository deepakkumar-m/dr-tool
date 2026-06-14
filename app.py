"""K8s DR Orchestrator — Flask Application Entry Point."""

import os

from flask import Flask, send_from_directory
from flask_cors import CORS

from config import Config
from models import db
from routes.api_analytics import analytics_bp
from routes.api_audit import audit_bp
from routes.api_clusters import clusters_bp
from routes.api_executions import executions_bp
from routes.api_runbooks import runbooks_bp
from routes.api_settings import settings_bp
from seed_data import seed_database


def create_app():
    app = Flask(
        __name__,
        static_folder="static",
        template_folder="templates",
    )
    app.config.from_object(Config)

    # Initialize extensions
    CORS(app)
    db.init_app(app)

    # Register API blueprints
    app.register_blueprint(clusters_bp)
    app.register_blueprint(runbooks_bp)
    app.register_blueprint(executions_bp)
    app.register_blueprint(audit_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(settings_bp)

    # Create database tables and seed data
    with app.app_context():
        db.create_all()
        seed_database()

    # Serve the SPA for all non-API routes
    @app.route("/")
    def index():
        return send_from_directory("templates", "index.html")

    @app.route("/<path:path>")
    def catch_all(path):
        # If it's a static file, serve it
        if path.startswith("static/"):
            return send_from_directory(".", path)
        # Otherwise serve the SPA
        return send_from_directory("templates", "index.html")

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000, threaded=True)
