"""Bake grass windows at build time.

Tiny free hosts (512MB RAM) can't hold TabPFN + torch in memory, so this
script runs once per city — locally or in CI — and writes a small JSON the
service can serve verbatim with HELIO_PRECOMPUTE_ONLY=1.

Usage:
    uv run python -m app.precompute [--days 7]
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from pathlib import Path

# A bake must never hang on interactive login: without TABPFN_TOKEN the
# fallback chain (precomputed → heuristic) takes over.
os.environ.setdefault("TABPFN_NO_BROWSER", "1")

from .cities import CITIES, PRECOMPUTED_DIR  # noqa: E402
from .service import compute_window  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Precompute grass windows for every city")
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--out", default=str(PRECOMPUTED_DIR))
    args = parser.parse_args(argv)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    for city_key in CITIES:
        window = compute_window(city_key, days=args.days)
        window["served"] = "precomputed"
        window["bakedAt"] = dt.datetime.now(dt.timezone.utc).isoformat()
        path = out_dir / f"window-{city_key}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(window, f, indent=2, ensure_ascii=False)
        top = window["days"][0]
        print(f"[precompute] {city_key}: {len(window['days'])} days · top score {max(d['score'] for d in window['days']):.3f} · {top['label']} {top['weekday']} -> {path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
