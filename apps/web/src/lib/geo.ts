import { CITIES, type City, type Settings } from './types';

/** Nearest baked city for a coordinate — weather archives ship per city, so this is the honest match. */
export function nearestCity(lat: number, lon: number): { city: City; km: number } {
  let best = CITIES[0];
  let bestKm = Number.POSITIVE_INFINITY;
  for (const c of CITIES) {
    const km = haversineKm(lat, lon, c.lat, c.lon);
    if (km < bestKm) {
      bestKm = km;
      best = c;
    }
  }
  return { city: best, km: bestKm };
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function parseGeoKey(key: string): { lat: number; lon: number } | null {
  const m = /^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(key || '');
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

export function fmtGeo(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lon).toFixed(2)}°${ew}`;
}

/** Dial coordinates for whatever sky the settings point at — baked or geo. */
export function cityCoords(s: Settings): { lat: number; lon: number } {
  const baked = CITIES.find((c) => c.key === s.cityKey);
  if (baked) return { lat: baked.lat, lon: baked.lon };
  const g = parseGeoKey(s.cityKey);
  return g ?? { lat: CITIES[0].lat, lon: CITIES[0].lon };
}

export function cityLabelOf(s: Settings): string {
  const baked = CITIES.find((c) => c.key === s.cityKey);
  if (baked) return baked.label;
  if (s.cityLabel) return s.cityLabel;
  const g = parseGeoKey(s.cityKey);
  return g ? fmtGeo(g.lat, g.lon) : CITIES[0].label;
}

/** Display name for a walk/journal entry that only recorded its cityKey. */
export function prettyCity(key: string): string {
  const g = parseGeoKey(key);
  if (g) return fmtGeo(g.lat, g.lon);
  return CITIES.find((c) => c.key === key)?.label ?? key;
}
