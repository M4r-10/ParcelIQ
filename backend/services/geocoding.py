"""
TitleGuard AI — Geocoding Service

Converts property addresses to geographic coordinates using Mapbox Geocoding API.
"""

import requests
from config import Config
from shapely.geometry import Point, box
import math


def geocode_address(address: str) -> dict:
    """
    Convert a property address to latitude/longitude coordinates using OpenStreetMap's Nominatim.

    Args:
        address: Full property address string.

    Returns:
        dict with lat, lng, formatted_address, and confidence.
    """
    try:
        url = "https://nominatim.openstreetmap.org/search"
        headers = {
            # Nominatim requires a user-agent
            "User-Agent": "SpatialPropertyRiskMVP/1.0"
        }
        params = {
            "q": address,
            "format": "json",
            "limit": 1
        }
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        data = response.json()
    
        if len(data) > 0:
            feature = data[0]
            lat = float(feature["lat"])
            lng = float(feature["lon"])
            return {
                "lat": lat,
                "lng": lng,
                "formatted_address": feature.get("display_name", address),
                "confidence": feature.get("importance", 0),
            }
    except requests.RequestException as e:
        print(f"Nominatim API Error: {e}")
        raise ValueError(f"Failed to geocode address: {address}")

    raise ValueError(f"No coordinates found for address: {address}")


def reverse_geocode(lat: float, lng: float) -> dict:
    """
    Convert coordinates back to an address using Nominatim.

    Args:
        lat: Latitude.
        lng: Longitude.

    Returns:
        dict with address components.
    """
    try:
        url = "https://nominatim.openstreetmap.org/reverse"
        headers = {
            "User-Agent": "SpatialPropertyRiskMVP/1.0"
        }
        params = {
            "lat": lat,
            "lon": lng,
            "format": "json"
        }
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        data = response.json()

        if data and "display_name" in data:
            return {
                "address": data["display_name"],
                "lat": lat,
                "lng": lng,
            }
    except requests.RequestException as e:
        print(f"Nominatim Reverse Geocoding API Error: {e}")

    return {
        "address": f"{lat}, {lng}",
        "lat": lat,
        "lng": lng,
    }


def fetch_parcel_boundary(lat: float, lng: float, radius_meters: float = 50) -> dict:
    """
    Calculates an approximate property bounding box.
    In environments without a real municipal GIS or paid boundary API, we calculate 
    an approximate geometric bounding box centered on the coordinate to represent the parcel.
    """
    # Rough approximation: 1 degree latitude is ~111km
    deg_lat = radius_meters / 111111.0
    deg_lng = radius_meters / (111111.0 * math.cos(math.radians(lat)))
    
    parcel_box = box(lng - deg_lng, lat - deg_lat, lng + deg_lng, lat + deg_lat)
    
    return {
        "type": "Feature",
        "properties": {
            "source": "calculated_bounding_box",
            "property_age": 30
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [list(parcel_box.exterior.coords)]
        }
    }


def fetch_building_footprint(lat: float, lng: float, radius_meters: float = 50) -> dict | None:
    """
    Fetch actual building footprint geometry from OpenStreetMap via Overpass API.
    
    Uses progressive radius search (50m → 100m → 200m) and picks the
    building closest to the target coordinate. Returns None only if all
    attempts fail entirely.
    """
    radii = [radius_meters, 100, 200]
    
    for r in radii:
        result = _overpass_building_query(lat, lng, r)
        if result:
            return result
    
    # No OSM building found at any radius — generate an estimate
    return _estimate_building_footprint(lat, lng)


def _overpass_building_query(lat: float, lng: float, radius_m: float) -> dict | None:
    """Query Overpass for buildings within radius_m of (lat, lng)."""
    deg_lat = radius_m / 111111.0
    deg_lng = radius_m / (111111.0 * math.cos(math.radians(lat)))
    
    bbox = f"{lat - deg_lat},{lng - deg_lng},{lat + deg_lat},{lng + deg_lng}"
    
    overpass_url = "http://overpass-api.de/api/interpreter"
    overpass_query = f"""
    [out:json];
    (
      way["building"]({bbox});
      relation["building"]({bbox});
    );
    out geom;
    """
    
    try:
        response = requests.post(overpass_url, data=overpass_query, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        elements = data.get("elements", [])
        if not elements:
            return None
        
        # Pick the building nearest to the target coordinate
        best = None
        best_dist = float("inf")
        
        for el in elements:
            if "geometry" not in el:
                continue
            coords = [[pt["lon"], pt["lat"]] for pt in el["geometry"]]
            if len(coords) < 3:
                continue
            # Ensure polygon is closed
            if coords[0] != coords[-1]:
                coords.append(coords[0])
            
            # Compute centroid distance to target
            avg_lat = sum(c[1] for c in coords) / len(coords)
            avg_lng = sum(c[0] for c in coords) / len(coords)
            dist = math.hypot(avg_lat - lat, avg_lng - lng)
            
            if dist < best_dist:
                best_dist = dist
                best = {
                    "type": "Feature",
                    "properties": {
                        "source": "osm_overpass",
                        "tags": el.get("tags", {}),
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [coords]
                    }
                }
        
        return best
        
    except Exception as e:
        print(f"Building footprint query failed (r={radius_m}m): {e}")
        return None


def _estimate_building_footprint(lat: float, lng: float) -> dict:
    """
    Generate an estimated building footprint when OSM has no data.
    
    Uses a typical residential building size (~1,500 sq ft ≈ 140 m²)
    centered on the geocoded coordinate. This ensures the pipeline
    always has a reasonable building to work with.
    """
    # Typical residential footprint: ~12m × 12m (≈ 1,550 sq ft)
    half_side_m = 6.0
    
    deg_lat = half_side_m / 111111.0
    deg_lng = half_side_m / (111111.0 * math.cos(math.radians(lat)))
    
    building_box = box(lng - deg_lng, lat - deg_lat, lng + deg_lng, lat + deg_lat)
    
    return {
        "type": "Feature",
        "properties": {
            "source": "estimated",
            "estimated_sqft": 1550,
            "note": "No OSM building found; using typical residential estimate",
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [list(building_box.exterior.coords)]
        }
    }

