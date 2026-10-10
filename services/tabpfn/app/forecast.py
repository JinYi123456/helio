"""Forecast fetch — live from open-meteo (free, no key), or climatology when offline."""
from __future__ import annotations

import datetime as dt

import httpx
import numpy as np
import pandas as pd

from .cities import CITIES
from .features import climatology_rows

DAILY = "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,relative_humidity_2m_mean,sunshine_duration,cloud_cover_mean"
HOURLY = "temperature_2m,precipitation_probability,cloud_cover,wind_speed_10m"


def live_forecast(city_key: str, days: int = 7) -> tuple[pd.DataFrame, dict, str]:
    city = CITIES[city_key]
    resp = httpx.get(
        "https://api.open-meteo.com/v1/forecast",
        params={
            "latitude": city["lat"],
            "longitude": city["lon"],
            "daily": DAILY,
            "hourly": HOURLY,
            "timezone": "auto",
            "forecast_days": days,
        },
        timeout=8.0,
    )
    resp.raise_for_status()
    data = resp.json()
    d = data["daily"]
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
    df["tmean"] = (df["tmax"] + df["tmin"]) / 2
    df["diurnal"] = df["tmax"] - df["tmin"]
    df["sun_hours"] = df["sunshine_s"] / 3600.0
    doy = pd.to_datetime(d["time"]).dayofyear.to_numpy(dtype=float)
    df["doy_sin"] = np.sin(2 * np.pi * doy / 365.25)
    df["doy_cos"] = np.cos(2 * np.pi * doy / 365.25)

    h = data.get("hourly", {})
    hourly = {
        "time": h.get("time", []),
        "temp": h.get("temperature_2m", []),
        "rain_prob": h.get("precipitation_probability", []),
        "cloud": h.get("cloud_cover", []),
        "wind": h.get("wind_speed_10m", []),
    }
    return df, hourly, "live"


def climatology_forecast(city_key: str, days: int = 7) -> tuple[pd.DataFrame, dict, str]:
    today = dt.date.today()
    dates = pd.DatetimeIndex([pd.Timestamp(today + dt.timedelta(days=i)) for i in range(1, days + 1)])
    df = climatology_rows(city_key, dates)
    return df, {}, "climatology"


def best_hours(hourly: dict, day_iso: str) -> list[int]:
    """Pick the friendliest 2-hour block of the day (heuristic over the hourly forecast)."""
    times = hourly.get("time") or []
    if not times:
        return [7, 8]
    idx = [i for i, t in enumerate(times) if t.startswith(day_iso)]
    if not idx:
        return [7, 8]

    def score(i: int) -> float:
        t = hourly["temp"][i] if i < len(hourly["temp"]) and hourly["temp"][i] is not None else 24
        rp = hourly["rain_prob"][i] if i < len(hourly["rain_prob"]) and hourly["rain_prob"][i] is not None else 40
        cl = hourly["cloud"][i] if i < len(hourly["cloud"]) and hourly["cloud"][i] is not None else 60
        hour_of_day = int(times[i][11:13])
        daylight = 1.0 if 6 <= hour_of_day <= 19 else 0.15
        s = (100 - rp) - abs(t - 23) * 3 - cl * 0.35
        return s * daylight

    best, best_pair = -1e9, (idx[0], idx[0] + 1)
    scored = {i: score(i) for i in idx}
    for a, b in zip(idx, idx[1:]):
        if b == a + 1:
            s = scored[a] + scored[b]
            if s > best:
                best, best_pair = s, (a, b)
    hours = [int(times[best_pair[0]][11:13]), int(times[best_pair[1]][11:13])]
    if hours[0] == hours[1]:
        hours = [hours[0], min(23, hours[0] + 1)]
    return hours


WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def fmt_window(date: pd.Timestamp, hours: list[int]) -> str:
    return f"{WEEKDAYS[date.weekday()]} · {hours[0]:02d}:00–{hours[-1] + 1:02d}:00"
