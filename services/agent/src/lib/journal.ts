import { chatText, providerReady } from './llm.js';
import { hashStr, mulberry32, pick } from './util.js';

const FALLBACK_HAIKU: string[][] = [
  ['morning grass, still wet', 'your shoes know the way by now', 'the screen waits, patiently'],
  ['one leaf, then the wind', 'you were there for the letting go', 'nobody else saw'],
  ['the puddle held sky', 'you stepped around it gently', 'two skies now, not one'],
  ['bark under your palm', 'older than every message', 'it does not reply'],
  ['a bee, working late', 'you watched without your camera', 'then remembered it'],
  ['stones warm from the sun', 'you put one back where it was', 'the ground says thank you'],
  ['moss growing on walls', 'softer than any plan you made', 'green does not hurry'],
];

export async function writeHaiku(input: {
  missionTitle: string;
  tags: string[];
  seen: string;
  dateKey: string;
}): Promise<{ haiku: string; engine: string }> {
  if (providerReady()) {
    const text = await chatText(
      [
        {
          role: 'user',
          content: [
            'Write a haiku about this exact moment from a short walk.',
            `Mission: ${input.missionTitle}`,
            `What the walker saw: ${input.seen}`,
            `Themes: ${input.tags.join(', ')}`,
            'Rules: exactly 3 lines, 5-7-5 syllables, concrete images, lowercase ok, no title, no quotes, no explanation.',
          ].join('\n'),
        },
      ],
      { temperature: 0.9, maxTokens: 90 }
    );
    if (text) {
      const lines = text
        .split('\n')
        .map((l) => l.replace(/^[\s"'\-•*]+|[\s"']+$/g, ''))
        .filter(Boolean)
        .slice(0, 3);
      if (lines.length === 3) return { haiku: lines.join('\n'), engine: 'model' };
    }
  }
  const rng = mulberry32(hashStr(input.dateKey + input.missionTitle));
  return { haiku: pick(FALLBACK_HAIKU, rng).join('\n'), engine: 'hand-written' };
}
