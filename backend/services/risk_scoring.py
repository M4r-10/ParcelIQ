"""
TitleGuard AI — Risk Scoring Engine  v2

An advanced, multi-stage risk assessment pipeline:

  Stage 1  Non-linear per-factor transforms  (sigmoid, exponential decay)
  Stage 2  Multi-factor interaction terms     (coverage × easement, etc.)
  Stage 3  Gradient-boosted ML model          (trained on synthetic data)
  Stage 4  SHAP-based explainability          (per-feature contributions)
  Stage 5  Closing delay probability          (logistic regression classifier)
  Stage 6  Final blended score                (0.70 × weighted + 0.30 × ML)

Public API  (backwards-compatible with app.py):
  - compute_risk_score(property_data)  → dict
  - get_risk_tier(score)               → str
"""

from __future__ import annotations

import math
import os
import warnings
import csv
from pathlib import Path
from typing import Optional

import numpy as np

# ---------------------------------------------------------------------------
# ML / explainability imports  (graceful fallback if not installed)
#
# TODO: Run `pip install scikit-learn joblib shap` to enable ML features.
#       The engine works without them — it just uses the weighted path.
# ---------------------------------------------------------------------------
try:
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    import joblib
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

try:
    import shap
    HAS_SHAP = True
except ImportError:
    HAS_SHAP = False


# ---------------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------------

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent  # → project root
_DATA_DIR = _PROJECT_ROOT / "data"
_MODEL_DIR = _DATA_DIR / "models"
_CSV_PATH = _DATA_DIR / "synthetic_training_data.csv"

# Blending weights for final score  (Stage 6)
W_WEIGHTED = 0.70   # weight of the analytical/weighted path
W_ML       = 0.30   # weight of the ML prediction path

# Per-factor base weights  (must sum to 1.0)
W_FLOOD     = 0.25
W_EASEMENT  = 0.20
W_COVERAGE  = 0.20
W_OWNERSHIP = 0.15
W_AGE       = 0.10
W_CV_DELTA  = 0.10

# Non-linear transform parameters
LOT_SIGMOID_K  = 15.0   # sigmoid sharpness around zoning limit
FLOOD_ALPHA    = 50.0    # exponential decay constant (metres)
EASEMENT_K     = 10.0    # sigmoid slope for easement risk
AGE_HALF_LIFE  = 40      # years at which age risk reaches ~63%

# Feature columns expected by the ML model (must match training CSV)
_FEATURE_COLS = [
    "flood_exposure",
    "flood_boundary_distance",
    "easement_encroachment_pct",
    "lot_coverage_ratio",
    "property_age",
    "num_transfers_5yr",
    "avg_holding_period_years",
    "ownership_anomaly_score",
    "cv_vs_recorded_area_delta",
]


# ═══════════════════════════════════════════════════════════════════════════
# STAGE 1 — NON-LINEAR PER-FACTOR TRANSFORMS
# ═══════════════════════════════════════════════════════════════════════════
#
# Instead of `score = factor * 100`, each risk factor goes through a
# mathematical transform that captures real-world threshold behaviour.
#
# Key concept: The standard logistic sigmoid function:
#
#     σ(x) = 1 / (1 + e^(−k·(x − x₀)))
#
# Where:
#   x  = input value
#   x₀ = centre point (threshold where risk = 50%)
#   k  = slope (how sharply risk rises around the threshold)
#
# This maps any input to the range (0, 1).
# ═══════════════════════════════════════════════════════════════════════════

def _sigmoid(x: float, k: float = 1.0, x0: float = 0.0) -> float:
    """
    Standard logistic sigmoid: 1 / (1 + e^(−k·(x − x₀)))

    Example:
      _sigmoid(0.80, k=15.0, x0=0.70)  →  ~0.82  (above threshold → high)
      _sigmoid(0.50, k=15.0, x0=0.70)  →  ~0.05  (below threshold → low)
    """
    z = -k * (x- x0)
    z = max(-500, min(500, z))
    return 1.0 / (1.0 + math.exp(z))


