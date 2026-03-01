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
    masked_image = cv2.bitwise_and(image, image, mask=parcel_mask)

    # --- Step 3.5: AI Enhancement (structure-preserving) ---
    enhancement_metrics = {}
    edge_map = None
    try:
        from services.enhancement import enhance_image, ENABLE_DUAL_INFERENCE
        import hashlib as _hl

        cache_key = _hl.md5(satellite_image_path.encode()).hexdigest()[:12]
        enhanced_image, edge_map, enhancement_metrics = enhance_image(
            masked_image,
            parcel_mask=parcel_mask,
            validate=True,
            cache_key=cache_key,
        )

        if enhancement_metrics.get("enhancement_applied"):
            eh, ew = enhanced_image.shape[:2]
            parcel_mask_enh = cv2.resize(parcel_mask, (ew, eh), interpolation=cv2.INTER_NEAREST)

            # --- Step 4: Multi-Scale Ensemble Inference & TTA ---
            # We run segmentation on multiple variations and vote on the mask
            # Variation 1: Base enhanced image
            mask_v1 = _segment_building_footprint(enhanced_image, edge_map)
            
            # Variation 2: 1.5x Upscaled (captures fine structures)
            upscaled = cv2.resize(enhanced_image, (int(ew * 1.5), int(eh * 1.5)), interpolation=cv2.INTER_LANCZOS4)
            edge_up = cv2.resize(edge_map, (int(ew * 1.5), int(eh * 1.5)), interpolation=cv2.INTER_LANCZOS4) if edge_map is not None else None
            mask_v2_up = _segment_building_footprint(upscaled, edge_up)
            mask_v2 = cv2.resize(mask_v2_up, (ew, eh), interpolation=cv2.INTER_NEAREST)

            # Variation 3: Slight Gaussian Blur (ignores noisy textures)
            blurred = cv2.GaussianBlur(enhanced_image, (3, 3), 0)
            edge_blur = cv2.GaussianBlur(edge_map, (3, 3), 0) if edge_map is not None else None
            mask_v3 = _segment_building_footprint(blurred, edge_blur)

            # Variation 4: TTA Rotated 90 degrees
            rotated = cv2.rotate(enhanced_image, cv2.ROTATE_90_CLOCKWISE)
            edge_rot = cv2.rotate(edge_map, cv2.ROTATE_90_CLOCKWISE) if edge_map is not None else None
            mask_v4_rot = _segment_building_footprint(rotated, edge_rot)
            # Inverse rotate
            mask_v4 = cv2.rotate(mask_v4_rot, cv2.ROTATE_90_COUNTERCLOCKWISE)

            # --- Ensemble Majority Vote ---
            # Sum the normalized masks (0 or 1)
            vote_stack = np.stack([mask_v1 > 0, mask_v2 > 0, mask_v3 > 0, mask_v4 > 0], axis=0).astype(np.uint8)
            vote_sum = np.sum(vote_stack, axis=0)
            
            # Keep pixels where at least 2 models (or variations) agree
            ensemble_mask = np.where(vote_sum >= 2, 255, 0).astype(np.uint8)

            # Add Dual-Inference Safety (original image cross-check)
            if ENABLE_DUAL_INFERENCE:
                mask_original = _segment_building_footprint(masked_image)
                mask_original = cv2.bitwise_and(mask_original, mask_original, mask=parcel_mask)
                mask_original_up = cv2.resize(mask_original, (ew, eh), interpolation=cv2.INTER_NEAREST)
                
                # Intersection: only keep areas detected in both original AND the ensemble
                building_mask_enh = cv2.bitwise_and(mask_original_up, ensemble_mask)
                enhancement_metrics["dual_inference"] = True
            else:
                building_mask_enh = ensemble_mask
                enhancement_metrics["dual_inference"] = False

            # --- Step 4.5: Post-Processing Geometry Regularization ---
            # Enforce straight lines and clean architectural edges utilizing approxPolyDP
            building_mask_enh = cv2.bitwise_and(building_mask_enh, building_mask_enh, mask=parcel_mask_enh)
            building_mask_enh = _regularize_geometry(building_mask_enh)

            # Downscale back to original image dims for calculation
            building_mask = cv2.resize(building_mask_enh, (w, h), interpolation=cv2.INTER_NEAREST)

            if eh != h or ew != w:
                vis_image = cv2.resize(enhanced_image, (w, h), interpolation=cv2.INTER_AREA)
            else:
                vis_image = enhanced_image.copy()
        else:
            # Fallback
            building_mask = _segment_building_footprint(masked_image)
            building_mask = cv2.bitwise_and(building_mask, building_mask, mask=parcel_mask)
            building_mask = _regularize_geometry(building_mask)

    except ImportError:
        enhancement_metrics = {"enhancement_applied": False, "reason": "module_not_available"}
        building_mask = _segment_building_footprint(masked_image)
        building_mask = cv2.bitwise_and(building_mask, building_mask, mask=parcel_mask)
        building_mask = _regularize_geometry(building_mask)
    except Exception as e:
        enhancement_metrics = {"enhancement_applied": False, "reason": str(e)}
        print(f"[cv_coverage] Enhancement failed: {e}")
        building_mask = _segment_building_footprint(masked_image)
        building_mask = cv2.bitwise_and(building_mask, building_mask, mask=parcel_mask)
        building_mask = _regularize_geometry(building_mask)

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
    red_overlay = np.zeros_like(vis_image)
    red_overlay[building_mask > 0] = [0, 0, 255]
    vis_image = cv2.addWeighted(vis_image, 1.0, red_overlay, 0.4, 0)

    parcel_contours, _ = cv2.findContours(
        parcel_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    cv2.drawContours(vis_image, parcel_contours, -1, (255, 255, 0), 2)

    outside_mask = cv2.bitwise_not(parcel_mask)
    vis_image[outside_mask > 0] = (
        vis_image[outside_mask > 0] * 0.35
    ).astype(np.uint8)

    text = f"Coverage: {coverage_pct*100:.1f}% (Max {zoning_max*100:.0f}%)"
    cv2.putText(vis_image, text, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 255), 2)

    # Enhancement badge
    if enhancement_metrics.get("enhancement_applied"):
        enh_text = f"AI Enhanced | SSIM={enhancement_metrics.get('ssim_score', 0):.2f}"
        cv2.putText(vis_image, enh_text, (20, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 128), 1)

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
        "confidence": 0.92 if (has_real_parcel and enhancement_metrics.get("enhancement_applied")) else (0.90 if has_real_parcel else 0.75),
        "enhancement": enhancement_metrics,
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

