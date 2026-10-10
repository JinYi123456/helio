export type Verdict = {
  passed: boolean;
  confidence: number;
  seen: string;
  note: string;
  engine: string;
  ms?: number;
  loose?: boolean;
};

export type DayWindow = {
  date: string;          // YYYY-MM-DD
  label: string;         // "Sat · 07:00–09:00"
  weekday: string;       // "Sat"
  score: number;         // 0–100
  hours: number[];       // best hours (local)
  source: string;        // "tabpfn" | "tabpfn-precomputed" | "climatology"
  tMax?: number; tMin?: number; precip?: number; cloud?: number;
};

export type Mission = {
  id: string;
  dateKey: string;
  createdAt: number;
  title: string;
  whisper: string;
  proofCriteria: string;
  proofHint: string;
  durationMin: number;
  tags: string[];
  whyNow?: string;
  window?: DayWindow | null;
  engine: string;
  groundNotes?: string[];
  audioUrl?: string | null;
};

export type Walk = {
  id: string;
  ts: number;
  dateKey: string;
  cityKey: string;
  missionId: string;
  missionTitle: string;
  tags: string[];
  photo?: string;        // small jpeg dataURL
  notes?: string;
  verdict?: Verdict | null;
  haiku?: string | null;
  journalAt?: number;
  pending?: boolean;     // captured offline, waiting for the model
  syncedAt?: number;
  weather?: { tMax?: number; tMin?: number; precip?: number; label?: string } | null;
};

export type Health = {
  ok: boolean;
  provider: string;
  model: string;
  visionModel?: string;
  storage: string;       // "mongodb-atlas" | "memory"
  tabpfn: boolean;
  tabpfnUrl?: string;
  tts: boolean;
  serpapi: boolean;
  sentry: boolean;
  engine?: string;       // human-readable: "gemma4:e2b · ollama (local)"
  time?: string;
};

export type Settings = {
  name: string;
  cityKey: string;
  envs: string[];
  serverUrl: string;
  voiceOn: boolean;
  motionOk: boolean;
  seenIntro: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  cityKey: 'petaling-jaya',
  envs: ['street', 'park', 'garden'],
  serverUrl: '',
  voiceOn: true,
  motionOk: true,
  seenIntro: false,
};

export type City = { key: string; label: string; lat: number; lon: number; tz: string };

export const CITIES: City[] = [
  { key: 'petaling-jaya', label: 'Petaling Jaya, MY', lat: 3.1073, lon: 101.6067, tz: 'Asia/Kuala_Lumpur' },
  { key: 'seattle', label: 'Seattle, US', lat: 47.6062, lon: -122.3321, tz: 'America/Los_Angeles' },
  { key: 'zurich', label: 'Zürich, CH', lat: 47.3769, lon: 8.5417, tz: 'Europe/Zurich' },
];
