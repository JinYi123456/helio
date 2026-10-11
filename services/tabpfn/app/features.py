"""Feature engineering over a decade of daily weather.

The raw CSVs come from open-meteo's archive API (free, open data). The first
three lines of each file are API metadata, hence skiprows=3. Geo keys carry
no CSV — their history is fetched from the same archive on demand.
"""
from __future__ import annotations

import datetime as dt
import functools

import httpx
import numpy as np
import pandas as pd

from .cities import CITIES, CITY_LABEL_RULES, DATA_DIR
from .geo import GENERIC_RULES, derive_rules, is_geo, parse_geo_key

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


ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
ARCHIVE_DAILY = (
    "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,"
    "relative_humidity_2m_mean,sunshine_duration,cloud_cover_mean"
)


@functools.lru_cache(maxsize=16)
def archive_for(lat: float, lon: float) -> pd.DataFrame:
    """Two years of real daily weather for an arbitrary coordinate."""
    end = dt.date.today() - dt.timedelta(days=6)  # the archive lags a few days
    start = end - dt.timedelta(days=729)
    resp = httpx.get(
        ARCHIVE_URL,
        params={
            "latitude": lat,
            "longitude": lon,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "daily": ARCHIVE_DAILY,
            "timezone": "auto",
        },
        timeout=12.0,
    )
    resp.raise_for_status()
    d = resp.json()["daily"]
    df = pd.DataFrame(
        {
            "date": pd.to_datetime(d["time"]),
            "tmax": d["temperature_2m_max"],
            "tmin": d["temperature_2m_min"],
            "precip": d["precipitation_sum"],
            "wind": d["wind_speed_10m_max"],
            "humidity": d["relative_humidity_2m_mean"],
            "sunshine_s": [x if x is not None else 0 for x in d["sunshine_duration"]],
            "cloud": d["cloud_cover_mean"],
        }
    )
    df = df.dropna(subset=["tmax", "tmin", "precip"]).reset_index(drop=True)
    if df.empty:
        raise RuntimeError("archive returned nothing usable")
    return build_features(df)


def history_for(city_key: str) -> pd.DataFrame:
    """A decade of weather for baked cities; two archived years for geo keys."""
    parsed = parse_geo_key(city_key)
    if parsed:
        return archive_for(*parsed)
    return load_history(city_key)


def rules_for(city_key: str) -> dict:
    parsed = parse_geo_key(city_key)
    if parsed:
        try:
            return derive_rules(archive_for(*parsed))
        except Exception:  # noqa: BLE001 — archive hiccup: stay honest, stay in the envelope
            return dict(GENERIC_RULES)
    return CITY_LABEL_RULES[city_key]


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
    r = rules_for(city_key)
    good = (
        (df["tmax"] >= r["tmax_lo"])
        & (df["tmax"] <= r["tmax_hi"])
        & (df["precip"] < r["precip_max"])
        & (df["wind"] < r["wind_max"])
        & (df["cloud"] <= r["cloud_max"])
    )
    return good.astype(int)


def climatology_rows(city_key: str, dates: pd.DatetimeIndex) -> pd.DataFrame:
    """When there's no network, guess the forecast from years of the same days."""
    hist = history_for(city_key)
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
