import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { MastraLanguageModel } from '@mastra/core/agent';
import { config, llmEndpoint, type LlmEndpoint } from '../config.js';
import { fetchWithTimeout } from './util.js';
import { gemmaModelIds } from './vision.js';

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
async function chatOnce(
  p: LlmEndpoint,
  model: string,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; timeoutMs?: number }
): Promise<string | null> {
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
          model,
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

let _textWinner = '';

async function textCandidates(p: LlmEndpoint): Promise<string[]> {
  const list: (string | undefined)[] = [process.env.HELIO_MODEL_COMPAT, p.model];
  if (p.name === 'google') list.push(...(await gemmaModelIds(p.baseURL, p.apiKey)));
  return list.filter((m): m is string => Boolean(m)).filter((m, i, a) => a.indexOf(m) === i);
}

async function pingModel(p: LlmEndpoint, model: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${p.baseURL.replace(/\/$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(p.apiKey ? { authorization: `Bearer ${p.apiKey}` } : {}),
        },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 4 }),
      },
      20_000
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Hosted catalogs drift — the configured model id may not exist anymore (or be
 * text-only). Ping candidates once and remember the first that answers, the
 * same way the vision path does.
 */
export async function ensureTextModel(): Promise<string> {
  const p = llmEndpoint();
  if (p.name === 'ollama' || _textWinner) return _textWinner || p.model;
  for (const model of await textCandidates(p)) {
    if (await pingModel(p, model)) {
      _textWinner = model;
      break;
    }
  }
  return _textWinner || p.model;
}

export async function chatText(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; timeoutMs?: number } = {}
): Promise<string | null> {
  if (!providerConfigured()) return null;
  const p = llmEndpoint();
  const model = await ensureTextModel();
  const out = await chatOnce(p, model, messages, opts);
  if (out) return out;
  if (_textWinner) {
    // The cached winner can go stale mid-flight — re-resolve once.
    _textWinner = '';
    const retry = await ensureTextModel();
    if (retry !== model) return chatOnce(p, retry, messages, opts);
  }
  return null;
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
  return provider.chatModel(_textWinner || p.model) as unknown as MastraLanguageModel;
}

export function providerReady(): boolean {
  return providerConfigured();
}

export function providerLabel(): string {
  const p = llmEndpoint();
  return `${p.name}/${p.model}`;
}
