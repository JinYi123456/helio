import { config } from '../config.js';
import { fetchWithTimeout, pad2 } from './util.js';

export type DayWindow = {
  date: string;
  label: string;
  weekday: string;
  score: number; // 0–100
  hours: number[];
  source: string; // tabpfn | tabpfn-precomputed | climatology
  tMax?: number;
  tMin?: number;
  precip?: number;
  cloud?: number;
};

type TabpfnDay = {
  date: string;
  label: string;
  weekday: string;
  score: number;
  hours: number[];
  source: string;
  tMax: number;
  tMin: number;
  precip: number;
  cloud: number;
};

type TabpfnPayload = { city: string; source: string; served: string; days: TabpfnDay[] };

export function mapTabpfnDays(payload: TabpfnPayload): DayWindow[] {
  const source =
    payload.served === 'model' ? 'tabpfn' : payload.served?.includes('precomputed') ? 'tabpfn-precomputed' : 'climatology';
  return (payload.days || []).map((d) => ({
    date: d.date,
    label: `${d.weekday} · ${pad2(d.hours[0])}:00–${pad2((d.hours.at(-1) ?? d.hours[0]) + 1)}:00`,
    weekday: d.weekday,
    score: Math.round(d.score * 100),
    hours: d.hours,
    source,
    tMax: d.tMax,
    tMin: d.tMin,
    precip: d.precip,
    cloud: d.cloud,
  }));
}

/** The Grass Window as the web app knows it — null when the service is dark. */
export async function fetchWindow(cityKey: string, days = 7): Promise<{ days: DayWindow[]; source: string } | null> {
  try {
    const res = await fetchWithTimeout(`${config.tabpfnUrl}/window?city=${encodeURIComponent(cityKey)}&days=${days}`, {}, 30_000);
    if (!res.ok) return null;
    const payload = (await res.json()) as TabpfnPayload;
    const mapped = mapTabpfnDays(payload);
    if (!mapped.length) return null;
    return { days: mapped, source: mapped[0].source };
  } catch {
    return null;
  }
}
