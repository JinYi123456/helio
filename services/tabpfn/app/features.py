"""Feature engineering over a decade of daily weather.

The raw CSVs come from open-meteo's archive API (free, open data). The first
three lines of each file are API metadata, hence skiprows=3.
"""
from __future__ import annotations

import functools

import numpy as np
import pandas as pd

from .cities import CITIES, CITY_LABEL_RULES, DATA_DIR

RENAME = {
    "time": "date",
    "temperature_2m_max": "tmax",
    "temperature_2m_min": "tmin",
    "precipitation_sum": "precip",
    "wind_speed_10m_max": "wind",
    "relative_humidity_2m_mean": "humidity",
    "sunshine_duration": "sunshine_s",
    "cloud_cover_mean": "cloud",
}

FEATURES = ["doy_sin", "doy_cos", "tmax", "tmin", "tmean", "diurnal", "precip", "wind", "humidity", "cloud", "sun_hours"]


@functools.lru_cache(maxsize=4)
def load_history(city_key: str) -> pd.DataFrame:
    city = CITIES[city_key]
    df = pd.read_csv(DATA_DIR / city["csv"], skiprows=3)
    df.columns = [str(c).split(" (")[0] for c in df.columns]
    df = df.rename(columns=RENAME)
    df["date"] = pd.to_datetime(df["date"])
    df = df.dropna(subset=["tmax", "tmin", "precip"])
    return build_features(df)


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    doy = df["date"].dt.dayofyear.to_numpy(dtype=float)
    df["doy_sin"] = np.sin(2 * np.pi * doy / 365.25)
    df["doy_cos"] = np.cos(2 * np.pi * doy / 365.25)
    df["tmean"] = (df["tmax"] + df["tmin"]) / 2
    df["diurnal"] = df["tmax"] - df["tmin"]
    df["sun_hours"] = df["sunshine_s"] / 3600.0
    return df


def label_good(df: pd.DataFrame, city_key: str) -> pd.Series:
    r = CITY_LABEL_RULES[city_key]
    good = (
        (df["tmax"] >= r["tmax_lo"])
        & (df["tmax"] <= r["tmax_hi"])
        & (df["precip"] < r["precip_max"])
        & (df["wind"] < r["wind_max"])
        & (df["cloud"] <= r["cloud_max"])
    )
    return good.astype(int)


def climatology_rows(city_key: str, dates: pd.DatetimeIndex) -> pd.DataFrame:
    """When there's no network, guess the forecast from a decade of the same days."""
    hist = load_history(city_key)
    rows = []
    for d in dates:
        doy = d.dayofyear
        window = hist[((hist["date"].dt.dayofyear - doy).abs() <= 4)]
        if window.empty:
            window = hist.tail(30)
        row = {col: float(window[col].mean()) for col in ["tmax", "tmin", "precip", "wind", "humidity", "cloud", "sun_hours"]}
        row["date"] = d
        rows.append(row)
    df = pd.DataFrame(rows)
    df["doy_sin"] = np.sin(2 * np.pi * dates.dayofyear.to_numpy(dtype=float) / 365.25)
    df["doy_cos"] = np.cos(2 * np.pi * dates.dayofyear.to_numpy(dtype=float) / 365.25)
    df["tmean"] = (df["tmax"] + df["tmin"]) / 2
    df["diurnal"] = df["tmax"] - df["tmin"]
    return df
