/* Tiny IndexedDB wrapper — everything Helio knows lives on this device. */
import type { Walk, Mission, Settings } from './types';

const DB = 'helio';
const VER = 1;

let _db: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (_db) return _db;
  _db = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('walks')) db.createObjectStore('walks', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('missions')) db.createObjectStore('missions', { keyPath: 'dateKey' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _db;
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const kvGet = <T>(key: string) => tx<T | undefined>('kv', 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>);
export const kvSet = (key: string, val: unknown) => tx('kv', 'readwrite', (s) => s.put(val, key) as IDBRequest<IDBValidKey>);

export const putWalk = (w: Walk) => tx('walks', 'readwrite', (s) => s.put(w) as IDBRequest<IDBValidKey>);
export const allWalks = () => tx<Walk[]>('walks', 'readonly', (s) => s.getAll() as IDBRequest<Walk[]>);
export const delWalk = (id: string) => tx('walks', 'readwrite', (s) => s.delete(id) as IDBRequest<undefined>);

export const putMission = (m: Mission) => tx('missions', 'readwrite', (s) => s.put(m) as IDBRequest<IDBValidKey>);
export const getMission = (dateKey: string) => tx<Mission | undefined>('missions', 'readonly', (s) => s.get(dateKey) as IDBRequest<Mission | undefined>);

export async function loadSettings(): Promise<Settings | undefined> {
  return kvGet<Settings>('settings');
}
export async function saveSettings(s: Settings): Promise<void> {
  await kvSet('settings', s);
}

export async function wipeAll(): Promise<void> {
  const db = await open();
  await Promise.all(['kv', 'walks', 'missions'].map((store) =>
    new Promise<void>((resolve, reject) => {
      const t = db.transaction(store, 'readwrite');
      const r = t.objectStore(store).clear();
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    })
  ));
}
