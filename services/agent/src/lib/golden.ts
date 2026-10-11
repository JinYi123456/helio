import type { DayWindow } from './window.js';

export type GoldenHour = {
  date: string;
  hour: number;
  iso: string;
  weekday: string;
  score: number;
};

/**
 * The next grass-worthy hour to sleep until: for every upcoming day, its first
 * hour that is still in the future; the best-scoring day wins (ties go to the
 * soonest). Null when the whole window is already behind us.
 */
export function pickGoldenHour(week: DayWindow[], now: Date = new Date()): GoldenHour | null {
  let best: (GoldenHour & { at: number }) | null = null;
  for (const day of week) {
    const hour = (day.hours ?? []).find((h) => at(day.date, h).getTime() > now.getTime());
    if (hour === undefined) continue;
    const when = at(day.date, hour);
    if (!best || day.score > best.score || (day.score === best.score && when.getTime() < best.at)) {
      best = {
        date: day.date,
        hour,
        iso: when.toISOString(),
        weekday: day.weekday,
        score: day.score,
        at: when.getTime(),
      };
    }
  }
  if (!best) return null;
  return { date: best.date, hour: best.hour, iso: best.iso, weekday: best.weekday, score: best.score };
}

function at(date: string, hour: number): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}