def nl_flood_risk(
    inside_flood: bool,
    distance_to_boundary_m: float,
    flood_zone: str = "X",
) -> float:
    """
    Exponential-decay flood risk based on distance to flood boundary.

    Formula:  FloodRisk = 1 − e^(−α / d)

    Behaviour:
      - Inside flood zone (AE/VE)  →  return 1.0  (maximum risk)
      - At boundary (d ≈ 0)        →  ≈ 1.0
      - Far away (d >> α)          →  ≈ 0.0
      - α (FLOOD_ALPHA) controls how quickly risk drops with distance
    Why exponential decay?
      A house 10m from a flood zone is dramatically riskier than one 200m away.
      Linear scaling would understate the danger of being close to the boundary.
    """
    
    if inside_flood or distance_to_boundary_m <= 0: 
        return 1.0
    else: 
        return 1.0 - math.exp(-FLOOD_ALPHA / distance_to_boundary_m) 


def nl_lot_coverage_risk(
    coverage_ratio: float,
    zoning_max: float = 0.70,
) -> float:
    """
    Sigmoid thresholding centred at the zoning maximum.

    Formula:  LotRisk = sigmoid(k · (coverage_ratio − zoning_max))

    Behaviour:
      - Well below limit  →  near 0
      - Exactly at limit  →  0.5
      - Above limit       →  rapidly approaches 1.0

    Why sigmoid?
      A property at 50% coverage (limit 70%) is fine.
      A property at 69% (just below limit) is risky but legal.
      A property at 72% (above limit) is a serious violation.
      The sigmoid captures this sharp "cliff" around the threshold.
    """
    return _sigmoid(coverage_ratio, k = LOT_SIGMOID_K, x0 = zoning_max)


def nl_easement_risk(encroachment_pct: float) -> float:
    """
    Sigmoid curve for easement encroachment, centred at 15%.

    Minor encroachment (< 5%)   → very low risk
    Moderate (10-20%)            → rapidly rising risk
    Major (> 25%)                → near maximum risk
    """
    return _sigmoid(x = encroachment_pct, x0 = 0.15, k = EASEMENT_K)


def nl_ownership_risk(
    num_transfers_5yr: int,
    avg_holding_period: float,
    anomaly_score: float,
) -> float:
    """
    Composite ownership irregularity score.

    Combines three sub-signals:

    1. Transfer frequency via tanh:
       transfer_signal = tanh(num_transfers / 3.0)
       Why tanh? It saturates — 6 transfers isn't 2× worse than 3.

    2. Short-hold penalty via exponential:
       hold_penalty = exp(-avg_hold / 3.0)
       Short hold periods (< 2 years) are suspicious (flipping).

    3. Anomaly score (0-1):
       Directly from the ownership anomaly scorer (LLC patterns, etc.)


    The weights (0.4, 0.35, 0.25) reflect that anomaly score is the
    strongest signal, followed by transfer frequency, then hold duration.
    """
    transfer_signal = math.tanh(num_transfers_5yr / 3.0)
    hold_penalty = math.exp(-avg_holding_period / 3.0) if avg_holding_period > 0 else 1.0
    composite = 0.4 * anomaly_score + 0.35 * transfer_signal + 0.25 * hold_penalty
    return max(0, min(1, composite))


def nl_age_risk(property_age: int) -> float:
    """
    Exponential growth age risk with a half-life.

    Formula:  AgeRisk = 1 − e^(−age / half_life)

    Behaviour:
      - New property (age=0)        →  0.0
      - At half_life (40 years)     →  ~0.63
      - Very old (80+ years)        →  ≈ 1.0

    """
    if property_age <= 0: 
        return 0
    return 1.0 - math.exp(-property_age / AGE_HALF_LIFE)


