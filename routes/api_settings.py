"""Settings API endpoints."""

from flask import Blueprint, jsonify, request

settings_bp = Blueprint("settings", __name__)

# In-memory settings (persisted to DB in a future version)
_settings = {
    "rto_defaults": {"tier-1": 30, "tier-2": 120, "tier-3": 240},
    "notification_channels": {
        "slack": {"enabled": True, "channel": "#dr-ops"},
        "email": {"enabled": True, "distribution_list": "dl-dr-team@example.com"},
        "teams": {"enabled": False, "webhook_url": ""},
    },
    "theme": "dark",
    "auto_rollback_timeout_minutes": 30,
    "execution_step_timeout_minutes": 10,
}


@settings_bp.route("/api/settings", methods=["GET"])
def get_settings():
    return jsonify(_settings)


@settings_bp.route("/api/settings", methods=["PUT"])
def update_settings():
    data = request.get_json()
    _settings.update(data)
    return jsonify(_settings)
