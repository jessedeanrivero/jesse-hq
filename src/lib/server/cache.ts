import 'server-only';

// Per-instance, in-memory, short-lived. Nothing is persisted. Keys always include the user's email.
type Entry = { value: unknown; expires: number };
const store = new Map<string, Entry>();
const MAX = 300;

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value as T;
  const value = await fn();
  if (store.size >= MAX) {
    const first = store.keys().next().value;
    if (first) store.delete(first);
  }
  store.set(key, { value, expires: now + ttlMs });
  return value;
}

export function invalidate(prefix: string): void {
  for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k);
}
