import { config } from '../config.js';
import { ollamaChat } from './ollama.js';

export type MemoryWalk = {
  id: string;
  ts: number;
  dateKey: string;
  cityKey: string;
  missionTitle: string;
  tags: string[];
  seen?: string;
  haiku?: string;
  verdictPassed?: boolean;
  embedding?: number[];
};

type Store = {
  save(walk: MemoryWalk): Promise<void>;
  recent(cityKey: string, limit: number): Promise<MemoryWalk[]>;
  similar?(cityKey: string, vector: number[], limit: number): Promise<MemoryWalk[]>;
  kind: 'mongodb' | 'memory';
};

function memoryStore(): Store {
  const walks: MemoryWalk[] = [];
  return {
    kind: 'memory',
    async save(walk) {
      const i = walks.findIndex((w) => w.id === walk.id);
      if (i >= 0) walks[i] = { ...walks[i], ...walk };
      else walks.unshift(walk);
      if (walks.length > 500) walks.pop();
    },
    async recent(cityKey, limit) {
      return walks.filter((w) => w.cityKey === cityKey).slice(0, limit);
    },
  };
}

let storePromise: Promise<Store> | null = null;

async function mongoStore(): Promise<Store> {
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(config.mongoUri, { serverSelectionTimeoutMS: 4000 });
  await client.connect();
  const col = client.db(config.mongoDb).collection<MemoryWalk>('walks');
  await col.createIndex({ cityKey: 1, ts: -1 });

  const vectorIndex = process.env.MONGODB_VECTOR_INDEX || '';
  return {
    kind: 'mongodb',
    async save(walk) {
      await col.updateOne({ id: walk.id }, { $set: walk }, { upsert: true });
    },
    async recent(cityKey, limit) {
      return col.find({ cityKey }, { projection: { embedding: 0 } }).sort({ ts: -1 }).limit(limit).toArray();
    },
    async similar(cityKey, vector, limit) {
      if (!vectorIndex) return [];
      return col
        .aggregate<MemoryWalk>([
          {
            $vectorSearch: {
              index: vectorIndex,
              path: 'embedding',
              queryVector: vector,
              numCandidates: Math.max(20, limit * 10),
              limit,
              filter: { cityKey },
            },
          },
          { $project: { embedding: 0 } },
        ])
        .toArray();
    },
  };
}

export async function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = config.mongoUri
      ? mongoStore().catch(() => memoryStore())
      : Promise.resolve(memoryStore());
  }
  return storePromise;
}

async function embed(text: string): Promise<number[] | undefined> {
  try {
    const res = await fetch(`${config.ollamaBaseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.HELIO_EMBED_MODEL || 'nomic-embed-text', prompt: text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { embedding?: number[] };
    return data.embedding?.length ? data.embedding : undefined;
  } catch {
    return undefined;
  }
}

export async function rememberWalk(walk: Omit<MemoryWalk, 'embedding'>): Promise<void> {
  const store = await getStore();
  const text = `${walk.missionTitle} ${walk.seen ?? ''} ${(walk.tags || []).join(' ')}`.trim();
  const embedding = await embed(text);
  await store.save({ ...walk, embedding });
}

export async function recentWalks(cityKey: string, limit = 6): Promise<MemoryWalk[]> {
  const store = await getStore();
  try {
    return await store.recent(cityKey, limit);
  } catch {
    return [];
  }
}

/** Long-term field memory: walks that feel like today's. */
export async function similarWalks(cityKey: string, query: string, limit = 4): Promise<MemoryWalk[]> {
  const store = await getStore();
  try {
    const vec = await embed(query);
    if (vec && store.similar) {
      const hits = await store.similar(cityKey, vec, limit);
      if (hits.length) return hits;
    }
    return await store.recent(cityKey, limit);
  } catch {
    return [];
  }
}

export async function memoryKind(): Promise<'mongodb' | 'memory'> {
  return (await getStore()).kind;
}
