import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PushSchedule } from './schedule';

// The push itself is not under test: the payload is the message as it is, and `fetch` below records it.
vi.mock('@block65/webcrypto-web-push', () => ({
  buildPushPayload: async (message: { data: string }) => ({ method: 'POST', headers: {}, body: message.data }),
}));

const { default: worker } = await import('./index');

type Store = Map<string, { value: string; ttl?: number }>;

/**
 * Enough of KV for the reminder routes. `readsFrom` makes every read see an earlier `copy` of the store, as a KV edge
 * cache can for up to a minute, while writes still land; `readsFrom(null)` ends it.
 */
function memoryKV() {
  const live: Store = new Map();
  let seen: Store | null = null;
  const kv = {
    live,
    copy: (): Store => new Map(live),
    readsFrom(store: Store | null) {
      seen = store;
    },
    async get(key: string, type?: string) {
      const e = (seen ?? live).get(key);
      if (!e) return null;
      return type === 'json' ? JSON.parse(e.value) : e.value;
    },
    async put(key: string, value: string, opts?: { expirationTtl?: number }) {
      live.set(key, { value, ttl: opts?.expirationTtl });
    },
    async delete(key: string) {
      live.delete(key);
    },
    async list() {
      return { keys: [...live.keys()].map((name) => ({ name })), list_complete: true, cacheStatus: null };
    },
  };
  return kv;
}

const ENDPOINT = 'https://web.push.apple.com/phone-1';
const SUB = { endpoint: ENDPOINT, keys: { p256dh: 'p', auth: 'a' } };
const TTL = 60 * 86400;

// Tuesday 6 October 2026 in Kolkata. Each slot is a meal-time prompt at its time; nothing else is due.
const ms = (hhmm: string) => Date.parse(`2026-10-06T${hhmm}+05:30`);
const schedule = (...times: string[]): PushSchedule => ({
  v: 1,
  tz: 'Asia/Kolkata',
  lang: 'en',
  days: [],
  blocks: [],
  slots: times.map((at) => ({ id: `s${at.replace(':', '')}`, at, title: `At ${at}`, body: 'log or skip' })),
  breaks: null,
  water: null,
  mantras: [],
  quiet: { from: 0, to: 0 },
});

let kv: ReturnType<typeof memoryKV>;
let env: Parameters<typeof worker.fetch>[1];
let pushes: string[];
let pushStatus: number;
let onPush: (() => Promise<void>) | null;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  kv = memoryKV();
  env = {
    SUBS: kv as unknown as KVNamespace,
    USERS: memoryKV() as unknown as KVNamespace,
    VAPID_SUBJECT: 'mailto:x@example.com',
    VAPID_PUBLIC_KEY: 'pub',
    VAPID_PRIVATE_KEY: 'priv',
    ALLOWED_ORIGINS: 'https://sobat-a56c7.web.app',
    ADMIN_EMAIL: '',
    FIREBASE_API_KEY: 'key',
  };
  pushes = [];
  pushStatus = 201;
  onPush = null;
  vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
    if (url.startsWith(ENDPOINT)) {
      pushes.push(JSON.parse(init.body).title);
      const hook = onPush;
      onPush = null;
      if (hook) await hook();
      return new Response(null, { status: pushStatus });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function subscribe(at: string, s: PushSchedule): Promise<void> {
  vi.setSystemTime(ms(at));
  const res = await worker.fetch(new Request('https://relay.test/subscribe', { method: 'POST', body: JSON.stringify({ subscription: SUB, schedule: s }) }), env);
  expect(res.status).toBe(200);
}

async function cron(at: string): Promise<void> {
  vi.setSystemTime(ms(at));
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException() {} } as unknown as ExecutionContext;
  await worker.scheduled({} as ScheduledEvent, env, ctx);
  await Promise.all(pending);
}

const key = async () => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ENDPOINT)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const entry = async () => JSON.parse(kv.live.get(await key())!.value) as { schedule: PushSchedule; lastRunMs?: number };

