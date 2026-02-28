"""
TitleGuard AI — Mock Data Layer

Provides hardcoded sample data for demo and development purposes.
Replace with real data sources in production.

Datasets:
  - SAMPLE_PARCELS: Parcel boundaries with property metadata
  - OWNERSHIP_HISTORY: Transfer records per parcel
  - FLOOD_ZONES: FEMA flood zone polygons (mock)
  - EASEMENTS: Easement strip polygons (mock)
"""


# ---------------------------------------------------------------------------
# Sample Parcels — GeoJSON-style parcel boundaries
# ---------------------------------------------------------------------------
SAMPLE_PARCELS = {
    "downtown_sample": {
        "type": "Feature",
        "properties": {
            "parcel_id": "downtown_sample",
            "address": "123 Main St, Irvine, CA 92618",
            "property_age": 35,
            "lot_size_sqft": 4000,
            "zoning": "R-1",
            "year_built": 1989,
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [-117.8270, 33.6850],
                    [-117.8260, 33.6850],
                    [-117.8260, 33.6840],
                    [-117.8270, 33.6840],
                    [-117.8270, 33.6850],
                ]
            ],
        },
    },
    "suburban_sample": {
        "type": "Feature",
        "properties": {
            "parcel_id": "suburban_sample",
            "address": "456 Oak Ave, Irvine, CA 92620",
            "property_age": 12,
            "lot_size_sqft": 6500,
            "zoning": "R-2",
            "year_built": 2012,
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [-117.7950, 33.7100],
                    [-117.7935, 33.7100],
                    [-117.7935, 33.7085],
                    [-117.7950, 33.7085],
                    [-117.7950, 33.7100],
                ]
            ],
        },
    },
    # TODO: Add more sample parcels for different risk profiles
    # TODO: Load parcels from a GeoJSON file or database
}


# ---------------------------------------------------------------------------
# Ownership History — Transfer records
# ---------------------------------------------------------------------------
OWNERSHIP_HISTORY = {
    "downtown_sample": [
        {
            "date": "2019-03-15",
            "from": "Smith Family Trust",
            "to": "Greenfield Holdings LLC",
            "price": 450000,
            "type": "sale",
        },
        {
            "date": "2020-11-02",
            "from": "Greenfield Holdings LLC",
            "to": "Pacific Ventures LLC",
            "price": 510000,
            "type": "sale",
        },
        {
            "date": "2022-06-20",
            "from": "Pacific Ventures LLC",
            "to": "Current Owner",
            "price": 580000,
            "type": "sale",
        },
    ],
    "suburban_sample": [
        {
            "date": "2012-08-10",
            "from": "Developer Corp",
            "to": "Johnson Family",
            "price": 620000,
            "type": "new_construction",
        },
    ],
    # TODO: Add more realistic ownership patterns
    # TODO: Include foreclosure, tax lien, and quitclaim deed types
}


# ---------------------------------------------------------------------------
# Flood Zones — Mock FEMA flood zone polygons
# ---------------------------------------------------------------------------
FLOOD_ZONES = {
    "downtown_sample": {
        "zone_type": "AE",  # FEMA flood zone classification
        "exposure": 0.65,   # 65% of parcel is in flood zone
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [-117.8275, 33.6845],
                    [-117.8255, 33.6845],
                    [-117.8255, 33.6840],
                    [-117.8275, 33.6840],
                    [-117.8275, 33.6845],
                ]
            ],
        },
        "description": "Zone AE — 1% annual chance flood hazard area",
    },
    "suburban_sample": {
        "zone_type": "X",
        "exposure": 0.05,
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [-117.7952, 33.7087],
                    [-117.7948, 33.7087],
                    [-117.7948, 33.7085],
                    [-117.7952, 33.7085],
                    [-117.7952, 33.7087],
                ]
            ],
        },
        "description": "Zone X — Minimal flood hazard",
    },
    # TODO: Add more flood zone types (A, AH, VE, etc.)
    # TODO: Integrate with real FEMA NFHL API
}


# ---------------------------------------------------------------------------
# Easements — Mock easement strip polygons
# ---------------------------------------------------------------------------
EASEMENTS = {
    "downtown_sample": {
        "type": "utility",
        "encroachment_pct": 0.15,  # 15% of parcel
        "description": "10-foot utility easement along the east boundary",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [-117.8261, 33.6850],
                    [-117.8260, 33.6850],
                    [-117.8260, 33.6840],
                    [-117.8261, 33.6840],
                    [-117.8261, 33.6850],
                ]
            ],
        },
        "restrictions": [
            "No permanent structures",
            "Utility company access required",
        ],
    },
    "suburban_sample": {
        "type": "access",
        "encroachment_pct": 0.08,
        "description": "Shared driveway access easement on the north side",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [-117.7945, 33.7100],
                    [-117.7940, 33.7100],
                    [-117.7940, 33.7098],
                    [-117.7945, 33.7098],
                    [-117.7945, 33.7100],
                ]
            ],
        },
        "restrictions": [
            "Shared access with neighboring property",
            "No obstruction of driveway",
        ],
    },
    # TODO: Add conservation easements, drainage easements
    # TODO: Load from a real GIS layer or title report parser
}


# ---------------------------------------------------------------------------
# Building Footprints — Mock building outlines within parcels
# ---------------------------------------------------------------------------
BUILDING_FOOTPRINTS = {
    "downtown_sample": {
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [-117.8268, 33.6848],
                    [-117.8263, 33.6848],
                    [-117.8263, 33.6842],
                    [-117.8268, 33.6842],
                    [-117.8268, 33.6848],
                ]
            ],
        },
        "area_sqft": 2720,
        "stories": 2,
    },
    "suburban_sample": {
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [-117.7948, 33.7097],
                    [-117.7940, 33.7097],
                    [-117.7940, 33.7089],
                    [-117.7948, 33.7089],
                    [-117.7948, 33.7097],
                ]
            ],
        },
        "area_sqft": 3200,
        "stories": 1,
    },
    # TODO: Source from OpenStreetMap building footprint data
    # TODO: Generate from CV pipeline output
}
