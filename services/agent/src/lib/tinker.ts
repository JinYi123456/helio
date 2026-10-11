import { config } from '../config.js';

/* Helio's whisper voice, served by a Tinker LoRA. The prompt contract here
   must match services/tinker/train_whisper.py exactly — the fine-tune only
   learned this shape. */

export const TINKER_SYSTEM =
  'You write ONE whisper for Helio, an outdoors app. Voice: quiet, concrete, a little wry. ' +
  'Second person, present. 1-2 sentences, under 30 words. No emojis, no quotes, no greetings. ' +
  'The whisper sends a specific person outside to find ONE specific thing nearby.';

export const USER_PREFIX = 'WRITE THE WHISPER';

export type WhisperContext = {
  city: string;
  weekday: string;
  hour: number;
  envs: string[];
  tMax: number | null;
  precip: number | null;
  tags: string[];
  title: string;
};

export function tinkerConfigured(apiKey: string, samplerPath: string): boolean {
  return Boolean(apiKey && samplerPath);
}

export function tinkerEnabled(): boolean {
  return tinkerConfigured(config.tinkerApiKey, config.tinkerSamplerPath);
}

/** Pull a usable whisper out of an OpenAI-shaped chat completion. */
export function parseWhisperResponse(data: unknown): string | null {
  const text = (data as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') return null;
  const clean = text.trim().replace(/^["']|["']$/g, '');
  if (clean.length < 12 || clean.length > 300) return null;
  return clean;
}

export function whisperUserPrompt(context: WhisperContext): string {
  return `${USER_PREFIX}\n${JSON.stringify(context)}`;
}

/** Null whenever Tinker isn't configured or can't answer — the caller keeps its own whisper. */
export async function whisperFromTinker(context: WhisperContext): Promise<string | null> {
  if (!tinkerEnabled()) return null;
  try {
    const res = await fetch(`${config.tinkerBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.tinkerApiKey}`,
      },
      body: JSON.stringify({
        model: config.tinkerSamplerPath,
        messages: [
          { role: 'system', content: TINKER_SYSTEM },
          { role: 'user', content: whisperUserPrompt(context) },
        ],
        max_tokens: 80,
        temperature: 0.9,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    return parseWhisperResponse(await res.json());
  } catch {
    return null;
  }
}
