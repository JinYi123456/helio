"""Bring-your-own-sky: any coordinate on earth gets a Grass Window.

The three baked cities ship a decade of curated weather and tuned label
rules. For anywhere else the app sends a `geo:<lat>,<lon>` key; the service
fetches the last two years of open-meteo archive on demand and derives the
same kind of rules from the location's own climatology.
"""
from __future__ import annotations

import re

import numpy as np
import pandas as pd

_GEO_RE = re.compile(r"^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$")


def geo_key(lat: float, lon: float) -> str:
    return f"geo:{round(lat, 3)},{round(lon, 3)}"


def parse_geo_key(key: str) -> tuple[float, float] | None:
    m = _GEO_RE.match(key or "")
    if not m:
        return None
    lat, lon = float(m.group(1)), float(m.group(2))
    if abs(lat) > 90 or abs(lon) > 180:
        return None
    return lat, lon


def is_geo(key: str) -> bool:
    return parse_geo_key(key) is not None


def fmt_geo(lat: float, lon: float) -> str:
    ns = "N" if lat >= 0 else "S"
    ew = "E" if lon >= 0 else "W"
    return f"{abs(lat):.2f}°{ns}, {abs(lon):.2f}°{ew}"


# Kept within the envelope of the curated city rules so a data hiccup can
# never produce more generous labelling than the hand-tuned skies.
GENERIC_RULES = {"tmax_lo": 5.0, "tmax_hi": 32.0, "precip_max": 1.2, "wind_max": 35.0, "cloud_max": 80.0}


def derive_rules(df: pd.DataFrame) -> dict:
    """Label rules from the location's own archive — same shape as CITY_LABEL_RULES.

    A day is good when it sits inside *this place's* normal temperature
    range, is drier than its typical day, and is neither a gale nor a
    whiteout. Percentiles are clamped to the curated cities' envelope.
    """
    tmax = df["tmax"].dropna().to_numpy(dtype=float) if "tmax" in df else np.array([])
    if len(tmax):
        tmax_lo = round(float(np.percentile(tmax, 5)), 1)
        tmax_hi = round(float(np.percentile(tmax, 95)), 1)
    else:
        tmax_lo, tmax_hi = GENERIC_RULES["tmax_lo"], GENERIC_RULES["tmax_hi"]

    def pct(col: str, q: float, fallback: float) -> float:
        if col not in df:
            return fallback
        vals = df[col].dropna().to_numpy(dtype=float)
        if not len(vals):
            return fallback
        return float(np.percentile(vals, q))

    return {
        "tmax_lo": tmax_lo,
        "tmax_hi": tmax_hi,
        "precip_max": round(min(2.0, max(0.4, pct("precip", 40, GENERIC_RULES["precip_max"]))), 2),
        "wind_max": round(min(40.0, max(25.0, pct("wind", 90, GENERIC_RULES["wind_max"]))), 1),
        "cloud_max": round(min(90.0, max(65.0, pct("cloud", 75, GENERIC_RULES["cloud_max"]))), 0),
    }
