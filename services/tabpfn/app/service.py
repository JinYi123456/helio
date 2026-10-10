"""Window computation shared by the API and the precompute script."""
from __future__ import annotations

import datetime as dt
import json
import os
import time

import pandas as pd

from .cities import CITIES, CITY_LABEL_RULES, PRECOMPUTED_DIR
from .forecast import best_hours, climatology_forecast, fmt_window, live_forecast
from .model import GrassWindowModel, FitInfo

_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

_models: dict[str, GrassWindowModel] = {}
_MODEL_FAIL_COOLDOWN_S = 600.0
_model_fail_until: dict[str, float] = {}


def get_model(city_key: str) -> GrassWindowModel:
    if city_key not in _models:
        _models[city_key] = GrassWindowModel(city_key)
    return _models[city_key]


def _model_available(city_key: str) -> bool:
    return time.monotonic() >= _model_fail_until.get(city_key, 0.0)


def _mark_model_failed(city_key: str) -> None:
    _model_fail_until[city_key] = time.monotonic() + _MODEL_FAIL_COOLDOWN_S


def _day_payload(date: pd.Timestamp, row: pd.Series, score: float, hours: list[int], source: str) -> dict:
    return {
        "date": date.strftime("%Y-%m-%d"),
        "label": f"{_MONTHS[date.month - 1]} {date.day}",
        "weekday": fmt_window(date, hours).split(" · ")[0],
        "score": round(score, 4),
        "hours": hours,
        "source": source,
        "tMax": round(float(row["tmax"]), 1),
        "tMin": round(float(row["tmin"]), 1),
        "precip": round(float(row["precip"]), 2),
        "cloud": round(float(row["cloud"]), 0),
    }


def _precomputed_path(city_key: str, precomputed_dir=None):
    d = precomputed_dir or PRECOMPUTED_DIR
    return d / f"window-{city_key}.json"


def load_precomputed(city_key: str, precomputed_dir=None) -> dict:
    path = _precomputed_path(city_key, precomputed_dir)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def compute_window(
    city_key: str,
    days: int = 7,
    precompute_only: bool = False,
    precomputed_dir=None,
    use_live: bool = True,
) -> dict:
    """Scores the next `days` days for grass-worthiness.

    Order of preference: live forecast → climatology, both scored by TabPFN.
    If the model can't run (tiny host, missing weights) or PRE-compute mode is
    on, a precomputed JSON made at build time is served instead.
    """
    if city_key not in CITIES:
        raise KeyError(city_key)

    if precompute_only or os.environ.get("HELIO_PRECOMPUTE_ONLY") == "1":
        return load_precomputed(city_key, precomputed_dir)

    source = "live"
    try:
        if not use_live:
            raise RuntimeError("live disabled")
        df, hourly, source = live_forecast(city_key, days)
    except Exception:
        df, hourly, source = climatology_forecast(city_key, days)

    scores = fit = None
    served = "model"
    if _model_available(city_key):
        try:
            model = get_model(city_key)
            scores = model.predict_days(df)
            fit = model.fit_info
        except Exception:
            _mark_model_failed(city_key)

    if scores is None:
        try:
            pre = load_precomputed(city_key, precomputed_dir)
            pre["served"] = "precomputed-fallback"
            return pre
        except FileNotFoundError:
            scores = heuristic_scores(df, city_key)
            fit = FitInfo()
            served = "heuristic"

    out_days = []
    for i, (_, row) in enumerate(df.iterrows()):
        date = row["date"]
        if source == "live":
            hours = best_hours(hourly, date.strftime("%Y-%m-%d"))
        else:
            hours = [7, 8]
        out_days.append(_day_payload(date, row, scores[i], hours, source))

    return {
        "city": city_key,
        "source": source,
        "served": served,
        "days": out_days,
        "fit": {
            "contextRows": fit.context_rows,
            "personalRows": fit.personal_rows,
            "labelRate": round(fit.label_rate, 4),
        },
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
    }


def heuristic_scores(df: pd.DataFrame, city_key: str) -> list[float]:
    """Last-resort scoring when the model itself is unavailable."""
    r = CITY_LABEL_RULES[city_key]
    scores = []
    for _, row in df.iterrows():
        s = 0.45
        s += 0.2 if r["tmax_lo"] <= row["tmax"] <= r["tmax_hi"] else -0.15
        s += 0.15 if row["precip"] < r["precip_max"] else -0.2
        s += 0.1 if row["wind"] < r["wind_max"] else -0.1
        s += 0.05 if row["cloud"] <= r["cloud_max"] else -0.05
        s += 0.05 * min(1.0, float(row["sun_hours"]) / 10.0)
        scores.append(round(max(0.02, min(0.98, s)), 4))
    return scores
