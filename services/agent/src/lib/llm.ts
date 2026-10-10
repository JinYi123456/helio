import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { MastraLanguageModel } from '@mastra/core/agent';
import { config, llmEndpoint } from '../config.js';
import { fetchWithTimeout } from './util.js';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

function providerConfigured(): boolean {
  const p = llmEndpoint();
  switch (p.name) {
    case 'google':
      return Boolean(config.googleApiKey);
    case 'openrouter':
      return Boolean(config.openrouterApiKey);
    case 'custom':
      return Boolean(config.customBaseUrl && config.customModel);
    default:
      return true;
  }
}

/**
 * Plain OpenAI-compatible chat, used for haiku/repair calls.
 * `reasoning_effort: none` keeps Ollama's gemma4 from thinking out loud.
 */
export async function chatText(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; timeoutMs?: number } = {}
): Promise<string | null> {
  if (!providerConfigured()) return null;
  const p = llmEndpoint();
  try {
    const res = await fetchWithTimeout(
      `${p.baseURL.replace(/\/$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(p.apiKey ? { authorization: `Bearer ${p.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: p.model,
          messages,
          temperature: opts.temperature ?? 0.8,
          max_tokens: opts.maxTokens ?? 400,
          ...(p.suppressThinking ? { reasoning_effort: 'none' } : {}),
        }),
      },
      opts.timeoutMs ?? 90_000
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content;
    return text && text.trim().length > 0 ? text.trim() : null;
  } catch {
    return null;
  }
}

/**
 * The Mastra-facing model. We hand Mastra an AI-SDK provider built over the
 * configured endpoint; for Ollama we splice `reasoning_effort:"none"` into
 * every request so thinking models answer directly.
 */
export function buildMastraModel(): MastraLanguageModel {
  const p = llmEndpoint();
  const provider = createOpenAICompatible({
    name: p.name,
    baseURL: p.baseURL,
    apiKey: p.apiKey,
    ...(p.suppressThinking
      ? {
          transformRequestBody: (body: Record<string, unknown>) => ({ ...body, reasoning_effort: 'none' }),
        }
      : {}),
  });
  return provider.chatModel(p.model) as unknown as MastraLanguageModel;
}

export function providerReady(): boolean {
  return providerConfigured();
}

export function providerLabel(): string {
  const p = llmEndpoint();
  return `${p.name}/${p.model}`;
}
