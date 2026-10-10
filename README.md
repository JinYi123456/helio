# helio · proof of grass

**An open-weight AI that sends you outside — then refuses to believe you went.**

![ci](https://github.com/JinYi123456/helio/actions/workflows/ci.yml/badge.svg)
[![license: MIT](https://img.shields.io/badge/license-MIT-a3e635.svg)](LICENSE)

Helio is an offline-first PWA that gets you to touch grass. A local **Gemma** verifies a photo
of what you actually saw, **TabPFN** scores the next seven days to tell you *which hours are
worth going outside*, and the whole thing runs on your own machine — backcountry, airplane
mode, zero signal. No account. No upload. Nothing to sign up for.

Built for the **DEV × Hacktoberfest Open Source AI Challenge** — Week 1: *Touch Grass*.

---

## The loop

| | screen | what happens |
|---|---|---|
| 01 | **dial** | TabPFN reads a decade of your city's weather and draws the best outdoor hours today |
| 02 | **door** | the mission compiler (Mastra + Gemma) writes you a tiny whispered assignment |
| 03 | **pocket** | put the phone away — the screen is done now |
| 04 | **proof** | photograph what you found; an on-device vision model passes or fails it |
| 05 | **journal** | a 5-7-5 haiku is written for the walk, a species joins your meadow |

Every verified walk blooms a meadow and grows a 12-species field dex. Duolingo for touching
grass — except the owl is a small green sprout and the streak burns nobody.

## Architecture

```
┌───────────── apps/web — Vite + React PWA (installable, offline) ──────────────┐
│  boot → dial → door → pocket → proof → journal → meadow                       │
│  IndexedDB: missions · walks · photos  ·  service worker warms an offline pack │
└──────────────────────────────┬────────────────────────────────────────────────┘
                               │  /api/*  (same origin in prod)
┌──────────────────────────────▼──────── services/agent — Hono + Mastra ────────┐
│  mission compiler agent ─ tools: grass window · local ground · field memory   │
│  vision verifier: Gemma via Ollama (or any OpenAI-compatible endpoint)        │
│  haiku journal · ElevenLabs whisper (→ browser voice) · MongoDB memory (→ RAM)│
└──────────────────────────────┬────────────────────────────────────────────────┘
                               │  TABPFN_URL
┌──────────────────────────────▼──────── services/tabpfn — FastAPI ─────────────┐
│  TabPFN in-context over 10 years of open-meteo history → grass window scores  │
│  chain: live forecast → precomputed JSON (daily GH Action bake) → heuristic   │
└──────────────────────────────────────────────────────────────────────────────┘
```

Every dependency is optional by design — pull the plug on any one of them and Helio keeps
working, honestly labelled:

- **tabpfn service down** → the dial shows climatology windows instead of model scores
- **TabPFN weights not accepted** → precomputed windows baked by CI are served
- **LLM down** → a hand-written seed mission walks in (and says so)
- **TTS down** → the browser reads the whisper
- **MongoDB absent** → field memory lives in RAM
- **no camera** → keep the proof and upload a photo instead

## Partner tech — used hard, never required

| partner | how helio uses it | if absent |
|---|---|---|
| **TabPFN** (Prior Labs) | tiny tabular foundation model, in-context over 10y weather · predawn on CPU in ~1s | precomputed/heuristic windows |
| **Ollama + Gemma** | mission compiler + vision verifier, fully on-device | any OpenAI-compatible endpoint, or seed missions |
| **Google AI Studio** | free hosted Gemma for the hosted demo build | — |
| **Mastra** | mission compiler agent — tools, steps, structured draft schema | — |
| **ElevenLabs** | whisper text-to-speech, cached to disk | browser speech synthesis |
| **SerpApi** | "what's in season right now" ground notes | skipped, whisper stays local |
| **MongoDB Atlas** | field memory with `$vectorSearch` over walk notes | in-memory ring buffer |
| **Sentry** | AI agent tracing — runtime instrumentation turns every mission compile into a `gen_ai.invoke_agent → gen_ai.chat` trace with token usage | no telemetry |
| **open-meteo** | 10y history + live forecast (free, no key) | bundled CSVs |

## Quickstart (5 minutes, zero cost)

```bash
npm ci
ollama pull gemma4:e2b          # or any tool-calling model — see .env.example
npm run dev                     # agent on :8787, PWA on :5183
```

The grass window service is optional for dev — Helio falls back to climatology. To run the
real thing:

```bash
cd services/tabpfn
uv sync && uv run uvicorn app.main:app --port 8790
# the first TabPFN run asks a one-time license acceptance at https://ux.priorlabs.ai
# then set TABPFN_TOKEN in .env and the daily bake keeps windows fresh
```

Or run everything with one command once `.env` exists: `npm run dev`.

## Tests

```bash
npm test                              # agent: 20 vitest specs (tools, verdicts, windows, seeds)
npm run test:py                       # tabpfn: 10 passed, 3 model tests skip without TABPFN_TOKEN
npm run build:all                     # tsc + vite build, both services
```

## Deploy

[`render.yaml`](render.yaml) is a two-service free-tier blueprint: the agent (Node, serves the
built PWA) and the grass window service (Python, no torch — it serves windows baked by the
daily [`bake-windows`](.github/workflows/bake-windows.yml) Action, which commits fresh JSON
and triggers a redeploy). Push to GitHub → New Blueprint on Render → paste your free
`GOOGLE_API_KEY`. The AI is open-weight and the hosting is free; the only bill is walking.

## Repo map

```
apps/web            PWA — dial · door · pocket · proof · journal · meadow
services/agent      Hono API + Mastra mission compiler + vision verifier
services/tabpfn     FastAPI + TabPFN grass-window model + precompute baker
data/weather        10y open-meteo history per city (CSV)
data/precomputed    baked windows, refreshed daily by CI
docs/               building log · demo script
```

## License

MIT. The weights belong to everyone.
