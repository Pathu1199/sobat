import { beforeEach, describe, expect, it } from 'vitest';
import { handleData, type DataEnv, type UserMeta } from './data';

/** Enough of KV for the routes: get/put/delete/list with a prefix. */
function fakeKV(): KVNamespace & { store: Map<string, string> } {
  const store = new Map<string, string>();
  const kv = {
    store,
    async get(key: string, type?: string) {
      const v = store.get(key);
      if (v === undefined) return null;
      return type === 'json' ? JSON.parse(v) : v;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list(opts: { prefix?: string } = {}) {
      const keys = [...store.keys()].filter((k) => !opts.prefix || k.startsWith(opts.prefix)).map((name) => ({ name }));
      return { keys, list_complete: true, cursor: undefined, cacheStatus: null };
    },
  };
  return kv as unknown as KVNamespace & { store: Map<string, string> };
}

/** A Drive that lives in memory: one folder, files by name, with the real URL shapes. */
function fakeDrive() {
  const files = new Map<string, { id: string; name: string; content: string; modifiedTime: string }>();
  let nextId = 1;
  let clock = 1_700_000_000_000;
  const calls: string[] = [];
  const stamp = () => new Date((clock += 1000)).toISOString();
  const meta = (f: { id: string; name: string; content: string; modifiedTime: string }) => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime, size: String(f.content.length) });

  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${url.split('?')[0]}`);
    const ok = (body: unknown, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

    if (url.startsWith('https://oauth2.googleapis.com/token')) return ok({ access_token: 'tok', expires_in: 3600 });

    const u = new URL(url);
    if (u.pathname === '/drive/v3/files' && method === 'GET') {
      const q = u.searchParams.get('q') ?? '';
      if (q.includes('application/vnd.google-apps.folder')) return ok({ files: [{ id: 'folder', name: 'Sobat', modifiedTime: stamp() }] });
      const m = /name = '([^']+)'/.exec(q);
      if (m) {
        const f = files.get(m[1]);
        return ok({ files: f ? [meta(f)] : [] });
      }
      return ok({ files: [...files.values()].map(meta) });
    }
    if (u.pathname === '/drive/v3/files' && method === 'POST') return ok({ id: 'folder' });
    const media = /^\/drive\/v3\/files\/([^/]+)$/.exec(u.pathname);
    if (media && method === 'GET') {
      const f = [...files.values()].find((x) => x.id === media[1]);
      return f ? ok(f.content) : ok({ error: 'nf' }, 404);
    }
    if (media && method === 'DELETE') {
      for (const [k, f] of files) if (f.id === media[1]) files.delete(k);
      return new Response(null, { status: 204 });
    }
    if (u.pathname.startsWith('/upload/drive/v3/files')) {
      // The body opens with the boundary, so splitting on the boundaries that
      // follow a newline leaves the metadata part first and the file second.
      const body = String(init?.body);
      const parts = body.split(/\r\n--[^\r\n]+\r\n/);
      const metaPart = JSON.parse(parts[0].split('\r\n\r\n')[1]) as { name: string };
      const content = parts[1].split('\r\n\r\n')[1];
      const existingId = /files\/([^?]+)/.exec(u.pathname)?.[1];
      if (existingId && method === 'PATCH') {
        const f = [...files.values()].find((x) => x.id === existingId)!;
        f.content = content;
        f.modifiedTime = stamp();
        return ok(meta(f));
      }
      const f = { id: `f${nextId++}`, name: metaPart.name, content, modifiedTime: stamp() };
      files.set(f.name, f);
      return ok(meta(f));
    }
    return ok({ error: 'unhandled ' + url }, 500);
  }) as typeof fetch;

  return { fetchFn, files, calls };
}

const TOKENS: Record<string, { uid: string; email: string }> = {
  'tok-a': { uid: 'A', email: 'a@x.com' },
  'tok-b': { uid: 'B', email: 'b@x.com' },
  'tok-admin': { uid: 'ADM', email: 'admin@x.com' },
};

function makeEnv(drive = fakeDrive(), overrides: Partial<DataEnv> = {}): DataEnv & { kv: ReturnType<typeof fakeKV>; drive: typeof drive } {
  const kv = fakeKV();
  let t = 1_700_000_000_000;
  const env: DataEnv = {
    users: kv,
    fetchFn: drive.fetchFn,
    verify: async (tok) => TOKENS[tok] ?? null,
    oauth: { clientId: 'id', clientSecret: 'secret', refreshToken: 'rt' },
    adminEmail: 'Admin@x.com',
    folderName: 'Sobat',
    maxBytes: 1000,
    now: () => (t += 10),
    ...overrides,
  };
  return { ...env, kv, drive };
}

function req(method: string, path: string, token?: string, body?: unknown): Request {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    const text = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = String(text.length);
    init.body = text;
  }
  return new Request(`https://relay.test${path}`, init);
}

const state = (n: number) => JSON.stringify({ version: 5, profile: { onboarded: true }, meals: Array.from({ length: n }, (_, i) => ({ id: `m${i}` })) });

