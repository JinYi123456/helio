import { config } from '../config.js';

/* Tiger Data (TimescaleDB) — the time-series shadow of the meadow.

   Every walk lands here as an append-only footprint row, so the graph the
   app draws for the last seven days also exists server-side, cheaply
   aggregated. Leaf node: no TIGER_URL → nothing connects, nothing breaks. */

export function tigerEnabled(): boolean {
  return Boolean(config.tigerUrl);
}

export type Footprint = {
  id: string;
  ts: number;
  cityKey: string;
  missionTitle: string;
  tags: string[];
  verdictPassed?: boolean;
  seen?: string;
};

type Pool = import('pg').Pool;

let poolPromise: Promise<Pool | null> | null = null;

async function initPool(): Promise<Pool | null> {
  if (!tigerEnabled()) return null;
  try {
    const { Pool } = await import('pg');
    /* pg >=8.16 maps `sslmode=require` to verify-full and lets it override an
       explicit ssl object; Tiger's proxy chain then fails to verify. Strip the
       URI knob and pass an explicit ssl config instead. */
    const cs = config.tigerUrl.replace(/([?&])sslmode=[^&]*/i, '$1').replace(/[?&]+$/, '');
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(cs);
    const pool = new Pool({
      connectionString: cs,
      ssl: local ? undefined : { rejectUnauthorized: false },
      max: 2,
      connectionTimeoutMillis: 6000,
    });
    await pool.query(
      `CREATE TABLE IF NOT EXISTS footprints (
         ts timestamptz NOT NULL,
         mission_id text,
         city_key text,
         title text,
         tags text[],
         verdict boolean,
         seen text
       )`
    );
    await pool.query(`CREATE INDEX IF NOT EXISTS footprints_city_ts ON footprints (city_key, ts DESC)`);
    try {
      await pool.query(`SELECT create_hypertable('footprints', 'ts', if_not_exists => TRUE)`);
    } catch {
      /* plain Postgres still works — hypertable is an optimisation */
    }
    return pool;
  } catch {
    return null;
  }
}

function getPool(): Promise<Pool | null> {
  if (!poolPromise) poolPromise = initPool();
  return poolPromise;
}

export async function recordFootprint(fp: Footprint): Promise<boolean> {
  try {
    const pool = await getPool();
    if (!pool) return false;
    await pool.query(
      `INSERT INTO footprints (ts, mission_id, city_key, title, tags, verdict, seen)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [new Date(fp.ts), fp.id, fp.cityKey, fp.missionTitle, fp.tags, fp.verdictPassed ?? null, fp.seen ?? null]
    );
    return true;
  } catch {
    return false;
  }
}

export type DayBucket = { day: string; walks: number };

export async function footprintSeries(cityKey: string, days = 7): Promise<DayBucket[] | null> {
  try {
    const pool = await getPool();
    if (!pool) return null;
    const res = await pool.query(
      `SELECT to_char(date_trunc('day', ts), 'YYYY-MM-DD') AS day, count(*)::int AS walks
         FROM footprints
        WHERE city_key = $1 AND ts > now() - ($2 || ' days')::interval
        GROUP BY 1 ORDER BY 1`,
      [cityKey, String(Math.max(1, Math.min(90, days)))]
    );
    return res.rows as DayBucket[];
  } catch {
    return null;
  }
}

export async function tigerStatus(): Promise<{ enabled: boolean; connected: boolean; total?: number }> {
  if (!tigerEnabled()) return { enabled: false, connected: false };
  try {
    const pool = await getPool();
    if (!pool) return { enabled: true, connected: false };
    const res = await pool.query(`SELECT count(*)::int AS total FROM footprints`);
    return { enabled: true, connected: true, total: (res.rows[0] as { total: number }).total };
  } catch {
    return { enabled: true, connected: false };
  }
}
