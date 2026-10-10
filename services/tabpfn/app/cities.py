"""City registry for the Grass Window model.

Each city ships with a decade of real daily weather (open-meteo archive, CC-BY)
and climate-appropriate rules for what counts as a "good outdoor day".
"""
from __future__ import annotations

from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[3] / "data" / "weather"
PRECOMPUTED_DIR = Path(__file__).resolve().parents[3] / "data" / "precomputed"

CITIES: dict[str, dict] = {
    "petaling-jaya": {
        "label": "Petaling Jaya, MY",
        "lat": 3.1073,
        "lon": 101.6067,
        "tz": "Asia/Kuala_Lumpur",
        "csv": "petaling-jaya.csv",
    },
    "seattle": {
        "label": "Seattle, US",
        "lat": 47.6062,
        "lon": -122.3321,
        "tz": "America/Los_Angeles",
        "csv": "seattle.csv",
    },
    "zurich": {
        "label": "Zürich, CH",
        "lat": 47.3769,
        "lon": 8.5417,
        "tz": "Europe/Zurich",
        "csv": "zurich.csv",
    },
}

# What makes a day worth touching grass, per climate.
# A day is labled good=1 only if every bound holds.
CITY_LABEL_RULES: dict[str, dict] = {
    "petaling-jaya": {"tmax_lo": 20.0, "tmax_hi": 34.0, "precip_max": 2.0, "wind_max": 30.0, "cloud_max": 88.0},
    "seattle": {"tmax_lo": 8.0, "tmax_hi": 28.0, "precip_max": 1.0, "wind_max": 35.0, "cloud_max": 78.0},
    "zurich": {"tmax_lo": 5.0, "tmax_hi": 28.0, "precip_max": 1.2, "wind_max": 35.0, "cloud_max": 75.0},
}


def city_or_400(key: str) -> dict:
    city = CITIES.get(key)
    if city is None:
        raise KeyError(key)
    return city
