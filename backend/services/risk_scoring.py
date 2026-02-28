"""
TitleGuard AI — Risk Scoring Engine

Computes a weighted risk score (0-100) from multiple property risk factors.

Risk Score =
  (0.30 × Flood Risk) +
  (0.25 × Easement Impact) +
  (0.20 × Lot Coverage Risk) +
  (0.15 × Ownership Irregularity) +
  (0.10 × Property Age Risk)
"""

from config import Config


def compute_risk_score(property_data: dict) -> dict:
    """
    Compute overall risk score and per-factor breakdown.

    Args:
        property_data: dict with keys:
            - flood_zone (float 0-1): flood exposure level
            - easement_encroachment (float 0-1): easement overlap ratio
            - lot_coverage_pct (float 0-1): current lot coverage ratio
            - ownership_history (list): list of ownership transfer records
            - property_age (int): age of property in years
            - zoning_max_coverage (float 0-1): maximum allowed lot coverage

    Returns:
        dict with overall score, tier, and per-factor breakdown.
    """

    # --- Factor 1: Flood Risk ---
    flood_score = _compute_flood_risk(property_data.get("flood_zone", 0.0))

    # --- Factor 2: Easement Impact ---
    easement_score = _compute_easement_risk(
        property_data.get("easement_encroachment", 0.0)
    )

    # --- Factor 3: Lot Coverage Risk ---
    lot_coverage_score = _compute_lot_coverage_risk(
        property_data.get("lot_coverage_pct", 0.0),
        property_data.get("zoning_max_coverage", Config.DEFAULT_MAX_LOT_COVERAGE),
    )

    # --- Factor 4: Ownership Irregularity ---
    ownership_score = _compute_ownership_risk(
        property_data.get("ownership_history", [])
    )

    # --- Factor 5: Property Age Risk ---
    age_score = _compute_age_risk(property_data.get("property_age", 0))

    # --- Weighted total ---
    overall = (
        Config.WEIGHT_FLOOD * flood_score
        + Config.WEIGHT_EASEMENT * easement_score
        + Config.WEIGHT_LOT_COVERAGE * lot_coverage_score
        + Config.WEIGHT_OWNERSHIP * ownership_score
        + Config.WEIGHT_PROPERTY_AGE * age_score
    )

    overall = round(min(max(overall, 0), 100), 1)

    return {
        "overall_score": overall,
        "risk_tier": get_risk_tier(overall),
        "factors": {
            "flood_risk": {
                "score": round(flood_score, 1),
                "weight": Config.WEIGHT_FLOOD,
                "label": "Flood Zone Exposure",
            },
            "easement_impact": {
                "score": round(easement_score, 1),
                "weight": Config.WEIGHT_EASEMENT,
                "label": "Easement Encroachment",
            },
            "lot_coverage": {
                "score": round(lot_coverage_score, 1),
                "weight": Config.WEIGHT_LOT_COVERAGE,
                "label": "Lot Coverage Risk",
            },
            "ownership_irregularity": {
                "score": round(ownership_score, 1),
                "weight": Config.WEIGHT_OWNERSHIP,
                "label": "Ownership Irregularity",
            },
            "property_age": {
                "score": round(age_score, 1),
                "weight": Config.WEIGHT_PROPERTY_AGE,
                "label": "Property Age Risk",
            },
        },
    }


def get_risk_tier(score: float) -> str:
    """Map a 0-100 risk score to a human-readable tier."""
    if score >= 80:
        return "Critical"
    elif score >= 60:
        return "High"
    elif score >= 40:
        return "Moderate"
    elif score >= 20:
        return "Low"
    else:
        return "Minimal"


# ---------------------------------------------------------------------------
# Private factor computation helpers
# ---------------------------------------------------------------------------

def _compute_flood_risk(flood_exposure: float) -> float:
    """
    Convert flood zone exposure (0-1) to a 0-100 risk score.
    """
    # TODO: Incorporate FEMA flood zone classification (A, AE, X, etc.)
    # TODO: Weight by historical flood event frequency
    # TODO: Consider distance from flood zone boundary, not just binary overlap
    return flood_exposure * 100


def _compute_easement_risk(encroachment_pct: float) -> float:
    """
    Convert easement encroachment percentage to a 0-100 risk score.
    """
    # TODO: Differentiate between easement types (utility, access, conservation)
    # TODO: Consider whether easement restricts buildable area vs. just access
    return encroachment_pct * 100


def _compute_lot_coverage_risk(coverage_pct: float, max_coverage: float) -> float:
    """
    Score lot coverage risk based on proximity to zoning maximum.
    """
    if max_coverage <= 0:
        return 0.0

    ratio = coverage_pct / max_coverage  # e.g., 0.68 / 0.70 = 0.97

    # TODO: Use a more nuanced curve (e.g., exponential near threshold)
    # TODO: Consider municipality-specific zoning variance rules
    if ratio >= 1.0:
        return 100.0  # Over the limit
    elif ratio >= 0.9:
        return 80.0 + (ratio - 0.9) * 200  # 80-100 range
    elif ratio >= 0.7:
        return 40.0 + (ratio - 0.7) * 200  # 40-80 range
    else:
        return ratio * 57.0  # 0-40 range


def _compute_ownership_risk(ownership_history: list) -> float:
    """
    Score ownership irregularity based on transfer frequency and patterns.
    """
    if not ownership_history:
        return 0.0

    num_transfers = len(ownership_history)

    # TODO: Analyze time gaps between transfers (rapid flipping = higher risk)
    # TODO: Detect LLC-to-LLC transfers (potential shell company patterns)
    # TODO: Check for foreclosure / tax lien indicators in transfer records
    # TODO: Consider holding period duration vs. market norms

    # Simple heuristic: more transfers in recent years = higher risk
    if num_transfers >= 5:
        return 80.0
    elif num_transfers >= 3:
        return 50.0
    elif num_transfers >= 2:
        return 25.0
    else:
        return 10.0


def _compute_age_risk(property_age: int) -> float:
    """
    Score property age risk — older properties may have more title issues.
    """
    # TODO: Correlate with known title defect rates by decade
    # TODO: Factor in whether title has been recently searched / insured
    # TODO: Consider jurisdiction-specific statute of limitations for claims

    if property_age >= 100:
        return 90.0
    elif property_age >= 50:
        return 60.0
    elif property_age >= 25:
        return 35.0
    elif property_age >= 10:
        return 15.0
    else:
        return 5.0
