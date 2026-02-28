"""
TitleGuard AI — Earthquake Risk Prediction Model

Fetches real USGS (United States Geological Survey) historical earthquake
data and converts them into GeoJSON for Mapbox visualization.
"""

import requests
from datetime import datetime

# Filter out minor tremors — only show significant/damaging quakes
MIN_MAGNITUDE = 4.5
START_DATE = "1950-01-01"  # Going back decently far for major quakes
SEARCH_RADIUS_KM = 50.0    # 50km radius for earthquake impacts

def fetch_earthquake_zones(center_lat: float, center_lng: float) -> dict:
    """
    Fetches real USGS historical earthquakes around a property.
    Returns a GeoJSON FeatureCollection containing Point features.

    Data source: earthquake.usgs.gov/fdsnws/event/1/
    """
    try:
        url = "https://earthquake.usgs.gov/fdsnws/event/1/query"
        params = {
            "format": "geojson",
            "starttime": START_DATE,
            "endtime": datetime.now().strftime("%Y-%m-%d"),
            "minmagnitude": MIN_MAGNITUDE,
            "latitude": center_lat,
            "longitude": center_lng,
            "maxradiuskm": SEARCH_RADIUS_KM,
            "limit": 100,  # Cap at 100 to avoid massive payloads
        }
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"[Earthquake Model] USGS query failed: {e}")
        return {"type": "FeatureCollection", "features": []}

    usgs_features = data.get("features", [])
    if not usgs_features:
        print("[Earthquake Model] No significant historical earthquakes in area.")
        return {"type": "FeatureCollection", "features": []}

    # Format into our expected GeoJSON format
    geojson_features = []

    for feature in usgs_features:
        props = feature.get("properties", {})
        geometry = feature.get("geometry", {})
        
        mag = props.get("mag", 0.0)
        place = props.get("place", "Unknown location")
        time_ms = props.get("time", 0)
        
        # Calculate a severity weight based on magnitude
        # Mag 4.5 = 0.4, Mag 6.0 = 0.7, Mag 7.5+ = 1.0
        severity = min(max((mag - 4.0) / 3.5, 0.3), 1.0)
        
        # Format the year
        year = datetime.fromtimestamp(time_ms / 1000).year if time_ms else None

        geojson_features.append({
            "type": "Feature",
            "properties": {
                "magnitude": round(mag, 1),
                "place": place,
                "year": year,
                "severity": severity,
            },
            "geometry": geometry, # Already a GeoJSON Point [lng, lat, depth]
        })

    print(f"[Earthquake Model] Found {len(geojson_features)} historical earthquakes.")

    return {
        "type": "FeatureCollection",
        "features": geojson_features,
    }
