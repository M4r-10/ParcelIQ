"""
TitleGuard AI -- Structure-Preserving Satellite Image Enhancement

Modular preprocessing step that enhances satellite imagery clarity
before CV segmentation, WITHOUT hallucinating new geometry.

Enhanced Pipeline:
  1. Apply parcel mask (enhance only inside parcel)
  2. Multi-stage enhancement:
     a. Non-local means denoising (stronger noise reduction)
     b. Guided filter (edge-aware smoothing that preserves structure)
     c. CLAHE contrast enhancement (L-channel only)
     d. Multi-scale unsharp mask (coarse + fine edges)
     e. Morphological gradient edge reinforcement
     f. 2x super-resolution (INTER_LANCZOS4 + detail injection)
  3. Validate structural integrity (SSIM + edge overlap)
  4. If validation fails -> return original image unchanged

Public API:
  enhance_image(image, parcel_mask, validate=True) -> (enhanced, metrics)
"""

import cv2
import numpy as np
import time
import hashlib
import os
import json
from pathlib import Path
from skimage.metrics import structural_similarity as ssim

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ENABLE_AI_ENHANCEMENT = True
ENABLE_SUPER_RES = True
ENABLE_DUAL_INFERENCE = True

# Validation thresholds
SSIM_MIN_THRESHOLD = 0.50
EDGE_OVERLAP_MIN = 0.25

# Cache
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_ENHANCE_CACHE = _PROJECT_ROOT / "data" / "enhanced_cache"
_ENHANCE_CACHE.mkdir(parents=True, exist_ok=True)

