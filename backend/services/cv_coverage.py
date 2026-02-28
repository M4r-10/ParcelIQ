"""
TitleGuard AI — CV-Based Lot Coverage Estimation

Pipeline:
  1. Retrieve / load satellite image of the parcel
  2. Apply segmentation or threshold-based masking to detect building footprint
  3. Convert pixel area → real-world area using map scale
  4. Compare with zoning threshold to determine expansion risk
"""

import numpy as np
import cv2

def estimate_lot_coverage(parcel_geojson: dict, satellite_image_path: str = None) -> dict:
    """
    Estimate lot coverage percentage using computer vision.

    Args:
        parcel_geojson: GeoJSON geometry of the parcel boundary.
        satellite_image_path: Path to the satellite image file (or None for mock).

    Returns:
        dict with coverage metrics and risk assessment.
    """
    if satellite_image_path is None:
        # Return mock data for demo purposes
        return _mock_coverage_result()

    # --- Step 1: Load satellite image ---
    image = cv2.imread(satellite_image_path)
    if image is None:
        raise ValueError(f"Could not load image: {satellite_image_path}")

    # --- Step 2: Segment building footprint ---
    building_mask = _segment_building_footprint(image)

    # --- Step 3: Calculate pixel areas ---
    building_pixel_area = np.count_nonzero(building_mask)
    total_pixel_area = _get_parcel_pixel_area(parcel_geojson, image)

    # Prevent division by zero
    if total_pixel_area <= 0:
        total_pixel_area = 1

    # --- Step 4: Convert to real-world area ---
    scale = _get_map_scale(parcel_geojson, image)
    building_area_sqft = building_pixel_area * scale
    parcel_area_sqft = total_pixel_area * scale

    # --- Step 5: Compute coverage ---
    coverage_pct = building_area_sqft / parcel_area_sqft if parcel_area_sqft > 0 else 0

    # Basic zoning max coverage threshold (e.g. 70%)
    zoning_max = 0.70
    expansion_risk = "HIGH" if coverage_pct > (zoning_max * 0.9) else "LOW"

    return {
        "lot_coverage_pct": round(coverage_pct, 4),
        "building_area_sqft": round(building_area_sqft, 1),
        "parcel_area_sqft": round(parcel_area_sqft, 1),
        "zoning_max_coverage": zoning_max,
        "expansion_risk": expansion_risk,
        "method": "cv_segmentation",
        "confidence": 0.85,  # Basic confidence score for OpenCV heuristics
    }

def _segment_building_footprint(image: np.ndarray) -> np.ndarray:
    """
    Detect building footprint in a satellite image using OpenCV thresholding.
    """
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Apply Otsu's thresholding
    # Buildings often appear as different brightness compared to vegetation/asphalt
    _, mask = cv2.threshold(gray, 128, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    
    # Apply morphological operations to clean up
    kernel = np.ones((5, 5), np.uint8)
    # Close small holes inside building footprints
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    # Open to remove small objects (e.g., cars, small trees)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    
    return mask

def _get_parcel_pixel_area(parcel_geojson: dict, image: np.ndarray) -> int:
    """
    Calculate the pixel area of the parcel within the satellite image.
    Projects GeoJSON coordinates to pixel bounds if available.
    """
    height, width = image.shape[:2]
    
    try:
        if 'geometry' in parcel_geojson and 'coordinates' in parcel_geojson['geometry']:
            coords = parcel_geojson['geometry']['coordinates'][0]
            lons = [c[0] for c in coords]
            lats = [c[1] for c in coords]
            min_lon, max_lon = min(lons), max(lons)
            min_lat, max_lat = min(lats), max(lats)
            
            # Map lon/lat dynamically to 90% of the image to simulate projection
            lon_range = max_lon - min_lon or 0.0001
            lat_range = max_lat - min_lat or 0.0001
            
            padded_min_lon = min_lon - lon_range * 0.05
            padded_max_lon = max_lon + lon_range * 0.05
            padded_min_lat = min_lat - lat_range * 0.05
            padded_max_lat = max_lat + lat_range * 0.05
            
            padded_lon_range = padded_max_lon - padded_min_lon
            padded_lat_range = padded_max_lat - padded_min_lat
            
            pts = []
            for lon, lat in coords:
                px = int(((lon - padded_min_lon) / padded_lon_range) * width)
                # Flip y-axis for image coordinates
                py = int((1.0 - (lat - padded_min_lat) / padded_lat_range) * height)
                pts.append([px, py])
                
            pts_array = np.array(pts, np.int32).reshape((-1, 1, 2))
            mask = np.zeros((height, width), dtype=np.uint8)
            cv2.fillPoly(mask, [pts_array], 255)
            
            area = np.count_nonzero(mask)
            if area > 0:
                return area
    except Exception as e:
        print(f"Failed to project parcel boundaries: {e}")
        
    return int(height * width * 0.8)

def _get_map_scale(parcel_geojson: dict, image: np.ndarray) -> float:
    """
    Calculate the scale factor (sq ft per pixel) from GeoJSON distance approximations.
    """
    try:
        if 'geometry' in parcel_geojson and 'coordinates' in parcel_geojson['geometry']:
            coords = parcel_geojson['geometry']['coordinates'][0]
            lons = [c[0] for c in coords]
            lats = [c[1] for c in coords]
            min_lon, max_lon = min(lons), max(lons)
            min_lat, max_lat = min(lats), max(lats)
            
            avg_lat = sum(lats) / len(lats)
            # Approx 364,000 ft per degree of latitude
            ft_per_deg_lat = 364000
            ft_per_deg_lon = 364000 * np.cos(np.radians(avg_lat))
            
            width_ft = (max_lon - min_lon) * ft_per_deg_lon
            height_ft = (max_lat - min_lat) * ft_per_deg_lat
            
            area_sqft = width_ft * height_ft
            
            # Assume parcel covers ~81% of image (padded by 5% each side)
            total_image_area_sqft = area_sqft / 0.81
            total_pixels = image.shape[0] * image.shape[1]
            if total_pixels > 0:
                return total_image_area_sqft / total_pixels
    except Exception as e:
        pass
        
    return 0.5  # default 0.5 sq ft per pixel

def _mock_coverage_result() -> dict:
    """Return a realistic mock coverage result for demo purposes."""
    return {
        "lot_coverage_pct": 0.68,
        "building_area_sqft": 2720.0,
        "parcel_area_sqft": 4000.0,
        "zoning_max_coverage": 0.70,
        "expansion_risk": "HIGH",
        "method": "mock",
        "confidence": 0.95,
        "explanation": (
            "Current lot coverage: 68%. "
            "Zoning max: 70%. "
            "Only 2% margin remaining — expansion risk is HIGH."
        ),
    }

