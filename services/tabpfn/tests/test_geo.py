"""Bring-your-own-sky: geo keys, derived rules, and the full chain — no network.

The geo path fetches open-meteo's archive on demand; here the archive and the
live forecast are monkeypatched so the specs stay deterministic and offline.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app import features, service
from app.geo import derive_rules, fmt_geo, geo_key, is_geo, parse_geo_key


def test_geo_key_roundtrip():
    key = geo_key(3.10734, 101.60674)
    assert key == "geo:3.107,101.607"
    assert parse_geo_key(key) == (3.107, 101.607)


def test_geo_key_rejects_junk():
    assert not is_geo("petaling-jaya")
    assert not is_geo("geo:not,numbers")
    assert not is_geo("")
    assert parse_geo_key("geo:91.0,10.0") is None
    assert parse_geo_key("geo:10.0,-181.0") is None


def test_fmt_geo_hemispheres():
    assert fmt_geo(3.107, 101.607) == "3.11°N, 101.61°E"
    assert fmt_geo(-33.87, -70.66) == "33.87°S, 70.66°W"


def _frame(seed: int = 7, n: int = 730) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    dates = pd.date_range("2024-10-01", periods=n, freq="D")
    tmax = 20 + 8 * np.sin(np.linspace(0, 4 * np.pi, n)) + rng.normal(0, 2, n)
    return pd.DataFrame(
        {
            "date": dates,
            "tmax": tmax,
            "tmin": tmax - 8,
            "precip": rng.exponential(1.5, n),
            "wind": rng.uniform(3, 30, n),
            "cloud": rng.uniform(5, 100, n),
            "sunshine_s": rng.uniform(0, 12, n) * 3600.0,
            "humidity": rng.uniform(40, 95, n),
        }
    )


def test_derive_rules_shape_and_clamps():
    r = derive_rules(_frame())
    assert set(r) == {"tmax_lo", "tmax_hi", "precip_max", "wind_max", "cloud_max"}
    assert r["tmax_lo"] < r["tmax_hi"]
    assert 0.4 <= r["precip_max"] <= 2.0
    assert 25.0 <= r["wind_max"] <= 40.0
    assert 65.0 <= r["cloud_max"] <= 90.0


def test_rules_for_falls_back_to_generic(monkeypatch):
    def boom(lat, lon):
        raise RuntimeError("archive down")

    monkeypatch.setattr(features, "archive_for", boom)
    assert features.rules_for("geo:1.5,103.5") == features.GENERIC_RULES


def test_history_and_rules_for_geo_use_archive(monkeypatch):
    fake = features.build_features(_frame())
    monkeypatch.setattr(features, "archive_for", lambda lat, lon: fake)
    hist = features.history_for("geo:1.5,103.5")
    assert len(hist) == len(fake)
    r = features.rules_for("geo:1.5,103.5")
    assert r["tmax_lo"] < r["tmax_hi"]


def test_compute_window_geo_serves_heuristic_without_model(monkeypatch):
    fake_hist = features.build_features(_frame())
    monkeypatch.setattr(features, "archive_for", lambda lat, lon: fake_hist)

    fc = fake_hist.tail(7).reset_index(drop=True)
    monkeypatch.setattr(service, "live_forecast", lambda city, days: (fc, {}, "live"))
    monkeypatch.setattr(service, "_model_available", lambda city: False)

    out = service.compute_window("geo:1.5,103.5", days=7)
    assert out["served"] == "heuristic"
    assert out["city"] == "geo:1.5,103.5"
    assert len(out["days"]) == 7
    assert out["days"][0]["hours"] == [7, 8]  # no hourly data in the fake live feed


def test_unknown_key_still_raises():
    with pytest.raises(KeyError):
        service.compute_window("atlantis", days=7)
