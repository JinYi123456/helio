import { createHash } from 'node:crypto';

export function sha1(s: string): string {
  return createHash('sha1').update(s).digest('hex');
}

export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 8000): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}

function extract(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

/** Parse JSON from a small model that may wrap it in prose or code fences. */
export function looseJson<T = unknown>(text: string): T | null {
  if (!text) return null;
  // Thinking models narrate first; <thought>…</thought> can contain stray braces,
  // so the JSON is scooped from the reply with the narration removed.
  const stripped = text.replace(/<(?:thought|thinking|reasoning)>[\s\S]*?<\/(?:thought|thinking|reasoning)>/gi, ' ');
  for (const candidate of stripped === text ? [text] : [stripped, text]) {
    const json = extract(candidate);
    if (!json) continue;
    try {
      return JSON.parse(json) as T;
    } catch {
      continue;
    }
  }
  return null;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

/** Deterministic 32-bit rng — same seed, same mission. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