def nl_cv_discrepancy_risk(cv_delta: float) -> float:
    """
    Sigmoid on |cv_delta| centred at 10% discrepancy.

    A 23% CV-vs-recorded mismatch (like our high-risk house) means the
    building is larger than officially recorded — possible unpermitted work.
    """
    return _sigmoid(abs(cv_delta), k = 20.0, x0 = 0.10)


# ═══════════════════════════════════════════════════════════════════════════
# STAGE 2 — MULTI-FACTOR INTERACTION TERMS
# ═══════════════════════════════════════════════════════════════════════════
#
# Risk factors interact non-linearly. A property that is both in a flood
# zone AND has suspicious ownership is riskier than the sum of individual
# risks. Interaction terms capture these "double jeopardy" effects.
#
# Example from the user's specification:
#   Score = 0.3×Flood + 0.25×Easement + 0.2×Coverage
#         + 0.1×Coverage×Easement   ← interaction term!
# ═══════════════════════════════════════════════════════════════════════════

def _interaction_terms(
    flood: float,
    easement: float,
    coverage: float,
    ownership: float,
) -> float:
    """
    Compute multiplicative interaction terms between risk factors.

    Key interactions to model:

    1. coverage × easement:
       A building that covers 80% of the lot AND encroaches on an easement
       is worse than either problem alone. The structure can't be adjusted
       without violating one constraint or the other.

    2. flood × ownership:
       Suspicious ownership patterns in a flood zone suggest someone is
       trying to offload a known-bad property (insurance fraud, etc.)

    BONUS TODO: Consider adding more interactions:
      - flood × coverage (flood zone + over-built = can't rebuild)
      - age × cv_delta (old building + area mismatch = likely unpermitted adds)
    """
    
    return 0.5 * (coverage * easement) + 0.5 * (flood * ownership)


# ═══════════════════════════════════════════════════════════════════════════
# STAGE 3 — ML MODEL (Gradient Boosted Classifier)
# ═══════════════════════════════════════════════════════════════════════════
#
# Instead of hand-tuned weights, train a ML model on the synthetic dataset
# (data/synthetic_training_data.csv) to predict risk probability.
#
# Architecture:
#   - GradientBoostingClassifier (scikit-learn) for risk probability
#   - StandardScaler for feature normalisation
#   - Models are cached to data/models/ to avoid retraining each restart
#
# Why GBM?
#   - Handles non-linear relationships automatically
#   - Provides feature_importances_ for interpretability
#   - Works well on small datasets (2,000 rows)
#   - Compatible with SHAP TreeExplainer
# ═══════════════════════════════════════════════════════════════════════════

# Module-level model cache (loaded/trained once)
_model = None         # GradientBoostingClassifier
_scaler = None        # StandardScaler
_delay_model = None   # LogisticRegression (Stage 5)
_shap_explainer = None  # SHAP TreeExplainer (Stage 4)


