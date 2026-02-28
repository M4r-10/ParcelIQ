"""
TitleGuard AI — AI Summary Layer (LLM)

Generates plain-English risk explanations using OpenAI's GPT API.

Output includes:
  - Risk explanation in natural language
  - Recommended next steps
  - Potential closing delay likelihood
"""

from config import Config

import json
from openai import OpenAI


def generate_risk_summary(risk_data: dict) -> dict:
    """
    Generate a plain-English risk summary using an LLM.

    Args:
        risk_data: dict containing overall_score, risk_tier, and factor breakdown.

    Returns:
        dict with explanation, recommendations, and delay likelihood.
    """

    if not Config.GROQ_API_KEY:
        # Return mock summary when API key is not configured
        print("Notice: GROQ_API_KEY is not set. Falling back to mock AI summary.")
        return _mock_summary(risk_data)

    client = OpenAI(
        base_url=Config.GROQ_BASE_URL,
        api_key=Config.GROQ_API_KEY
    )
    prompt = _build_prompt(risk_data)

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
        
        # Merge structured response with meta identifier
        summary_dict["generated_by"] = "gpt"
        return summary_dict
        
    except Exception as e:
        print(f"Error calling OpenAI API: {str(e)}")
        # Fallback to mock on any failures
        return {"error": str(e), "fallback": True, **_mock_summary(risk_data)}


def _build_prompt(risk_data: dict) -> str:
    """
    Build a structured prompt for the LLM from risk data.

    Args:
        risk_data: The computed risk score and factor breakdown.

    Returns:
        Formatted prompt string.
    """
    overall = risk_data.get("overall_score", "N/A")
    tier = risk_data.get("risk_tier", "N/A")
    factors = risk_data.get("factors", {})

    prompt = f"""Analyze the following property risk assessment and provide:
1. A 2-3 sentence plain-English risk explanation
2. 3 recommended next steps for the buyer/underwriter
3. An estimated closing delay likelihood (Low/Medium/High)

RISK ASSESSMENT:
- Overall Score: {overall}/100
- Risk Tier: {tier}

FACTOR BREAKDOWN:
"""

    for key, factor in factors.items():
        prompt += f"- {factor.get('label', key)}: {factor.get('score', 'N/A')}/100 (weight: {factor.get('weight', 'N/A')})\n"

    prompt += """
Respond in this JSON format:
{
  "explanation": "...",
  "recommendations": ["...", "...", "..."],
  "closing_delay_likelihood": "Low|Medium|High",
  "delay_reason": "..."
}
"""
    return prompt


def _mock_summary(risk_data: dict) -> dict:
    """
    Generate a mock AI summary for demo purposes.

    Args:
        risk_data: Risk score data to base the mock on.
    """
    score = risk_data.get("overall_score", 72)
    tier = risk_data.get("risk_tier", "Moderate")

    # TODO: Generate dynamic mock summaries based on actual factor scores
    return {
        "explanation": (
            f"This property presents {tier.lower()} underwriting risk (score: {score}/100) "
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
        "generated_by": "mock",
    }
