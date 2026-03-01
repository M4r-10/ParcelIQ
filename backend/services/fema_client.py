"""
TitleGuard AI — Flood Risk Assessment Service

Uses the Open-Meteo Elevation API + coastal/water proximity heuristics
to estimate real flood risk for any lat/lng coordinate.

The FEMA NFHL ArcGIS REST API (Layer 28) is used when available,
but may be unreachable. This module provides robust fallback logic.

Flood risk factors:
  - Elevation (lower = higher risk)
  - Coastal proximity (from Overpass API water features)
  - Regional flood zone classification heuristic
"""

import math
import requests


def query_flood_zone(lat: float, lng: float) -> dict:
    """
    Determine flood risk for a property at (lat, lng).
    
    Uses multiple data sources:
      1. Open-Meteo Elevation API for real elevation
      2. FEMA NFHL ArcGIS (if available)
      3. Overpass API for nearby water features
    
    Returns:
        dict with zone, inside_flood, flood_boundary_distance,
        exposure, description, source
    """
    # Get real elevation
    elevation_m = _get_elevation(lat, lng)
    
    # Check FEMA first (may be unavailable)
    fema_result = _try_fema_query(lat, lng)
    if fema_result:
        return fema_result
    
    # Estimate flood risk from elevation + water proximity
    water_distance_m = _estimate_water_proximity(lat, lng)
    
    return _elevation_based_flood_risk(lat, lng, elevation_m, water_distance_m)


