import { describe, it, expect } from 'vitest';
import { mapTabpfnDays } from '../src/lib/window.js';

const payload = {
  city: 'petaling-jaya',
  source: 'live',
  served: 'model',
  days: [
    { date: '2026-10-12', label: 'Oct 12', weekday: 'Mon', score: 0.8123, hours: [7, 8], source: 'live', tMax: 31.5, tMin: 24.1, precip: 0.4, cloud: 62 },
    { date: '2026-10-13', label: 'Oct 13', weekday: 'Tue', score: 0.4, hours: [17], source: 'live', tMax: 30.0, tMin: 24.0, precip: 8.2, cloud: 90 },
  ],
};

describe('mapTabpfnDays', () => {
  it('maps tabpfn payloads to web windows', () => {
    const days = mapTabpfnDays(payload);
    expect(days).toHaveLength(2);
    const d = days[0];
    expect(d.score).toBe(81);
    expect(d.label).toBe('Mon · 07:00–09:00');
    expect(d.weekday).toBe('Mon');
    expect(d.source).toBe('tabpfn');
    expect(d.tMax).toBe(31.5);
  });

  it('labels single-hour windows sensibly', () => {
    const days = mapTabpfnDays(payload);
    expect(days[1].label).toBe('Tue · 17:00–18:00');
  });

  it('marks precomputed and heuristic sources', () => {
    const pre = mapTabpfnDays({ ...payload, served: 'precomputed-fallback' });
    expect(pre[0].source).toBe('tabpfn-precomputed');
    const heur = mapTabpfnDays({ ...payload, served: 'heuristic' });
    expect(heur[0].source).toBe('climatology');
  });
});