def _train_models():
    """
    Train or load cached ML models from synthetic_training_data.csv.

    TODO: Implement this function step by step:

    Step 1 — Check for cached models:
      - Define paths: gbm_path = _MODEL_DIR / "risk_gbm.pkl"
      -               lr_path  = _MODEL_DIR / "delay_lr.pkl"
      -               sc_path  = _MODEL_DIR / "scaler.pkl"
      - If all three .pkl files exist, load them with joblib.load()
      - Set _model, _delay_model, _scaler globals
      - Call _init_shap() and return early

    Step 2 — Load training CSV:
      - Open _CSV_PATH with csv.DictReader
      - For each row, extract features: [float(row[c]) for c in _FEATURE_COLS]
      - Extract label: int(row["label"])
      - Build numpy arrays X (n_samples × 9 features) and y (n_samples,)

    Step 3 — Scale features:
      - _scaler = StandardScaler()
      - X_scaled = _scaler.fit_transform(X)
      (StandardScaler normalises each column to mean=0, std=1.
       This helps gradient boosting converge and makes SHAP values
       comparable across features.)

    Step 4 — Train GBM:
      - _model = GradientBoostingClassifier(
            n_estimators=200,   # number of boosting stages
            max_depth=4,        # depth of each tree (controls complexity)
            learning_rate=0.1,  # shrinkage (smaller = more robust but slower)
            subsample=0.8,      # row sampling (helps prevent overfitting)
            random_state=42,    # reproducibility
        )
      - _model.fit(X_scaled, y)

    Step 5 — Train Logistic Regression (for closing delay):
      - _delay_model = LogisticRegression(max_iter=500, random_state=42)
      - _delay_model.fit(X_scaled, y)

    Step 6 — Cache models:
      - _MODEL_DIR.mkdir(parents=True, exist_ok=True)
      - joblib.dump(_model, gbm_path)
      - joblib.dump(_delay_model, lr_path)
      - joblib.dump(_scaler, sc_path)

    Step 7 — Initialise SHAP:
      - Call _init_shap()

    Remember to declare `global _model, _scaler, _delay_model, _shap_explainer`
    at the top of the function!
    """
    global _model, _scaler, _delay_model, _shap_explainer

    if not HAS_SKLEARN:
        return

    gbm_path = _MODEL_DIR / "risk_gbm.pkl"
    lr_path = _MODEL_DIR / "delay_lr.pkl"
    sc_path = _MODEL_DIR / "scaler.pkl"

    if gbm_path.exists() and lr_path.exists() and sc_path.exists(): 
        print(f"Loading cached models")
        _model = joblib.load(gbm_path)
        _delay_model = joblib.load(lr_path)
        _scaler = joblib.load(sc_path)

        _X_train = None #TODO Intialize later with actual data
        _init_shap()
        return


    with open(_CSV_PATH, mode = 'r', newline='', encoding = 'utf-8') as file: 
        reader = csv.DictReader(file)
        x_list, y_list  = [], []
        for row in reader: 
            x_list.append([float(row[c]) for c in _FEATURE_COLS])
            y_list.append(int(row["label"]))

    X = np.array(x_list)
    Y = np.array(y_list)
    _X_train = X.copy() # Save for SHAP usage later

    _scaler = StandardScaler()
    X_scaled = _scaler.fit_transform(X)

    _model = GradientBoostingClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.1,
        subsample=0.8,
        random_state=42
    )
    _model.fit(X_scaled, Y)

    _delay_model = LogisticRegression(max_iter=500, random_state=42)
    _delay_model.fit(X_scaled, Y)

    _MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(_model, gbm_path)
    joblib.dump(_delay_model, lr_path)
    joblib.dump(_scaler, sc_path)

    print("Models sucessfully trained and cached")

    _init_shap()
    print("SHAP explainer initialized")
    return


# ═══════════════════════════════════════════════════════════════════════════
# STAGE 4 — SHAP EXPLAINABILITY
# ═══════════════════════════════════════════════════════════════════════════
#
# SHAP (SHapley Additive exPlanations) decomposes a prediction into
# per-feature contributions. For each property, you can say:
#   "Flood exposure added +18 points to the risk score"
#   "Low ownership anomaly reduced risk by -5 points"
#
# This makes the ML model transparent — critical for hackathon judges.
#
# Reference: https://shap.readthedocs.io/en/latest/
# ═══════════════════════════════════════════════════════════════════════════

def _init_shap():
    """
    Create a SHAP TreeExplainer for the GBM model.

    TODO: Implement.
      - Check HAS_SHAP and _model is not None
      - _shap_explainer = shap.TreeExplainer(_model)
      - Wrap in try/except in case SHAP has issues with the model
    """
    global _shap_explainer
    if HAS_SHAP and _model is not None:
        try: 
            _shap_explainer = shap.TreeExplainer(_model) 
        except Exception as e:
            print(f"Error initializing SHAP explainer: {e}")
            _shap_explainer = None


