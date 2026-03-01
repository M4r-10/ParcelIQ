"""Step-by-step pipeline test to isolate the OSError."""
import sys, os, traceback
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

print("=== Step 1: Geocode ===")
try:
    from services.geocoder import geocode_address
    loc = geocode_address("54 Turnbury Lane, Irvine, CA 92620")
    print(f"  OK: {loc}")
except Exception as e:
    print(f"  FAIL: {e}")
    traceback.print_exc()

print("\n=== Step 2: Fetch parcel ===")
try:
    from services.parcel_client import fetch_parcel_boundary
    parcel = fetch_parcel_boundary(loc["lat"], loc["lng"])
    print(f"  OK: {type(parcel)}")
except Exception as e:
    print(f"  FAIL: {e}")
    traceback.print_exc()

print("\n=== Step 3: Fetch building ===")
try:
    from services.parcel_client import fetch_building_footprint
    building = fetch_building_footprint(loc["lat"], loc["lng"])
    print(f"  OK: {type(building)}")
except Exception as e:
    print(f"  FAIL: {e}")
    traceback.print_exc()

print("\n=== Step 4: Satellite image ===")
try:
    from services.satellite_client import fetch_satellite_image
    sat_path = fetch_satellite_image(loc["lat"], loc["lng"], parcel_geojson=parcel)
    print(f"  OK: {sat_path}")
except Exception as e:
    print(f"  FAIL: {e}")
    traceback.print_exc()

print("\n=== Step 5: CV coverage ===")
try:
    from services.cv_coverage import estimate_lot_coverage
    cv_result = estimate_lot_coverage(parcel or {}, satellite_image_path=sat_path)
    print(f"  OK: coverage={cv_result.get('lot_coverage_pct')}")
except Exception as e:
    print(f"  FAIL: {e}")
    traceback.print_exc()

print("\n=== Step 6: Flood zone ===")
try:
    from services.flood_service import query_flood_zone, fetch_historical_flood_claims
    flood = query_flood_zone(loc["lat"], loc["lng"])
    claims = fetch_historical_flood_claims(loc["lat"], loc["lng"])
    print(f"  OK: zone={flood['zone']}, claims={claims}")
except Exception as e:
    print(f"  FAIL: {e}")
    traceback.print_exc()

print("\n=== Step 7: Risk scoring ===")
try:
    from services.risk_scoring import compute_risk_score
    risk = compute_risk_score({
        "flood_zone": flood["zone"],
        "inside_flood": flood["inside_flood"],
        "flood_boundary_distance": flood["flood_boundary_distance"],
        "lot_coverage_pct": cv_result.get("lot_coverage_pct", 0.5),
        "historical_flood_claims": claims,
        "wildfire_count": 0,
        "earthquake_count": 0,
    })
    print(f"  OK: score={risk['overall_score']}, tier={risk['risk_tier']}")
    print(f"      method={risk['scoring_method']}")
    print(f"      uncertainty={risk['uncertainty_level']}")
except Exception as e:
    print(f"  FAIL: {e}")
    traceback.print_exc()

print("\n=== Step 8: AI Summary ===")
try:
    from services.ai_summary import generate_risk_summary
    summary = generate_risk_summary(risk, address="54 Turnbury Lane")
    print(f"  OK: {type(summary)}")
except Exception as e:
    print(f"  FAIL: {e}")
    traceback.print_exc()

print("\n=== Step 9: Wildfire zones ===")
try:
    from services.wildfire_service import fetch_wildfire_zones
    wf = fetch_wildfire_zones(loc["lat"], loc["lng"])
    print(f"  OK: {len(wf.get('features', []))} features")
except Exception as e:
    print(f"  FAIL: {e}")
    traceback.print_exc()

print("\n=== Step 10: Earthquake zones ===")
try:
    from services.earthquake_service import fetch_earthquake_zones
    eq = fetch_earthquake_zones(loc["lat"], loc["lng"])
    print(f"  OK: {len(eq.get('features', []))} features")
except Exception as e:
    print(f"  FAIL: {e}")
    traceback.print_exc()

print("\n=== DONE ===")
