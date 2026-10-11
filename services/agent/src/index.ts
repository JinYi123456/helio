import './instrument.js';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { config, engineLabel, llmEndpoint } from './config.js';
import { writeHaiku } from './lib/journal.js';
import { memoryKind, recentWalks, rememberWalk, similarWalks } from './lib/memory.js';
import { compileMission } from './lib/mission-agent.js';
import { ollamaReachable } from './lib/ollama.js';
import { seedMission } from './lib/seeds.js';
import { localGround } from './lib/serpapi.js';
import { captureException, sentryEnabled, withSpan } from './lib/sentry.js';
import { audioFile, ensureAudio } from './lib/tts.js';
import { fetchWindow, type DayWindow } from './lib/window.js';
import { hostedVisionAttempt, verifyPhoto, visionCandidates } from './lib/vision.js';

const CITY_LABELS: Record<string, string> = {
  'petaling-jaya': 'Petaling Jaya, MY',
  seattle: 'Seattle, US',
  zurich: 'Zürich, CH',
};

const app = new Hono();

app.use('*', async (c, next) => {
  const t0 = performance.now();
  await next();
  c.header('x-helio-ms', String(Math.round(performance.now() - t0)));
});

app.onError((err, c) => {
  captureException(err, { path: c.req.path });
  return c.json({ error: 'helio is clouded over', detail: String(err) }, 500);
});

/* ── health ─────────────────────────────────────────────────────────── */

app.get('/api/health', async (c) => {
  const [ollama, tabpfnOk, storage] = await Promise.all([
    ollamaReachable(),
    fetch(`${config.tabpfnUrl}/health`, { signal: AbortSignal.timeout(2500) })
      .then((r) => r.ok)
      .catch(() => false),
    memoryKind(),
  ]);
  return c.json({
    ok: true,
    provider: config.provider,
    model: config.model,
    visionModel: config.visionModel,
    storage: storage === 'mongodb' ? 'mongodb-atlas' : 'memory',
    tabpfn: tabpfnOk,
    tabpfnUrl: config.tabpfnUrl,
    tts: Boolean(config.elevenLabsKey),
    serpapi: Boolean(config.serpApiKey),
    sentry: sentryEnabled(),
    engine: `${engineLabel()}${ollama ? '' : ' · model server offline'}`,
    time: new Date().toISOString(),
  });
});

/* ── the grass window ───────────────────────────────────────────────── */

app.get('/api/window', async (c) => {
  const city = c.req.query('city') || 'petaling-jaya';
  const w = await fetchWindow(city, 7);
  if (!w) return c.json({ error: 'grass window service is asleep' }, 503);
  return c.json(w);
});

/* ── mission compiler ───────────────────────────────────────────────── */

type MissionBody = {
  cityKey?: string;
  envs?: string[];
  dateKey?: string;
  history?: string[];
  regenerate?: boolean;
  name?: string;
};

