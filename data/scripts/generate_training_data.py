"""
Generate synthetic_training_data.csv for TitleGuard AI.
2,000 rows · binary label (0|1) · logistic risk model.
"""
import csv, random, math, os

random.seed(42)

HEADER = [
    "flood_exposure",
    "flood_boundary_distance",
    "easement_encroachment_pct",
    "lot_coverage_ratio",
    "property_age",
    "num_transfers_5yr",
    "avg_holding_period_years",
    "ownership_anomaly_score",
    "cv_vs_recorded_area_delta",
    "label",
]

def logistic(x):
    return 1.0 / (1.0 + math.exp(-x))

def gen_row():
    flood_exposure = random.choice([0, 0, 0, 0, 1])
    flood_boundary_distance = 0.0 if flood_exposure else round(random.uniform(10, 500), 1)
    easement_pct = round(random.uniform(0, 0.35), 3)
    lot_area = random.choice([4500, 5000, 5200, 5500, 6000, 6500, 7000, 7500, 8000, 9000, 10000])
    max_coverage = round(random.uniform(0.55, 0.80), 2)
    coverage_ratio = round(random.uniform(0.25, min(1.05, max_coverage + 0.25)), 3)
    year_built = random.randint(1945, 2024)
    age = 2026 - year_built
    num_transfers = random.choice([0, 0, 0, 1, 1, 2, 2, 3, 4, 5, 6])
    avg_hold = round(random.uniform(0.5, 15), 2) if num_transfers > 0 else round(random.uniform(5, 30), 1)
    anomaly = round(min(1.0, max(0.0,
        0.1 * num_transfers + (0.15 if avg_hold < 2 else 0) + random.gauss(0.05, 0.1)
    )), 3)
    cv_delta = round(max(0, random.gauss(0.05, 0.08)), 3)

    z = (
        1.2 * flood_exposure
        - 0.005 * flood_boundary_distance
        + 2.5 * easement_pct
        + 2.0 * (coverage_ratio - max_coverage)
        + 0.01 * age
        + 0.3 * num_transfers
        - 0.05 * avg_hold
        + 1.5 * anomaly
        + 1.0 * cv_delta
        + random.gauss(0, 0.3) - 1.5
    )
    prob = logistic(z)
    label = 1 if prob >= 0.5 else 0

    return [
        flood_exposure,
        flood_boundary_distance,
        easement_pct,
        coverage_ratio,
        age,
        num_transfers,
        avg_hold,
        anomaly,
        cv_delta,
        label,
    ]

output_path = os.path.join(os.path.dirname(__file__), "..", "synthetic_training_data.csv")

with open(output_path, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(HEADER)
    for _ in range(2000):
        writer.writerow(gen_row())

print(f"Generated 2,000 rows -> {os.path.abspath(output_path)}")