def _ml_predict(feature_vec: list[float]) -> Optional[dict]:
    """
    Run ML pipeline: scale → predict → explain with SHAP.

    Args:
        feature_vec: list of 9 floats in _FEATURE_COLS order

    Returns:
        dict with:
          - ml_risk_probability (float 0-1)
          - feature_importance (dict: feature_name → importance_score)
          - shap_values (dict: feature_name → SHAP contribution)
        or None if models aren't available

    TODO: Implement.
      1. Check _model and _scaler aren't None, return None otherwise
      2. X = np.array([feature_vec])
      3. X_scaled = _scaler.transform(X)
      4. prob = float(_model.predict_proba(X_scaled)[0, 1])
         (predict_proba returns [[P(class=0), P(class=1)]], we want class 1)
      5. importance = dict(zip(_FEATURE_COLS, _model.feature_importances_))
      6. If _shap_explainer exists:
         - sv = _shap_explainer.shap_values(X_scaled)
         - If sv is a list (binary classification), use sv[1] for class 1
         - Build shap_dict = {col: sv[0, i] for each feature}
      7. Return the result dict
    """
    if _model is None or _scaler is None:
        return None
    
    X = np.array([feature_vec])
    X_scaled = _scaler.transform(X)
    prob = float(_model.predict_proba(X_scaled)[0, 1])
    importance = dict(zip(_FEATURE_COLS, _model.feature_importances_))
    
    shap_dict = {}
    if _shap_explainer is not None:
        try:
            sv = _shap_explainer.shap_values(X_scaled)
            if isinstance(sv, list):
                sv = sv[1]
            shap_dict = {col: float(sv[0, i]) for i, col in enumerate(_FEATURE_COLS)}
        except Exception as e:
            print(f"Error computing SHAP values: {e}")

    return {
        "ml_risk_probability": prob,
        "feature_importance": importance,
        "shap_values": shap_dict
    }


# ═══════════════════════════════════════════════════════════════════════════
# STAGE 5 — CLOSING DELAY PREDICTION
# ═══════════════════════════════════════════════════════════════════════════
#
# A logistic regression classifier that predicts:
#   "Will this property's closing be delayed?"
#
# This adds a practical, underwriting-relevant output beyond just
# the risk score. Judges love this because it maps to real business impact.
#
# The final score blends:
#   FinalScore = 0.70 × WeightedScore + 0.30 × PredictedDelayProb
# ═══════════════════════════════════════════════════════════════════════════

def _delay_predict(feature_vec: list[float]) -> Optional[dict]:
    """
    Predict closing delay probability.

    TODO: Implement.
      1. Check _delay_model and _scaler aren't None
      2. Scale the feature vector
      3. prob = float(_delay_model.predict_proba(X_scaled)[0, 1])
      4. Map probability to likelihood label:
         - prob >= 0.6  →  "High"
         - prob >= 0.3  →  "Medium"
         - else         →  "Low"
      5. Return {"delay_probability": prob, "delay_likelihood": label}
    """
    if _delay_model is None or _scaler is None:
        return None
    
    X = np.array([feature_vec])
    X_scaled = _scaler.transform(X)
    prob = float(_delay_model.predict_proba(X_scaled)[0, 1])
    
    if prob >= 0.6:
        label = "High"
    elif prob >= 0.3:
        label = "Medium"
    else:
        label = "Low"
        
    return {"delay_probability": prob, "delay_likelihood": label}


