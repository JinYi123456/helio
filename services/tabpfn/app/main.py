"""Helio · Grass Window service.

A FastAPI wrapper around the TabPFN model: which hours of the next days are
worth touching grass? Runs on CPU, keeps a fitted model per city in memory,
and can fall back to precomputed windows on tiny hosts.
"""
from __future__ import annotations

import datetime as dt
import os

# A server must never block on interactive browser login — if the weights
# aren't available the service degrades to precomputed/heuristic windows.
os.environ.setdefault("TABPFN_NO_BROWSER", "1")

from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from . import service  # noqa: E402
from .cities import CITIES  # noqa: E402

app = FastAPI(title="Helio Grass Window", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PersonalLabel(BaseModel):
    date: str
    walked: bool = True
    tmax: float | None = None
    tmin: float | None = None
    precip: float | None = None


class PersonalizeBody(BaseModel):
    city: str
    labels: list[PersonalLabel] = Field(default_factory=list)


@app.get("/health")
def health():
    return {
        "ok": True,
        "engine": "tabpfn",
        "cities": sorted(CITIES.keys()),
        "modelsLoaded": sorted(service._models.keys()),
        "precomputeOnly": os.environ.get("HELIO_PRECOMPUTE_ONLY") == "1",
        "time": dt.datetime.now(dt.timezone.utc).isoformat(),
    }


@app.get("/cities")
def cities():
    return {"cities": [{"key": k, **{kk: v[kk] for kk in ("label", "lat", "lon", "tz")}} for k, v in CITIES.items()]}


@app.get("/window")
def window(city: str, days: int = 7):
    if city not in CITIES:
        raise HTTPException(status_code=404, detail=f"unknown city: {city}")
    days = max(1, min(days, 14))
    try:
        return service.compute_window(city, days=days)
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="precomputed window missing and model unavailable")
    except Exception as exc:  # noqa: BLE001 — surfaced to the caller as 503
        raise HTTPException(status_code=503, detail=f"window unavailable: {exc}")


@app.post("/personalize")
def personalize(body: PersonalizeBody):
    if body.city not in CITIES:
        raise HTTPException(status_code=404, detail=f"unknown city: {body.city}")
    model = service.get_model(body.city)
    n = model.add_personal_labels([l.model_dump() for l in body.labels])
    return {"ok": True, "city": body.city, "personalRows": n}
