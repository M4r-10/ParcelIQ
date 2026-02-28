"""
TitleGuard AI — Derived Feature Calculators

Utility functions for engineering features from raw geospatial and
ownership data.  These are used both at training time and at inference
time (property analysis API).
"""
from __future__ import annotations
import math
from typing import List, Dict, Optional


# ──────────────────────────────────────────────
# A.  Lot Coverage
# ──────────────────────────────────────────────

def compute_lot_coverage(
    building_area_sqft: float,
    parcel_area_sqft: float,
    zoning_max_coverage: float = 0.70,
) -> dict:
    """
    Returns lot coverage ratio and delta from zoning limit.

    >>> compute_lot_coverage(4160, 5200, 0.70)
    {'lot_coverage_ratio': 0.8, 'coverage_delta_from_limit': 0.1}
    """
    ratio = round(building_area_sqft / parcel_area_sqft, 4) if parcel_area_sqft else 0
    delta = round(ratio - zoning_max_coverage, 4)
    return {
        "lot_coverage_ratio": ratio,
        "coverage_delta_from_limit": delta,
        "coverage_over_limit": delta > 0,
    }


# ──────────────────────────────────────────────
# B.  Flood Metrics
# ──────────────────────────────────────────────

def compute_flood_metrics(
    parcel_bbox: list,
    flood_zone: str,
    inside_flood: bool,
    distance_to_boundary_m: float,
    flood_intersection_pct: Optional[float] = None,
) -> dict:
    """
    Summarise flood exposure for a parcel.

    Parameters
    ----------
    parcel_bbox : [minLon, minLat, maxLon, maxLat]
    flood_zone  : "X" | "AE" | "VE"
    inside_flood : parcel centroid inside SFHA
    distance_to_boundary_m : metres to nearest flood boundary
    flood_intersection_pct : optional, fraction of parcel inside flood poly
    """
    exposure = 1 if inside_flood else 0
    if flood_intersection_pct is None:
        flood_intersection_pct = 1.0 if inside_flood else 0.0

    return {
        "flood_exposure": exposure,
        "inside_flood": inside_flood,
        "flood_zone": flood_zone,
        "distance_to_flood_boundary": distance_to_boundary_m,
        "flood_intersection_pct": round(flood_intersection_pct, 4),
    }


# ──────────────────────────────────────────────
# C.  Easement Encroachment
# ──────────────────────────────────────────────

def compute_easement_encroachment(
    building_area_sqft: float,
    easement_area_sqft: float,
    overlap_area_sqft: float = 0.0,
) -> dict:
    """
    Returns encroachment percentage of building overlapping easements.
    """
    pct = round(overlap_area_sqft / building_area_sqft, 4) if building_area_sqft else 0
    return {
        "encroachment_pct": pct,
        "easement_area_sqft": easement_area_sqft,
        "overlap_area_sqft": overlap_area_sqft,
    }


# ──────────────────────────────────────────────
# D.  Ownership Anomaly Score  (Isolation-Forest-style heuristic)
# ──────────────────────────────────────────────

def compute_ownership_anomaly(
    ownership_history: List[Dict],
    lookback_years: int = 5,
    current_year: int = 2026,
) -> dict:
    """
    Scores ownership anomalies from 0 (clean) to 1 (highly suspicious).

    Heuristic factors:
    - Number of transfers in the lookback window
    - Average holding period across all owners
    - LLC / corporate entity ratio
    - Price escalation velocity
    """
    if not ownership_history:
        return {
            "ownership_anomaly_score": 0.0,
            "num_transfers_5yr": 0,
            "avg_holding_period_years": 0.0,
            "entity_flags": [],
        }

    cutoff_year = current_year - lookback_years
    recent_transfers = 0
    entity_flags = []
    holding_periods = []
    prices = []

    for record in ownership_history:
        entity = record.get("entity_type", "Individual")
        hold = record.get("holding_period_years")
        price = record.get("purchase_price")

        if hold is not None:
            holding_periods.append(hold)
        if price is not None:
            prices.append(price)

        # Count recent transfers
        sale = record.get("sale_date")
        if sale:
            sale_year = int(sale[:4])
            if sale_year >= cutoff_year:
                recent_transfers += 1

        # Flag non-individual entities
        if entity in ("LLC", "Corporation", "Trust"):
            entity_flags.append(entity)

    avg_hold = round(sum(holding_periods) / len(holding_periods), 2) if holding_periods else 0
    llc_ratio = len(entity_flags) / len(ownership_history) if ownership_history else 0

    # Price velocity (annualised appreciation rate)
    price_velocity = 0
    if len(prices) >= 2:
        total_years = sum(holding_periods) if holding_periods else 1
        price_velocity = (prices[-1] - prices[0]) / (prices[0] * max(total_years, 1))

    # Composite anomaly score
    score = min(1.0, max(0.0, (
        0.12 * recent_transfers +
        (0.20 if avg_hold < 2 else 0) +
        0.25 * llc_ratio +
        0.15 * min(price_velocity, 1.0) +
        (-0.10 if avg_hold > 10 else 0)
    )))

    return {
        "ownership_anomaly_score": round(score, 3),
        "num_transfers_5yr": recent_transfers,
        "avg_holding_period_years": avg_hold,
        "entity_flags": entity_flags,
    }


