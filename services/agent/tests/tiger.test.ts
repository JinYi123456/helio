import { describe, expect, it } from 'vitest';
import { config } from '../src/config.js';
import { footprintSeries, recordFootprint, tigerEnabled, tigerStatus } from '../src/lib/tiger.js';

/* Tiger Data is a leaf node. These specs pin the two contracts that matter
   for a leaf node: (1) it is enabled exactly when TIGER_URL is configured,
   and (2) calls degrade gracefully — never throw — when it is not. Real
   connection behaviour is verified against a live database, not mocked. */

describe('tiger data', () => {
  it('is enabled exactly when a URL is configured', () => {
    expect(tigerEnabled()).toBe(Boolean(config.tigerUrl));
  });

  it('degrades gracefully without a URL', async () => {
    if (tigerEnabled()) return; // live environment — covered by the e2e check instead
    await expect(recordFootprint({
      id: 'walk-1',
      ts: Date.now(),
      cityKey: 'petaling-jaya',
      missionTitle: 'a walk',
      tags: ['stone'],
    })).resolves.toBe(false);
    await expect(footprintSeries('petaling-jaya')).resolves.toBeNull();
    await expect(tigerStatus()).resolves.toEqual({ enabled: false, connected: false });
  });
});
