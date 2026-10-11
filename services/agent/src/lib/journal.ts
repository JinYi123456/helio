import { llmEndpoint } from '../config.js';
import { chatText, providerReady } from './llm.js';
import { withSpan } from './sentry.js';
import { hashStr, looseJson, mulberry32, pick, stripThinking } from './util.js';

const FALLBACK_HAIKU: string[][] = [
  ['morning grass, still wet', 'your shoes know the way by now', 'the screen waits, patiently'],
  ['one leaf, then the wind', 'you were there for the letting go', 'nobody else saw'],
  ['the puddle held sky', 'you stepped around it gently', 'two skies now, not one'],
  ['bark under your palm', 'older than every message', 'it does not reply'],
  ['a bee, working late', 'you watched without your camera', 'then remembered it'],
  ['stones warm from the sun', 'you put one back where it was', 'the ground says thank you'],
  ['moss growing on walls', 'softer than any plan you made', 'green does not hurry'],
];

export function haikuPrompt(input: { missionTitle: string; tags: string[]; seen: string }): string {
  return [
    'Write a haiku about this exact moment from a short walk.',
    `Mission: ${input.missionTitle}`,
    `What the walker saw: ${input.seen}`,
    `Themes: ${input.tags.join(', ')}`,
    'Rules: exactly 3 lines, 5-7-5 syllables, concrete images, lowercase ok, no title, no quotes, no explanation.',
  ].join('\n');
}

/** Strict-JSON wording — thinking models over-deliberate on open creative asks but settle for schemas. */
export function haikuPromptJson(input: { missionTitle: string; tags: string[]; seen: string }): string {
  return [
    'Write a haiku about this exact moment from a short walk.',
    `Mission: ${input.missionTitle}`,
    `What the walker saw: ${input.seen}`,
    `Themes: ${input.tags.join(', ')}`,
    '5-7-5 syllables across exactly 3 lines, concrete images, lowercase ok.',
    'Reply with only JSON, no other text: {"haiku": ["line 1", "line 2", "line 3"]}',
  ].join('\n');
}

/** Leanest ask — fewest constraints means the least to deliberate about. */
export function haikuPromptLean(input: { missionTitle: string; tags: string[]; seen: string }): string {
  return `Write one haiku, three lines, 5-7-5 syllables, about ${input.seen}. Mission theme: ${input.missionTitle}. Reply with only the three lines.`;
}

function cleanLine(l: unknown): string {
  return typeof l === 'string' ? l.replace(/^[\s"'\-•*]+|[\s"']+$/g, '') : '';
}

function haikuLines(text: string): string[] {
  const ok = (l: string) => l && l.length <= 64 && !/[<>{}\[\]]/.test(l);
  const j = looseJson<{ haiku?: unknown }>(text);
  if (j) {
    const h = Array.isArray(j.haiku) ? j.haiku : typeof j.haiku === 'string' ? j.haiku.split('\n') : [];
    const js = h.map(cleanLine).filter(ok).slice(0, 3);
    if (js.length === 3) return js;
  }
  return stripThinking(text).split('\n').map(cleanLine).filter(ok).slice(0, 3);
}

export async function writeHaiku(input: {
  missionTitle: string;
  tags: string[];
  seen: string;
  dateKey: string;
}): Promise<{ haiku: string; engine: string }> {
  if (providerReady()) {
    const p = llmEndpoint();
    const text = await withSpan(
      'journal.haiku',
      'gen_ai.chat',
      () =>
        chatText([{ role: 'user', content: haikuPromptJson(input) }], {
          temperature: 0.9,
          // Without reasoning_effort support, a fixed cap truncates hosted
          // thinking models mid-<thought> — let the server default run.
          maxTokens: p.suppressThinking ? 320 : null,
        }),
      { 'gen_ai.system': p.name, 'gen_ai.request.model': p.model }
    );
    if (text) {
      const lines = haikuLines(text);
      if (lines.length === 3) return { haiku: lines.join('\n'), engine: 'model' };
    }
  }
  const rng = mulberry32(hashStr(input.dateKey + input.missionTitle));
  return { haiku: pick(FALLBACK_HAIKU, rng).join('\n'), engine: 'hand-written' };
}