def _get_elevation(lat: float, lng: float) -> float | None:
    """
    Query the Open-Meteo Elevation API for real elevation in meters.
    Free, no API key required.
    """
    try:
        resp = requests.get(
            "https://api.open-meteo.com/v1/elevation",
            params={"latitude": lat, "longitude": lng},
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
        elevations = data.get("elevation", [])
        if elevations:
            return float(elevations[0])
    except Exception as e:
        print(f"Elevation API error: {e}")
    return None


def _estimate_water_proximity(lat: float, lng: float) -> float:
    """
    Use Overpass API to find the nearest water body (river, sea, lake)
    and estimate distance in meters.
    """
    # Search within ~500m radius
    radius_m = 500
    deg = radius_m / 111111.0
    bbox = f"{lat - deg},{lng - deg},{lat + deg},{lng + deg}"
    
    query = f"""
    [out:json];
    (
      way["natural"="water"]({bbox});
      way["natural"="coastline"]({bbox});
      way["waterway"]({bbox});
      relation["natural"="water"]({bbox});
    );
    out center;
    """
    
    try:
        resp = requests.post(
            "http://overpass-api.de/api/interpreter",
            data=query,
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
        
        elements = data.get("elements", [])
        if not elements:
            return 1000.0  # No water found within 500m
        
        # Find closest water feature
        min_dist = float("inf")
        for el in elements:
            if "center" in el:
                wlat = el["center"]["lat"]
                wlng = el["center"]["lon"]
            elif "lat" in el and "lon" in el:
                wlat = el["lat"]
                wlng = el["lon"]
            else:
                continue
            
            dist = _haversine(lat, lng, wlat, wlng)
            min_dist = min(min_dist, dist)
        
        return min_dist if min_dist < float("inf") else 1000.0
        
    except Exception as e:
        print(f"Water proximity estimation failed: {e}")
        return 1000.0


def _elevation_based_flood_risk(
    lat: float, 
    lng: float, 
    elevation_m: float | None,
    water_distance_m: float,
) -> dict:
    """
    Compute flood risk heuristically from elevation and water proximity.
    
    Logic:
      - Elevation < 3m + near water → Zone AE (high risk)
      - Elevation < 5m + near coast → Zone A  
      - Elevation < 10m + near water → Zone X (moderate)
      - Otherwise → Zone X (minimal)
    """
    if elevation_m is None:
        elevation_m = 50.0  # Conservative default
    
    near_water = water_distance_m < 200  # Within 200m of water
    near_coast = water_distance_m < 100  # Within 100m of coastline
    
    if elevation_m < 3 and near_water:
        zone = "AE"
        inside = True
        exposure = 0.85
        boundary_dist = 0.0
        desc = "Zone AE — Estimated high flood risk (low elevation, near water)"
    elif elevation_m < 5 and near_coast:
        zone = "VE"
        inside = True
        exposure = 0.95
        boundary_dist = 0.0
        desc = "Zone VE — Estimated coastal flood risk (very low elevation)"
    elif elevation_m < 5 and near_water:
        zone = "A"
        inside = True
        exposure = 0.70
        boundary_dist = 0.0
        desc = "Zone A — Estimated moderate-high flood risk"
    elif elevation_m < 10 and near_water:
        zone = "X"
        inside = False
        exposure = 0.30
        boundary_dist = water_distance_m
        desc = "Zone X — Moderate flood proximity (low elevation near water)"
    elif elevation_m < 15:
        zone = "X"
        inside = False
        exposure = 0.15
        boundary_dist = max(water_distance_m, 300)
        desc = "Zone X — Low flood risk (moderate elevation)"
    else:
        zone = "X"
        inside = False
        exposure = 0.05
        boundary_dist = max(water_distance_m, 1000)
        desc = "Zone X — Minimal flood risk (high elevation)"
    
    return {
        "zone": zone,
        "zone_subtype": "",
        "inside_flood": inside,
        "flood_boundary_distance": boundary_dist,
        "exposure": exposure,
        "base_flood_elevation": None,
        "elevation_m": elevation_m,
        "water_distance_m": water_distance_m,
        "description": desc,
        "source": "elevation_heuristic",
    }


def _try_fema_query(lat: float, lng: float) -> dict | None:
    """Try FEMA NFHL REST API. Returns None if unavailable."""
    try:
        url = "https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query"
        params = {
            "geometry": f"{lng},{lat}",
            "geometryType": "esriGeometryPoint",
            "inSR": "4326",
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE",
            "returnGeometry": "false",
            "f": "json",
        }
        resp = requests.get(url, params=params, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        
        features = data.get("features", [])
        if features:
            attrs = features[0].get("attributes", {})
            zone = attrs.get("FLD_ZONE", "X")
            sfha = attrs.get("SFHA_TF", "F")
            inside = sfha == "T"
            
            exposure_map = {
                "VE": 1.0, "V": 0.95, "AE": 0.85, "A": 0.80,
                "AH": 0.75, "AO": 0.70, "AR": 0.60, "D": 0.30,
                "X": 0.05, "B": 0.10, "C": 0.05,
            }
            
            return {
                "zone": zone,
                "zone_subtype": attrs.get("ZONE_SUBTY", ""),
                "inside_flood": inside,
                "flood_boundary_distance": 0.0 if inside else 500.0,
                "exposure": exposure_map.get(zone.upper(), 0.5) if inside else 0.05,
                "base_flood_elevation": attrs.get("STATIC_BFE"),
                "description": f"Zone {zone} — FEMA NFHL designation",
                "source": "fema_nfhl",
            }
    except Exception:
        pass
    return None


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in meters between two coordinates."""
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def fetch_historical_flood_claims(lat: float, lng: float) -> int:
    """
    Fetch historical flood insurance claims in the area using OpenFEMA.
    
    Because FEMA anonymizes claims to 1 decimal point of precision for privacy,
    we query exactly that aggregated grid (~6x6 mile area).
    """
    try:
        # Round to 1 decimal place matching FEMA's anonymized precision
        r_lat = round(lat, 1)
        r_lng = round(lng, 1)
        
        url = "https://www.fema.gov/api/open/v2/FimaNfipClaims"
        params = {
            "$filter": f"latitude eq {r_lat} and longitude eq {r_lng}",
            "$inlinecount": "allpages",
            "$top": "1",  # We only need the top 1 to get the inlinecount
            "$format": "json"
        }
        
        resp = requests.get(url, params=params, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        
        # OpenFEMA v2 returns inlinecount inside metadata
        metadata = data.get("metadata", {})
        count = metadata.get("count", 0)
        
        return count
    except Exception as e:
        print(f"OpenFEMA Historical Claims query failed: {e}")
        return 0
