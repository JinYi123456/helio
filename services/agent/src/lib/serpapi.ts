import { config } from '../config.js';
import { fetchWithTimeout } from './util.js';

const cache = new Map<string, { at: number; notes: string[] }>();
const TTL_MS = 12 * 3600 * 1000;

/**
 * SerpApi — what's actually happening outside right now, per city and month.
 * Free tier: 100 searches/month, so results are cached for half a day.
 */
export async function localGround(cityLabel: string, month: number, envs: string[] = []): Promise<string[]> {
  if (!config.serpApiKey) return [];
  const envWord = envs.includes('waterside') ? 'waterfront' : envs.includes('trail') ? 'hiking trail' : 'park';
  const q = `what's in season ${cityLabel} in ${['January','February','March','April','May','June','July','August','September','October','November','December'][(month - 1) % 12]} ${envWord} blooms foliage`;
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.notes;

  try {
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', q);
    url.searchParams.set('num', '5');
    url.searchParams.set('api_key', config.serpApiKey);
    const res = await fetchWithTimeout(url.toString(), {}, 10_000);
    if (!res.ok) return hit?.notes ?? [];
    const data = (await res.json()) as { organic_results?: { title?: string; snippet?: string }[] };
    const notes = (data.organic_results || [])
      .map((r) => [r.title, r.snippet].filter(Boolean).join(' — '))
      .filter((s) => s.length > 10)
      .slice(0, 3)
      .map((s) => s.slice(0, 220));
    cache.set(key, { at: Date.now(), notes });
    return notes;
  } catch {
    return hit?.notes ?? [];
  }
}
