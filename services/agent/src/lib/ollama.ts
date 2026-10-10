import { config } from '../config.js';
import { fetchWithTimeout } from './util.js';

export type NativeMessage = { role: 'system' | 'user' | 'assistant'; content: string; images?: string[] };

export type NativeChatResult = {
  content: string;
  reasoning: string;
  ms: number;
  model: string;
};

/** Direct Ollama API — needed for vision (images) and think:false on gemma4. */
export async function ollamaChat(opts: {
  model: string;
  messages: NativeMessage[];
  think?: boolean;
  format?: 'json';
  numPredict?: number;
  temperature?: number;
  timeoutMs?: number;
}): Promise<NativeChatResult | null> {
  const t0 = performance.now();
  try {
    const res = await fetchWithTimeout(
      `${config.ollamaBaseUrl}/api/chat`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: opts.model,
          messages: opts.messages,
          stream: false,
          think: opts.think ?? false,
          ...(opts.format ? { format: opts.format } : {}),
          options: { num_predict: opts.numPredict ?? 400, temperature: opts.temperature ?? 0.7 },
        }),
      },
      opts.timeoutMs ?? 120_000
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { message?: { content?: string; reasoning?: string } };
    return {
      content: data.message?.content ?? '',
      reasoning: data.message?.reasoning ?? '',
      ms: Math.round(performance.now() - t0),
      model: opts.model,
    };
  } catch {
    return null;
  }
}

export async function ollamaReachable(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${config.ollamaBaseUrl}/api/tags`, {}, 1500);
    return res.ok;
  } catch {
    return false;
  }
}
