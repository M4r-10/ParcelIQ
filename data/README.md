# TitleGuard AI — Demo Data

Structured, reproducible demo data for three risk-tiered properties in Irvine, CA.
All assets are cached locally — **no live API dependency during demo**.

## Folder Structure

```
data/
├── properties/
│   ├── low_risk/           # 123 Meadowbrook Ln — risk ~10%
│   ├── medium_risk/        # 456 Oak Ave — risk ~40%
│   └── high_risk/          # 789 River Rd — risk ~82%
│       ├── parcel.geojson
│       ├── building.geojson
│       ├── flood_overlay.geojson
│       ├── easements.geojson
│       ├── satellite.png
│       ├── ownership.json
│       ├── zoning.json
│       ├── features.json
│       └── metadata.json
├── zoning_rules.json          # Global zoning thresholds (R1, R2, R3)
├── flood_zones_master.geojson # Regional flood zone layer
├── synthetic_training_data.csv # 2,000 rows for ML training
├── scripts/
│   └── generate_training_data.py
└── README.md
```

## Property Summary

| Property | Lot (sqft) | Coverage | Flood | Easement | Owners | Age | Risk |
|----------|-----------|----------|-------|----------|--------|-----|------|
| Low      | 7,500     | 37%      | X (safe) | None  | 1      | 11  | 5–15% |
| Medium   | 6,000     | 70%      | X (45m from AE) | 8% | 3 | 34 | 30–50% |
| High     | 5,200     | 80% ⚠   | AE (inside) | 22% | 6 (LLC chain) | 61 | 70–90% |

## Feature Schema

All `features.json` and `synthetic_training_data.csv` rows share this schema:

| Feature | Type | Description |
|---------|------|-------------|
| `flood_exposure` | 0/1 | Inside flood zone |
| `flood_boundary_distance` | float | Meters to nearest SFHA boundary |
| `easement_encroachment_pct` | float | % of lot encumbered by easements |
| `lot_coverage_ratio` | float | building_area / lot_area |
| `property_age` | int | Years since construction |
| `num_transfers_5yr` | int | Ownership transfers in past 5 years |
| `avg_holding_period_years` | float | Mean holding time across owners |
| `ownership_anomaly_score` | float | 0–1 anomaly metric (LLC patterns) |

## Coordinate System

All geometry is in **WGS84 (EPSG:4326)**.

## Regenerating Training Data

```bash
python data/scripts/generate_training_data.py
```

Produces 2,000 synthetic rows with a logistic risk model.
