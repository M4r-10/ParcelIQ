"""
TitleGuard AI -- CV-Based Lot Coverage Estimation

Pipeline:
  1. Load satellite image (tightly cropped to parcel bbox)
  2. Project parcel polygon onto image pixels -> create parcel mask
  3. Mask everything OUTSIDE the parcel before segmentation
  4. Segment building footprint using HSV color analysis
  5. Compute building area vs parcel area -> lot coverage %
  6. Generate annotated debug visualization
"""

import numpy as np
import cv2
import os


def estimate_lot_coverage(
    parcel_geojson: dict,
    satellite_image_path: str = None,
    image_bbox: tuple = None,
) -> dict:
    """
    Estimate lot coverage percentage using computer vision.

    Args:
        parcel_geojson:       GeoJSON Feature with parcel Polygon geometry.
        satellite_image_path: Path to satellite image file (or None for mock).
        image_bbox:           (minLon, minLat, maxLon, maxLat) of the image
                              extent, used for precise geo-to-pixel projection.

    Returns:
        dict with coverage metrics, risk assessment, and debug image path.
    """
    if satellite_image_path is None:
        return _mock_coverage_result()

    # --- Step 1: Load satellite image ---
    image = cv2.imread(satellite_image_path)
    if image is None:
        raise ValueError(f"Could not load image: {satellite_image_path}")

    vis_image = image.copy()
    h, w = image.shape[:2]

    # --- Step 2: Build parcel mask ---
    parcel_mask, parcel_pixel_area, has_real_parcel = _build_parcel_mask(
        parcel_geojson, image, image_bbox
    )

    # --- Step 3: Mask the image to just the parcel area ---
    # Everything outside the parcel becomes black -> won't be segmented
    masked_image = cv2.bitwise_and(image, image, mask=parcel_mask)

    # --- Step 4: Segment building footprint (only inside parcel) ---
    building_mask = _segment_building_footprint(masked_image)
    # Intersect with parcel mask to be safe
    building_mask = cv2.bitwise_and(building_mask, building_mask, mask=parcel_mask)
    building_pixel_area = np.count_nonzero(building_mask)

    # --- Step 5: Calculate areas & coverage ---
    if parcel_pixel_area <= 0:
        parcel_pixel_area = 1

    scale = _get_map_scale(parcel_geojson, image, image_bbox)
    building_area_sqft = building_pixel_area * scale
    parcel_area_sqft = parcel_pixel_area * scale

    coverage_pct = building_area_sqft / parcel_area_sqft if parcel_area_sqft > 0 else 0

    zoning_max = 0.70
    expansion_risk = "HIGH" if coverage_pct > (zoning_max * 0.9) else "LOW"

    # --- Step 6: Generate Visualization ---
    # Semi-transparent red overlay on detected buildings
    red_overlay = np.zeros_like(vis_image)
    red_overlay[building_mask > 0] = [0, 0, 255]
    vis_image = cv2.addWeighted(vis_image, 1.0, red_overlay, 0.4, 0)

    # Draw parcel boundary outline in bright cyan
    parcel_contours, _ = cv2.findContours(
        parcel_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    cv2.drawContours(vis_image, parcel_contours, -1, (255, 255, 0), 2)  # cyan BGR

    # Semi-transparent dark overlay on everything OUTSIDE the parcel
    outside_mask = cv2.bitwise_not(parcel_mask)
    dark_overlay = np.zeros_like(vis_image)
    dark_overlay[outside_mask > 0] = [0, 0, 0]
    vis_image[outside_mask > 0] = (
        vis_image[outside_mask > 0] * 0.35
    ).astype(np.uint8)

    # Text overlay
    text = f"Coverage: {coverage_pct*100:.1f}% (Max {zoning_max*100:.0f}%)"
    cv2.putText(vis_image, text, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 255), 2)

    parcel_label = "PARCEL BOUNDARY" if has_real_parcel else "ESTIMATED BOUNDARY"
    cv2.putText(vis_image, parcel_label, (20, h - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 1)

    # Save debug image
    output_dir = os.path.dirname(satellite_image_path)
    base_name = os.path.basename(satellite_image_path)
    out_filename = f"out_cv_{base_name}"
    out_path = os.path.join(output_dir, out_filename)
    cv2.imwrite(out_path, vis_image)

    return {
        "lot_coverage_pct": round(coverage_pct, 4),
        "building_area_sqft": round(building_area_sqft, 1),
        "parcel_area_sqft": round(parcel_area_sqft, 1),
        "zoning_max_coverage": zoning_max,
        "expansion_risk": expansion_risk,
        "method": "cv_segmentation",
        "confidence": 0.90 if has_real_parcel else 0.75,
        "debug_image_url": f"/images/{out_filename}",
    }


# ---------------------------------------------------------------------------
# Parcel mask construction
# ---------------------------------------------------------------------------

def _build_parcel_mask(
    parcel_geojson: dict,
    image: np.ndarray,
    image_bbox: tuple = None,
) -> tuple:
    """
    Project the parcel GeoJSON polygon onto image pixel coordinates
    and return a filled binary mask.

    When image_bbox is provided, uses exact geo-to-pixel projection.
    Otherwise falls back to relative projection or center-80% estimate.

    Returns:
        (mask, pixel_area, has_real_parcel)
    """
    h, w = image.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)

    try:
        geom = parcel_geojson.get("geometry", {})
        coords = geom.get("coordinates", [[]])[0]
        if len(coords) < 3:
            raise ValueError("Not enough coordinates")

        lons = [c[0] for c in coords]
        lats = [c[1] for c in coords]

        if image_bbox:
            # Precise projection: we know the exact lon/lat of the image edges
            img_min_lon, img_min_lat, img_max_lon, img_max_lat = image_bbox
            lon_range = img_max_lon - img_min_lon
            lat_range = img_max_lat - img_min_lat
        else:
            # Relative projection with padding
            pad = 0.15
            min_lon, max_lon = min(lons), max(lons)
            min_lat, max_lat = min(lats), max(lats)
            lon_span = max_lon - min_lon or 0.0001
            lat_span = max_lat - min_lat or 0.0001
            img_min_lon = min_lon - lon_span * pad
            img_max_lon = max_lon + lon_span * pad
            img_min_lat = min_lat - lat_span * pad
            img_max_lat = max_lat + lat_span * pad
            lon_range = img_max_lon - img_min_lon
            lat_range = img_max_lat - img_min_lat

        pts = []
        for lon, lat in coords:
            px = int(((lon - img_min_lon) / lon_range) * w)
            # Flip y — image y=0 is top (north)
            py = int((1.0 - (lat - img_min_lat) / lat_range) * h)
            pts.append([px, py])

        pts_array = np.array(pts, np.int32).reshape((-1, 1, 2))
        cv2.fillPoly(mask, [pts_array], 255)

        area = np.count_nonzero(mask)
        if area > 0:
            return mask, area, True

    except Exception as e:
        print(f"[cv_coverage] Parcel projection failed: {e}")

    # Fallback: assume center 80% is the parcel
    border_y, border_x = int(h * 0.1), int(w * 0.1)
    mask[border_y:h - border_y, border_x:w - border_x] = 255
    return mask, int(h * w * 0.64), False


