"""API tests — stub model + offline forecast, so the suite stays fast and green."""
from __future__ import annotations

import json

from fastapi.testclient import TestClient

from app import service
from app.forecast import climatology_forecast
from app.main import app

client = TestClient(app)


class StubModel:
    """Fast stand-in for GrassWindowModel — the real one is exercised in test_model.py."""

    def __init__(self):
        from app.model import FitInfo

        self.fit_info = FitInfo(context_rows=123, personal_rows=0, label_rate=0.4)
        self.personal = []

    def predict_days(self, df):
        return [0.5 + 0.05 * i for i in range(len(df))]

    def add_personal_labels(self, labels):
        self.personal = [l for l in labels if l.get("walked")]
        return len(self.personal)


def _offline(monkeypatch):
    monkeypatch.setattr(
        service,
        "live_forecast",
        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("offline")),
    )
    monkeypatch.setattr(service, "get_model", lambda city: StubModel())


def test_health(monkeypatch):
    _offline(monkeypatch)
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["engine"] == "tabpfn"
    assert "petaling-jaya" in body["cities"]


def test_cities():
    r = client.get("/cities")
    assert r.status_code == 200
    keys = {c["key"] for c in r.json()["cities"]}
    assert keys == {"petaling-jaya", "seattle", "zurich"}


def test_window_offline_still_answers(monkeypatch):
    _offline(monkeypatch)
    r = client.get("/window", params={"city": "zurich", "days": 7})
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "climatology"
    assert body["served"] == "model"
    assert len(body["days"]) == 7
    day = body["days"][0]
    for field in ("date", "label", "weekday", "score", "hours", "tMax", "tMin", "precip", "cloud"):
        assert field in day
    assert day["hours"] == [7, 8]
    assert 0 <= day["score"] <= 1


def test_window_unknown_city():
    r = client.get("/window", params={"city": "atlantis"})
    assert r.status_code == 404


def test_window_heuristic_when_model_and_precompute_missing(monkeypatch, tmp_path):
    monkeypatch.setattr(service, "live_forecast", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("offline")))
    monkeypatch.setattr(service, "get_model", lambda city: (_ for _ in ()).throw(RuntimeError("no weights")))
    monkeypatch.setattr(service, "PRECOMPUTED_DIR", tmp_path)
    r = client.get("/window", params={"city": "zurich", "days": 3})
    assert r.status_code == 200
    body = r.json()
    assert body["served"] == "heuristic"
    assert len(body["days"]) == 3
    assert all(0 <= d["score"] <= 1 for d in body["days"])


def test_window_precompute_only(monkeypatch, tmp_path):
    baked = {
        "city": "seattle",
        "source": "live",
        "served": "precomputed",
        "days": [{"date": "2026-10-12", "label": "Oct 12", "weekday": "Mon", "score": 0.9, "hours": [7, 8], "source": "live", "tMax": 14.0, "tMin": 8.0, "precip": 0.0, "cloud": 40.0}],
        "fit": {"contextRows": 731, "personalRows": 0, "labelRate": 0.31},
    }
    (tmp_path / "window-seattle.json").write_text(json.dumps(baked))
    monkeypatch.setattr(service, "PRECOMPUTED_DIR", tmp_path)
    monkeypatch.setenv("HELIO_PRECOMPUTE_ONLY", "1")
    r = client.get("/window", params={"city": "seattle"})
    assert r.status_code == 200
    assert r.json()["served"] == "precomputed"
    assert r.json()["days"][0]["score"] == 0.9


def test_personalize(monkeypatch):
    _offline(monkeypatch)
    r = client.post(
        "/personalize",
        json={"city": "petaling-jaya", "labels": [{"date": "2026-09-01", "walked": True}, {"date": "2026-09-02", "walked": False}]},
    )
    assert r.status_code == 200
    assert r.json()["personalRows"] == 1