app.post('/api/mission', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as MissionBody;
  const cityKey = body.cityKey && CITY_LABELS[body.cityKey] ? body.cityKey : 'petaling-jaya';
  const cityLabel = CITY_LABELS[cityKey];
  const envs = body.envs?.length ? body.envs : ['street', 'park', 'garden'];
  const dateKey = body.dateKey || new Date().toISOString().slice(0, 10);

  const p = llmEndpoint();
  const mission = await withSpan(
    'mission.compile',
    'agent',
    async () => {
      const [win, ground, memory] = await Promise.all([
        fetchWindow(cityKey, 7),
        localGround(cityLabel, Number(dateKey.slice(5, 7)), envs),
        recentWalks(cityKey, 6),
      ]);

      const week: DayWindow[] = win?.days ?? [];
      const today = week.find((d) => d.date === dateKey) ?? week[0] ?? null;

      const report = {
        cityKey,
        cityLabel,
        dateKey,
        name: body.name,
        envs,
        history: body.history ?? [],
        window: today,
        week,
        ground: ground.length ? ground : memory.slice(0, 2).map((m) => `${m.missionTitle} — ${m.seen ?? 'logged'}`),
        memory: memory.map((m) => ({ dateKey: m.dateKey, missionTitle: m.missionTitle, seen: m.seen })),
      };

      const draft = await compileMission(report, Boolean(body.regenerate));
      const chosen =
        draft ??
        seedMission({ dateKey, cityKey, envs, variant: body.regenerate ? 1 : 0, window: today });

      const usedModel = Boolean(draft);
      const audioUrl = await ensureAudio(chosen.whisper);

      return {
        id: crypto.randomUUID(),
        dateKey,
        createdAt: Date.now(),
        title: chosen.title,
        whisper: chosen.whisper,
        proofCriteria: chosen.proofCriteria,
        proofHint: chosen.proofHint,
        durationMin: chosen.durationMin,
        tags: chosen.tags,
        whyNow: chosen.whyNow,
        window: today,
        engine: usedModel ? engineLabel() : 'hand-written seed · open data (offline-safe)',
        groundNotes: ground,
        audioUrl,
      };
    },
    { 'gen_ai.system': p.name, 'gen_ai.request.model': p.model, 'helio.city': cityLabel }
  );

  return c.json(mission);
});

/* ── proof of grass (vision verdict) ────────────────────────────────── */

app.post('/api/verify', async (c) => {
  const body = (await c.req.json().catch(() => null)) as
    | { mission?: { title?: string; proofCriteria?: string; tags?: string[] }; image?: string }
    | null;
  if (!body?.mission?.title || !body.image) return c.json({ error: 'need mission + image' }, 400);

  // verifyPhoto carries its own gen_ai span (shared with /api/sync).
  const verdict = await verifyPhoto(body.image!, {
    title: body.mission!.title!,
    proofCriteria: body.mission!.proofCriteria || body.mission!.title!,
    tags: body.mission!.tags ?? [],
  });
  if (!verdict) return c.json({ error: 'no vision model reachable — keep your proof, we will check later' }, 503);
  return c.json(verdict);
});

/* ── hosted vision probe (?go=1) — reports why each candidate model said no ── */

const dotPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

app.get('/api/_diag/vision', async (c) => {
  if (c.req.query('go') !== '1') return c.json({ hint: 'append ?go=1' });
  const p = llmEndpoint();
  const candidates = await visionCandidates(p.baseURL, p.apiKey, p.model);
  const attempts: unknown[] = [];
  for (const model of candidates.slice(0, 8)) {
    const res = await hostedVisionAttempt(p.baseURL, p.apiKey, model, dotPng, 'Reply with the single word ok', 30_000);
    if (!res) attempts.push({ model, error: 'unreachable' });
    else attempts.push({ model, status: res.status, body: (await res.text()).slice(0, 240) });
  }
  return c.json({ provider: p.name, model: p.model, candidates, attempts });
});

/* ── journal + memory ───────────────────────────────────────────────── */

type JournalBody = {
  missionTitle?: string;
  tags?: string[];
  seen?: string;
  cityKey?: string;
  dateKey?: string;
  id?: string;
  verdictPassed?: boolean;
};

app.post('/api/journal', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as JournalBody;
  const title = body.missionTitle || 'a walk';
  const { haiku, engine } = await writeHaiku({
    missionTitle: title,
    tags: body.tags ?? [],
    seen: body.seen ?? 'something quietly alive',
    dateKey: body.dateKey || new Date().toISOString().slice(0, 10),
  });
  if (body.id) {
    await rememberWalk({
      id: body.id,
      ts: Date.now(),
      dateKey: body.dateKey || new Date().toISOString().slice(0, 10),
      cityKey: body.cityKey || 'petaling-jaya',
      missionTitle: title,
      tags: body.tags ?? [],
      seen: body.seen,
      haiku,
      verdictPassed: body.verdictPassed,
    }).catch(() => {});
  }
  return c.json({ haiku, engine });
});

