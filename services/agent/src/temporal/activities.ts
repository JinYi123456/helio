export type LifecycleEventInput = {
  missionId: string;
  title: string;
  cityKey?: string;
};

const AGENT_URL = process.env.HELIO_AGENT_URL || 'http://127.0.0.1:8787';

async function notifyAgent(event: 'ripe' | 'missed', input: LifecycleEventInput): Promise<void> {
  console.log(`[temporal] ${event} · ${input.missionId} · ${input.title}`);
  try {
    await fetch(`${AGENT_URL}/api/_lifecycle/event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...input, event, at: new Date().toISOString() }),
    });
  } catch {
    /* the agent may be away — the durable state still lives on the Temporal server */
  }
}

export async function missionBecameRipe(input: LifecycleEventInput): Promise<void> {
  await notifyAgent('ripe', input);
}

export async function missionMissed(input: LifecycleEventInput): Promise<void> {
  await notifyAgent('missed', input);
}
