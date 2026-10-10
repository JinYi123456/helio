/* Sun math — computed on-device, no API. Used for the dial's day/night shading. */

export function sunTimes(date: Date, lat: number, lon: number): { sunrise: number; sunset: number } {
  const rad = Math.PI / 180;
  const start = new Date(Date.UTC(date.getFullYear(), 0, 0));
  const doy = Math.floor((date.getTime() - start.getTime()) / 86400000);
  const decl = 23.44 * Math.sin(rad * (360 * (284 + doy)) / 365);
  const cosH = -Math.tan(lat * rad) * Math.tan(decl * rad);
  const clamped = Math.max(-1, Math.min(1, cosH));
  const H = (Math.acos(clamped) / rad) / 15; // hours of half-day
  const tzOffset = -date.getTimezoneOffset() / 60; // hours east of UTC
  const solarNoon = 12 - (lon - tzOffset * 15) / 15;
  return { sunrise: solarNoon - H, sunset: solarNoon + H };
}

export function fmtHour(h: number): string {
  const hh = Math.floor(((h % 24) + 24) % 24);
  const mm = Math.round(((h % 1) + 1) % 1 * 60 / 5) * 5;
  const m = mm === 60 ? 0 : mm;
  const h2 = mm === 60 ? (hh + 1) % 24 : hh;
  return `${String(h2).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function nowHours(d = new Date()): number {
  return d.getHours() + d.getMinutes() / 60;
}

export function dateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