describe('the reminder run and the uploads', () => {
  it('sends what fell due once, and an upload made after it, read from a minute-old copy, does not send it again', async () => {
    await subscribe('20:20:00', schedule('20:30'));
    const before = kv.copy();
    await cron('20:30:00.5');
    expect(pushes).toEqual(['At 20:30']);
    // The upload right after the reminder (a tick) reads the store as it was before the run wrote.
    kv.readsFrom(before);
    await subscribe('20:31:00', schedule('20:30', '20:45'));
    kv.readsFrom(null);
    await cron('20:35:00.5');
    await cron('20:40:00.5');
    expect(pushes).toEqual(['At 20:30']);
  });

  it('keeps an upload made while the run was sending', async () => {
    await subscribe('20:20:00', schedule('20:30', '20:33'));
    // The user ticks the item while its reminder is going out: the new schedule no longer has 20:33.
    onPush = () => subscribe('20:30:00.7', schedule('20:30'));
    await cron('20:30:00.5');
    expect((await entry()).schedule.slots.map((s) => s.at)).toEqual(['20:30']);
    await cron('20:35:00.5');
    expect(pushes).toEqual(['At 20:30']);
  });

  it('never writes the run time into the entry, and writes the run time only when something was sent, or once for a new phone', async () => {
    await subscribe('20:20:00', schedule('20:33'));
    expect(await entry()).not.toHaveProperty('lastRunMs');
    expect(kv.live.get(await key())!.ttl).toBe(TTL);
    await cron('20:25:00.5');
    expect(kv.live.get(`run:${await key()}`)).toEqual({ value: String(ms('20:25:00.5')), ttl: TTL });
    await cron('20:30:00.5');
    // A quiet run writes nothing.
    expect(kv.live.get(`run:${await key()}`)!.value).toBe(String(ms('20:25:00.5')));
    await cron('20:35:00.5');
    expect(kv.live.get(`run:${await key()}`)!.value).toBe(String(ms('20:35:00.5')));
    expect(await entry()).not.toHaveProperty('lastRunMs');
    expect(pushes).toEqual(['At 20:33']);
  });

  it('loses nothing due between the first run and the next upload of a new phone', async () => {
    await subscribe('20:20:00', schedule('20:27'));
    await cron('20:25:00.5');
    await subscribe('20:28:00', schedule('20:27', '21:00'));
    await cron('20:30:00.5');
    expect(pushes).toEqual(['At 20:27']);
  });

  it('carries on from the run time in an entry an older relay wrote, once, and loses nothing after the next upload', async () => {
    // Already sent at 20:18 by the older relay, which kept the run time in the entry.
    const k = await key();
    await kv.put(k, JSON.stringify({ sub: SUB, schedule: schedule('20:18', '20:24', '20:27'), updatedAt: ms('20:00:00'), lastRunMs: ms('20:20:00.5') }));
    await cron('20:25:00.5');
    expect(pushes).toEqual(['At 20:24']);
    // A quiet first run keeps its place too.
    await kv.put(k, JSON.stringify({ sub: SUB, schedule: schedule('20:18', '20:27'), updatedAt: ms('20:00:00'), lastRunMs: ms('20:20:00.5') }));
    kv.live.delete(`run:${k}`);
    pushes = [];
    await cron('20:25:00.5');
    expect(pushes).toEqual([]);
    await subscribe('20:28:00', schedule('20:18', '20:27'));
    await cron('20:30:00.5');
    expect(pushes).toEqual(['At 20:27']);
  });

  it('drops the entry and its run time when the push service says the address is gone, or the phone stops', async () => {
    const k = await key();
    await subscribe('20:20:00', schedule('20:24', '20:30'));
    await cron('20:25:00.5');
    expect(kv.live.has(`run:${k}`)).toBe(true);
    pushStatus = 410;
    await cron('20:30:00.5');
    expect([...kv.live.keys()]).toEqual([]);

    pushStatus = 201;
    await subscribe('20:31:00', schedule('20:33'));
    await cron('20:35:00.5');
    expect(kv.live.has(`run:${k}`)).toBe(true);
    const res = await worker.fetch(new Request('https://relay.test/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: ENDPOINT }) }), env);
    expect(res.status).toBe(200);
    expect([...kv.live.keys()]).toEqual([]);
  });
});

describe('/test', () => {
  it('says the app is working, by its name', async () => {
    const titles = async (lang: string) => {
      pushes = [];
      await worker.fetch(new Request('https://relay.test/test', { method: 'POST', body: JSON.stringify({ subscription: SUB, schedule: { lang } }) }), env);
      return pushes[0];
    };
    expect(await titles('en')).toBe('Dhyey is working');
    expect(await titles('mr')).toMatch(/^ध्येय/);
    expect(await titles('hi')).toMatch(/^ध्येय/);
  });
});