describe('routing', () => {
  it('ignores paths that are not its own', async () => {
    expect(await handleData(req('GET', '/subscribe'), makeEnv(), '/subscribe')).toBeNull();
  });

  it('refuses without a token, and with one Firebase does not know', async () => {
    const env = makeEnv();
    expect((await handleData(req('GET', '/data'), env, '/data'))!.status).toBe(401);
    expect((await handleData(req('GET', '/data', 'nope'), env, '/data'))!.status).toBe(401);
  });

  it('says so when Drive has not been connected yet', async () => {
    const env = makeEnv(fakeDrive(), { oauth: null });
    const res = (await handleData(req('GET', '/data', 'tok-a'), env, '/data'))!;
    expect(res.status).toBe(503);
  });
});

describe('a person and their file', () => {
  let env: ReturnType<typeof makeEnv>;
  beforeEach(() => {
    env = makeEnv();
  });

  it('starts with no file and a directory entry', async () => {
    const res = (await handleData(req('GET', '/data', 'tok-a'), env, '/data'))!;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ state: null, modifiedTime: null });
    const meta = JSON.parse(env.kv.store.get('user:A')!) as UserMeta;
    expect(meta.email).toBe('a@x.com');
    expect(meta.createdAt).toBeTruthy();
  });

  it('creates the file on the first PUT and reads it back', async () => {
    const put = (await handleData(req('PUT', '/data', 'tok-a', { state: state(2), baseModifiedTime: null, platform: 'web', name: 'Ann' }), env, '/data'))!;
    expect(put.status).toBe(200);
    const { modifiedTime } = (await put.json()) as { modifiedTime: string };
    expect(modifiedTime).toBeTruthy();
    expect(env.drive.files.get('A.json')?.content).toBe(state(2));

    const get = (await handleData(req('GET', '/data', 'tok-a'), env, '/data'))!;
    expect(await get.json()).toEqual({ state: state(2), modifiedTime });
    const meta = JSON.parse(env.kv.store.get('user:A')!) as UserMeta;
    expect(meta.name).toBe('Ann');
    expect(meta.platform).toBe('web');
    expect(meta.bytes).toBe(state(2).length);
  });

  it('refuses a write built on a version the file has moved past, and hands back the current one', async () => {
    const first = (await handleData(req('PUT', '/data', 'tok-a', { state: state(1), baseModifiedTime: null }), env, '/data'))!;
    const { modifiedTime: v1 } = (await first.json()) as { modifiedTime: string };
    // Another device writes.
    await handleData(req('PUT', '/data', 'tok-a', { state: state(3), baseModifiedTime: v1 }), env, '/data');
    // This device still thinks v1 is current.
    const stale = (await handleData(req('PUT', '/data', 'tok-a', { state: state(2), baseModifiedTime: v1 }), env, '/data'))!;
    expect(stale.status).toBe(409);
    const body = (await stale.json()) as { error: string; state: string; modifiedTime: string };
    expect(body.error).toBe('stale');
    expect(body.state).toBe(state(3));
    expect(body.modifiedTime).not.toBe(v1);
    // The file was not overwritten.
    expect(env.drive.files.get('A.json')?.content).toBe(state(3));
  });

  it('also refuses "no file yet" when another device has since created one', async () => {
    await handleData(req('PUT', '/data', 'tok-a', { state: state(1), baseModifiedTime: null }), env, '/data');
    const res = (await handleData(req('PUT', '/data', 'tok-a', { state: state(2), baseModifiedTime: null }), env, '/data'))!;
    expect(res.status).toBe(409);
  });

  it('replaces in place when the base matches', async () => {
    const first = (await handleData(req('PUT', '/data', 'tok-a', { state: state(1), baseModifiedTime: null }), env, '/data'))!;
    const { modifiedTime } = (await first.json()) as { modifiedTime: string };
    const second = (await handleData(req('PUT', '/data', 'tok-a', { state: state(2), baseModifiedTime: modifiedTime }), env, '/data'))!;
    expect(second.status).toBe(200);
    expect(env.drive.files.size).toBe(1);
    expect(env.drive.calls.filter((c) => c.startsWith('PATCH'))).toHaveLength(1);
  });

  it('rejects a body that is not a JSON state, and one that is too large', async () => {
    expect((await handleData(req('PUT', '/data', 'tok-a', { state: 'not json', baseModifiedTime: null }), env, '/data'))!.status).toBe(400);
    expect((await handleData(req('PUT', '/data', 'tok-a', { state: 42, baseModifiedTime: null }), env, '/data'))!.status).toBe(400);
    const big = JSON.stringify({ x: 'y'.repeat(2000) });
    expect((await handleData(req('PUT', '/data', 'tok-a', { state: big, baseModifiedTime: null }), env, '/data'))!.status).toBe(413);
  });

  it('only ever shows a person their own file', async () => {
    await handleData(req('PUT', '/data', 'tok-a', { state: state(5), baseModifiedTime: null }), env, '/data');
    const b = (await handleData(req('GET', '/data', 'tok-b'), env, '/data'))!;
    expect(await b.json()).toEqual({ state: null, modifiedTime: null });
  });

  it('deletes the file and the directory entry', async () => {
    await handleData(req('PUT', '/data', 'tok-a', { state: state(5), baseModifiedTime: null }), env, '/data');
    const del = (await handleData(req('DELETE', '/data', 'tok-a'), env, '/data'))!;
    expect(del.status).toBe(200);
    expect(env.drive.files.size).toBe(0);
    expect(env.kv.store.has('user:A')).toBe(false);
  });

  it('fetches a Drive token once and reuses it', async () => {
    await handleData(req('GET', '/data', 'tok-a'), env, '/data');
    await handleData(req('GET', '/data', 'tok-a'), env, '/data');
    await handleData(req('GET', '/data', 'tok-b'), env, '/data');
    expect(env.drive.calls.filter((c) => c.includes('oauth2.googleapis.com/token'))).toHaveLength(1);
  });
});