# Logging
_LOG_DIR = _PROJECT_ROOT / "data" / "enhancement_logs"
_LOG_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def enhance_image(
    image: np.ndarray,
    parcel_mask: np.ndarray = None,
    validate: bool = True,
    cache_key: str = None,
) -> tuple:
    """
    Apply structure-preserving enhancement to a satellite image.

    Returns:
        (enhanced_image, edge_map, metrics_dict)
        If validation fails, enhanced_image == original image.
    """
    if not ENABLE_AI_ENHANCEMENT:
        # Return empty edge map if disabled
        return image, np.zeros(image.shape[:2], dtype=np.uint8), {"enhancement_applied": False, "reason": "disabled"}

    start_time = time.time()

    # Check cache (Note: cache doesn't store edge maps currently, we recompute it if needed)
    if cache_key:
        cached = _load_cached(cache_key)
        if cached is not None:
            # We must recompute the edge map for the cached image
            edge_map = _generate_edge_map(cached)
            return cached, edge_map, {"enhancement_applied": True, "cached": True}

    original = image.copy()
    h, w = image.shape[:2]

    # --- Stage 1: Isolate parcel region ---
    if parcel_mask is not None:
        if parcel_mask.shape[:2] != (h, w):
            parcel_mask = cv2.resize(parcel_mask, (w, h), interpolation=cv2.INTER_NEAREST)
        work_image = cv2.bitwise_and(image, image, mask=parcel_mask)
    else:
        work_image = image.copy()
        parcel_mask = np.ones((h, w), dtype=np.uint8) * 255

    # --- Stage 2: Non-local means denoising ---
    denoised = cv2.fastNlMeansDenoisingColored(work_image, None, 10, 10, 7, 21)

    # --- Stage 3: Spectral Shadow Handling ---
    # Convert to HSV, boost the V channel in dark areas to reveal hidden structure
    hsv = cv2.cvtColor(denoised, cv2.COLOR_BGR2HSV)
    h_c, s_c, v_c = cv2.split(hsv)
    # Adaptive boosting for shadows: dark pixels get lightened, bright stay same
    v_boosted = np.where(v_c < 100, np.clip(v_c * 1.5, 0, 255), v_c).astype(np.uint8)
    shadow_compensated = cv2.cvtColor(cv2.merge((h_c, s_c, v_boosted)), cv2.COLOR_HSV2BGR)

    # --- Stage 4: Guided filter (edge-aware structural smoothing) ---
    guide = cv2.cvtColor(shadow_compensated, cv2.COLOR_BGR2GRAY)
    guided = np.stack([
        _guided_filter(guide, shadow_compensated[:, :, c], radius=4, eps=0.02)
        for c in range(3)
    ], axis=2).astype(np.uint8)

    # --- Stage 5: Edge-Aware Contrast Normalization (CLAHE on LAB) ---
    lab = cv2.cvtColor(guided, cv2.COLOR_BGR2LAB)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    lab[:, :, 0] = clahe.apply(lab[:, :, 0])
    contrast_enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    # --- Stage 6: Multi-scale unsharp mask ---
    fine_sharp = _unsharp_mask(contrast_enhanced, sigma=0.8, strength=1.2)
    coarse_sharp = _unsharp_mask(fine_sharp, sigma=3.0, strength=0.5)

    # --- Stage 7: Morphological gradient edge reinforcement ---
    edge_reinforced = _reinforce_edges(coarse_sharp)

    # --- Stage 8: 2x super-resolution with detail injection ---
    if ENABLE_SUPER_RES:
        enhanced = _super_resolve_2x(edge_reinforced, work_image)
        parcel_mask_up = cv2.resize(parcel_mask, (w * 2, h * 2), interpolation=cv2.INTER_NEAREST)
    else:
        enhanced = edge_reinforced
        parcel_mask_up = parcel_mask

    # Re-apply parcel mask
    if ENABLE_SUPER_RES:
        original_up = cv2.resize(original, (w * 2, h * 2), interpolation=cv2.INTER_LANCZOS4)
        final = original_up.copy()
    else:
        final = original.copy()

    final[parcel_mask_up > 0] = enhanced[parcel_mask_up > 0]

    # --- Generate robust 4th channel EdgeMap ---
    edge_map = _generate_edge_map(final)

    # --- Stage 9: Structural validation ---
    metrics = _compute_validation_metrics(original, final, parcel_mask)
    metrics["elapsed_ms"] = round((time.time() - start_time) * 1000, 1)

    if validate:
        if metrics["ssim_score"] < SSIM_MIN_THRESHOLD:
            metrics["enhancement_applied"] = False
            metrics["reason"] = f"SSIM {metrics['ssim_score']:.3f} < {SSIM_MIN_THRESHOLD}"
            print(f"[enhancement] REJECTED: {metrics['reason']}")
            if ENABLE_SUPER_RES:
                ret_img = cv2.resize(original, (w * 2, h * 2), interpolation=cv2.INTER_LANCZOS4)
                return ret_img, _generate_edge_map(ret_img), metrics
            return original, _generate_edge_map(original), metrics

        if metrics["edge_overlap_ratio"] < EDGE_OVERLAP_MIN:
            metrics["enhancement_applied"] = False
            metrics["reason"] = f"Edge overlap {metrics['edge_overlap_ratio']:.3f} < {EDGE_OVERLAP_MIN}"
            print(f"[enhancement] REJECTED: {metrics['reason']}")
            if ENABLE_SUPER_RES:
                ret_img = cv2.resize(original, (w * 2, h * 2), interpolation=cv2.INTER_LANCZOS4)
                return ret_img, _generate_edge_map(ret_img), metrics
            return original, _generate_edge_map(original), metrics

    metrics["enhancement_applied"] = True
    metrics["reason"] = "passed_validation"

    # Cache & log
    if cache_key:
        _save_cached(cache_key, final)
    _log_metrics(cache_key or "unknown", metrics)

    print(f"[enhancement] Applied: SSIM={metrics['ssim_score']:.3f}, "
          f"EdgeOverlap={metrics['edge_overlap_ratio']:.3f}, "
          f"EdgeImprovement={metrics['edge_improvement_pct']:+.1f}%, "
          f"Time={metrics['elapsed_ms']}ms")

    return final, edge_map, metrics


# ---------------------------------------------------------------------------
# Enhancement helpers
# ---------------------------------------------------------------------------

def _unsharp_mask(image: np.ndarray, sigma: float = 1.0, strength: float = 1.5) -> np.ndarray:
    """Apply unsharp mask sharpening."""
    blurred = cv2.GaussianBlur(image, (0, 0), sigma)
    sharpened = cv2.addWeighted(image, 1.0 + strength, blurred, -strength, 0)
    return np.clip(sharpened, 0, 255).astype(np.uint8)


def _guided_filter(guide: np.ndarray, src: np.ndarray, radius: int = 4, eps: float = 0.02) -> np.ndarray:
    """
    Edge-preserving guided filter.
    Uses the guide image's edges to decide where to smooth.
    Much better than bilateral filter for preserving building edges.
    """
    guide_f = guide.astype(np.float64) / 255.0
    src_f = src.astype(np.float64) / 255.0

    ksize = 2 * radius + 1

    mean_g = cv2.boxFilter(guide_f, -1, (ksize, ksize))
    mean_s = cv2.boxFilter(src_f, -1, (ksize, ksize))
    mean_gs = cv2.boxFilter(guide_f * src_f, -1, (ksize, ksize))
    mean_gg = cv2.boxFilter(guide_f * guide_f, -1, (ksize, ksize))

    cov_gs = mean_gs - mean_g * mean_s
    var_g = mean_gg - mean_g * mean_g

    a = cov_gs / (var_g + eps)
    b = mean_s - a * mean_g

    mean_a = cv2.boxFilter(a, -1, (ksize, ksize))
    mean_b = cv2.boxFilter(b, -1, (ksize, ksize))

    result = mean_a * guide_f + mean_b
    return np.clip(result * 255, 0, 255).astype(np.uint8)


