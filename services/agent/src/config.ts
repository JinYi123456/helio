import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/* Load .env from the repo root without a dependency. Real environments
   (Render, CI) inject plain env vars, so anything already set wins. */
function loadDotEnv() {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(dir, '.env');
    if (existsSync(candidate)) {
      for (const line of readFileSync(candidate, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && process.env[m[1]] === undefined) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
      }
      return;
    }
    dir = resolve(dir, '..');
  }
}
loadDotEnv();

export type ProviderName = 'ollama' | 'google' | 'openrouter' | 'custom';

export const config = {
  port: Number(process.env.PORT || 8787),
  serveWeb: process.env.SERVE_WEB !== '0',
  provider: (process.env.HELIO_PROVIDER || 'ollama') as ProviderName,
  model: process.env.HELIO_MODEL || 'gemma4:e2b',
  visionModel: process.env.HELIO_VISION_MODEL || process.env.HELIO_MODEL || 'gemma4:e2b',
  visionFallbackModel: process.env.HELIO_VISION_FALLBACK || 'gemma3:4b',
  ollamaBaseUrl: (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/v1\/?$/, ''),
  googleApiKey: process.env.GOOGLE_API_KEY || '',
  googleModel: process.env.GOOGLE_MODEL || 'gemma-4-31b-it',
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openrouterModel: process.env.OPENROUTER_MODEL || 'google/gemma-4-31b-it:free',
  customBaseUrl: process.env.CUSTOM_BASE_URL || '',
  customModel: process.env.CUSTOM_MODEL || '',
  tabpfnUrl: process.env.TABPFN_URL || 'http://127.0.0.1:8790',
  elevenLabsKey: process.env.ELEVENLABS_API_KEY || '',
  elevenLabsVoice: process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
  serpApiKey: process.env.SERPAPI_KEY || '',
  mongoUri: process.env.MONGODB_URI || '',
  mongoDb: process.env.MONGODB_DB || 'helio',
  sentryDsn: process.env.SENTRY_DSN || '',
  audioCacheDir: process.env.HELIO_AUDIO_CACHE || resolve(dirname(fileURLToPath(import.meta.url)), '..', 'audio-cache'),
};

export type LlmEndpoint = {
  /** OpenAI-compatible base URL, e.g. http://127.0.0.1:11434/v1 */
  baseURL: string;
  apiKey: string;
  model: string;
  name: string;
  /** Ollama thinking models need reasoning_effort:"none" to answer directly */
  suppressThinking: boolean;
};

export function llmEndpoint(): LlmEndpoint {
  switch (config.provider) {
    case 'google':
      return {
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKey: config.googleApiKey,
        model: config.googleModel,
        name: 'google',
        suppressThinking: false,
      };
    case 'openrouter':
      return {
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: config.openrouterApiKey,
        model: config.openrouterModel,
        name: 'openrouter',
        suppressThinking: false,
      };
    case 'custom':
      return {
        baseURL: config.customBaseUrl,
        apiKey: process.env.CUSTOM_API_KEY || 'none',
        model: config.customModel,
        name: 'custom',
        suppressThinking: false,
      };
    default:
      return {
        baseURL: `${config.ollamaBaseUrl}/v1`,
        apiKey: 'ollama',
        model: config.model,
        name: 'ollama',
        suppressThinking: true,
      };
  }
}

export function engineLabel(): string {
  const probe = llmEndpoint();
  const where = config.provider === 'ollama' ? 'on-device' : 'hosted';
  return `${probe.model} · ${config.provider} (${where}, open weights)`;
}