describe('a blocked person', () => {
  it('can neither read nor write, and is told why', async () => {
    const env = makeEnv();
    await handleData(req('PUT', '/data', 'tok-a', { state: state(1), baseModifiedTime: null }), env, '/data');
    await handleData(req('PATCH', '/admin/users/A', 'tok-admin', { disabled: true }), env, '/admin/users/A');
    const get = (await handleData(req('GET', '/data', 'tok-a'), env, '/data'))!;
    expect(get.status).toBe(403);
    expect(await get.json()).toEqual({ error: 'blocked' });
    const put = (await handleData(req('PUT', '/data', 'tok-a', { state: state(2), baseModifiedTime: null }), env, '/data'))!;
    expect(put.status).toBe(403);
    expect(env.drive.files.get('A.json')?.content).toBe(state(1));
  });
});

describe('the admin', () => {
  let env: ReturnType<typeof makeEnv>;
  beforeEach(async () => {
    env = makeEnv();
    await handleData(req('PUT', '/data', 'tok-a', { state: state(1), baseModifiedTime: null, name: 'Ann' }), env, '/data');
    await handleData(req('PUT', '/data', 'tok-b', { state: state(2), baseModifiedTime: null, name: 'Bob' }), env, '/data');
  });

  it('is nobody else', async () => {
    expect((await handleData(req('GET', '/admin/users', 'tok-a'), env, '/admin/users'))!.status).toBe(403);
    expect((await handleData(req('PATCH', '/admin/users/B', 'tok-a', { disabled: true }), env, '/admin/users/B'))!.status).toBe(403);
    expect((await handleData(req('DELETE', '/admin/users/B', 'tok-a'), env, '/admin/users/B'))!.status).toBe(403);
  });

  it('sees every account, most recent first', async () => {
    const res = (await handleData(req('GET', '/admin/users', 'tok-admin'), env, '/admin/users'))!;
    expect(res.status).toBe(200);
    const { users } = (await res.json()) as { users: UserMeta[] };
    expect(users.map((u) => u.name)).toEqual(['Bob', 'Ann']);
    expect(users[0].bytes).toBe(state(2).length);
  });

  it('blocks and unblocks', async () => {
    expect((await handleData(req('PATCH', '/admin/users/B', 'tok-admin', { disabled: true }), env, '/admin/users/B'))!.status).toBe(200);
    expect((await handleData(req('GET', '/data', 'tok-b'), env, '/data'))!.status).toBe(403);
    expect((await handleData(req('PATCH', '/admin/users/B', 'tok-admin', { disabled: false }), env, '/admin/users/B'))!.status).toBe(200);
    expect((await handleData(req('GET', '/data', 'tok-b'), env, '/data'))!.status).toBe(200);
  });

  it('refuses a non-boolean and an unknown account', async () => {
    expect((await handleData(req('PATCH', '/admin/users/B', 'tok-admin', { disabled: 'yes' }), env, '/admin/users/B'))!.status).toBe(400);
    expect((await handleData(req('PATCH', '/admin/users/ZZ', 'tok-admin', { disabled: true }), env, '/admin/users/ZZ'))!.status).toBe(404);
  });

  it('deletes an account\'s file and entry', async () => {
    expect((await handleData(req('DELETE', '/admin/users/B', 'tok-admin'), env, '/admin/users/B'))!.status).toBe(200);
    expect(env.drive.files.has('B.json')).toBe(false);
    expect(env.drive.files.has('A.json')).toBe(true);
    expect(env.kv.store.has('user:B')).toBe(false);
  });

  it('cannot block or delete their own account from here', async () => {
    await handleData(req('PUT', '/data', 'tok-admin', { state: state(1), baseModifiedTime: null }), env, '/data');
    expect((await handleData(req('PATCH', '/admin/users/ADM', 'tok-admin', { disabled: true }), env, '/admin/users/ADM'))!.status).toBe(400);
    expect((await handleData(req('DELETE', '/admin/users/ADM', 'tok-admin'), env, '/admin/users/ADM'))!.status).toBe(400);
  });
});
