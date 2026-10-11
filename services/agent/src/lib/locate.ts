/** Bring-your-own-sky: turn a browser coordinate into a sky Helio can read.
 *
 * Near a baked city → that city's decade of curated weather (the full model
 * treatment). Anywhere else → a geo key the grass-window service scores live,
 * named via a keyless reverse-geocode lookup.
 */
import { fetchWithTimeout } from './util.js';

export type Baked = { key: string; label: string; lat: number; lon: number };

export const BAKED: Baked[] = [
  { key: 'petaling-jaya', label: 'Petaling Jaya, MY', lat: 3.1073, lon: 101.6067 },
  { key: 'seattle', label: 'Seattle, US', lat: 47.6062, lon: -122.3321 },
  { key: 'zurich', label: 'Zürich, CH', lat: 47.3769, lon: 8.5417 },
];

export const NEAR_KM = 50;

export type Located = {
  key: string;
  label: string;
  lat: number;
  lon: number;
  nearest: { key: string; label: string; km: number };
  how: 'nearest-baked' | 'live-coords';
};

export function kmBetween(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function nearestBaked(lat: number, lon: number): { key: string; label: string; km: number } {
  let best = BAKED[0];
  let bestKm = Number.POSITIVE_INFINITY;
  for (const c of BAKED) {
    const km = kmBetween(lat, lon, c.lat, c.lon);
    if (km < bestKm) {
      bestKm = km;
      best = c;
    }
  }
  return { key: best.key, label: best.label, km: bestKm };
}

const fix = (n: number) => String(Number((Math.round(n * 1000) / 1000).toFixed(3)));

export function geoKey(lat: number, lon: number): string {
  return `geo:${fix(lat)},${fix(lon)}`;
}

export function isGeoKey(key: string | undefined): boolean {
  return /^geo:-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(key || '');
}

export function fmtGeo(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lon).toFixed(2)}°${ew}`;
}

/** Keyless reverse geocode, designed for client-side use. Null → caller falls back to coords. */
async function reverseViaBigDataCloud(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
      {},
      4000
    );
    if (!res.ok) return null;
    const j = (await res.json()) as {
      city?: string;
      locality?: string;
      principalSubdivision?: string;
      countryCode?: string;
    };
    const place = j.city || j.locality || j.principalSubdivision;
    if (!place) return null;
    return j.countryCode ? `${place}, ${j.countryCode}` : place;
  } catch {
    return null;
  }
}

export async function resolveLocation(
  lat: number,
  lon: number,
  reverse: (lat: number, lon: number) => Promise<string | null> = reverseViaBigDataCloud
): Promise<Located> {
  const nearest = nearestBaked(lat, lon);
  if (nearest.km <= NEAR_KM) {
    return { key: nearest.key, label: nearest.label, lat, lon, nearest, how: 'nearest-baked' };
  }
  const label = (await reverse(lat, lon)) ?? fmtGeo(lat, lon);
  return { key: geoKey(lat, lon), label, lat, lon, nearest, how: 'live-coords' };
}