def _segment_building_footprint(image: np.ndarray, edge_map: np.ndarray = None) -> np.ndarray:
    """
    Detect building footprint using HSV color masking combined with EdgeMap.
    Removes vegetation and shadows, then uses geometric edges to refine boundaries.
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

    # --- Incorporate the EdgeMap ---
    if edge_map is not None:
        # Subtract strong edges from the foreground to cleanly detach connected components
        # (e.g., separating a house from an adjacent concrete patio or driveway)
        _, strong_edges = cv2.threshold(edge_map, 100, 255, cv2.THRESH_BINARY)
        # Dilate edges slightly to act as a stronger separator
        kernel_edge = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        separators = cv2.dilate(strong_edges, kernel_edge, iterations=1)
        
        # Cut the foreground mask using the edges
        fg_mask[separators > 0] = 0

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
        # 1 degree of latitude is ~364,000 feet
        ft_per_deg_lat = 364000.0
        # 1 degree of longitude is ~364,000 feet * cos(latitude)
        ft_per_deg_lon = 364000.0 * np.cos(np.radians(avg_lat))

        width_ft = abs(max_lon - min_lon) * ft_per_deg_lon
        height_ft = abs(max_lat - min_lat) * ft_per_deg_lat

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
        "lot_coverage_pct": 0.35, # More realistic than 68%
        "building_area_sqft": 2400.0,
        "parcel_area_sqft": 6850.0,
        "zoning_max_coverage": 0.40,
        "expansion_risk": "MEDIUM",
        "method": "mock",
        "confidence": 0.85,
        "explanation": (
            "Current lot coverage: 35%. "
            "Zoning max: 40%. "
            "Moderate margin remaining."
        ),
    }
def _regularize_geometry(mask: np.ndarray, epsilon_factor: float = 0.015) -> np.ndarray:
    """
    Post-processing Geometry Regularization.
    
    Extracts contours from the segmentation mask and applies approxPolyDP 
    to simplify the shapes into straight-edged, CAD-like polygons.
    """
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    regularized_mask = np.zeros_like(mask)
    
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area > 100:  # Ignore tiny noise
            # epsilon represents the maximum distance between original curve and the approximation
            epsilon = epsilon_factor * cv2.arcLength(cnt, True)
            approx_polygon = cv2.approxPolyDP(cnt, epsilon, True)
            
            # Draw the regularized, straight-line polygon
            cv2.drawContours(regularized_mask, [approx_polygon], -1, 255, thickness=cv2.FILLED)
            
    return regularized_mask
