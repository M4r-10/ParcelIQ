import sys
sys.path.append('.')
from services.fema_client import fetch_historical_flood_claims
print("Miami:", fetch_historical_flood_claims(25.77, -80.13))
