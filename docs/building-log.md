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
  otherwise), Sentry agent tracing (see 07).

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

## 07 · sentry agent tracing (the one that looked free)

- One line — `mastraIntegration()` — should give full `gen_ai` traces. It gave zero. Two
  hidden requirements, both found by probing with a dummy DSN and a capture transport
  (`scripts/sentry-probe.ts`; nothing leaves the machine).
- **Dead end #5**: Node reads an ESM module graph *before* any module body runs, so
  `init()` called from app code registers Sentry's runtime-instrumentation hooks after
  `@mastra/core` has already loaded — and already-loaded modules are never instrumented.
  Fix: `node --import ./scripts/sentry-preload.mjs`, a 4-line preload gated on
  `SENTRY_DSN`, so without a DSN Sentry never enters the process at all.
- **Dead end #6**: a standalone Mastra `Agent` emits nothing to an exporter on its own.
  The span exporter attaches when a `Mastra` instance is constructed (with
  `@mastra/observability` bootstrapping the pipeline). So the same agent now also lives
  in `new Mastra({ agents })`, built only when tracing is configured.
- Result, verified against exactly what Render runs (`node dist/index.js`, Node 24):
  every mission compile is one trace —
  `http.server → mission.compile → gen_ai.invoke_agent → gen_ai.chat → http.client` —
  with model name, input messages and token usage riding along as `gen_ai.*` attributes.
- The knob that made this debuggable stays in: `HELIO_SENTRY_DEBUG=1` prints span
  lifecycles to the server log.

## 08 · temporal — a mission is a promise with a deadline

- "Walk when the window opens, prove it before it closes" is exactly the shape Temporal
  exists for, so every compiled mission starts a `missionLifecycle` workflow: sleep until
  the TabPFN-picked golden hour, a 6-hour expiry, one `markDone` signal the verifier fires.
  The workflow races `sleep()` against `condition(done)` and returns `"verified"` or
  `"missed"` honestly.
- Verified for real: a mission that signalled during its sleep completed as
  `Result: "verified"` (2m33s wall time, timer cancelled); a probe workflow woke at its
  golden hour, POSTed a `ripe` event back into the agent, then closed as `"missed"` — all
  visible in the Temporal UI.
- Leaf node: with no `TEMPORAL_ADDRESS`, the mission still compiles and the API says
  `lifecycle: { scheduled: false }`.

## 09 · tiger data — the time-series shadow of the meadow

- Walks land in a `footprints` hypertable (TimescaleDB, via `pg`) and
  `GET /api/footprints` serves the server-side 7-day series. Verified locally end-to-end.
- Env-gated: no `TIGER_URL` → the endpoint answers `{enabled:false}` and the meadow never
  notices. Wired end-to-end, one key away.

## 10 · tinker — the whisper as a trainable artifact

- `services/tinker/` distills the hand-written field corpus into context→whisper pairs and
  LoRA-fine-tunes a small open-weight model via Tinker's SDK; the agent samples whispers
  through Tinker's OpenAI-compatible endpoint.
- Fully wired and env-gated, with the honest status in the article: the training run is
  waiting on the account's billing/credit activation, so today the compiler's own whisper
  answers — and says so.

## 11 · the UI audit day — three bugs a screenshot would have shipped

- Swept every screen in three walker contexts (pass path, keyboard-fail path, offline
  path) plus desktop 1280 and narrow 320: programmatic checks for horizontal overflow,
  spills past the viewport, sibling overlaps in key rows, out-of-box children and SVG
  viewBox clipping — 40+ screenshots, a machine-readable report, zero findings left.
- **Dead end #7**: the screen-entrance animation used fill-mode `both`, and a *finished*
  transform animation still counts as a containing block for `position:fixed` descendants
  (computed `matrix(1,0,0,1,0,0)` ≠ `none`). The bottom nav and the journal sheet anchored
  to the bottom of the *page* instead of the viewport — invisible on any screen taller
  than the fold. Diagnosed by walking the ancestor chain's computed styles in a live
  probe; fix is fill-mode `backwards`.
- **Dead end #8**: the dial sprout's CSS sway animation override the SVG positioning
  `transform` attribute outright — the sprout rendered ~189 viewBox units outside the
  frame, invisibly. Fix: positioning moved to an outer `<g>`, the animation lives on an
  inner `<g>` with `transform-box: fill-box` so it pivots in place.
- Also caught by the same sweep: hour labels clipped at the viewBox edge (padded the
  viewBox), and the seed card's raw `0/100` TabPFN score — honest on a rainy week, but it
  reads as broken — replaced with the hour window (`Sun · 06:00–08:00`).
- New in the same pass: one-tap **use my location** in settings — browser permission →
  nearest baked city, with an honest distance note when you're far from all three.
  Tested on all three paths: near, far, and denied.
