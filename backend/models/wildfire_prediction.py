"""
TitleGuard AI — Wildfire Zone Prediction Model

Fetches real NIFC (National Interagency Fire Center) historical wildfire
perimeter polygons and converts them into GeoJSON for Mapbox visualization.
"""

import requests
from math import radians, cos


def fetch_wildfire_zones(center_lat: float, center_lng: float) -> dict:
    """
    Fetches real NIFC historical wildfire perimeter polygons around a property.
    Returns a GeoJSON FeatureCollection for Mapbox rendering.

    Data source: NIFC InterAgencyFirePerimeterHistory_All_Years_View
    """
    # 1. Build a bounding box (~3km radius — fires can be large)
    radius_km = 3.0
    lat_offset = radius_km / 111.111
    lng_offset = radius_km / (111.111 * cos(radians(center_lat)))

    bbox = f"{center_lng - lng_offset},{center_lat - lat_offset},{center_lng + lng_offset},{center_lat + lat_offset}"

    # 2. Query NIFC for historical wildfire perimeters
    try:
        url = "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/InterAgencyFirePerimeterHistory_All_Years_View/FeatureServer/0/query"
        params = {
            "geometry": bbox,
            "geometryType": "esriGeometryEnvelope",
            "inSR": "4326",
            "outSR": "4326",
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "INCIDENT,FIRE_YEAR,GIS_ACRES",
            "returnGeometry": "true",
            "f": "json",
            "resultRecordCount": "50",
        }
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"[Wildfire Model] NIFC query failed: {e}")
        return {"type": "FeatureCollection", "features": []}

    nifc_features = data.get("features", [])
    if not nifc_features:
        print("[Wildfire Model] No historical fires in area.")
        return {"type": "FeatureCollection", "features": []}

    # 3. Convert ArcGIS features to GeoJSON
    geojson_features = []

    for feature in nifc_features:
        attrs = feature.get("attributes", {})
        geometry = feature.get("geometry", {})
        rings = geometry.get("rings", [])

        if not rings:
            continue

        fire_name = attrs.get("INCIDENT", "Unknown")
        fire_year = attrs.get("FIRE_YEAR", 0)
        acres = attrs.get("GIS_ACRES", 0)

        # Simplify large polygons for performance
        simplified_rings = []
        for ring in rings:
            if len(ring) > 500:
                step = max(1, len(ring) // 500)
                simplified = ring[::step]
                if simplified[-1] != ring[-1]:
                    simplified.append(ring[-1])
                simplified_rings.append(simplified)
            else:
                simplified_rings.append(ring)

        # Severity based on fire size
        if acres > 10000:
            severity = 1.0
        elif acres > 1000:
            severity = 0.8
        elif acres > 100:
            severity = 0.6
        else:
            severity = 0.4

        geojson_features.append({
            "type": "Feature",
            "properties": {
                "fire_name": fire_name,
                "fire_year": fire_year,
                "acres": round(acres, 1),
                "severity": severity,
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": simplified_rings,
            },
        })

    print(f"[Wildfire Model] Found {len(geojson_features)} historical wildfire perimeters.")

    return {
        "type": "FeatureCollection",
        "features": geojson_features,
    }
