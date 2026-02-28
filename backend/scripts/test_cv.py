"""
Test script for the CV Coverage pipeline.

Full end-to-end: geocode -> building footprint -> parcel boundary ->
satellite image (bbox-cropped) -> CV segmentation -> coverage result
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"))

from services.satellite_client import fetch_satellite_image, compute_building_bearing
from services.cv_coverage import estimate_lot_coverage
from services.geocoding import geocode_address, fetch_parcel_boundary, fetch_building_footprint

# ---------------------------------------------------------------
TEST_ADDRESS = "54 Turnbury Lane, Irvine, CA 92620"
# ---------------------------------------------------------------

def main():
    print("\n" + "=" * 60)
    print("  [CV] Parcel-Bounded Satellite + Lot Coverage Test")
    print("=" * 60)
    print(f"  Address: {TEST_ADDRESS}")
    print("-" * 60)

    # 1. Geocode
    print("\n  [1/5] Geocoding address ...")
    try:
        location = geocode_address(TEST_ADDRESS)
        lat, lng = location["lat"], location["lng"]
        print(f"         Lat: {lat:.6f}   Lng: {lng:.6f}")
    except Exception as e:
        print(f"         FAILED: {e}")
        return

    # 2. Fetch parcel boundary
    print("\n  [2/5] Fetching parcel boundary ...")
    parcel = fetch_parcel_boundary(lat, lng)
    if parcel and "geometry" in parcel:
        coords = parcel["geometry"].get("coordinates", [[]])[0]
        print(f"         Parcel polygon: {len(coords)} vertices")
    else:
        print("         No parcel found (will use estimated boundary)")
        parcel = {}

    # 3. Fetch building footprint + compute bearing
    print("\n  [3/5] Fetching building footprint ...")
    building = fetch_building_footprint(lat, lng)
    bearing = 0.0
    if building:
        bearing = compute_building_bearing(building)
        print(f"         Building found, bearing: {bearing:.0f} deg")
    else:
        print("         No building footprint (bearing: 0 deg)")

    # 4. Fetch satellite image (bbox-cropped to parcel)
    print("\n  [4/5] Fetching satellite image (parcel-bounded) ...")
    sat_path = fetch_satellite_image(
        lat, lng,
        parcel_geojson=parcel if parcel else None,
        bearing=bearing,
        address=TEST_ADDRESS,
    )
    if sat_path:
        size_kb = os.path.getsize(sat_path) / 1024
        print(f"         Saved: {sat_path}")
        print(f"         Size:  {size_kb:.0f} KB")
    else:
        print("         FAILED -- falling back to mock")
        _print_result(estimate_lot_coverage({}), is_mock=True)
        return

    # 5. Run CV coverage (with parcel masking)
    print("\n  [5/5] Running CV segmentation (parcel-masked) ...")
    result = estimate_lot_coverage(
        parcel if parcel else {},
        satellite_image_path=sat_path,
    )
    _print_result(result)

    # Show debug image location
    if result.get("debug_image_url"):
        debug_name = os.path.basename(result["debug_image_url"])
        debug_path = os.path.join(os.path.dirname(sat_path), debug_name)
        if os.path.exists(debug_path):
            print(f"\n  Debug image: {debug_path}")

    print("\n" + "=" * 60 + "\n")


def _print_result(result, is_mock=False):
    label = " (MOCK)" if is_mock else ""
    print("\n" + "=" * 60)
    print(f"  [CV] Lot Coverage Results{label}")
    print("=" * 60)
    print(f"  Lot Coverage:    {result['lot_coverage_pct'] * 100:.1f}%")
    print(f"  Building Area:   {result['building_area_sqft']:,.1f} sq ft")
    print(f"  Parcel Area:     {result['parcel_area_sqft']:,.1f} sq ft")
    print(f"  Zoning Max:      {result['zoning_max_coverage'] * 100:.0f}%")
    print(f"  Expansion Risk:  {result['expansion_risk']}")
    print(f"  Confidence:      {result['confidence'] * 100:.0f}%")
    print(f"  Method:          {result['method']}")
    print("=" * 60)


if __name__ == "__main__":
    main()
