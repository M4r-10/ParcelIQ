"""
TitleGuard AI — Main Flask Application
Spatial Property Risk Intelligence Engine

Routes:
  POST /api/analyze       — Full property risk analysis
  GET  /api/parcel/<id>   — Parcel GeoJSON data
  POST /api/risk-score    — Risk score breakdown
  POST /api/ai-summary    — LLM-generated risk summary
  POST /api/cv-coverage   — CV-based lot coverage estimation
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from config import Config
from services.risk_scoring import compute_risk_score, get_risk_tier
from services.cv_coverage import estimate_lot_coverage
from services.ai_summary import generate_risk_summary
from services.geocoding import geocode_address
from data.mock_data import SAMPLE_PARCELS, OWNERSHIP_HISTORY, FLOOD_ZONES, EASEMENTS

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok", "service": "TitleGuard AI"})


# ---------------------------------------------------------------------------
# POST /api/analyze — Full property risk analysis pipeline
# ---------------------------------------------------------------------------
@app.route("/api/analyze", methods=["POST"])
def analyze_property():
    """
    Accepts a property address and runs the full analysis pipeline:
    1. Geocode address
    2. Retrieve parcel data
    3. Estimate lot coverage (CV)
    4. Compute risk score
    5. Generate AI summary
    """
    data = request.get_json()
    address = data.get("address", "")

    if not address:
        return jsonify({"error": "Address is required"}), 400

    # Step 1: Geocode
    location = geocode_address(address)

    # Step 2: Look up parcel data (using mock data for now)
    # TODO: Replace with real parcel lookup based on geocoded coordinates
    parcel_id = data.get("parcel_id", "downtown_sample")
    parcel = SAMPLE_PARCELS.get(parcel_id)

    if not parcel:
        return jsonify({"error": "Parcel not found"}), 404

    # Step 3: CV lot coverage estimation
    # TODO: Pass real satellite image path instead of None
    coverage_result = estimate_lot_coverage(
        parcel_geojson=parcel["geometry"],
        satellite_image_path=None,
    )

    # Step 4: Compute risk score
    property_data = {
        "flood_zone": _get_flood_exposure(parcel_id),
        "easement_encroachment": _get_easement_encroachment(parcel_id),
        "lot_coverage_pct": coverage_result["lot_coverage_pct"],
        "ownership_history": OWNERSHIP_HISTORY.get(parcel_id, []),
        "property_age": parcel.get("property_age", 30),
        "zoning_max_coverage": Config.DEFAULT_MAX_LOT_COVERAGE,
    }

    risk_result = compute_risk_score(property_data)

    # Step 5: Generate AI summary
    summary_result = generate_risk_summary(risk_result)

    # Assemble response
    response = {
        "address": address,
        "location": location,
        "parcel": parcel,
        "coverage": coverage_result,
        "risk": risk_result,
        "ai_summary": summary_result,
        "layers": {
            "flood_zone": FLOOD_ZONES.get(parcel_id),
            "easements": EASEMENTS.get(parcel_id),
        },
    }

    return jsonify(response)


# ---------------------------------------------------------------------------
# GET /api/parcel/<parcel_id> — Return parcel GeoJSON
# ---------------------------------------------------------------------------
@app.route("/api/parcel/<parcel_id>", methods=["GET"])
def get_parcel(parcel_id):
    """Return GeoJSON for a specific parcel."""
    parcel = SAMPLE_PARCELS.get(parcel_id)

    if not parcel:
        return jsonify({"error": "Parcel not found"}), 404

    # TODO: Fetch from real GIS database instead of mock data
    return jsonify(parcel)


# ---------------------------------------------------------------------------
# POST /api/risk-score — Risk score breakdown
# ---------------------------------------------------------------------------
@app.route("/api/risk-score", methods=["POST"])
def risk_score():
    """Compute and return risk score with factor breakdown."""
    data = request.get_json()

    # TODO: Validate input data schema
    result = compute_risk_score(data)
    return jsonify(result)


# ---------------------------------------------------------------------------
# POST /api/ai-summary — LLM-generated risk summary
# ---------------------------------------------------------------------------
@app.route("/api/ai-summary", methods=["POST"])
def ai_summary():
    """Generate AI-powered risk summary from risk data."""
    data = request.get_json()

    # TODO: Validate that required risk fields are present
    result = generate_risk_summary(data)
    return jsonify(result)


# ---------------------------------------------------------------------------
# POST /api/cv-coverage — CV lot coverage estimation
# ---------------------------------------------------------------------------
@app.route("/api/cv-coverage", methods=["POST"])
def cv_coverage():
    """Estimate lot coverage using computer vision."""
    data = request.get_json()

    parcel_geojson = data.get("parcel_geojson")
    image_path = data.get("image_path")

    # TODO: Accept image upload instead of file path
    result = estimate_lot_coverage(parcel_geojson, image_path)
    return jsonify(result)


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------
def _get_flood_exposure(parcel_id):
    """
    Determine flood zone exposure for a parcel.
    Returns a float 0.0-1.0 representing risk level.
    """
    flood_data = FLOOD_ZONES.get(parcel_id)
    if not flood_data:
        return 0.0

    # TODO: Calculate actual geometric intersection of parcel and flood zone
    # For now, return the mock exposure value
    return flood_data.get("exposure", 0.0)


def _get_easement_encroachment(parcel_id):
    """
    Calculate easement encroachment percentage for a parcel.
    Returns a float 0.0-1.0 representing encroachment.
    """
    easement_data = EASEMENTS.get(parcel_id)
    if not easement_data:
        return 0.0

    # TODO: Calculate actual geometric overlap using Shapely
    # For now, return the mock encroachment value
    return easement_data.get("encroachment_pct", 0.0)


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("🏛  TitleGuard AI — Spatial Property Risk Intelligence Engine")
    print("   Starting on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=Config.DEBUG)