# ──────────────────────────────────────────────
# E.  CV Discrepancy  (Computer Vision vs Recorded)
# ──────────────────────────────────────────────

def compute_cv_discrepancy(
    cv_building_area_sqft: float,
    recorded_building_area_sqft: float,
    threshold_pct: float = 0.10,
) -> dict:
    """
    Compares CV-detected building area to recorded area.

    A delta > threshold_pct triggers an unrecorded expansion flag.
    """
    if recorded_building_area_sqft == 0:
        return {
            "area_delta_pct": 0.0,
            "unrecorded_expansion_flag": False,
        }

    delta = (cv_building_area_sqft - recorded_building_area_sqft) / recorded_building_area_sqft
    delta_pct = round(delta, 4)

    return {
        "area_delta_pct": delta_pct,
        "cv_building_area_sqft": cv_building_area_sqft,
        "recorded_building_area_sqft": recorded_building_area_sqft,
        "unrecorded_expansion_flag": delta_pct > threshold_pct,
    }


# ──────────────────────────────────────────────
# F.  Nonlinear Coverage Risk Curve
# ──────────────────────────────────────────────

def coverage_risk_curve(coverage_ratio: float, zoning_max: float = 0.70) -> float:
    """
    Maps lot coverage ratio → marginal risk contribution using a logistic
    function centred around the zoning maximum.

    Returns a value in [0, 1].

    Below ~60% of zoning max → near-zero contribution.
    At zoning max → ~0.50 contribution.
    Exceeding zoning max → rapidly approaches 1.0.
    """
    x = (coverage_ratio - zoning_max) / 0.05   # normalise around limit
    return round(1 / (1 + math.exp(-x)), 4)


# ──────────────────────────────────────────────
# G.  Full Feature Vector Builder
# ──────────────────────────────────────────────

def build_feature_vector(
    parcel: dict,
    building: dict,
    flood: dict,
    easements: list,
    ownership: list,
    zoning: dict,
    cv_building_area: Optional[float] = None,
) -> dict:
    """
    Assemble the complete ML feature vector from raw property data.
    """
    lot_area = parcel["properties"]["lot_area_sqft"]
    bldg_area = building["properties"]["building_area_sqft"]
    zoning_max = zoning.get("max_lot_coverage", 0.70)

    coverage = compute_lot_coverage(bldg_area, lot_area, zoning_max)
    flood_m = compute_flood_metrics(
        parcel_bbox=None,
        flood_zone=flood["properties"]["flood_zone"],
        inside_flood=flood["properties"]["inside_flood"],
        distance_to_boundary_m=flood["properties"]["distance_to_boundary_m"],
    )

    total_easement_encroach = sum(
        f.get("properties", {}).get("encroachment_pct", 0)
        for f in (easements.get("features", []) if isinstance(easements, dict) else easements)
    )

    own = compute_ownership_anomaly(ownership)

    cv_delta = 0.0
    if cv_building_area is not None:
        cv_result = compute_cv_discrepancy(cv_building_area, bldg_area)
        cv_delta = cv_result["area_delta_pct"]

    return {
        "flood_exposure": flood_m["flood_exposure"],
        "flood_boundary_distance": flood_m["distance_to_flood_boundary"],
        "easement_encroachment_pct": round(total_easement_encroach, 4),
        "lot_coverage_ratio": coverage["lot_coverage_ratio"],
        "property_age": 2026 - building["properties"].get("year_built", 2000),
        "num_transfers_5yr": own["num_transfers_5yr"],
        "avg_holding_period_years": own["avg_holding_period_years"],
        "ownership_anomaly_score": own["ownership_anomaly_score"],
        "cv_vs_recorded_area_delta": round(cv_delta, 4),
    }
