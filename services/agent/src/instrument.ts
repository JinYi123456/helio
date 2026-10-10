import { initSentry } from './lib/sentry.js';

// Keep this module first in index.ts, and keep it free of @mastra/core and ai
// imports: Sentry must initialize before those load or its runtime
// instrumentation cannot inject diagnostics channels into them.
initSentry();
