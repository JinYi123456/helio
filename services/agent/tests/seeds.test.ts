import { describe, it, expect } from 'vitest';
import { seedMission, SEEDS } from '../src/lib/seeds.js';

const base = { dateKey: '2026-10-11', cityKey: 'petaling-jaya', envs: ['trail', 'park'] };

describe('seedMission', () => {
  it('returns a complete, usable mission', () => {
    const m = seedMission(base);
    expect(m.title.length).toBeGreaterThan(2);
    expect(m.whisper.length).toBeGreaterThan(10);
    expect(m.proofCriteria.length).toBeGreaterThan(10);
    expect(m.proofHint.length).toBeGreaterThan(5);
    expect(m.durationMin).toBeGreaterThanOrEqual(5);
    expect(m.tags.length).toBeGreaterThan(0);
    expect(m.whyNow.length).toBeGreaterThan(5);
  });

  it('is deterministic for the same day and city', () => {
    expect(seedMission(base).title).toBe(seedMission(base).title);
  });

  it('changes when the walker asks for a new seed', () => {
    const a = seedMission({ ...base, variant: 0 });
    const b = seedMission({ ...base, variant: 7 });
    expect(a.title + a.whisper).not.toBe(b.title + b.whisper);
  });

  it('respects chosen environments when possible', () => {
    const m = seedMission({ ...base, envs: ['waterside'] });
    const seed = SEEDS.find((s) => s.envs.includes('waterside'))!;
    expect(seed).toBeTruthy();
    expect(m.title.length).toBeGreaterThan(0);
  });

  it('writes whyNow from the actual window when present', () => {
    const m = seedMission({
      ...base,
      window: { date: base.dateKey, label: 'Sun · 07:00–09:00', weekday: 'Sun', score: 84, hours: [7, 8], source: 'tabpfn', tMax: 31, precip: 0.2 },
    });
    expect(m.whyNow).toContain('84');
    expect(m.whyNow).toContain('07:00');
  });
});
