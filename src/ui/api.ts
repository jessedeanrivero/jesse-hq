'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiError, ApiErrorCode } from '@/lib/shared/types';

export class ApiFailure extends Error {
  constructor(
    public status: number,
    public body: Omit<ApiError, 'code'> & { code: ApiErrorCode | 'offline' }
  ) {
    super(body.error);
  }
}

const cache = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

export async function api<T>(path: string, opts: { ttl?: number; force?: boolean; method?: string; body?: unknown } = {}): Promise<T> {
  const method = opts.method ?? 'GET';
  const ttl = opts.ttl ?? 60_000;
  if (method === 'GET' && !opts.force) {
    const hit = cache.get(path);
    if (hit && Date.now() - hit.at < ttl) return hit.data as T;
    const running = inflight.get(path);
    if (running) return running as Promise<T>;
  }
  const p = (async () => {
    let res: Response;
    try {
      res = await fetch(path, {
        method,
        credentials: 'same-origin',
        headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        cache: 'no-store',
      });
    } catch {
      throw new ApiFailure(0, { error: 'You appear to be offline. The world still works; this will load when you are back.', code: 'offline' });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiFailure(res.status, { error: (data as ApiError).error ?? `Request failed (${res.status})`, code: (data as ApiError).code ?? 'google_error', detail: (data as ApiError).detail, setup: (data as ApiError).setup });
    if (method === 'GET') cache.set(path, { at: Date.now(), data });
    return data as T;
  })();
  if (method === 'GET') {
    inflight.set(path, p);
    p.finally(() => inflight.delete(path)).catch(() => undefined);
  }
  return p;
}

export function invalidateApi(prefix = ''): void {
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k);
}

export function useApi<T>(path: string | null, ttl = 60_000): { data: T | null; error: ApiFailure | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(() => {
    const hit = path ? cache.get(path) : undefined;
    return hit && Date.now() - hit.at < ttl ? (hit.data as T) : null;
  });
  const [error, setError] = useState<ApiFailure | null>(null);
  const [loading, setLoading] = useState<boolean>(!!path && !data);
  const [nonce, setNonce] = useState(0);
  const force = useRef(false);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    setLoading(true);
    api<T>(path, { ttl, force: force.current })
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof ApiFailure ? e : new ApiFailure(500, { error: 'Something went wrong.', code: 'google_error' }));
      })
      .finally(() => {
        force.current = false;
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [path, ttl, nonce]);

  const reload = useCallback(() => {
    force.current = true;
    setNonce((n) => n + 1);
  }, []);

  return { data, error, loading, reload };
}
