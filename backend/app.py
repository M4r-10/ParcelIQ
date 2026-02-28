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
from services.geocoding import geocode_address, fetch_parcel_boundary, fetch_building_footprint
from services.fema_client import query_flood_zone
from services.spatial_analysis import (
    estimate_property_age,
    estimate_easement_encroachment,
    estimate_ownership_volatility,
    estimate_cv_delta,
)
from data.mock_data import SAMPLE_PARCELS

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
    Accepts a property address and runs the full analysis pipeline.
    Every risk factor is derived dynamically from the geocoded location.
    """
    data = request.get_json()
    address = data.get("address", "")

    if not address:
        return jsonify({"error": "Address is required"}), 400

    # ------------------------------------------------------------------
    # Step 1: Geocode the address to real lat/lng
    # ------------------------------------------------------------------
    try:
        location = geocode_address(address)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    lat = location["lat"]
    lng = location["lng"]

    # ------------------------------------------------------------------
    # Step 2: Fetch parcel boundary + building footprint from OSM
    # ------------------------------------------------------------------
    parcel = fetch_parcel_boundary(lat, lng)
    building = fetch_building_footprint(lat, lng)

    # Compute lot coverage geometrically from building vs parcel area
    coverage_result = _compute_geometric_coverage(parcel, building)
    coverage_pct = coverage_result["lot_coverage_pct"]

    # ------------------------------------------------------------------
    # Step 3: Query FEMA for real flood zone data
    # ------------------------------------------------------------------
    flood_data = query_flood_zone(lat, lng)

    # ------------------------------------------------------------------
    # Step 4: Derive all remaining risk factors dynamically
    # ------------------------------------------------------------------
    prop_age = estimate_property_age(lat, lng, building)
    easement_pct = estimate_easement_encroachment(parcel, building)
    ownership = estimate_ownership_volatility(building, coverage_pct, prop_age)
    cv_delta = estimate_cv_delta(coverage_pct, building, parcel)

    property_data = {
        "flood_zone": flood_data["zone"],
        "inside_flood": flood_data["inside_flood"],
        "flood_boundary_distance": flood_data["flood_boundary_distance"],
        "easement_encroachment": easement_pct,
        "lot_coverage_pct": coverage_pct,
        "num_transfers_5yr": ownership["num_transfers_5yr"],
        "avg_holding_period": ownership["avg_holding_period"],
        "ownership_anomaly_score": ownership["ownership_anomaly_score"],
        "property_age": prop_age,
        "zoning_max_coverage": Config.DEFAULT_MAX_LOT_COVERAGE,
        "cv_vs_recorded_area_delta": cv_delta,
    }

    # ------------------------------------------------------------------
    # Step 5: Run ML risk scoring pipeline
    # ------------------------------------------------------------------
    risk_result = compute_risk_score(property_data)

    # ------------------------------------------------------------------
    # Step 6: Generate AI summary (grounded in SHAP + risk factors)
    # ------------------------------------------------------------------
    summary_result = generate_risk_summary(risk_result, address=address)

    # ------------------------------------------------------------------
    # Assemble response
    # ------------------------------------------------------------------
    response = {
        "address": address,
        "location": location,
        "parcel": parcel,
        "building": building,
        "coverage": coverage_result,
        "risk": risk_result,
        "ai_summary": summary_result,
        "flood_data": flood_data,
        "derived_factors": {
            "property_age": prop_age,
            "easement_encroachment": easement_pct,
            "ownership": ownership,
            "cv_delta": cv_delta,
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

    return jsonify(parcel)


# ---------------------------------------------------------------------------
# POST /api/risk-score — Risk score breakdown
# ---------------------------------------------------------------------------
@app.route("/api/risk-score", methods=["POST"])
def risk_score():
    """Compute and return risk score with factor breakdown."""
    data = request.get_json()
    result = compute_risk_score(data)
    return jsonify(result)


# ---------------------------------------------------------------------------
# POST /api/ai-summary — LLM-generated risk summary
# ---------------------------------------------------------------------------
@app.route("/api/ai-summary", methods=["POST"])
def ai_summary():
    """Generate AI-powered risk summary from risk data."""
    data = request.get_json()
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

    result = estimate_lot_coverage(parcel_geojson, image_path)
    return jsonify(result)


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------
def _compute_geometric_coverage(parcel: dict, building: dict | None) -> dict:
    """
    Compute lot coverage by comparing building footprint area to parcel area
    using Shapely geometry, without needing satellite imagery.
    """
    from shapely.geometry import shape

    try:
        parcel_geom = shape(parcel["geometry"])
        parcel_area = parcel_geom.area  # in degrees² (approximate)

        if building and "geometry" in building:
            building_geom = shape(building["geometry"])
            building_area = building_geom.area
            coverage_pct = building_area / parcel_area if parcel_area > 0 else 0.0
            # Clamp to reasonable range
            coverage_pct = min(coverage_pct, 1.0)

            # Estimate sqft from degree area (very rough: 1 deg ≈ 364,000 ft at ~34°N)
            ft_per_deg = 364000
            parcel_sqft = parcel_area * (ft_per_deg ** 2)
            building_sqft = building_area * (ft_per_deg ** 2)

            return {
                "lot_coverage_pct": round(coverage_pct, 4),
                "building_area_sqft": round(building_sqft, 1),
                "parcel_area_sqft": round(parcel_sqft, 1),
                "zoning_max_coverage": Config.DEFAULT_MAX_LOT_COVERAGE,
                "expansion_risk": "HIGH" if coverage_pct > 0.63 else "MODERATE" if coverage_pct > 0.4 else "LOW",
                "method": "geometric_osm",
                "confidence": 0.75,
                "cv_delta": 0.0,
            }
        else:
            # No building found — can't compute coverage
            return {
                "lot_coverage_pct": 0.0,
                "building_area_sqft": 0.0,
                "parcel_area_sqft": round(parcel_area * (364000 ** 2), 1),
                "zoning_max_coverage": Config.DEFAULT_MAX_LOT_COVERAGE,
                "expansion_risk": "LOW",
                "method": "geometric_no_building",
                "confidence": 0.5,
                "cv_delta": 0.0,
            }

    except Exception as e:
        print(f"Geometric coverage calculation failed: {e}")
        return _mock_coverage_fallback()


def _mock_coverage_fallback() -> dict:
    """Fallback mock coverage when geometric calculation fails."""
    return {
        "lot_coverage_pct": 0.68,
        "building_area_sqft": 2720.0,
        "parcel_area_sqft": 4000.0,
        "zoning_max_coverage": Config.DEFAULT_MAX_LOT_COVERAGE,
        "expansion_risk": "HIGH",
        "method": "mock_fallback",
        "confidence": 0.5,
        "cv_delta": 0.0,
    }


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("🏛  TitleGuard AI — Spatial Property Risk Intelligence Engine")
    print("   Starting on http://localhost:5001")
    app.run(host="0.0.0.0", port=5001, debug=Config.DEBUG)