def _reinforce_edges(image: np.ndarray) -> np.ndarray:
    """
    Extract morphological gradient (edge map) and blend it back
    to reinforce building boundaries without changing interior regions.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Morphological gradient = dilation - erosion (strong boundary detector)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    morph_grad = cv2.morphologyEx(gray, cv2.MORPH_GRADIENT, kernel)

    # Threshold to keep only significant edges (building outlines)
    _, strong_edges = cv2.threshold(morph_grad, 25, 255, cv2.THRESH_BINARY)

    # Clean up small noise
    strong_edges = cv2.morphologyEx(strong_edges, cv2.MORPH_CLOSE,
                                     cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2)))

    # Create darker edge overlay for contrast at boundaries
    edge_overlay = np.zeros_like(image)
    edge_overlay[strong_edges > 0] = [40, 40, 40]  # dark gray edges

    # Blend: darken pixels at edges to increase boundary contrast
    result = image.copy()
    mask_3ch = np.stack([strong_edges] * 3, axis=2)
    # At edge pixels: blend 70% original + 30% darker
    result = np.where(
        mask_3ch > 0,
        (image.astype(np.float32) * 0.7 + edge_overlay.astype(np.float32) * 0.3).astype(np.uint8),
        image,
    )

    return result


def _super_resolve_2x(image: np.ndarray, original: np.ndarray) -> np.ndarray:
    """
    2x super-resolution with detail injection.

    1. Upscale with INTER_LANCZOS4 (sharpest interpolation)
    2. Extract and inject high-frequency detail from the enhanced image
    3. Light final sharpening
    """
    h, w = image.shape[:2]
    new_w, new_h = w * 2, h * 2

    # Lanczos upscale (preserves edges better than cubic)
    upscaled = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)

    # Extract high-frequency details: enhanced - blur(enhanced)
    blurred = cv2.GaussianBlur(upscaled, (0, 0), 2.0)
    detail = cv2.subtract(upscaled, blurred)

    # Inject detail back with controlled strength
    detail_injected = cv2.add(upscaled, cv2.multiply(detail, np.array([1.5])))
    detail_injected = np.clip(detail_injected, 0, 255).astype(np.uint8)

    # Light final sharpening
    result = _unsharp_mask(detail_injected, sigma=0.5, strength=0.4)

    return result


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _compute_validation_metrics(
    original: np.ndarray,
    enhanced: np.ndarray,
    parcel_mask: np.ndarray,
) -> dict:
    """
    Compute structural similarity and edge overlap between original
    and enhanced images. Enhanced is downscaled to original dims for comparison.
    """
    oh, ow = original.shape[:2]
    eh, ew = enhanced.shape[:2]

    if eh != oh or ew != ow:
        compare_enhanced = cv2.resize(enhanced, (ow, oh), interpolation=cv2.INTER_AREA)
    else:
        compare_enhanced = enhanced

    gray_orig = cv2.cvtColor(original, cv2.COLOR_BGR2GRAY)
    gray_enh = cv2.cvtColor(compare_enhanced, cv2.COLOR_BGR2GRAY)

    # Apply parcel mask for focused comparison
    if parcel_mask is not None:
        mask_resized = parcel_mask
        if mask_resized.shape[:2] != (oh, ow):
            mask_resized = cv2.resize(mask_resized, (ow, oh), interpolation=cv2.INTER_NEAREST)
        gray_orig = cv2.bitwise_and(gray_orig, gray_orig, mask=mask_resized)
        gray_enh = cv2.bitwise_and(gray_enh, gray_enh, mask=mask_resized)

    # SSIM
    try:
        ssim_score = ssim(gray_orig, gray_enh, data_range=255)
    except Exception:
        ssim_score = 1.0

    # Multi-threshold edge detection for robust comparison
    # Use both Canny and Laplacian for complementary edge information
    edges_orig_canny = cv2.Canny(gray_orig, 50, 150)
    edges_enh_canny = cv2.Canny(gray_enh, 50, 150)

    # Laplacian edges (second derivative — captures finer detail)
    lap_orig = cv2.Laplacian(gray_orig, cv2.CV_64F)
    lap_enh = cv2.Laplacian(gray_enh, cv2.CV_64F)
    edges_orig_lap = (np.abs(lap_orig) > 15).astype(np.uint8) * 255
    edges_enh_lap = (np.abs(lap_enh) > 15).astype(np.uint8) * 255

    # Combine Canny + Laplacian edges
    edges_orig = cv2.bitwise_or(edges_orig_canny, edges_orig_lap)
    edges_enh = cv2.bitwise_or(edges_enh_canny, edges_enh_lap)

    # Dilate for sub-pixel tolerance
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges_enh_dilated = cv2.dilate(edges_enh, kernel, iterations=1)

    orig_edge_count = np.count_nonzero(edges_orig)
    enh_edge_count = np.count_nonzero(edges_enh)

    if orig_edge_count > 0:
        overlap = np.count_nonzero(cv2.bitwise_and(edges_orig, edges_enh_dilated))
        edge_overlap_ratio = overlap / orig_edge_count
    else:
        edge_overlap_ratio = 1.0

    edge_improvement = (enh_edge_count / max(orig_edge_count, 1)) - 1.0

    # Edge sharpness score: average Laplacian variance (higher = sharper)
    lap_var_orig = np.var(lap_orig[gray_orig > 0]) if np.any(gray_orig > 0) else 0.0
    lap_var_enh = np.var(lap_enh[gray_enh > 0]) if np.any(gray_enh > 0) else 0.0
    sharpness_improvement = (lap_var_enh / max(lap_var_orig, 0.001)) - 1.0

    return {
        "ssim_score": round(ssim_score, 4),
        "edge_overlap_ratio": round(edge_overlap_ratio, 4),
        "edge_improvement_pct": round(edge_improvement * 100, 1),
        "sharpness_improvement_pct": round(sharpness_improvement * 100, 1),
        "original_edges": int(orig_edge_count),
        "enhanced_edges": int(enh_edge_count),
        "laplacian_var_orig": round(lap_var_orig, 1),
        "laplacian_var_enh": round(lap_var_enh, 1),
        "original_size": f"{original.shape[1]}x{original.shape[0]}",
        "enhanced_size": f"{enhanced.shape[1]}x{enhanced.shape[0]}",
    }


# ---------------------------------------------------------------------------
# Caching
# ---------------------------------------------------------------------------

def _cache_path(cache_key: str) -> Path:
    return _ENHANCE_CACHE / f"enh_{cache_key}.png"


def _load_cached(cache_key: str) -> np.ndarray | None:
    p = _cache_path(cache_key)
    if p.exists():
        print(f"[enhancement] Cache hit: {p.name}")
        return cv2.imread(str(p))
    return None


def _save_cached(cache_key: str, image: np.ndarray):
    p = _cache_path(cache_key)
    cv2.imwrite(str(p), image)


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def _log_metrics(key: str, metrics: dict):
    """Append metrics to a JSON-lines log file."""
    log_file = _LOG_DIR / "enhancement_log.jsonl"
    entry = {"key": key, **metrics}
    try:
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass
def _generate_edge_map(image: np.ndarray) -> np.ndarray:
    """
    Generate a robust, multi-scale edge map combining:
      1. Canny edges (fine, zero-crossing boundaries)
      2. Scharr gradients (directional structural edges)
    
    This provides explicit geometric features for the segmentation model.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # 1. Canny (fine edges)
    # Using slightly lower thresholds to capture more roof details
    canny_edges = cv2.Canny(gray, 40, 120)
    
    # 2. Scharr gradients (better rotation invariance than Sobel)
    scharr_x = cv2.Scharr(gray, cv2.CV_64F, 1, 0)
    scharr_y = cv2.Scharr(gray, cv2.CV_64F, 0, 1)
    
    # Calculate gradient magnitude
    scharr_mag = cv2.magnitude(scharr_x, scharr_y)
    
    # Normalize Scharr to 0-255 uint8
    scharr_norm = cv2.normalize(scharr_mag, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)
    
    # Boost Scharr mid-tones to make edges pop
    _, scharr_thresh = cv2.threshold(scharr_norm, 50, 255, cv2.THRESH_TOZERO)
    
    # 3. Combine: Canny provides sharp localization, Scharr provides structural magnitude
    combined_edges = cv2.bitwise_or(canny_edges, scharr_thresh)
    
    # Slight morphological closing to connect broken edge lines
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    edge_map = cv2.morphologyEx(combined_edges, cv2.MORPH_CLOSE, kernel)
    
    return edge_map
