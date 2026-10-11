"""Mine Helio's hand-written seed whispers and grow them into a training set.

The whisper is Helio's voice: quiet, concrete, a little wry. We keep the 24
hand-written field whispers as gold rows and ask the local Gemma to write new
ones across a matrix of contexts (city, weekday, hour, weather, archetype).
Everything runs against local Ollama — no paid calls in dataset building.
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

OLLAMA = "http://127.0.0.1:11434"
MODEL = "gemma4:e2b"
HERE = Path(__file__).parent
OUT = HERE / "whisper_pairs.jsonl"

# stdout gets redirected in background runs where the locale encoding (cp1252)
# chokes on non-ASCII — that once killed the main loop after the first flush.
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except Exception:  # noqa: BLE001
        pass

CITIES = [
    ("Petaling Jaya, MY", {"weekday": ["Sat", "Sun", "Mon", "Tue"], "tMax": [30, 31, 32, 33], "precip": [0, 4, 12, 30]}),
    ("Seattle, US", {"weekday": ["Wed", "Thu", "Fri", "Sat"], "tMax": [14, 17, 19, 22], "precip": [0, 0, 3, 9]}),
    ("Zürich, CH", {"weekday": ["Mon", "Tue", "Wed", "Sun"], "tMax": [18, 21, 24, 27], "precip": [0, 2, 7]}),
]
HOURS = [6, 7, 8, 9, 11, 16, 17, 18]

# Archetypes mirror services/agent/src/lib/seeds.ts — envs, tags, and the two
# hand-written whispers that anchor the voice.
ARCHETYPES = [
    {
        "envs": ["street", "park"], "tags": ["sprout", "grass", "weed", "crack"],
        "gold_title": "The Cracked Code",
        "gold_whispers": [
            "Somewhere within two streets of you, a plant is losing a fight for its life — and winning.",
            "Pavement was not asked for permission. Find the sprout that ignored it.",
        ],
    },
    {
        "envs": ["park", "garden", "trail"], "tags": ["leaf", "foliage"],
        "gold_title": "One Honest Leaf",
        "gold_whispers": [
            "Leaves keep records. Bring back one that is mid-sentence.",
            "Find a single leaf that has started to lie about the season.",
        ],
    },
    {
        "envs": ["garden", "balcony", "park"], "tags": ["flower", "bloom", "petal"],
        "gold_title": "Who Planted This?",
        "gold_whispers": [
            "Find a flower nobody planted and nobody watered. It wants nothing from you.",
            "A volunteer bloom is somewhere near. Photograph it before it changes its mind.",
        ],
    },
    {
        "envs": ["trail", "park"], "tags": ["bark", "tree", "trunk"],
        "gold_title": "Bark Study",
        "gold_whispers": [
            "Find the oldest standing thing within walking distance. Touch its side, then photograph it honestly.",
            "Bark is a diary written in ridges. Find the tree that wrote today.",
        ],
    },
    {
        "envs": ["waterside", "street", "park"], "tags": ["water", "puddle", "reflection"],
        "gold_title": "Still Water",
        "gold_whispers": [
            "Yesterday is still here. Find water sitting in one place and photograph its ceiling.",
            "Find the smallest body of water you can be tall next to.",
        ],
    },
    {
        "envs": ["balcony", "street", "park", "garden", "trail"], "tags": ["sky", "cloud", "sunlight"],
        "gold_title": "Sky First",
        "gold_whispers": [
            "You have underrated the ceiling you never look at. Sixty seconds, face up, then one photograph.",
            "The sky is free and today it has a mood about it.",
        ],
    },
    {
        "envs": ["park", "trail", "waterside"], "tags": ["bird", "feather"],
        "gold_title": "Feather Hunt",
        "gold_whispers": [
            "Birds drop evidence everywhere. Bring me a feather, or at least its story.",
            "Something feathered, or someone feathered, is nearby. Find the trace.",
        ],
    },
    {
        "envs": ["park", "garden", "trail"], "tags": ["bee", "butterfly", "pollinator"],
        "gold_title": "Small Witness",
        "gold_whispers": [
            "Someone nearby is working a double shift for no wage. Find them, thank them, photograph them.",
            "A bee or butterfly or beetle has time for you. Go.",
        ],
    },
    {
        "envs": ["street", "trail", "park", "waterside"], "tags": ["stone", "rock", "pebble"],
        "gold_title": "Stone Library",
        "gold_whispers": [
            "Pick up one stone. Read it like a stranger's resume. Put it back when you're done.",
            "Stones are just rocks that finished the course. Find a graduate.",
        ],
    },
    {
        "envs": ["trail", "garden", "park"], "tags": ["moss", "lichen"],
        "gold_title": "Moss Minute",
        "gold_whispers": [
            "Moss only lives where the light is a suggestion. Find a patch and photograph it at its scale.",
            "There is a small green carpet somewhere in this city. Bring photo proof of its softness.",
        ],
    },
    {
        "envs": ["park", "garden", "trail", "street"], "tags": ["seed", "acorn", "pod"],
        "gold_title": "Seed Courier",
        "gold_whispers": [
            "Trees are shipping the future by wind and squirrel. Intercept one package.",
            "Find a seed, pod, acorn, or berry. Don't keep it — just photograph it.",
        ],
    },
    {
        "envs": ["street", "park", "trail"], "tags": ["trace", "trail", "footprint"],
        "gold_title": "Trace Reader",
        "gold_whispers": [
            "Somebody passed here before you and left a mark. Find the trail, the prints, the gate that knows.",
            "Read one trace of somebody's journey — human, bird, or cat.",
        ],
    },
]

TITLES = {
    "sprout": ["Pavement Rebels", "Between the Stones", "The Sidewalk Defector"],
    "leaf": ["The Two-Colour Leaf", "Leaf Ledger", "Margin Notes"],
    "flower": ["The Volunteer", "Nobody Watered This", "Loud Petals"],
    "bark": ["Read the Trunk", "The Oldest Standing Thing", "Ridge Diary"],
    "water": ["The Puddle Oracle", "Small Weather", "The Ceiling of the Puddle"],
    "sky": ["Look Up Tax", "The Ceiling Problem", "Free Ceiling"],
    "bird": ["The Wind Left This", "Small Relic", "Evidence, Feathered"],
    "bee": ["The Worker", "Six Legs, No Phone", "Unpaid Shift"],
    "stone": ["Read a Rock", "The Patient Kind", "Graduate Rocks"],
    "moss": ["The Quiet Room", "Softer Than It Looks", "Green Suggestion"],
    "seed": ["The Package", "Nature's Parcel", "Future in Transit"],
    "trace": ["Left Behind", "The Trail's Shortest Chapter", "Wear and Tear"],
}

SYSTEM = (
    "You write ONE whisper for Helio, an outdoors app. Voice: quiet, concrete, a little wry. "
    "Second person, present. 1-2 sentences, under 30 words. No emojis, no quotes, no greetings. "
    "The whisper sends a specific person outside to find ONE specific thing nearby. "
    "Study the examples; write in the same voice, never repeat them."
)

BANNED = re.compile(r"embrace|journey|tapestry|unleash|delve|vibrant|testament|whisper of|soul|magic", re.I)


def chat(prompt: str, temperature: float) -> str | None:
    body = json.dumps({
        "model": MODEL,
        "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}],
        "stream": False,
        "think": False,
        "keep_alive": "30m",
        "options": {"temperature": temperature, "num_predict": 90},
    }).encode()
    req = urllib.request.Request(
        f"{OLLAMA}/api/chat", data=body, headers={"content-type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            data = json.loads(res.read())
        text = (data.get("message") or {}).get("content", "")
        return text.strip() or None
    except Exception as err:  # noqa: BLE001
        print("  ! ollama:", err, file=sys.stderr)
        return None


def clean(text: str) -> str | None:
    t = text.strip().strip('"').strip("'").strip()
    t = re.sub(r"^(whisper|Whisper|WHISPER)\s*[:\-—]\s*", "", t)
    t = t.replace("\n", " ").strip()
    if not t or len(t) < 20 or len(t) > 240:
        return None
    if BANNED.search(t):
        return None
    if t.count(".") + t.count("!") + t.count("?") > 4:
        return None
    if not t.endswith((".", "!", "?", "—")):
        t += "."
    return t


def ctx_for(city: str, profile: dict, i: int, arch: dict, title: str) -> dict:
    return {
        "city": city,
        "weekday": profile["weekday"][i % len(profile["weekday"])],
        "hour": HOURS[i % len(HOURS)],
        "envs": arch["envs"],
        "tMax": profile["tMax"][i % len(profile["tMax"])],
        "precip": profile["precip"][i % len(profile["precip"])],
        "tags": arch["tags"],
        "title": title,
    }


def user_prompt(ctx: dict, examples: list[str]) -> str:
    ex = "\n".join(f"- {w}" for w in examples)
    return (
        "Examples of the voice (never copy them):\n" + ex + "\n\n"
        "Context:\n" + json.dumps(ctx, ensure_ascii=False) + "\n\n"
        "Write the whisper now. Output only the whisper sentence(s)."
    )


def load_prior() -> list[dict]:
    if not OUT.exists():
        return []
    rows: list[dict] = []
    for line in OUT.read_text(encoding="utf8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            r = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(r, dict) and r.get("whisper"):
            rows.append(r)
    return rows


def main() -> None:
    rows: list[dict] = []
    # Gold rows — the hand-written seeds against a few contexts each, so the
    # model never drifts from canon without drowning the generated variety.
    for ai, arch in enumerate(ARCHETYPES):
        tags = arch["tags"]
        city, profile = CITIES[ai % len(CITIES)]
        for i in range(3):
            title = TITLES[tags[0]][i % 3]
            ctx = ctx_for(city, profile, i, arch, title)
            for w in arch["gold_whispers"]:
                rows.append({"context": ctx, "whisper": w, "source": "seed"})

    seen = {r["whisper"] for r in rows}
    kept = 0
    for r in load_prior():
        if r["whisper"] not in seen:
            seen.add(r["whisper"])
            rows.append(r)
            kept += 1
    done_ctx = {json.dumps(r["context"], sort_keys=True) for r in rows if r["source"] == "generated"}

    jobs: list[tuple[dict, list[str], float]] = []
    for arch in ARCHETYPES:
        tags = arch["tags"]
        for city, profile in CITIES:
            for i in range(5):  # 5 contexts per city per archetype
                title = TITLES[tags[0]][i % 3]
                ctx = ctx_for(city, profile, i, arch, title)
                temp = 0.85 + 0.1 * (i % 2)
                jobs.append((ctx, arch["gold_whispers"], temp))
    pending = [j for j in jobs if json.dumps(j[0], sort_keys=True) not in done_ctx]

    print(
        f"gold {len(rows) - kept} + resumed {kept} | jobs {len(jobs)} -> pending {len(pending)}",
        flush=True,
    )

    def flush() -> None:
        OUT.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n", encoding="utf8")

    def work(job: tuple[dict, list[str], float]) -> dict | None:
        ctx, examples, temp = job
        raw = chat(user_prompt(ctx, examples), temp)
        if not raw:
            return None
        whisper = clean(raw)
        if not whisper or whisper in seen:
            return None
        return {"context": ctx, "whisper": whisper, "source": "generated"}

    done = 0
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(work, j) for j in pending]
        for fut in as_completed(futures):
            done += 1
            try:
                row = fut.result()
            except Exception as err:  # noqa: BLE001 — a poisoned job must not kill the run
                print(f"  ! job failed: {err!r}", file=sys.stderr, flush=True)
                row = None
            if row and row["whisper"] not in seen:
                seen.add(row["whisper"])
                rows.append(row)
            flush()
            if done % 5 == 0 or done == len(pending):
                print(f"  {done}/{len(pending)} -> {len(rows)} rows", flush=True)

    flush()
    print(f"wrote {len(rows)} rows -> {OUT}", flush=True)


if __name__ == "__main__":
    main()
