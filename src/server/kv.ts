import 'server-only';

/**
 * Minimal key-value + sorted-set store. Uses Upstash Redis (REST) when configured, otherwise an
 * in-process memory store that is fine for local play but resets on restart.
 */
export interface Kv {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSec?: number): Promise<void>;
  del(key: string): Promise<void>;
  zadd(key: string, score: number, member: string): Promise<void>;
  zincr(key: string, by: number, member: string): Promise<number>;
  ztop(key: string, n: number): Promise<{ member: string; score: number }[]>;
  zrank(key: string, member: string): Promise<number | null>;
  zscore(key: string, member: string): Promise<number | null>;
  incr(key: string, by?: number, ttlSec?: number): Promise<number>;
  smembers(key: string): Promise<string[]>;
  sadd(key: string, member: string): Promise<void>;
  srem(key: string, member: string): Promise<void>;
  zcard(key: string): Promise<number>;
  /** Many plain values in one round trip (missing keys come back null). */
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  /** HyperLogLog unique counts: pfcount over several keys counts the union. */
  pfadd(key: string, member: string, ttlSec?: number): Promise<void>;
  pfcount(keys: string[]): Promise<number>;
  kind: 'memory' | 'upstash';
}

class MemoryKv implements Kv {
  kind = 'memory' as const;
  private data = new Map<string, { v: unknown; exp: number }>();
  private zsets = new Map<string, Map<string, number>>();
  private sets = new Map<string, Set<string>>();
  async get<T>(key: string) {
    const e = this.data.get(key);
    if (!e) return null;
    if (e.exp && e.exp < Date.now()) { this.data.delete(key); return null; }
    return structuredClone(e.v) as T;
  }
  async set(key: string, value: unknown, ttlSec?: number) {
    this.data.set(key, { v: structuredClone(value), exp: ttlSec ? Date.now() + ttlSec * 1000 : 0 });
  }
  async del(key: string) { this.data.delete(key); }
  private z(key: string) { let z = this.zsets.get(key); if (!z) { z = new Map(); this.zsets.set(key, z); } return z; }
  async zadd(key: string, score: number, member: string) { this.z(key).set(member, score); }
  async zincr(key: string, by: number, member: string) { const z = this.z(key); const v = (z.get(member) ?? 0) + by; z.set(member, v); return v; }
  async ztop(key: string, n: number) {
    return [...this.z(key).entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([member, score]) => ({ member, score }));
  }
  async zrank(key: string, member: string) {
    const sorted = [...this.z(key).entries()].sort((a, b) => b[1] - a[1]);
    const i = sorted.findIndex(([m]) => m === member);
    return i < 0 ? null : i;
  }
  async zscore(key: string, member: string) { return this.z(key).get(member) ?? null; }
  async incr(key: string, by = 1, ttlSec?: number) { const v = ((await this.get<number>(key)) ?? 0) + by; await this.set(key, v, ttlSec); return v; }
  async smembers(key: string) { return [...(this.sets.get(key) ?? [])]; }
  async sadd(key: string, member: string) { let s = this.sets.get(key); if (!s) { s = new Set(); this.sets.set(key, s); } s.add(member); }
  async srem(key: string, member: string) { this.sets.get(key)?.delete(member); }
  async zcard(key: string) { return this.z(key).size; }
  async mget<T>(keys: string[]) { return Promise.all(keys.map((k) => this.get<T>(k))); }
  async pfadd(key: string, member: string) { await this.sadd(`hll:${key}`, member); }
  async pfcount(keys: string[]) { return new Set(keys.flatMap((k) => [...(this.sets.get(`hll:${k}`) ?? [])])).size; }
}

class UpstashKv implements Kv {
  kind = 'upstash' as const;
  constructor(private url: string, private token: string) {}
  private async cmd<T>(...args: (string | number)[]): Promise<T> {
    const r = await fetch(this.url, { method: 'POST', headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' }, body: JSON.stringify(args), cache: 'no-store' });
    const j = (await r.json()) as { result: T; error?: string };
    if (j.error) throw new Error(j.error);
    return j.result;
  }
  async get<T>(key: string) { const v = await this.cmd<string | null>('GET', key); return v ? (JSON.parse(v) as T) : null; }
  async set(key: string, value: unknown, ttlSec?: number) { await (ttlSec ? this.cmd('SET', key, JSON.stringify(value), 'EX', ttlSec) : this.cmd('SET', key, JSON.stringify(value))); }
  async del(key: string) { await this.cmd('DEL', key); }
  async zadd(key: string, score: number, member: string) { await this.cmd('ZADD', key, score, member); }
  async zincr(key: string, by: number, member: string) { return Number(await this.cmd<string>('ZINCRBY', key, by, member)); }
  async ztop(key: string, n: number) {
    const flat = await this.cmd<string[]>('ZRANGE', key, 0, n - 1, 'REV', 'WITHSCORES');
    const out: { member: string; score: number }[] = [];
    for (let i = 0; i < flat.length; i += 2) out.push({ member: flat[i], score: Number(flat[i + 1]) });
    return out;
  }
  async zrank(key: string, member: string) { const r = await this.cmd<number | null>('ZREVRANK', key, member); return r ?? null; }
  async zscore(key: string, member: string) { const r = await this.cmd<string | null>('ZSCORE', key, member); return r === null ? null : Number(r); }
  async incr(key: string, by = 1, ttlSec?: number) {
    const v = Number(await this.cmd<number>('INCRBY', key, by));
    if (ttlSec && v === by) await this.cmd('EXPIRE', key, ttlSec);
    return v;
  }
  async smembers(key: string) { return this.cmd<string[]>('SMEMBERS', key); }
  async sadd(key: string, member: string) { await this.cmd('SADD', key, member); }
  async srem(key: string, member: string) { await this.cmd('SREM', key, member); }
  async zcard(key: string) { return Number(await this.cmd<number>('ZCARD', key)); }
  async mget<T>(keys: string[]) {
    if (!keys.length) return [];
    const out: (T | null)[] = [];
    for (let i = 0; i < keys.length; i += 500) {
      const vals = await this.cmd<(string | null)[]>('MGET', ...keys.slice(i, i + 500));
      for (const v of vals) out.push(v === null ? null : (JSON.parse(v) as T));
    }
    return out;
  }
  async pfadd(key: string, member: string, ttlSec?: number) {
    const added = await this.cmd<number>('PFADD', key, member);
    if (ttlSec && added) await this.cmd('EXPIRE', key, ttlSec);
  }
  async pfcount(keys: string[]) { return keys.length ? Number(await this.cmd<number>('PFCOUNT', ...keys)) : 0; }
}

const g = globalThis as unknown as { __chogKv?: Kv };

export function kv(): Kv {
  if (!g.__chogKv) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    g.__chogKv = url && token ? new UpstashKv(url, token) : new MemoryKv();
  }
  return g.__chogKv;
}
