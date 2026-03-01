"""
TitleGuard AI -- Satellite Image Client

Fetches high-resolution satellite imagery for a property, using the parcel
polygon to auto-compute zoom level so the image tightly frames the single
lot. Supports bearing alignment so the house edges are perpendicular/parallel
to the image frame.

Public API:
  - fetch_satellite_image(lat, lng, parcel_geojson, bearing, ...) -> str | None
  - compute_building_bearing(building_geojson) -> float
"""

import os
import math
import hashlib
import requests
import numpy as np
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_CACHE_DIR = _PROJECT_ROOT / "data" / "satellite_cache"
_CACHE_DIR.mkdir(parents=True, exist_ok=True)

_MAPBOX_BASE = "https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static"

# Image settings
_IMAGE_SIZE = 1024       # 1024x1024 px
_RETINA = True           # @2x -> 2048x2048 actual pixels
_FALLBACK_ZOOM = 19.5    # when no parcel available
_PADDING_FACTOR = 1.6    # how much larger than parcel bbox (1.0 = exact fit)

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_building_bearing(building_geojson: dict) -> float:
    """
    Compute the dominant orientation of a building footprint and snap
    to the nearest 90 degrees so house edges align with the image.
    """
    try:
        geom = building_geojson.get("geometry", {})
        coords = geom.get("coordinates", [[]])[0]
        if len(coords) < 4:
            return 0.0

        pts = np.array(coords, dtype=np.float64)
        best_angle = 0.0
        best_length = 0.0

        for i in range(len(pts) - 1):
            dx = pts[i + 1][0] - pts[i][0]
            dy = pts[i + 1][1] - pts[i][1]
            length = math.sqrt(dx * dx + dy * dy)
            if length > best_length:
                best_length = length
                angle_from_north = math.degrees(math.atan2(dx, dy))
                best_angle = angle_from_north

        bearing = best_angle % 360
        remainder = bearing % 90
        bearing = bearing - remainder + (90 if remainder > 45 else 0)
        return bearing % 360

    except Exception as e:
        print(f"[satellite_client] Could not compute bearing: {e}")
        return 0.0


def fetch_satellite_image(
    lat: float,
    lng: float,
    parcel_geojson: dict = None,
    bearing: float = 0.0,
    address: str = "",
) -> str | None:
    """
    Fetch a satellite image centered on (lat, lng).

    If parcel_geojson is provided, the zoom level is auto-computed so the
    image tightly frames the parcel lot (+ padding). The bearing rotates
    the map so the building aligns with the image axes.

    Returns:
        Absolute file path to the cached .png, or None on failure.
    """
    token = os.getenv("MAPBOX_TOKEN", "")
    if not token:
        print("[satellite_client] MAPBOX_TOKEN is not set -- skipping.")
        return None

    # Compute zoom from parcel polygon if available
    zoom = _compute_zoom_from_parcel(parcel_geojson, lat) if parcel_geojson else _FALLBACK_ZOOM

    # Cache key includes coords, zoom, and bearing
    cache_key = hashlib.md5(
        f"{lat:.6f},{lng:.6f},{zoom:.2f},{bearing:.0f}".encode()
    ).hexdigest()[:12]
    filename = f"sat_{cache_key}.png"
    filepath = _CACHE_DIR / filename

    if filepath.exists():
        print(f"[satellite_client] Cache hit: {filepath}")
        return str(filepath)

    retina = "@2x" if _RETINA else ""

    # Center+zoom mode with bearing (supports rotation)
    url = (
        f"{_MAPBOX_BASE}"
        f"/{lng:.6f},{lat:.6f},{zoom:.2f},{bearing:.1f},0"
        f"/{_IMAGE_SIZE}x{_IMAGE_SIZE}{retina}"
        f"?access_token={token}"
        f"&attribution=false"
        f"&logo=false"
    )

    print(f"[satellite_client] Fetching image: center=({lat:.5f},{lng:.5f}), zoom={zoom:.2f}, bearing={bearing:.0f}")
    return _download(url, filepath)


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _compute_zoom_from_parcel(parcel_geojson: dict, center_lat: float) -> float:
    """
    Calculate the Mapbox zoom level that fits the parcel into the image
    with appropriate padding.

    The math:
      - At zoom z, one pixel = C * cos(lat) / (2^z * 256) meters
        where C = 40075016.686 (earth circumference in meters)
      - We want the parcel's longest side (in meters) * padding to fill
        the image width in pixels
    """
    try:
        geom = parcel_geojson.get("geometry", {})
        coords = geom.get("coordinates", [[]])[0]
        if len(coords) < 3:
            return _FALLBACK_ZOOM

        lons = [c[0] for c in coords]
        lats = [c[1] for c in coords]

        avg_lat = sum(lats) / len(lats)
        cos_lat = math.cos(math.radians(avg_lat))

        # Convert bbox to meters
        meters_per_deg_lon = 111320.0 * cos_lat
        meters_per_deg_lat = 110540.0

        width_m = (max(lons) - min(lons)) * meters_per_deg_lon
        height_m = (max(lats) - min(lats)) * meters_per_deg_lat

        # Use the larger dimension
        max_span_m = max(width_m, height_m) * _PADDING_FACTOR

        if max_span_m <= 0:
            return _FALLBACK_ZOOM

        # Actual pixel size (with retina)
        actual_pixels = _IMAGE_SIZE * (2 if _RETINA else 1)

        # meters per pixel = C * cos(lat) / (2^z * 256)
        # Solve for z: z = log2(C * cos(lat) / (mpp * 256))
        # where mpp = max_span_m / actual_pixels
        C = 40075016.686
        mpp = max_span_m / actual_pixels

        zoom = math.log2(C * cos_lat / (mpp * 256))

        # Clamp to Mapbox supported range
        zoom = max(14.0, min(22.0, zoom))

        print(f"[satellite_client] Parcel span: {max_span_m:.0f}m -> auto-zoom: {zoom:.2f}")
        return round(zoom, 2)

    except Exception as e:
        print(f"[satellite_client] Zoom calc failed: {e}")
        return _FALLBACK_ZOOM


def _download(url: str, filepath: Path) -> str | None:
    """Download image from URL, validate, and cache."""
    try:
        resp = requests.get(url, timeout=20)
        resp.raise_for_status()

        content_type = resp.headers.get("Content-Type", "")
        if "image" not in content_type:
            print(f"[satellite_client] Unexpected content type: {content_type}")
            print(f"[satellite_client] Body: {resp.text[:300]}")
            return None

        filepath.write_bytes(resp.content)
        size_kb = len(resp.content) / 1024
        print(f"[satellite_client] Saved {size_kb:.0f} KB -> {filepath}")
        return str(filepath)

    except requests.RequestException as e:
        print(f"[satellite_client] Request failed: {e}")
        return None