# ---------------------------------------------------------------------------
# Building segmentation
# ---------------------------------------------------------------------------

def _segment_building_footprint(image: np.ndarray) -> np.ndarray:
    """
    Detect building footprint using HSV color masking.
    Removes vegetation and shadows, then finds the largest structures.
    """
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    # Mask out vegetation (green hues)
    lower_green = np.array([30, 40, 40])
    upper_green = np.array([90, 255, 255])
    veg_mask = cv2.inRange(hsv, lower_green, upper_green)

    # Mask out shadows / very dark areas
    lower_dark = np.array([0, 0, 0])
    upper_dark = np.array([180, 255, 60])
    shadow_mask = cv2.inRange(hsv, lower_dark, upper_dark)

    # Mask out sky-blue (pools, sky reflection)
    lower_blue = np.array([95, 50, 50])
    upper_blue = np.array([130, 255, 255])
    blue_mask = cv2.inRange(hsv, lower_blue, upper_blue)

    # Combine all background masks
    bg_mask = cv2.bitwise_or(veg_mask, shadow_mask)
    bg_mask = cv2.bitwise_or(bg_mask, blue_mask)

    # Foreground = everything not background
    fg_mask = cv2.bitwise_not(bg_mask)

    # Morphological cleanup
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel, iterations=2)
    fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel, iterations=3)

    # Find contours and keep only significant structures
    contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    building_mask = np.zeros_like(fg_mask)

    if contours:
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        max_area = cv2.contourArea(contours[0])

        for cnt in contours:
            area = cv2.contourArea(cnt)
            # Keep contours that are >= 10% of the largest (main house + garage)
            if area > 300 and area >= max_area * 0.10:
                cv2.drawContours(building_mask, [cnt], -1, 255, thickness=cv2.FILLED)

    return building_mask


# ---------------------------------------------------------------------------
# Scale computation
# ---------------------------------------------------------------------------

def _get_map_scale(
    parcel_geojson: dict,
    image: np.ndarray,
    image_bbox: tuple = None,
) -> float:
    """
    Calculate sq ft per pixel from the image's geographic extent.
    """
    try:
        if image_bbox:
            min_lon, min_lat, max_lon, max_lat = image_bbox
        elif "geometry" in parcel_geojson and "coordinates" in parcel_geojson["geometry"]:
            coords = parcel_geojson["geometry"]["coordinates"][0]
            lons = [c[0] for c in coords]
            lats = [c[1] for c in coords]
            pad = 0.15
            min_lon = min(lons) - (max(lons) - min(lons)) * pad
            max_lon = max(lons) + (max(lons) - min(lons)) * pad
            min_lat = min(lats) - (max(lats) - min(lats)) * pad
            max_lat = max(lats) + (max(lats) - min(lats)) * pad
        else:
            return 0.25  # default for high-res imagery

        avg_lat = (min_lat + max_lat) / 2.0
        ft_per_deg_lat = 364000.0
        ft_per_deg_lon = 364000.0 * np.cos(np.radians(avg_lat))

        width_ft = (max_lon - min_lon) * ft_per_deg_lon
        height_ft = (max_lat - min_lat) * ft_per_deg_lat

        total_sqft = width_ft * height_ft
        total_pixels = image.shape[0] * image.shape[1]

        if total_pixels > 0:
            return total_sqft / total_pixels

    except Exception:
        pass

    return 0.25


# ---------------------------------------------------------------------------
# Mock fallback
# ---------------------------------------------------------------------------

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
            "Only 2% margin remaining -- expansion risk is HIGH."
        ),
    }
