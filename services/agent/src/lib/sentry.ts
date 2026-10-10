import { config } from '../config.js';

type SentryModule = typeof import('@sentry/node');

let sentry: SentryModule | null = null;
let ready: Promise<SentryModule | null> | null = null;

/** Lazy Sentry: without a DSN every span helper degrades to a plain call. */
export async function initSentry(): Promise<SentryModule | null> {
  if (!config.sentryDsn) return null;
  if (!ready) {
    ready = (async () => {
      const mod = await import('@sentry/node');
      mod.init({
        dsn: config.sentryDsn,
        tracesSampleRate: 1.0,
        environment: process.env.NODE_ENV || 'development',
        release: `helio-agent@0.1.0`,
      });
      sentry = mod;
      return mod;
    })();
  }
  return ready;
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
  const s = await initSentry();
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
  if (!sentry) return;
  sentry.captureException(err, context ? { extra: context } : undefined);
}
