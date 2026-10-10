import { createRequire } from 'node:module';
import { config } from '../config.js';

type SentryModule = typeof import('@sentry/node');

const require = createRequire(import.meta.url);

let sentry: SentryModule | null = null;
let attempted = false;

/**
 * Synchronous on purpose: Sentry registers its runtime-instrumentation hooks
 * inside init(), and any module loaded before that (notably @mastra/core and
 * the ai package) can never be instrumented afterwards — the hooks only see
 * future loads. instrument.ts calls this before anything else in the process.
 * Without a DSN it is a pure no-op and the SDK is never even loaded.
 */
export function initSentry(): SentryModule | null {
  if (attempted) return sentry;
  attempted = true;
  if (!config.sentryDsn) return null;
  try {
    // The CommonJS build, so init stays synchronous — a dynamic ESM import
    // resolves after @mastra/core is already loaded and tracing silently dies.
    const mod = require('@sentry/node') as SentryModule;
    mod.init({
      dsn: config.sentryDsn,
      tracesSampleRate: 1.0,
      environment: process.env.NODE_ENV || 'development',
      release: 'helio-agent@0.1.0',
      // HELIO_SENTRY_DEBUG=1 prints span lifecycles to the server log —
      // handy when checking that instrumentation attached on a fresh deploy.
      debug: process.env.HELIO_SENTRY_DEBUG === '1',
      // Auto-instruments @mastra/core: every mission compile becomes a
      // gen_ai.invoke_agent → gen_ai.chat → http.client trace with token usage.
      integrations: [mod.mastraIntegration()],
    });
    sentry = mod;
  } catch (err) {
    console.warn('helio: sentry init failed, continuing without tracing —', String(err));
    sentry = null;
  }
  return sentry;
}

export function sentryEnabled(): boolean {
  return Boolean(config.sentryDsn);
}

export async function withSpan<T>(
  name: string,
  op: string,
  fn: () => Promise<T>,
  attributes: Record<string, string | number> = {}
): Promise<T> {
  const s = initSentry();
  if (!s) return fn();
  return s.startSpan({ name, op, attributes }, async () => {
    try {
      return await fn();
    } catch (err) {
      s.captureException(err);
      throw err;
    }
  });
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  const s = initSentry();
  if (!s) return;
  s.captureException(err, context ? { extra: context } : undefined);
}
