import { config } from '../config.js';

export const TASK_QUEUE = 'helio-missions';

export type LifecycleSchedule = {
  scheduled: boolean;
  workflowId?: string;
  runId?: string;
  reason?: string;
};

export type LifecycleDurable = {
  status: string;
  running: boolean;
  startTime?: string;
  closeTime?: string;
} | null;

/** Temporal is a leaf node too — no server means "not scheduled", never an error. */
export function temporalEnabled(): boolean {
  return Boolean(config.temporalAddress);
}

let clientPromise: Promise<import('@temporalio/client').Client> | null = null;

async function getClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const { Client, Connection } = await import('@temporalio/client');
      const connection = await Connection.connect({ address: config.temporalAddress });
      return new Client({ connection });
    })();
    clientPromise.catch(() => {
      clientPromise = null; // a dead server shouldn't poison every later attempt
    });
  }
  return clientPromise;
}

export async function scheduleMissionLifecycle(input: {
  missionId: string;
  title: string;
  cityKey: string;
  goldenHourIso: string;
  expiresIso: string;
}): Promise<LifecycleSchedule> {
  if (!temporalEnabled()) return { scheduled: false, reason: 'temporal not configured' };
  try {
    const client = await getClient();
    const handle = await client.workflow.start('missionLifecycle', {
      taskQueue: TASK_QUEUE,
      workflowId: `helio-mission-${input.missionId}`,
      args: [input],
    });
    return { scheduled: true, workflowId: handle.workflowId, runId: handle.firstExecutionRunId };
  } catch (err) {
    return { scheduled: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

export async function missionLifecycleStatus(missionId: string): Promise<LifecycleDurable> {
  if (!temporalEnabled()) return null;
  try {
    const client = await getClient();
    const desc = await client.workflow.getHandle(`helio-mission-${missionId}`).describe();
    return {
      status: desc.status.name,
      running: desc.status.name === 'RUNNING',
      startTime: desc.startTime?.toISOString(),
      closeTime: desc.closeTime?.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function signalMissionDone(missionId: string): Promise<boolean> {
  if (!temporalEnabled()) return false;
  try {
    const client = await getClient();
    await client.workflow.getHandle(`helio-mission-${missionId}`).signal('markDone');
    return true;
  } catch {
    return false;
  }
}
