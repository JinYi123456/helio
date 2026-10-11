import { describe, it, expect } from 'vitest';
import { pickGoldenHour } from '../src/lib/golden.js';
import { scheduleMissionLifecycle, temporalEnabled } from '../src/lib/temporal.js';
import type { DayWindow } from '../src/lib/window.js';

const day = (date: string, weekday: string, score: number, hours: number[]): DayWindow => ({
  date,
  label: `${weekday} · best hours`,
  weekday,
  score,
  hours,
  source: 'tabpfn',
});

describe('pickGoldenHour', () => {
  it('prefers the best-scoring upcoming day over the soonest', () => {
    const now = new Date(2026, 9, 11, 9, 30);
    const week = [day('2026-10-11', 'Sun', 80, [10, 11]), day('2026-10-12', 'Mon', 95, [7])];
    const g = pickGoldenHour(week, now);
    expect(g?.date).toBe('2026-10-12');
    expect(g?.hour).toBe(7);
  });

  it('skips hours already past — and a day whose hours all passed', () => {
    const now = new Date(2026, 9, 11, 12, 0);
    const week = [day('2026-10-11', 'Sun', 99, [7, 10])];
    expect(pickGoldenHour(week, now)).toBeNull();
  });

  it('takes the first future hour of a day, not one already gone', () => {
    const now = new Date(2026, 9, 11, 9, 30);
    const week = [day('2026-10-11', 'Sun', 90, [7, 10, 16])];
    expect(pickGoldenHour(week, now)?.hour).toBe(10);
  });

  it('breaks score ties by the soonest', () => {
    const now = new Date(2026, 9, 11, 6, 0);
    const week = [day('2026-10-11', 'Sun', 90, [10]), day('2026-10-12', 'Mon', 90, [7])];
    expect(pickGoldenHour(week, now)?.date).toBe('2026-10-11');
  });

  it('handles an empty week', () => {
    expect(pickGoldenHour([], new Date())).toBeNull();
  });
});

describe('temporal disabled path', () => {
  it('degrades gracefully with no TEMPORAL_ADDRESS configured', async () => {
    expect(temporalEnabled()).toBe(false);
    const res = await scheduleMissionLifecycle({
      missionId: 'test-mission',
      title: 'a walk',
      cityKey: 'zurich',
      goldenHourIso: new Date(Date.now() + 60_000).toISOString(),
      expiresIso: new Date(Date.now() + 120_000).toISOString(),
    });
    expect(res).toEqual({ scheduled: false, reason: 'temporal not configured' });
  });
});
