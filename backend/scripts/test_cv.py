import os
import sys

# Add backend dir to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.cv_coverage import estimate_lot_coverage
from data.mock_data import SAMPLE_PARCELS


# We need to find the location of the satellite mock image
frontend_img_path = r"C:\Users\12096\.gemini\antigravity\brain\d8707fdf-d5d2-4e6c-9cfc-e903faa54a6e\satellite_test_image_1772300071699.png"

# If it exists, let's run the algorithm on it
if os.path.exists(frontend_img_path):
    print(f"Testing real CV logic against {frontend_img_path}")
    geo = SAMPLE_PARCELS.get("123 Main St, Irvine, CA 92618", {})
    if not geo:
        geo = list(SAMPLE_PARCELS.values())[0]

    res = estimate_lot_coverage(geo, frontend_img_path)
    
    print("\n" + "="*50)
    print(" [CV] Computer Vision Lot Coverage Analysis")
    print("="*50)
    print(f"  Lot Coverage:         {res['lot_coverage_pct']*100:.1f}%")
    print(f"  Building Area:        {res['building_area_sqft']:,.1f} sq ft")
    print(f"  Parcel Area:          {res['parcel_area_sqft']:,.1f} sq ft")
    print(f"  Zoning Max:           {res['zoning_max_coverage']*100:.1f}%")
    print(f"  Expansion Risk:       {res['expansion_risk']}")
    print(f"  CV Confidence:        {res['confidence']*100:.1f}%")
    if 'debug_image_url' in res:
        print(f"  Output Image:         {res['debug_image_url']}")
    print("="*50 + "\n")
else:
    print(f"Could not find test image at {frontend_img_path}. Only tests mock data.")
    print("Testing mock data fallback...")
    res = estimate_lot_coverage({}, None)
    
    print("\n" + "="*50)
    print(" [CV] Computer Vision Lot Coverage Analysis (MOCK)")
    print("="*50)
    print(f"  Lot Coverage:         {res['lot_coverage_pct']*100:.1f}%")
    print(f"  Building Area:        {res['building_area_sqft']:,.1f} sq ft")
    print(f"  Parcel Area:          {res['parcel_area_sqft']:,.1f} sq ft")
    print(f"  Zoning Max:           {res['zoning_max_coverage']*100:.1f}%")
    print(f"  Expansion Risk:       {res['expansion_risk']}")
    print(f"  CV Confidence:        {res['confidence']*100:.1f}%")
    print("="*50 + "\n")
