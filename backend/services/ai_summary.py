"""
TitleGuard AI — AI Summary Layer (LLM)

Generates plain-English risk explanations using the Groq API (OpenAI-compatible).

Output includes:
  - Risk explanation in natural language
  - Recommended next steps
  - Potential closing delay likelihood

The prompt is grounded in SHAP feature importances from the ML risk model
The prompt is grounded in SHAP feature importances from the ML risk model
so the LLM explanation reflects the actual drivers of the risk score.
Financial forecasts and mitigation strategies are powered by HasData Zillow data.
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

    # Allow larger output since we are adding financial & mitigation planning
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
            max_tokens=1500,
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
    # ensure overall is formatted properly even if it's 'N/A'
    overall_str = f"{overall:.1f}" if isinstance(overall, (int, float)) else str(overall)

    tier = risk_data.get("risk_tier", "N/A")
    factors = risk_data.get("factors", {})
    scoring_method = risk_data.get("scoring_method", "weighted_only")
    ml_data = risk_data.get("ml")
    delay_data = risk_data.get("delay")
    financial_data = risk_data.get("financial_data", {})

    prompt = f"""Analyze the following property risk assessment and provide:
1. A detailed, comprehensive paragraph evaluating the overall risk score, breaking down the specific factors, and providing an adequate analysis of their implications.
2. 3 recommended next steps for the buyer/underwriter
3. An estimated closing delay likelihood (Low/Medium/High)

PROPERTY: {address or "Unknown"}

RISK ASSESSMENT:
- Overall Score: {overall_str}/100
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

    # Integrating Financial Output (HasData)
    prompt += "\nFINANCIAL DATA & FORECASTING REQUIREMENTS:\n"
    if financial_data.get("error") == "missing_authoritative_data":
        prompt += (
            "CRITICAL DIRECTIVE: Financial valuation data is missing or could not be retrieved from the authoritative HasData Zillow source. "
            "You MUST explicitly state: 'Predictive modeling paused: Authoritative financial data missing.' "
            "Do NOT hallucinate, simulate, approximate, or fabricate valuation data. "
            "Do NOT provide 3-year or 5-year forecasts. Do NOT provide expected financial impact in mitigation strategies."
        )
    elif financial_data:
        prompt += f"Market Value Estimate: ${financial_data.get('market_value_estimate')}\n"
        prompt += f"Value Range: ${financial_data.get('value_range_low')} - ${financial_data.get('value_range_high')}\n"
        prompt += f"Rent Estimate (Monthly): ${financial_data.get('rent_estimate')}\n"
        prompt += f"Tax Assessed Value: ${financial_data.get('tax_assessed_value')}\n"
        prompt += f"Tax Annual Amount: ${financial_data.get('tax_annual_amount')}\n"
        prompt += f"Insurance Estimate (Annual): ${financial_data.get('insurance_estimate_annual')}\n"
        prompt += f"Confidence Score: {financial_data.get('confidence_score')}\n"
        if "historical_trends" in financial_data:
            trends = financial_data["historical_trends"]
            prompt += f"Historical Trends: 1yr={trends.get('1_year_appreciation_rate')}, 5yr={trends.get('5_year_appreciation_rate')}, 10yr={trends.get('10_year_appreciation_rate')}\n"
        
        prompt += (
            "\nBased STRICTLY on the retrieved financial and spatial property data above, you must also provide:\n"
            "1. Financial Forecasting: Provide a 3-year and 5-year value projection, downside risk scenario, and insurance cost escalation scenario.\n"
            "   - State your assumptions and model basis cleanly (e.g., linear appreciation trend, risk-adjusted discounting, etc.).\n"
            "   - Output your confidence level.\n"
            "2. Mitigation Strategies: Provide 2 financially rational mitigation strategies grounded in the data (e.g., risk-reducing property improvements, insurance restructuring, refinancing timing, exposure rebalancing).\n"
            "   - For EACH strategy, explicitly quantify the expected financial impact (estimated cost, projected savings, or value preservation).\n"
            "   - If insufficient data exists to compute an impact estimate, state that limitation clearly instead of guessing.\n"
            "Connect spatial risk factors directly to these financial implications.\n"
        )
    else:
        # Default behavior if financial_data key is entirely absent for some reason
        prompt += "No financial data provided. Do not compute financial predictions.\n"

    prompt += """
Respond in this pure JSON format:
{
  "explanation": "...",
  "recommendations": ["...", "...", "..."],
  "closing_delay_likelihood": "Low|Medium|High",
  "delay_reason": "...",
  "top_risk_drivers": ["...", "..."],
  "financial_forecast": {
    "status": "active (or 'paused: missing authoritative data')",
    "forecast_3_year": "$...",
    "forecast_5_year": "$...",
    "downside_risk_scenario": "...",
    "insurance_escalation_scenario": "...",
    "assumptions_and_basis": "...",
    "confidence_level": "..."
  },
  "mitigation_strategies": [
    {
      "strategy_name": "...",
      "description": "...",
      "expected_financial_impact": "..."
    }
  ]
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
        "financial_forecast": {
            "status": "active (mocked)",
            "forecast_3_year": "$745,000",
            "forecast_5_year": "$810,000",
            "downside_risk_scenario": "If local flood zones are expanded by FEMA next year, property value could temporarily depreciate by 5-8% due to higher insurance carrying costs.",
            "insurance_escalation_scenario": "Current $2,400 annual premium could escalate to $4,100 if the secondary flood basin is formally designated as high-risk.",
            "assumptions_and_basis": "Linear appreciation based on historical 5-year county average (4.2% YoY), adjusted downward by 0.5% for flood exposure risk.",
            "confidence_level": "Medium (Mocked data)"
        },
        "mitigation_strategies": [
            {
                "strategy_name": "Property Elevation Certificate",
                "description": "Obtain a formal elevation certificate to prove the primary structure is above the Base Flood Elevation (BFE).",
                "expected_financial_impact": "Estimated cost: $500-$1,000. Projected savings: Up to $1,200/year in flood insurance premiums."
            },
            {
                "strategy_name": "Diversified Hazard Insurance Structuring",
                "description": "Separate wind/hail coverage from flood coverage, prioritizing surplus lines carriers for flood risk if NFIP rates escalate.",
                "expected_financial_impact": "Projected savings: $400-$600/year. Value preservation effect: High."
            }
        ],
        "generated_by": "mock",
    }
