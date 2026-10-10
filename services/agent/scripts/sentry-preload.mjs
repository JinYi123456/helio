// Sentry's runtime instrumentation must be registered before Node loads the
// module graph: in ESM, every static import is instantiated (read through the
// loader hooks) before any module body runs, so calling init() from app code
// is always too late for @mastra/core and friends.
//
// Gated on the DSN: with Sentry configured, modules load pre-instrumented;
// without one, Sentry stays completely out of the process. Wired up as
//   node --import ./scripts/sentry-preload.mjs dist/index.js
if (process.env.SENTRY_DSN) {
  await import('@sentry/node/import');
}
