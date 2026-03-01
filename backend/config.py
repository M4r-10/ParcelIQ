"""
TitleGuard AI — Configuration
Loads environment variables and provides app-wide config.
"""

import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Application configuration loaded from environment variables."""

    # Flask
    DEBUG = os.getenv("FLASK_DEBUG", "True").lower() in ("true", "1", "yes")
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-prod")

    # Groq API (High-Speed LLM)
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "llama-3.3-70b-versatile")
    GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")

    # Mapbox
    MAPBOX_TOKEN = os.getenv("MAPBOX_TOKEN", "")

    # Melissa Property Data
    MELISSA_API_KEY = os.getenv("MELISSA_API_KEY", "")

    # HasData Zillow API
    HASDATA_API_KEY = os.getenv("HASDATA_API_KEY", "")

    # Risk scoring weights
    WEIGHT_FLOOD = 0.30
    WEIGHT_EASEMENT = 0.25
    WEIGHT_LOT_COVERAGE = 0.20
    WEIGHT_OWNERSHIP = 0.15
    WEIGHT_PROPERTY_AGE = 0.10

    # Zoning defaults
    DEFAULT_MAX_LOT_COVERAGE = 0.70  # 70%

    # TODO: Add database connection config if needed
    # TODO: Add Redis/cache config for API response caching
    # TODO: Add rate limiting config
