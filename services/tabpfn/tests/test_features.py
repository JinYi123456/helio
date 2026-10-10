"""Feature pipeline tests — real decade of weather, no network."""
from __future__ import annotations

import numpy as np
import pandas as pd

from app.cities import CITIES
from app.features import FEATURES, climatology_rows, label_good, load_history


def test_load_history_every_city():
    for key in CITIES:
        df = load_history(key)
        assert len(df) > 3000, f"{key} should ship a decade of days, got {len(df)}"
        assert (df["date"].dt.year.max() - df["date"].dt.year.min()) >= 9
        for col in FEATURES:
            assert col in df.columns, f"{key} missing feature {col}"
        assert df[FEATURES].isna().sum().sum() == 0


def test_label_good_is_discriminating():
    for key in CITIES:
        df = load_history(key)
        y = label_good(df, key)
        rate = float(y.mean())
        assert 0.02 < rate < 0.85, f"{key} label rate {rate} is degenerate"


def test_climatology_rows_shape():
    dates = pd.date_range("2026-10-12", periods=7)
    df = climatology_rows("zurich", dates)
    assert len(df) == 7
    for col in FEATURES:
        assert col in df.columns
    assert np.allclose(df["tmean"], (df["tmax"] + df["tmin"]) / 2)
    assert df["diurnal"].ge(0).all()
