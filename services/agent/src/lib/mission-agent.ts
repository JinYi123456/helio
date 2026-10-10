import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { buildMastraModel, chatText, providerReady } from './llm.js';
import { TAG_VOCAB } from './seeds.js';
import { fieldTools } from './tools.js';
import { clamp, looseJson } from './util.js';
import type { DayWindow } from './window.js';

export const MissionDraft = z.object({
  title: z.string(),
  whisper: z.string(),
  proofCriteria: z.string(),
  proofHint: z.string().default('Get close, hold steady, keep the subject big in frame.'),
  durationMin: z.number().default(12),
  tags: z.array(z.string()).default([]),
  whyNow: z.string().default(''),
});
export type MissionDraft = z.infer<typeof MissionDraft>;

const INSTRUCTIONS = `You are Helio's mission compiler. You turn weather data, local knowledge and a walker's history into ONE tiny outdoor mission that gets a person away from their screen for a few minutes.

Voice: quiet, concrete, a little wry. Second person. Never cheesy, never corporate. The screen should be the shortest part of the experience.

You have tools: grass-window (TabPFN forecast), local-ground (SerpApi search), field-memory (this walker's past missions). Use them when you need fresher data than the field report you were given.

When ready, answer with ONLY minified JSON matching exactly this shape:
{"title":"under 5 words","whisper":"1-2 sentences the walker hears in their ear","proofCriteria":"what one photo must honestly show — a subject a vision model can verify","proofHint":"one practical sentence for taking that photo","durationMin":8-25,"tags":["3-5 lowercase words"],"whyNow":"one sentence referencing the actual grass window data"}

Tags must be chosen from or close to: ${TAG_VOCAB.join(', ')}.`;

export const missionAgent = new Agent({
  id: 'helio-mission-compiler',
  name: 'helio-mission-compiler',
  instructions: INSTRUCTIONS,
  model: () => buildMastraModel(),
  tools: fieldTools,
});

export type MissionReport = {
  cityKey: string;
  cityLabel: string;
  dateKey: string;
  name?: string;
  envs: string[];
  history: string[];
  window: DayWindow | null;
  week: DayWindow[];
  ground: string[];
  memory: { dateKey: string; missionTitle: string; seen?: string }[];
};

function fieldReport(report: MissionReport): string {
  return JSON.stringify(
    {
      city: report.cityLabel,
      cityKey: report.cityKey,
      today: report.dateKey,
      walker: report.name || 'a walker',
      allowedEnvironments: report.envs,
      recentMissions: report.history.slice(0, 8),
      grassWindow: {
        today: report.window
          ? { weekday: report.window.weekday, score: report.window.score, hours: report.window.hours, tMax: report.window.tMax, precip: report.window.precip }
          : null,
        week: report.week.slice(0, 5).map((d) => ({ weekday: d.weekday, score: d.score, hours: d.hours, precip: d.precip })),
      },
      localGround: report.ground,
      fieldMemory: report.memory.slice(0, 5),
    },
    null,
    0
  );
}

function normalize(draft: MissionDraft): MissionDraft {
  const tags = draft.tags
    .map((t) => t.toLowerCase().trim())
    .filter(Boolean)
    .slice(0, 5);
  return {
    title: draft.title.trim().replace(/^["']|["']$/g, '').slice(0, 60),
    whisper: draft.whisper.trim().slice(0, 240),
    proofCriteria: draft.proofCriteria.trim().slice(0, 200),
    proofHint: draft.proofHint.trim().slice(0, 160),
    durationMin: clamp(Math.round(Number(draft.durationMin) || 12), 5, 30),
    tags: tags.length ? tags : ['grass', 'walk'],
    whyNow: draft.whyNow.trim().slice(0, 220),
  };
}

/** Ask the agent for a mission. Null when the model can't be reached or insists on prose. */
export async function compileMission(report: MissionReport, regenerate = false): Promise<MissionDraft | null> {
  if (!providerReady()) return null;
  const k = regenerate ? 'The walker pressed the seed again — make it meaningfully different from the usual.' : '';
  const prompt = [
    'FIELD REPORT:',
    fieldReport(report),
    k,
    'Compose today\'s mission now. One photo must be able to prove it. Output only the JSON.',
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const res = (await missionAgent.generate(prompt, { maxSteps: 4 })) as { text?: string };
    const raw = looseJson<unknown>(res.text ?? '');
    const parsed = raw ? MissionDraft.safeParse(raw) : null;
    if (parsed?.success) return normalize(parsed.data);

    // One repair pass — small models sometimes wrap JSON in prose.
    const repaired = await chatText(
      [
        { role: 'user', content: `Convert this answer into ONLY the required minified JSON with keys title, whisper, proofCriteria, proofHint, durationMin, tags, whyNow. Answer:\n${(res.text ?? '').slice(0, 1200)}` },
      ],
      { temperature: 0.1, maxTokens: 300 }
    );
    const fixed = repaired ? MissionDraft.safeParse(looseJson(repaired)) : null;
    return fixed?.success ? normalize(fixed.data) : null;
  } catch {
    return null;
  }
}
