import { buildPushPayload, type PushSubscription, type VapidKeys } from '@block65/webcrypto-web-push';
import { makeVerifier, type Verify } from './auth';
import { handleData, type DataEnv } from './data';
import { afterRun, dueBetween, validSchedule, type PushSchedule } from './schedule';

/**
 * Sobat's relay: one Worker, two jobs.
 *
 * Reminders — it stores, per phone, the push address Apple or Google issued
 * and the reminder times the app uploaded, and every five minutes it sends
 * what is due. Only times and the words to show travel, "Day so far" among
 * them; see `schedule.ts`.
 *
 * Account data — it keeps each signed-in person's logs as one file in the
 * app maker's Google Drive, and is the only thing that can reach that
 * Drive. A person reaches their own file, the admin reaches all of them.
 * See `data.ts`.
 */

export interface Env {
  SUBS: KVNamespace;
  USERS: KVNamespace;
  VAPID_SUBJECT: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  ALLOWED_ORIGINS: string;
  ADMIN_EMAIL: string;
  FIREBASE_API_KEY: string;
  DRIVE_FOLDER?: string;
  MAX_STATE_BYTES?: string;
  // Secrets: set with `wrangler secret put`.
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REFRESH_TOKEN?: string;
}

type Record_ = { sub: PushSubscription; schedule: PushSchedule; updatedAt: number; lastRunMs: number };

const MAX_BODY = 64 * 1024;

function cors(env: Env, req: Request): HeadersInit {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

async function keyFor(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(body: unknown, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function withHeaders(res: Response, headers: HeadersInit): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(headers)) out.headers.set(k, v);
  return out;
}

function validSubscription(s: unknown): s is PushSubscription {
  if (typeof s !== 'object' || s === null) return false;
  const o = s as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  return typeof o.endpoint === 'string' && /^https:\/\//.test(o.endpoint) && typeof o.keys?.p256dh === 'string' && typeof o.keys?.auth === 'string';
}

async function send(env: Env, sub: PushSubscription, title: string, body: string, url: string, tag: string): Promise<'ok' | 'gone' | 'fail'> {
  const vapid: VapidKeys = { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  try {
    const payload = await buildPushPayload({ data: JSON.stringify({ title, body, url, tag }), options: { ttl: 15 * 60, urgency: 'high' } }, sub, vapid);
    const res = await fetch(sub.endpoint, payload);
    if (res.status === 404 || res.status === 410) return 'gone';
    return res.ok ? 'ok' : 'fail';
  } catch {
    return 'fail';
  }
}

// One verifier per isolate, so its cache outlives a single request.
let verifier: Verify | undefined;
let verifierKey = '';

function driveConnected(env: Env): boolean {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN);
}

function dataEnv(env: Env): DataEnv {
  if (!verifier || verifierKey !== env.FIREBASE_API_KEY) {
    verifier = makeVerifier(env.FIREBASE_API_KEY);
    verifierKey = env.FIREBASE_API_KEY;
  }
  return {
    users: env.USERS,
    fetchFn: fetch,
    verify: verifier,
    oauth: driveConnected(env) ? { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET!, refreshToken: env.GOOGLE_REFRESH_TOKEN! } : null,
    adminEmail: env.ADMIN_EMAIL ?? '',
    folderName: env.DRIVE_FOLDER || 'Sobat',
    maxBytes: Number(env.MAX_STATE_BYTES) || 8 * 1024 * 1024,
    now: Date.now,
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const h = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/') {
      return json({ ok: true, service: 'sobat-relay', drive: driveConnected(env), auth: !!env.FIREBASE_API_KEY }, 200, h);
    }

    // Account data lives behind a sign-in; see data.ts.
    const data = await handleData(req, dataEnv(env), url.pathname);
    if (data) return withHeaders(data, h);

    if (req.method !== 'POST') return json({ error: 'method' }, 405, h);
    if (Number(req.headers.get('Content-Length') ?? 0) > MAX_BODY) return json({ error: 'too large' }, 413, h);

    let body: { subscription?: unknown; schedule?: unknown; endpoint?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return json({ error: 'bad json' }, 400, h);
    }

    if (url.pathname === '/subscribe') {
      if (!validSubscription(body.subscription) || !validSchedule(body.schedule)) return json({ error: 'bad subscription or schedule' }, 400, h);
      const key = await keyFor(body.subscription.endpoint);
      const prev = (await env.SUBS.get<Record_>(key, 'json')) ?? null;
      const rec: Record_ = { sub: body.subscription, schedule: body.schedule, updatedAt: Date.now(), lastRunMs: prev?.lastRunMs ?? Date.now() };
      // Forgotten phones fall out by themselves after 60 days without a sync.
      await env.SUBS.put(key, JSON.stringify(rec), { expirationTtl: 60 * 86400 });
      return json({ ok: true }, 200, h);
    }

    if (url.pathname === '/unsubscribe') {
      if (typeof body.endpoint !== 'string') return json({ error: 'endpoint' }, 400, h);
      await env.SUBS.delete(await keyFor(body.endpoint));
      return json({ ok: true }, 200, h);
    }

    if (url.pathname === '/test') {
      if (!validSubscription(body.subscription)) return json({ error: 'bad subscription' }, 400, h);
      const lang = typeof body.schedule === 'object' && body.schedule && 'lang' in body.schedule ? String((body.schedule as { lang: string }).lang) : 'en';
      const text = lang === 'mr' ? ['सोबत चालू आहे', 'अ‍ॅप बंद असतानाही आठवणी अशा येतील.'] : lang === 'hi' ? ['सोबत चल रहा है', 'ऐप बंद होने पर भी याद दिलाने वाले संदेश ऐसे आएँगे.'] : ['Sobat is working', 'Reminders will arrive like this even with the app closed.'];
      const r = await send(env, body.subscription, text[0], text[1], '/', 'sobat-test');
      return json({ ok: r === 'ok', result: r }, r === 'ok' ? 200 : 502, h);
    }

    return json({ error: 'not found' }, 404, h);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const now = Date.now();
    let cursor: string | undefined;
    do {
      const page = await env.SUBS.list({ cursor, limit: 100 });
      cursor = page.list_complete ? undefined : page.cursor;
      for (const { name } of page.keys) {
        ctx.waitUntil(
          (async () => {
            const rec = await env.SUBS.get<Record_>(name, 'json');
            if (!rec) return;
            const due = dueBetween(rec.schedule, rec.lastRunMs, now);
            let gone = false;
            for (const r of due) {
              const res = await send(env, rec.sub, r.title, r.body, r.url, r.key);
              if (res === 'gone') gone = true;
            }
            const next = afterRun(due.length, gone);
            if (next === 'delete') await env.SUBS.delete(name);
            else if (next === 'save') await env.SUBS.put(name, JSON.stringify({ ...rec, lastRunMs: now }), { expirationTtl: 60 * 86400 });
          })(),
        );
      }
    } while (cursor);
  },
};
