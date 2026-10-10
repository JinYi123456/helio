/**
 * Probe: does Sentry's Mastra integration actually attach and emit gen_ai spans
 * in our setup (tsx + @mastra/core 1.75 + ollama)?
 *
 * Runs with a dummy DSN and a capture transport — nothing leaves the machine.
 * Usage: npx tsx scripts/sentry-probe.ts
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);

process.env.SENTRY_DSN ||= 'https://key@o0.ingest.sentry.io/0';

const bodies: string[] = [];

const Sentry = require('@sentry/node');
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1,
  debug: true,
  integrations: [Sentry.mastraIntegration()],
  transport: () => ({
    send: (request: { body?: string | Uint8Array } | string | Uint8Array) => {
      const raw = (request as { body?: string | Uint8Array })?.body ?? request;
      const text =
        typeof raw === 'string' ? raw : raw instanceof Uint8Array ? new TextDecoder().decode(raw) : JSON.stringify(raw);
      bodies.push(text);
      return Promise.resolve({});
    },
    flush: () => Promise.resolve(true),
  }),
});

console.log('[probe] sentry initialized; now importing mastra (must load AFTER init)');

const { Mastra } = await import('@mastra/core');
const { Agent } = await import('@mastra/core/agent');
const { buildMastraModel } = await import('../src/lib/llm.js');

const probeAgent = new Agent({
  id: 'probe-compiler',
  name: 'probe-compiler',
  instructions: 'Answer with exactly one lowercase word from the grass vocabulary.',
  model: () => buildMastraModel(),
});

const mastra = new Mastra({
  agents: { probeCompiler: probeAgent },
});
console.log('[probe] mastra instance constructed:', Boolean(mastra));

const exporters = mastra.observability?.getDefaultInstance?.()?.getExporters?.() ?? [];
console.log(
  '[probe] exporters attached:',
  exporters.map((e: { name?: string }) => e.name)
);

const t0 = Date.now();
let answer = '';
try {
  const res = (await probeAgent.generate('Say: grass', { maxSteps: 1 })) as { text?: string };
  answer = (res.text ?? '').slice(0, 80);
} catch (err) {
  console.log('[probe] generate failed:', String(err));
}
console.log(`[probe] agent answered in ${((Date.now() - t0) / 1000).toFixed(1)}s:`, JSON.stringify(answer));

await Sentry.flush(8000);

console.log(`[probe] captured ${bodies.length} envelopes`);
const flat = bodies.join('\n');
const marks = ['gen_ai', 'mastra', 'mission', 'agent', 'chat', 'transaction'];
for (const m of marks) {
  const n = flat.split(m).length - 1;
  console.log(`[probe]   "${m}" occurrences: ${n}`);
}
writeFileSync('sentry-probe-envelopes.txt', flat, 'utf8');
console.log('[probe] raw envelopes -> services/agent/sentry-probe-envelopes.txt');