# ═══════════════════════════════════════════════════════════════════════════
# STAGE 6 — MAIN PUBLIC API
# ═══════════════════════════════════════════════════════════════════════════
#
# This is the function that app.py calls. It orchestrates all 6 stages
# and returns a rich result dict.
#
# The output includes:
#   - overall_score (0-100)
#   - risk_tier (Critical/High/Moderate/Low/Minimal)
#   - factors (per-factor breakdown with scores, weights, transform names)
#   - interactions (cross-factor interaction values)
#   - ml (ML model prediction + SHAP values)
#   - delay (closing delay prediction)
#   - scoring_method ("blended" if ML available, "weighted_only" otherwise)
# ═══════════════════════════════════════════════════════════════════════════

def compute_risk_score(property_data: dict) -> dict:
    """
    Full risk assessment pipeline.

    Input keys (all optional, sensible defaults):
        flood_zone              str    "X" / "AE" / "VE"
        inside_flood            bool
        flood_boundary_distance float  metres to nearest SFHA
        easement_encroachment   float  0-1 (fraction)
        lot_coverage_pct        float  0-1
        zoning_max_coverage     float  0-1
        ownership_history       list   of ownership records
        num_transfers_5yr       int
        avg_holding_period      float  years
        ownership_anomaly_score float  0-1
        property_age            int    years
        cv_vs_recorded_area_delta float

    Returns:
        dict — see Stage 6 description above

    TODO: Implement step by step:

    Step A — Ensure models are trained:
      if _model is None and HAS_SKLEARN:
          _train_models()

    Step B — Extract inputs from property_data with defaults:
      flood_zone = property_data.get("flood_zone", "X")
      inside_flood = property_data.get("inside_flood", False)
      ... (see all input keys above)

      LEGACY COMPAT: The old engine accepted flood_zone as a float (0-1).
      If it's a number, convert: inside_flood = val > 0.5, flood_zone = "AE"/"X"

    Step C — Stage 1: Compute non-linear factor scores (each returns 0-1):
      f_flood     = nl_flood_risk(inside_flood, flood_dist, flood_zone)
      f_easement  = nl_easement_risk(easement_pct)
      f_coverage  = nl_lot_coverage_risk(coverage_pct, zoning_max)
      f_ownership = nl_ownership_risk(num_transfers, avg_hold, anomaly)
      f_age       = nl_age_risk(prop_age)
      f_cv        = nl_cv_discrepancy_risk(cv_delta)

    Step D — Stage 2: Compute interaction terms:
      interaction = _interaction_terms(f_flood, f_easement, f_coverage, f_ownership)

    Step E — Compute weighted score (0-100):
      weighted_raw = (W_FLOOD * f_flood + W_EASEMENT * f_easement + ...)
      Add interaction boost: weighted_score = (weighted_raw + 0.15 * interaction) * 100
      Clamp to [0, 100]

    Step F — Stage 3-4: Build feature vector and run ML:
      feature_vec = [flood_exposure, flood_dist, easement_pct, coverage_pct,
                     prop_age, num_transfers, avg_hold, anomaly, cv_delta]
      ml_result = _ml_predict(feature_vec)
      ml_score = ml_result["ml_risk_probability"] * 100 if ml_result else weighted_score

    Step G — Stage 5: Closing delay:
      delay_result = _delay_predict(feature_vec)

    Step H — Stage 6: Blend scores:
      if ml_result:
          final_score = W_WEIGHTED * weighted_score + W_ML * ml_score
      else:
          final_score = weighted_score

    Step I — Build and return the result dict:
      {
          "overall_score": final_score,
          "risk_tier": get_risk_tier(final_score),
          "factors": { ... per-factor dicts with score, weight, label, transform ... },
          "interactions": { coverage_x_easement, flood_x_ownership, combined },
          "weighted_score": weighted_score,
          "ml": ml_result,           # None or dict with probability + SHAP
          "delay": delay_result,     # None or dict with delay likelihood
          "scoring_method": "blended" if ml_result else "weighted_only",
      }
    """
    if _model is None and HAS_SKLEARN:
        _train_models()
        
    flood_zone = property_data.get("flood_zone", "X")
    if isinstance(flood_zone, (int, float)):
        inside_flood = float(flood_zone) > 0.5
        flood_zone = "AE" if inside_flood else "X"
    else:
        inside_flood = property_data.get("inside_flood", False)
        
    flood_dist = property_data.get("flood_boundary_distance", 1000.0)
    easement_pct = property_data.get("easement_encroachment", 0.0)
    coverage_pct = property_data.get("lot_coverage_pct", 0.0)
    zoning_max = property_data.get("zoning_max_coverage", 0.70)
    
    # These may be None when Melissa data is unavailable
    num_transfers = property_data.get("num_transfers_5yr")
    avg_hold = property_data.get("avg_holding_period")
    anomaly = property_data.get("ownership_anomaly_score")
    prop_age = property_data.get("property_age")
    cv_delta = property_data.get("cv_vs_recorded_area_delta")
    
    # Compute non-linear scores for available factors
    f_flood = nl_flood_risk(inside_flood, flood_dist, flood_zone)
    f_easement = nl_easement_risk(easement_pct)
    f_coverage = nl_lot_coverage_risk(coverage_pct, zoning_max)
    
    # Track which factors are available vs unavailable
    f_ownership = None
    f_age = None
    f_cv = None
    
    if num_transfers is not None and avg_hold is not None and anomaly is not None:
        f_ownership = nl_ownership_risk(num_transfers, avg_hold, anomaly)
    if prop_age is not None:
        f_age = nl_age_risk(prop_age)
    if cv_delta is not None:
        f_cv = nl_cv_discrepancy_risk(cv_delta)
    
    # Build weighted score from available factors only, re-normalizing weights
    available = {
        "flood": (W_FLOOD, f_flood),
        "easement": (W_EASEMENT, f_easement),
        "coverage": (W_COVERAGE, f_coverage),
    }
    if f_ownership is not None:
        available["ownership"] = (W_OWNERSHIP, f_ownership)
    if f_age is not None:
        available["age"] = (W_AGE, f_age)
    if f_cv is not None:
        available["cv_delta"] = (W_CV_DELTA, f_cv)
    
    total_weight = sum(w for w, _ in available.values())
    if total_weight > 0:
        weighted_raw = sum((w / total_weight) * s for w, s in available.values())
    else:
        weighted_raw = 0.0
    
    # Interaction terms (only if ownership is available)
    interaction = _interaction_terms(
        f_flood, f_easement, f_coverage,
        f_ownership if f_ownership is not None else 0.0,
    )
    
    weighted_score = max(0.0, min(100.0, (weighted_raw + 0.15 * interaction) * 100))
    
    # ML prediction (use 0.0 defaults for unavailable features)
    flood_exposure = float(inside_flood)
    feature_vec = [
        flood_exposure,
        float(flood_dist),
        float(easement_pct),
        float(coverage_pct),
        float(prop_age if prop_age is not None else 0),
        float(num_transfers if num_transfers is not None else 0),
        float(avg_hold if avg_hold is not None else 10.0),
        float(anomaly if anomaly is not None else 0),
        float(cv_delta if cv_delta is not None else 0),
    ]
    
    ml_result = _ml_predict(feature_vec)
    delay_result = _delay_predict(feature_vec)
    
    if ml_result:
        ml_score = ml_result["ml_risk_probability"] * 100
        final_score = W_WEIGHTED * weighted_score + W_ML * ml_score
        scoring_method = "blended"
    else:
        final_score = weighted_score
        scoring_method = "weighted_only"
        
    # Build human-readable factor breakdown
    def _severity(s):
        if s >= 0.8: return "Critical"
        if s >= 0.6: return "High"
        if s >= 0.4: return "Moderate"
        if s >= 0.2: return "Low"
        return "Minimal"

    def _flood_display():
        if inside_flood:
            return f"Zone {flood_zone}", f"Inside flood zone {flood_zone}"
        elif flood_dist < 500:
            return f"{int(flood_dist)}m from zone", f"{int(flood_dist)}m from nearest flood boundary"
        else:
            return "Zone X — Safe", "Outside flood hazard area"

    flood_disp, flood_desc = _flood_display()

    # Helper for unavailable factor entries
    def _unavailable_factor(label):
        return {
            "label": label,
            "description": "Data unavailable for this property",
            "display_value": "—",
            "score": None,
            "weight": 0,
            "severity": "Unavailable",
            "unavailable": True,
        }

    factors_dict = {
        "flood": {
            "label": "Flood Zone Exposure",
            "description": flood_desc,
            "display_value": flood_disp,
            "score": round(f_flood * 100, 1),
            "weight": W_FLOOD,
            "severity": _severity(f_flood),
        },
        "easement": {
            "label": "Easement Encroachment",
            "description": f"Building setback proximity to parcel boundary",
            "display_value": f"{round(easement_pct * 100, 1)}%" if easement_pct > 0.01 else "None detected",
            "score": round(f_easement * 100, 1),
            "weight": W_EASEMENT,
            "severity": _severity(f_easement),
        },
        "coverage": {
            "label": "Lot Coverage",
            "description": f"{round(coverage_pct * 100, 1)}% of lot vs {round(zoning_max * 100)}% zoning max",
            "display_value": f"{round(coverage_pct * 100, 1)}%",
            "score": round(f_coverage * 100, 1),
            "weight": W_COVERAGE,
            "severity": _severity(f_coverage),
        },
    }

    # Ownership
    if f_ownership is not None:
        factors_dict["ownership"] = {
            "label": "Ownership Volatility",
            "description": f"{num_transfers} transfer{'s' if num_transfers != 1 else ''} in 5 yrs, avg hold {avg_hold:.1f} yrs",
            "display_value": f"{num_transfers} transfer{'s' if num_transfers != 1 else ''}" if num_transfers > 0 else "Stable",
            "score": round(f_ownership * 100, 1),
            "weight": W_OWNERSHIP,
            "severity": _severity(f_ownership),
        }
    else:
        factors_dict["ownership"] = _unavailable_factor("Ownership Volatility")

    # Property age
    if f_age is not None:
        factors_dict["age"] = {
            "label": "Property Age",
            "description": f"Built {2026 - prop_age}, {prop_age} years old",
            "display_value": f"{prop_age} yrs",
            "score": round(f_age * 100, 1),
            "weight": W_AGE,
            "severity": _severity(f_age),
        }
    else:
        factors_dict["age"] = _unavailable_factor("Property Age")

    # CV delta
    if f_cv is not None:
        factors_dict["cv_delta"] = {
            "label": "Survey Discrepancy",
            "description": f"CV vs recorded area differs by {round(cv_delta * 100, 1)}%",
            "display_value": f"{round(cv_delta * 100, 1)}% gap" if cv_delta > 0.01 else "Consistent",
            "score": round(f_cv * 100, 1),
            "weight": W_CV_DELTA,
            "severity": _severity(f_cv),
        }
    else:
        factors_dict["cv_delta"] = _unavailable_factor("Survey Discrepancy")

    return {
        "overall_score": final_score,
        "risk_tier": get_risk_tier(final_score),
        "factors": factors_dict,
        "interactions": {
            "value": interaction
        },
        "weighted_score": weighted_score,
        "ml": ml_result,
        "delay": delay_result,
        "scoring_method": scoring_method,
    }


def get_risk_tier(score: float) -> str:
    """
    Map 0-100 risk score to a human-readable tier.

    TODO: Implement.
      >= 80  →  "Critical"
      >= 60  →  "High"
      >= 40  →  "Moderate"
      >= 20  →  "Low"
      else   →  "Minimal"
    """
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
# Module initialisation
# ---------------------------------------------------------------------------
_train_models()
