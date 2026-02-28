import sys
sys.path.append('.')
from models.flood_prediction import predict_next_flood_zones
import json

print("Running predict_next_flood_zones...")
res = predict_next_flood_zones(25.77, -80.13, 2289)
print("Features count:", len(res.get("features", [])))
