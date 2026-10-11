import { config, llmEndpoint } from '../config.js';
import { ollamaChat, ollamaReachable } from './ollama.js';
import { withSpan } from './sentry.js';
import { clamp, fetchWithTimeout, looseJson } from './util.js';

export type Verdict = {
  passed: boolean;
  confidence: number;
  seen: string;
  note: string;
  engine: string;
  ms?: number;
  loose?: boolean;
};

type RawVerdict = { passed?: boolean; confidence?: number; seen?: string; note?: string };

const STRICT_JSON =
  'Answer with ONLY minified JSON, no prose, no code fences: {"passed": true|false, "confidence": 0.0..1.0, "seen": "under 14 words describing what is actually visible", "note": "one warm sentence to the walker, under 18 words"}';

function buildPrompt(mission: { title: string; proofCriteria: string; tags: string[] }): string {
  return [
    'You are Helio, a strict but warm field guide checking a photo from a walk.',
    `Mission: ${mission.title}`,
    `What the photo must honestly show: ${mission.proofCriteria}`,
    `Mission tags: ${mission.tags.join(', ')}`,
    'If the required subject truly appears, passed=true. If it does not, passed=false. Keep the walker encouraged either way.',
    'In "seen", name real visible things with simple nouns (grass, leaf, flower, bark, bird, bee, stone, water, sky, cloud, moss, seed, path).',
    STRICT_JSON,
  ].join('\n');
}

export function verdictFromRaw(raw: RawVerdict, engine: string, ms: number): Verdict | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const seen = (raw.seen ?? '').toString().trim();
  const note = (raw.note ?? '').toString().trim();
  if (!seen && typeof raw.passed !== 'boolean') return null;
  const passed = typeof raw.passed === 'boolean' ? raw.passed : true;
  return {
    passed,
    confidence: clamp(Number(raw.confidence ?? 0.6) || 0.6, 0, 1),
    seen: seen || 'something quietly alive',
    note: note || (passed ? 'That counts. The meadow noticed.' : 'Not quite the mark — but the grass still counts your steps.'),
    engine,
    ms,
    ...(typeof raw.passed === 'boolean' ? {} : { loose: true }),
  };
}

async function viaOllama(imageB64: string, prompt: string): Promise<Verdict | null> {
  const t0 = performance.now();
  for (const model of [config.visionModel, config.visionFallbackModel].filter((m, i, a) => a.indexOf(m) === i)) {
    const res = await ollamaChat({
      model,
      messages: [{ role: 'user', content: prompt, images: [imageB64] }],
      think: false,
      format: 'json',
      temperature: 0.2,
      numPredict: 240,
      timeoutMs: 240_000,
    });
    if (!res || !res.content.trim()) continue;
    const raw = looseJson<RawVerdict>(res.content);
    if (!raw) continue;
    return verdictFromRaw(raw, `${res.model} · ollama (on-device, open weights)`, Math.round(performance.now() - t0));
  }
  return null;
}

let _modelCatalog: { at: number; ids: string[] } | null = null;
let _visionWinner = '';

async function gemmaModelIds(baseURL: string, apiKey: string): Promise<string[]> {
  if (_modelCatalog && Date.now() - _modelCatalog.at < 10 * 60_000) return _modelCatalog.ids;
  try {
    const res = await fetchWithTimeout(
      `${baseURL.replace(/\/$/, '')}/models`,
      { headers: { ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) } },
      8_000
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: { id?: string }[] };
    const ids = (data.data ?? [])
      .map((m) => m.id ?? '')
      .filter((id) => /gemma/i.test(id));
    _modelCatalog = { at: Date.now(), ids };
    return ids;
  } catch {
    return [];
  }
}

export function visionCandidates(baseURL: string, apiKey: string, fallbackModel: string): Promise<string[]> {
  return gemmaModelIds(baseURL, apiKey).then((ids) =>
    [_visionWinner, process.env.HELIO_VISION_MODEL_COMPAT, fallbackModel, ...ids]
      .filter((m): m is string => Boolean(m))
      .filter((m, i, a) => a.indexOf(m) === i)
  );
}

/** One image call to one hosted model; the raw Response lets probes report why it failed. */
export async function hostedVisionAttempt(
  baseURL: string,
  apiKey: string,
  model: string,
  dataUrl: string,
  prompt: string,
  timeoutMs = 120_000
): Promise<Response | null> {
  try {
    return await fetchWithTimeout(
      `${baseURL.replace(/\/$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 240,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      },
      timeoutMs
    );
  } catch {
    return null;
  }
}

async function viaOpenAiCompat(dataUrl: string, prompt: string): Promise<Verdict | null> {
  const t0 = performance.now();
  const p = llmEndpoint();
  for (const model of await visionCandidates(p.baseURL, p.apiKey, p.model)) {
    const res = await hostedVisionAttempt(p.baseURL, p.apiKey, model, dataUrl, prompt);
    // Some open-weight ids are text-only — a 4xx just means "next candidate".
    if (!res || !res.ok) continue;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = looseJson<RawVerdict>(data.choices?.[0]?.message?.content ?? '');
    if (!raw) continue;
    _visionWinner = model;
    return verdictFromRaw(raw, `${model} · ${p.name} (hosted, open weights)`, Math.round(performance.now() - t0));
  }
  return null;
}

/** Judge one photo against one mission. Null when no vision model can be reached. */
export async function verifyPhoto(
  dataUrl: string,
  mission: { title: string; proofCriteria: string; tags: string[] }
): Promise<Verdict | null> {
  const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const prompt = buildPrompt(mission);

  return withSpan(
    'proof.verify',
    'gen_ai.chat',
    async () => {
      if (config.provider === 'ollama') {
        return viaOllama(b64, prompt);
      }
      const hosted = await viaOpenAiCompat(dataUrl, prompt);
      if (hosted) return hosted;
      // Hosted vision fell over — a local Ollama still gives a verdict.
      if (await ollamaReachable()) {
        return viaOllama(b64, prompt);
      }
      return null;
    },
    {
      'gen_ai.system': config.provider,
      'gen_ai.request.model': config.visionModel,
      'helio.mission': mission.title,
    }
  );
}
