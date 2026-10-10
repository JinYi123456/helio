"""The Grass Window model.

A tiny tabular foundation model (TabPFN, Prior Labs) learns your city's decade
of weather in-context — on CPU, in about a second — and scores the next days
for grass-worthiness. Personal labels (days you actually walked) nudge the
model toward *your* idea of a good day.
"""
from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

from .cities import CITY_LABEL_RULES
from .features import FEATURES, label_good, load_history


@dataclass
class FitInfo:
    context_rows: int = 0
    personal_rows: int = 0
    label_rate: float = 0.0


class GrassWindowModel:
    """Fits lazily, refits instantly (TabPFN learns in-context — no training loop)."""

    def __init__(self, city_key: str):
        self.city_key = city_key
        self._clf: Any | None = None
        self._fitted_sig: tuple | None = None
        self._lock = threading.Lock()
        self.personal: list[dict] = []
        self.fit_info = FitInfo()

    def _ensure_clf(self):
        if self._clf is None:
            from tabpfn import TabPFNClassifier  # heavy import stays lazy

            self._clf = TabPFNClassifier(device="cpu", n_estimators=8)

    def add_personal_labels(self, labels: list[dict]) -> int:
        """labels: [{"date": "YYYY-MM-DD", "walked": bool}] — only positives matter."""
        with self._lock:
            self.personal = [l for l in labels if l.get("walked")]
            self._fitted_sig = None
        return len(self.personal)

    def _fit(self):
        history = load_history(self.city_key)
        recent = history.tail(int(2 * 365.25))
        X = recent[FEATURES].to_numpy(dtype=float)
        y = label_good(recent, self.city_key).to_numpy()

        personal_rows = 0
        if self.personal:
            personal_X = self._personal_matrix(recent)
            if len(personal_X):
                X = np.vstack([X, personal_X])
                y = np.concatenate([y, np.ones(len(personal_X), dtype=int)])
                personal_rows = len(personal_X)

        self._ensure_clf()
        self._clf.fit(X, y)
        self.fit_info = FitInfo(
            context_rows=int(len(X)),
            personal_rows=personal_rows,
            label_rate=float(np.mean(y)),
        )
        self._fitted_sig = tuple(self.personal)

    def _personal_matrix(self, recent: pd.DataFrame) -> np.ndarray:
        """Turn walked days into labelled rows.

        Walks logged in the app happened after the archive was baked, so they
        rarely appear in the CSV. Walk-time weather (tmax/tmin/precip captured
        from the day's mission window) fills the gap; the rest of the features
        fall back to same-day-of-year climatology.
        """
        wanted = {l["date"]: l for l in self.personal}
        hit = recent[recent["date"].dt.strftime("%Y-%m-%d").isin(wanted)]
        rows: list[np.ndarray] = []
        if not hit.empty:
            rows.append(np.tile(hit[FEATURES].to_numpy(dtype=float), (3, 1)))

        missing = [l for d, l in wanted.items() if not hit["date"].dt.strftime("%Y-%m-%d").eq(d).any()]
        synth = []
        for l in missing:
            row = self._synth_row(l)
            if row is not None:
                synth.append(row)
        if synth:
            rows.append(np.tile(np.vstack(synth), (3, 1)))

        if not rows:
            return np.empty((0, len(FEATURES)))
        return np.vstack(rows)

    def _synth_row(self, label: dict) -> np.ndarray | None:
        tmax = label.get("tmax")
        tmin = label.get("tmin")
        if tmax is None or tmin is None:
            return None
        try:
            date = pd.Timestamp(label["date"])
        except Exception:
            return None
        hist = load_history(self.city_key)
        window = hist[(hist["date"].dt.dayofyear - date.dayofyear).abs() <= 4]
        if window.empty:
            window = hist.tail(30)
        clim = {c: float(window[c].mean()) for c in ("precip", "wind", "humidity", "cloud", "sun_hours")}
        precip = label.get("precip")
        precip = clim["precip"] if precip is None else float(precip)
        doy = float(date.dayofyear)
        feat = {
            "doy_sin": float(np.sin(2 * np.pi * doy / 365.25)),
            "doy_cos": float(np.cos(2 * np.pi * doy / 365.25)),
            "tmax": float(tmax),
            "tmin": float(tmin),
            "tmean": (float(tmax) + float(tmin)) / 2,
            "diurnal": float(tmax) - float(tmin),
            "precip": precip,
            "wind": clim["wind"],
            "humidity": clim["humidity"],
            "cloud": clim["cloud"],
            "sun_hours": clim["sun_hours"],
        }
        return np.array([feat[c] for c in FEATURES], dtype=float)

    def predict_days(self, forecast_df: pd.DataFrame) -> list[float]:
        sig = tuple(self.personal)
        if self._fitted_sig != sig:
            self._fit()
        X = forecast_df[FEATURES].to_numpy(dtype=float)
        proba = self._clf.predict_proba(X)
        return [float(p[1]) for p in proba]

    def label_rules(self) -> dict:
        return dict(CITY_LABEL_RULES[self.city_key])