/* ── offline sync: proofs captured without signal ───────────────────── */

type SyncWalk = {
  id: string;
  ts?: number;
  dateKey?: string;
  cityKey?: string;
  missionId?: string;
  missionTitle?: string;
  tags?: string[];
  photo?: string;
  seen?: string;
  haiku?: string | null;
  verdict?: { passed?: boolean } | null;
  weather?: { tMax?: number; tMin?: number; precip?: number } | null;
};

app.post('/api/sync', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { walks?: SyncWalk[] };
  const walks = (body.walks ?? []).slice(0, 3);
  const results: { id: string; haiku?: string; verdict?: unknown; error?: string }[] = [];

  for (const w of walks) {
    try {
      let verdict = w.verdict as { passed?: boolean; seen?: string } | null | undefined;
      if (!verdict?.passed && w.photo) {
        const v = await verifyPhoto(w.photo, {
          title: w.missionTitle || 'a walk',
          proofCriteria: w.missionTitle || 'something alive outdoors',
          tags: w.tags ?? [],
        });
        if (v) verdict = v;
      }
      const { haiku } = await writeHaiku({
        missionTitle: w.missionTitle || 'a walk',
        tags: w.tags ?? [],
        seen: (verdict as { seen?: string } | null)?.seen ?? w.seen ?? 'something alive outdoors',
        dateKey: w.dateKey || new Date().toISOString().slice(0, 10),
      });
      await rememberWalk({
        id: w.id,
        ts: w.ts ?? Date.now(),
        dateKey: w.dateKey || new Date().toISOString().slice(0, 10),
        cityKey: w.cityKey || 'petaling-jaya',
        missionTitle: w.missionTitle || 'a walk',
        tags: w.tags ?? [],
        seen: (verdict as { seen?: string } | null)?.seen,
        haiku,
        verdictPassed: (verdict as { passed?: boolean } | null)?.passed,
      }).catch(() => {});
      results.push({ id: w.id, haiku, verdict });
    } catch (err) {
      results.push({ id: w.id, error: String(err) });
    }
  }
  return c.json({ results });
});

/* ── memory peek (used by the mission agent and the article demo) ───── */

app.get('/api/memory', async (c) => {
  const city = c.req.query('city') || 'petaling-jaya';
  const q = c.req.query('q');
  const walks = q ? await similarWalks(city, q, 5) : await recentWalks(city, 8);
  return c.json({ kind: await memoryKind(), walks: walks.map(({ embedding, ...w }) => w) });
});

/* ── voice (ElevenLabs, cached) ─────────────────────────────────────── */

app.post('/api/tts', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { text?: string };
  if (!body.text) return c.body(null, 204);
  const path = await ensureAudio(body.text);
  if (!path) return c.body(null, 204);
  const bytes = await audioFile(path.replace('/audio/', ''));
  if (!bytes) return c.body(null, 204);
  return c.body(new Uint8Array(bytes), 200, { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=604800' });
});

app.get('/audio/:file', async (c) => {
  const bytes = await audioFile(c.req.param('file'));
  if (!bytes) return c.notFound();
  return c.body(new Uint8Array(bytes), 200, { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=604800' });
});

/* ── the built web app (prod) ───────────────────────────────────────── */

const webDist = resolve(dirname(fileURLToPath(import.meta.url)), '../../../apps/web/dist');
if (config.serveWeb && existsSync(webDist)) {
  app.use('*', serveStatic({ root: webDist }));
  app.get('*', async (c, next) => {
    if (c.req.path.startsWith('/api/') || c.req.path.startsWith('/audio/')) return next();
    const html = await readFile(resolve(webDist, 'index.html'), 'utf8');
    return c.html(html);
  });
}

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`helio agent listening on :${info.port} — ${engineLabel()}`);
});
