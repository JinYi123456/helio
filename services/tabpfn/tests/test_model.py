"""Real TabPFN fit — the heart of the Grass Window.

Model weights require a one-time, free license acceptance (Prior Labs
account → API key → TABPFN_TOKEN). Until the token is present these tests
skip with instructions instead of failing.
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest

from app.features import label_good, load_history
from app.forecast import climatology_forecast
from app.model import GrassWindowModel


def _have_token() -> bool:
    if os.environ.get("TABPFN_TOKEN"):
        return True
    return (Path.home() / ".cache" / "tabpfn" / "auth_token").is_file() or (Path.home() / ".tabpfn" / "token").is_file()


pytestmark = pytest.mark.skipif(
    not _have_token(),
    reason="TabPFN weights unavailable — free one-time license acceptance needed (see _private/HANDOFF.md, TABPFN_TOKEN)",
)


def _predict(model: GrassWindowModel, city: str, days: int = 7):
    df, _, _ = climatology_forecast(city, days)
    try:
        return model.predict_days(df)
    except Exception as exc:  # noqa: BLE001
        if "license" in str(exc).lower() or "TABPFN_TOKEN" in str(exc):
            pytest.skip(f"TabPFN license not yet accepted: {exc}")
        raise


def test_fit_and_predict_seven_days():
    model = GrassWindowModel("petaling-jaya")
    scores = _predict(model, "petaling-jaya", 7)
    assert len(scores) == 7
    assert all(0.0 <= s <= 1.0 for s in scores)
    assert model.fit_info.context_rows > 500
    assert model.fit_info.personal_rows == 0


def test_personal_labels_from_archive_day():
    hist = load_history("zurich")
    recent = hist.tail(60)
    not_good = recent[label_good(recent, "zurich") == 0]
    assert len(not_good) > 0
    walked_date = not_good.iloc[-1]["date"].strftime("%Y-%m-%d")

    model = GrassWindowModel("zurich")
    model.add_personal_labels([{"date": walked_date, "walked": True}])
    nudged = _predict(model, "zurich", 7)

    assert len(nudged) == 7
    assert model.fit_info.personal_rows == 3  # one walked day, duplicated as positives


def test_personal_labels_from_walk_weather():
    """Walks logged in the app are newer than the archive — weather comes from the walk."""
    model = GrassWindowModel("seattle")
    df, _, _ = climatology_forecast("seattle", 7)
    tomorrow = df.iloc[0]
    walked_date = tomorrow["date"].strftime("%Y-%m-%d")
    assert not load_history("seattle")["date"].dt.strftime("%Y-%m-%d").isin([walked_date]).any()

    model.add_personal_labels(
        [{"date": walked_date, "walked": True, "tmax": float(tomorrow["tmax"]), "tmin": float(tomorrow["tmin"]), "precip": float(tomorrow["precip"])}]
    )
    nudged = _predict(model, "seattle", 7)
    assert len(nudged) == 7
    assert model.fit_info.personal_rows == 3
