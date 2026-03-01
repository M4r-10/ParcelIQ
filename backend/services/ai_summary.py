"""
TitleGuard AI — AI Summary Layer (LLM)

Generates plain-English risk explanations using the Groq API (OpenAI-compatible).

Output includes:
  - Risk explanation in natural language
  - Recommended next steps
  - Potential closing delay likelihood

The prompt is grounded in SHAP feature importances from the ML risk model
so the LLM explanation reflects the actual drivers of the risk score.
"""

from config import Config

import json
from openai import OpenAI


def generate_risk_summary(risk_data: dict, address: str = "") -> dict:
    """
    Generate a plain-English risk summary using an LLM.

    Args:
        risk_data: dict containing overall_score, risk_tier, factor breakdown,
                   and optionally ml.shap_values from the risk scoring engine.
        address: The property address being analyzed (for context in the prompt).

    Returns:
        dict with explanation, recommendations, and delay likelihood.
    """

    if not Config.GROQ_API_KEY:
        print("Notice: GROQ_API_KEY is not set. Falling back to mock AI summary.")
        return _mock_summary(risk_data)

    client = OpenAI(
        base_url=Config.GROQ_BASE_URL,
        api_key=Config.GROQ_API_KEY
    )
    prompt = _build_prompt(risk_data, address)

    try:
        response = client.chat.completions.create(
            model=Config.OPENAI_MODEL,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a property risk analyst for a title insurance company. "
                        "Provide clear, professional risk assessments in plain English. "
                        "Be specific about risks and actionable in recommendations. "
                        "You must respond in pure JSON format."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=500,
        )
        summary_text = response.choices[0].message.content
        summary_dict = json.loads(summary_text)

        summary_dict["generated_by"] = "groq"
        return summary_dict

    except Exception as e:
        print(f"Error calling Groq API: {str(e)}")
        return {"error": str(e), "fallback": True, **_mock_summary(risk_data)}


def _build_prompt(risk_data: dict, address: str = "") -> str:
    """
    Build a structured prompt for the LLM from risk data,
    including SHAP feature importances when available.
    """
    overall = risk_data.get("overall_score", "N/A")
    tier = risk_data.get("risk_tier", "N/A")
    factors = risk_data.get("factors", {})
    scoring_method = risk_data.get("scoring_method", "weighted_only")
    ml_data = risk_data.get("ml")
    delay_data = risk_data.get("delay")

    prompt = f"""Analyze the following property risk assessment and provide:
1. A 2-3 sentence plain-English risk explanation
2. 3 recommended next steps for the buyer/underwriter
3. An estimated closing delay likelihood (Low/Medium/High)

PROPERTY: {address or "Unknown"}

RISK ASSESSMENT:
- Overall Score: {overall:.1f}/100
- Risk Tier: {tier}
- Scoring Method: {scoring_method}

FACTOR BREAKDOWN:
"""

    for key, factor in factors.items():
        if factor.get("unavailable"):
            prompt += f"- {key}: DATA UNAVAILABLE\n"
            continue
        score = factor.get("score", 0) or 0
        weight = factor.get("weight", 0)
        prompt += f"- {key}: score={score:.3f} (weight={weight})\n"

    # Include SHAP values if the ML model produced them
    if ml_data and ml_data.get("shap_values"):
        prompt += "\nML MODEL SHAP FEATURE CONTRIBUTIONS (positive = increases risk, negative = decreases risk):\n"
        shap_vals = ml_data["shap_values"]
        # Sort by absolute value to show top drivers first
        sorted_shap = sorted(shap_vals.items(), key=lambda x: abs(x[1]), reverse=True)
        for feat, val in sorted_shap:
            direction = "(+) increases risk" if val > 0 else "(-) decreases risk"
            prompt += f"- {feat}: {val:+.4f} ({direction})\n"

        ml_prob = ml_data.get("ml_risk_probability", 0)
        prompt += f"\nML Risk Probability: {ml_prob:.2%}\n"

    # Include closing delay prediction if available
    if delay_data:
        prompt += f"\nPREDICTED CLOSING DELAY: {delay_data.get('delay_likelihood', 'N/A')} "
        prompt += f"(probability: {delay_data.get('delay_probability', 0):.2%})\n"

    prompt += """
Respond in this JSON format:
{
  "explanation": "...",
  "recommendations": ["...", "...", "..."],
  "closing_delay_likelihood": "Low|Medium|High",
  "delay_reason": "...",
  "top_risk_drivers": ["...", "..."]
}
"""
    return prompt


def _mock_summary(risk_data: dict) -> dict:
    """Generate a mock AI summary for demo purposes."""
    score = risk_data.get("overall_score", 72)
    tier = risk_data.get("risk_tier", "Moderate")

    return {
        "explanation": (
            f"This property presents {tier.lower()} underwriting risk (score: {score:.0f}/100) "
            "due to high lot coverage (68% of 70% allowed) and partial flood zone exposure "
            "on the southwest boundary. The ownership history shows two transfers in the "
            "last 5 years, which warrants additional review."
        ),
        "recommendations": [
            "Verify build restrictions with local zoning authority before closing.",
            "Obtain an updated FEMA flood certification for the property.",
            "Request a full title search covering the last 20 years of ownership.",
        ],
        "closing_delay_likelihood": "Medium",
        "delay_reason": (
            "Flood zone verification and lot coverage confirmation may add 5-10 business "
            "days to the standard closing timeline."
        ),
        "top_risk_drivers": ["flood_exposure", "lot_coverage_ratio"],
        "generated_by": "mock",
    }
