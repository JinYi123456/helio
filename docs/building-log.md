# building log — helio, week 1 ("touch grass")

Condensed, honest notes from the build. Kept in the repo because the challenge asks what
the agent session looked like — this is it, in order.

## 01 · research before code

- Read the challenge brief: open-weight models / open-source AI at the core, push people
  outdoors, ship in public. Week 1 theme is literally "Touch Grass".
- Surveyed the partner stack for a concept that uses *many* partners without becoming a
  demo of glue: TabPFN (tabular, in-context — perfect for weather+habit scoring), Mastra
  (agent with tools), Ollama/Gemma (on-device, no key), ElevenLabs, SerpApi, MongoDB,
  Sentry. Every one maps to a real feature, none is load-bearing.
- Concept locked: **proof of grass**. The hard problem with outdoors apps is not the map,
  it's the friction of leaving. So the AI does two jobs no other app does:
  1. *when* — TabPFN says which hours are worth going out (a decade of weather, learned
     in-context, on CPU);
  2. *proof* — a local vision model verifies a photo of what you actually saw, on-device.
- Design rule from the first commit: **every partner is a leaf node**. Sever any edge of
  the graph and the product still works, with honest labels.

## 02 · skeleton + data

- npm workspaces: `apps/web` (Vite 8 + React 19 + TS, PWA), `services/agent` (Hono +
  Mastra), `services/tabpfn` (FastAPI, uv). Ports: 5183 / 8787 / 8790.
- 10y of open-meteo daily history per demo city (Petaling Jaya, Seattle, Zürich) → CSV.
  Free API, no key, reproducible.
- Lesson: the local dev port 5173 was owned by another project of mine — moved helio to
  5183 with `--strictPort` rather than fight it.

## 03 · tabpfn service

- `GrassWindowModel` fits in-context over ~730 rows of recent weather, labels a soft
  "good grass day" heuristic, predicts per-day grass-worthiness. CPU, ~1s, no finetuning.
- Failure chain built in from day one: live forecast → precomputed JSON → heuristic
  scores. `served` field always says which layer answered. Test suite covers all three.
- **Dead end #1**: TabPFN weights require a one-time license acceptance. Headless servers
  must never block on an interactive login — the fix became a feature: `TABPFN_NO_BROWSER=1`
  plus a 600s failure cooldown, and the service degrades to precomputed/heuristic.
- **Dead end #2**: personal walk labels post-dated the weather archive, so they matched
  nothing. Fix: synthesize feature rows from the walk-time weather (tmax/tmin/precip +
  climatology for the rest).

## 04 · agent service

- Mastra mission compiler: one agent, three tools (grass window, local ground, field
  memory), structured `MissionDraft` output with a zod schema, one repair pass, then a
  hand-written seed fallback pool. Missions are poetic but *checkable*: every mission
  carries photo proof criteria.
- Vision verifier: Gemma via Ollama with `think:false` (the e2b model is a thinking model
  — without suppression it spends its budget thinking and never answers; verified: a clean
  3-token reply with `reasoning_effort:"none"` on the OpenAI-compat endpoint).
- **Dead end #3**: `MastraModelConfig` isn't exported; the working path is
  `createOpenAICompatible(...).chatModel(id)` cast to `MastraLanguageModel`.
- Everything optional: ElevenLabs whisper (hashed disk cache → 204 → browser voice),
  SerpApi ground notes (12h cache), MongoDB memory (`$vectorSearch` when configured, RAM
  otherwise), Sentry spans around the compile path.

## 05 · web PWA

- Screens: boot → dial → door → pocket → proof → journal → meadow + settings + manifesto.
- The dial is a real sun-compass: sunrise/sunset computed locally, the walkable window
  lights up gold. The pocket screen exists to be *left* — it tells you the screen is done.
- Meadow + 12-species dex + haiku journal. Canvas export for a walk page.
- **Dead end #4**: React StrictMode double-mounts effects in dev → two parallel mission
  generations (~70s each on CPU) racing to win state. Fixed with an in-flight guard;
  prod was never affected.

## 06 · proof of grass (end to end)

Ran the whole loop in a real browser against the real stack — real Mastra mission, real
Gemma vision verdict (95% sure, 46s), real haiku, real stamp. A desk photo was correctly
rejected. Then the same day: CI, the daily window bake, and a two-service Render blueprint
so the demo link never dies.

Total partner surface: TabPFN · Ollama/Gemma · Mastra · Google AI Studio (hosted demo) ·
ElevenLabs · SerpApi · MongoDB · Sentry. Core promise: photos never leave the device.
