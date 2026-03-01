import sys
sys.path.append('backend')
from services.hasdata_client import fetch_zillow_data
import json

addresses_to_test = [
    "21231 Avenida Planicie, Lake Forest, CA 92630",
    "25180 Juno St, Menifee, CA 92586",
    "123 Unknown St, Nowhere, CA 00000" # Should fallback
]

for addr in addresses_to_test:
    print(f"\n--- Testing Address: {addr} ---")
    data = fetch_zillow_data(addr)
    print(json.dumps(data, indent=2))
