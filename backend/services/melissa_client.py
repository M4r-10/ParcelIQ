"""
ParcelIQ — Melissa Property Data Client

Queries the Melissa Property Cloud API to retrieve real county assessor
data for a given property address.  This replaces heuristic estimates with
ground-truth values for:

  - Year built (from county assessor records)
  - Building square footage
  - Lot square footage
  - Last sale / ownership transfer date

Uses only 3 column groups to minimise credit usage:
  GrpPropertyUseInfo  →  YearBuilt
  GrpPropertySize     →  AreaBuilding, AreaLotSF
  GrpSaleInfo         →  sale dates for ownership history

Docs: https://wiki.melissadata.com/index.php?title=Property_V4
"""

import requests
from config import Config
from datetime import datetime


# ── Base URLs ──────────────────────────────────────────────────────────────
_PROPERTY_URL = "https://property.melissadata.net/v4/WEB/LookupProperty"
_DEEDS_URL = "https://property.melissadata.net/v4/WEB/LookupDeeds"


def lookup_property(address: str) -> dict | None:
    """
    Look up property data from Melissa using a free-form address.

    Returns a normalised dict with assessor data, or None if the API
    is unavailable or returns no results.
    """
    api_key = Config.MELISSA_API_KEY
    if not api_key or api_key == "your-melissa-key-here":
        print("Melissa API key not configured - skipping property lookup")
        return None

    # Only request the 3 column groups we actually use for risk scoring.
    # Each group costs credits — keep this minimal.
    columns = ",".join([
        "GrpPropertyUseInfo",   # YearBuilt
        "GrpPropertySize",     # AreaBuilding, AreaLotSF
        "GrpSaleInfo",         # sale dates for ownership
    ])

    params = {
        "id": api_key,
        "ff": address,
        "cols": columns,
        "format": "json",
    }

    try:
        resp = requests.get(_PROPERTY_URL, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        records = data.get("Records", [])
        if not records:
            print(f"Melissa: no property records found for '{address}'")
            return None

        record = records[0]

        # Check for error result codes
        results = record.get("Results", "")
        if "SE01" in results:
            print(f"Melissa: empty/invalid request for '{address}'")
            return None

        return _parse_property_record(record)

    except requests.RequestException as e:
        print(f"Melissa Property API error: {e}")
        return None
    except Exception as e:
        print(f"Melissa response parsing error: {e}")
        return None


# NOTE: LookupDeeds removed to save credits.
# Ownership data is now derived from SaleInfo in LookupProperty
# (AssessorLastSaleDate, AssessorPriorSaleDate, LastOwnershipTransferDate).


# ── Internal parsers ──────────────────────────────────────────────────────

def _parse_property_record(record: dict) -> dict:
    """Parse a Melissa LookupProperty record into only the fields we use."""
    prop_use = record.get("PropertyUseInfo", {})
    prop_size = record.get("PropertySize", {})
    sale_info = record.get("SaleInfo", {})

    return {
        # Age — used for property_age risk factor
        "year_built": _safe_int(prop_use.get("YearBuilt")),
        "property_use": prop_use.get("PropertyUseGroup", ""),

        # Size — used for lot coverage + CV delta
        "building_sqft": _safe_int(prop_size.get("AreaBuilding")),
        "lot_sqft": _safe_int(prop_size.get("AreaLotSF")),
        "lot_acres": _safe_float(prop_size.get("AreaLotAcres")),

        # Sale dates — used for ownership volatility
        "last_sale_date": sale_info.get("AssessorLastSaleDate", ""),
        "prior_sale_date": sale_info.get("AssessorPriorSaleDate", ""),
        "last_transfer_date": sale_info.get("LastOwnershipTransferDate", ""),

        # Source marker
        "source": "melissa",
    }


def compute_ownership_from_sale_info(melissa_data: dict) -> dict | None:
    """
    Compute ownership metrics from the SaleInfo already in LookupProperty.
    No extra API call needed — uses last_sale_date and prior_sale_date.

    Returns:
        dict with num_transfers_5yr, avg_holding_period, ownership_anomaly_score
        or None if no sale dates are available.
    """
    if not melissa_data:
        return None

    last_date = _parse_date(melissa_data.get("last_sale_date", ""))
    prior_date = _parse_date(melissa_data.get("prior_sale_date", ""))
    transfer_date = _parse_date(melissa_data.get("last_transfer_date", ""))

    dates = [d for d in [last_date, prior_date, transfer_date] if d]
    if not dates:
        return None

    dates.sort()
    now = datetime.now()
    five_years_ago = now.replace(year=now.year - 5)

    recent = sum(1 for d in dates if d >= five_years_ago)

    # Holding period from consecutive sale dates
    if len(dates) >= 2:
        delta = (dates[-1] - dates[-2]).days / 365.25
        avg_hold = max(1.0, delta)
    else:
        # Only one sale on record → likely long-term owner
        years_since = (now - dates[0]).days / 365.25
        avg_hold = max(1.0, years_since)

    anomaly = 0.0
    if recent >= 2:
        anomaly += 0.3
    if avg_hold < 2.0:
        anomaly += 0.3
    elif avg_hold < 5.0:
        anomaly += 0.1

    return {
        "num_transfers_5yr": recent,
        "avg_holding_period": round(avg_hold, 1),
        "ownership_anomaly_score": round(min(1.0, anomaly), 3),
        "source": "melissa_sale_info",
    }


# ── Utility functions ─────────────────────────────────────────────────────

def _safe_int(value) -> int:
    """Convert to int, return 0 on failure. Handles '5200.00' style strings."""
    try:
        if value is None or value == "":
            return 0
        return int(float(str(value).replace(",", "")))
    except (ValueError, TypeError):
        return 0


def _safe_float(value) -> float:
    """Convert to float, return 0.0 on failure."""
    try:
        if value is None or value == "":
            return 0.0
        return float(str(value).replace(",", ""))
    except (ValueError, TypeError):
        return 0.0


def _parse_date(date_str: str) -> datetime | None:
    """Parse various Melissa date formats."""
    if not date_str:
        return None

    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m-%d-%Y", "%Y%m%d"):
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    return None
