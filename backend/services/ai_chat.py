"""
Parcel Intelligence — Property Virtual Assistant (LLM Chat)

Provides an interactive chatbot experience using the active property JSON.
Strictly restricted to answering based on the provided JSON context and the user's mode (Agent vs Regular).
"""

import json
from openai import OpenAI
from config import Config

def chat_with_assistant(property_json: dict, user_prompt: str, mode: str, history: list = None) -> dict:
    """
    Generate a response to a user query based on the property data.
    
    Args:
        property_json: A compact JSON dict containing risk metrics, timeline, and financial data.
        user_prompt: The question or request from the user.
        mode: "agent" or "regular". Dictates the tone and technical depth.
        history: List of previous messages in the format [{"role": "user"|"assistant", "content": "..."}]
        
    Returns:
        dict containing the updated ai_response and suggested follow-ups.
    """
    
    if not Config.GROQ_API_KEY:
        return {
            "response": "I'm running in offline mode, so I can't generate a dynamic response right now. But I see the Deal Health Score is " + str(property_json.get("dealHealthScore", 0)) + ".",
            "suggestions": ["Ask about structural risks", "Check flood hazards"]
        }

    client = OpenAI(
        base_url=Config.GROQ_BASE_URL,
        api_key=Config.GROQ_API_KEY
    )

    # 1. Construct the strict System Prompt
    system_instruction = f"""You are the Parcel Intelligence Property Assistant. 
You exist as an interactive pop-up in a property risk dashboard.

CRITICAL INSTRUCTIONS:
1. Property-Specific Answers: ONLY use the information provided in the JSON context below. Do not hallucinate or make up data.
2. Handling Missing Data: If a field is missing, reply politely (e.g., "This information is not available. Consider checking local records.").
3. User Mode ({mode.upper()} MODE): 
   - If AGENT MODE: Use detailed technical explanations, reference specific scores (e.g., 60/100), and highlight financial logic.
   - If REGULAR MODE: Use plain-language, friendly, and concise summaries. Avoid deep technical jargon.
4. Interactive Guidance: Include a tiny follow-up suggestion organically in the chat if relevant.
5. Integration: Reference visual dashboard tools if applicable (e.g. "You can see this in the 3D Scatter plot").
6. Conciseness: Keep responses short, direct, and focused on actionable insights. Do not generate massive paragraphs.
7. Output Format: Return pure JSON.

PROPERTY CONTEXT JSON:
{json.dumps(property_json, indent=2)}
"""

    # 2. Rebuild message history
    messages = [
        {"role": "system", "content": system_instruction}
    ]
    
    if history:
        # Keep only the last 5 exchanges to avoid context bloat
        messages.extend(history[-10:])
        
    messages.append({"role": "user", "content": user_prompt})

    # 3. Define the desired JSON output shape
    # We ask the LLM to provide the text response and a list of 2-3 short suggested questions
    format_prompt = """
OUTPUT FORMAT: Provide your response as a JSON object exactly like this:
{
  "response": "Your conversational text answer goes here...",
  "suggestions": ["Short follow up 1?", "Short follow up 2?"]
}
"""
    messages[0]["content"] += format_prompt

    # 4. Call LLM
    try:
        completion = client.chat.completions.create(
            model=Config.OPENAI_MODEL,
            response_format={"type": "json_object"},
            messages=messages,
            temperature=0.4, # keep it fairly deterministic but slightly conversational
            max_tokens=600,
        )
        
        response_text = completion.choices[0].message.content
        result_dict = json.loads(response_text)
        
        # Fallback if suggestions array is missing
        if "suggestions" not in result_dict:
            result_dict["suggestions"] = ["What is the Deal Health Score?", "Are there title risks?"]
            
        return result_dict

    except Exception as e:
        print(f"[ai_chat] Error generating chat response: {str(e)}")
        return {
            "response": "I encountered an error trying to process that request. Could you rephrase it?",
            "suggestions": ["What are the largest risks?", "Summarize the property."],
            "error": str(e)
        }
