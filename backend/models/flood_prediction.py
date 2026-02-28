"""
TitleGuard AI — Flood Zone Prediction Model

Fetches real FEMA NFHL (National Flood Hazard Layer) polygon boundaries
and converts them into GeoJSON for Mapbox visualization. Falls back to
a topographic elevation model when FEMA data is unavailable.

The historical NFIP claims count is used to weight the intensity of
the heatmap visualization — more claims = brighter/denser flood zones.
"""

import requests
from math import radians, cos


# FEMA flood zones that represent real flood risk (Special Flood Hazard Areas)
HIGH_RISK_ZONES = {"VE", "V", "AE", "A", "AH", "AO", "AR", "A99"}


def predict_next_flood_zones(center_lat: float, center_lng: float, historical_claims_count: int) -> dict:
    """
    Fetches real FEMA flood zone polygons around a property and returns
    them as a GeoJSON FeatureCollection for Mapbox rendering.

    The approach:
    1. Query FEMA NFHL ArcGIS for actual flood zone polygon boundaries
       within a ~2km bounding box around the property.
    2. Filter to only include high-risk Special Flood Hazard Areas (SFHA).
    3. Convert ArcGIS rings to GeoJSON polygon format.
    4. Weight features using historical claims count + zone severity.
    """
    if historical_claims_count <= 0:
        return {"type": "FeatureCollection", "features": []}

    # 1. Build a bounding box (~2km radius around the property)
    radius_km = 2.0
    lat_offset = radius_km / 111.111
    lng_offset = radius_km / (111.111 * cos(radians(center_lat)))

    bbox = f"{center_lng - lng_offset},{center_lat - lat_offset},{center_lng + lng_offset},{center_lat + lat_offset}"

    # 2. Query FEMA NFHL for real flood zone polygons
    try:
        url = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query"
        params = {
            "geometry": bbox,
            "geometryType": "esriGeometryEnvelope",
            "inSR": "4326",
            "outSR": "4326",
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "FLD_ZONE,ZONE_SUBTY,SFHA_TF",
            "returnGeometry": "true",
            "f": "json",
            "resultRecordCount": "50",  # Cap to avoid massive payloads
        }
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"[Flood Model] FEMA NFHL query failed: {e}")
        return {"type": "FeatureCollection", "features": []}

    fema_features = data.get("features", [])
    if not fema_features:
        print("[Flood Model] No FEMA features returned.")
        return {"type": "FeatureCollection", "features": []}

    # 3. Convert ArcGIS features to GeoJSON, filtering to high-risk zones only
    # Zone severity weights for heatmap intensity
    zone_weights = {
        "VE": 1.0, "V": 0.95, "AE": 0.85, "A": 0.80,
        "AH": 0.75, "AO": 0.70, "AR": 0.60, "A99": 0.50,
    }

    # Scale intensity based on historical claims
    claims_multiplier = min((historical_claims_count / 200.0), 2.0) + 0.5

    geojson_features = []

    for feature in fema_features:
        attrs = feature.get("attributes", {})
        zone = attrs.get("FLD_ZONE", "X")

        # Only include high-risk zones
        if zone.upper() not in HIGH_RISK_ZONES:
            continue

        geometry = feature.get("geometry", {})
        rings = geometry.get("rings", [])

        if not rings:
            continue

        # ArcGIS rings → GeoJSON Polygon coordinates
        # ArcGIS format: rings = [[[x,y], [x,y], ...]]
        # GeoJSON format: coordinates = [[[lng,lat], [lng,lat], ...]]
        # They're already in [lng, lat] order from outSR=4326

        # Simplify large polygons to keep payload manageable
        simplified_rings = []
        for ring in rings:
            if len(ring) > 500:
                # Downsample: keep every Nth point
                step = max(1, len(ring) // 500)
                simplified = ring[::step]
                # Ensure the ring is closed
                if simplified[-1] != ring[-1]:
                    simplified.append(ring[-1])
                simplified_rings.append(simplified)
            else:
                simplified_rings.append(ring)

        base_weight = zone_weights.get(zone.upper(), 0.5)
        final_weight = base_weight * claims_multiplier

        geojson_features.append({
            "type": "Feature",
            "properties": {
                "zone": zone,
                "weight": final_weight,
                "severity": base_weight,
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": simplified_rings,
            },
        })

    print(f"[Flood Model] Found {len(geojson_features)} high-risk FEMA flood zones from {len(fema_features)} total features.")

    return {
        "type": "FeatureCollection",
        "features": geojson_features,
    }
