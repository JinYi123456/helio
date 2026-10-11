import { condition, defineSignal, proxyActivities, setHandler, sleep } from '@temporalio/workflow';
import type * as activities from './activities.js';

const { missionBecameRipe, missionMissed } = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
});

export type MissionLifecycleInput = {
  missionId: string;
  title: string;
  cityKey: string;
  goldenHourIso: string;
  expiresIso: string;
};

export const markDone = defineSignal('markDone');

/**
 * One mission's durable lifecycle: sleep until its golden hour (the timer
 * survives agent restarts), mark it ripe, then give the walk until
 * `expiresIso` before calling it missed. A verified photo signals `markDone`
 * and ends the workflow from anywhere.
 */
export async function missionLifecycle(input: MissionLifecycleInput): Promise<'verified' | 'missed'> {
  let done = false;
  setHandler(markDone, () => {
    done = true;
  });

  const golden = Date.parse(input.goldenHourIso);
  const expires = Date.parse(input.expiresIso);

  if (Date.now() < golden) {
    await Promise.race([sleep(golden - Date.now()), condition(() => done)]);
  }
  if (done) return 'verified';

  await missionBecameRipe({ missionId: input.missionId, title: input.title, cityKey: input.cityKey });

  if (Date.now() < expires) {
    await Promise.race([sleep(expires - Date.now()), condition(() => done)]);
  }
  if (done) return 'verified';

  await missionMissed({ missionId: input.missionId, title: input.title });
  return 'missed';
}
