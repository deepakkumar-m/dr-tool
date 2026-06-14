"""Analytics API endpoints."""

from flask import Blueprint, jsonify

from services.analytics_service import (
    get_cluster_readiness,
    get_mttr_trends,
    get_rto_compliance,
    get_success_rate,
    get_test_frequency,
)

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route("/api/analytics/rto-compliance", methods=["GET"])
def rto_compliance():
    return jsonify(get_rto_compliance())


@analytics_bp.route("/api/analytics/test-frequency", methods=["GET"])
def test_frequency():
    return jsonify(get_test_frequency())


@analytics_bp.route("/api/analytics/success-rate", methods=["GET"])
def success_rate():
    return jsonify(get_success_rate())


@analytics_bp.route("/api/analytics/mttr", methods=["GET"])
def mttr_trends():
    return jsonify(get_mttr_trends())


@analytics_bp.route("/api/analytics/readiness", methods=["GET"])
def cluster_readiness():
    return jsonify(get_cluster_readiness())
