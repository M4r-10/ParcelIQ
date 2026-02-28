"""
TitleGuard AI — Geocoding Service

Converts property addresses to geographic coordinates using Mapbox Geocoding API.
"""

import requests
from config import Config


def geocode_address(address: str) -> dict:
    """
    Convert a property address to latitude/longitude coordinates.

    Args:
        address: Full property address string.

    Returns:
        dict with lat, lng, formatted_address, and confidence.
    """
    if not Config.MAPBOX_TOKEN:
        # Return mock coordinates when token is not configured
        return _mock_geocode(address)

    # TODO: Implement real Mapbox Geocoding API call
    # try:
    #     url = "https://api.mapbox.com/geocoding/v5/mapbox.places"
    #     params = {
    #         "access_token": Config.MAPBOX_TOKEN,
    #         "limit": 1,
    #         "types": "address",
    #     }
    #     encoded_address = requests.utils.quote(address)
    #     response = requests.get(f"{url}/{encoded_address}.json", params=params)
    #     response.raise_for_status()
    #     data = response.json()
    #
    #     if data.get("features"):
    #         feature = data["features"][0]
    #         lng, lat = feature["geometry"]["coordinates"]
    #         return {
    #             "lat": lat,
    #             "lng": lng,
    #             "formatted_address": feature.get("place_name", address),
    #             "confidence": feature.get("relevance", 0),
    #         }
    # except requests.RequestException as e:
    #     # TODO: Add logging
    #     pass

    return _mock_geocode(address)


def reverse_geocode(lat: float, lng: float) -> dict:
    """
    Convert coordinates back to an address.

    Args:
        lat: Latitude.
        lng: Longitude.

    Returns:
        dict with address components.
    """
    # TODO: Implement reverse geocoding
    # This is useful for click-on-map functionality
    return {
        "address": "Unknown",
        "lat": lat,
        "lng": lng,
    }


def _mock_geocode(address: str) -> dict:
    """Return mock geocoding result for demo purposes."""
    # Default to downtown Irvine, CA coordinates
    return {
        "lat": 33.6846,
        "lng": -117.8265,
        "formatted_address": address or "123 Main St, Irvine, CA 92618",
        "confidence": 0.95,
        "source": "mock",
    }
