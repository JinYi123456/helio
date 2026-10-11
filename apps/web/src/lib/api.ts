import type { Settings, Mission, Verdict, Walk, Health, DayWindow, Located } from './types';

export function apiBase(s: Settings): string {
  if (s.serverUrl) return s.serverUrl.replace(/\/$/, '');
  return ''; // same-origin: vite proxy in dev, the agent serves the built app in prod
}

async function j<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(base + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  health: (s: Settings) =>
    j<Health>(apiBase(s), '/api/health', { signal: AbortSignal.timeout(4000) }),

  window: (s: Settings, cityKey: string) =>
    j<{ days: DayWindow[]; source: string }>(apiBase(s), `/api/window?city=${encodeURIComponent(cityKey)}`),

  locate: (s: Settings, lat: number, lon: number) =>
    j<Located>(apiBase(s), `/api/locate?lat=${lat}&lon=${lon}`, { signal: AbortSignal.timeout(8000) }),

  mission: (
    s: Settings,
    body: { cityKey: string; cityLabel?: string; envs: string[]; dateKey: string; history: string[]; regenerate?: boolean; name?: string }
  ) => j<Mission>(apiBase(s), '/api/mission', { method: 'POST', body: JSON.stringify(body) }),

  verify: (s: Settings, body: { mission: Pick<Mission, 'title' | 'proofCriteria' | 'tags' | 'id'>; image: string; cityKey?: string }) =>
    j<Verdict>(apiBase(s), '/api/verify', { method: 'POST', body: JSON.stringify(body) }),

  journal: (s: Settings, body: { missionTitle: string; tags: string[]; seen: string; cityKey: string; dateKey: string; weather?: Walk['weather'] }) =>
    j<{ haiku: string; engine: string }>(apiBase(s), '/api/journal', { method: 'POST', body: JSON.stringify(body) }),

  sync: (s: Settings, walks: Walk[]) =>
    j<{ results: { id: string; haiku?: string; verdict?: Verdict; error?: string }[] }>(
      apiBase(s),
      '/api/sync',
      { method: 'POST', body: JSON.stringify({ walks }) }
    ),

  tts: async (s: Settings, text: string): Promise<string | null> => {
    try {
      const res = await fetch(apiBase(s) + '/api/tts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 204 || !res.ok) return null;
      const blob = await res.blob();
      if (!blob.size) return null;
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  },
};
