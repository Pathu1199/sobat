import { bearer, type Identity, type Verify } from './auth';
import { accessToken, Drive, DriveError, type DriveFile, type Fetch, type OAuthClient } from './drive';

/**
 * The account data routes. Each signed-in person has one file,
 * `<uid>.json`, in a folder of the app maker's Google Drive; the relay is the
 * only thing that can reach that Drive, and it lets a person at their own
 * file and the admin at all of them. A small directory in KV (one entry per
 * account) carries what the admin screen shows and the blocked flag.
 *
 *   GET    /data                 the file, or null            (owner)
 *   PUT    /data                 write the file               (owner)
 *   DELETE /data                 delete the file and entry    (owner)
 *   GET    /admin/users          every account                (admin)
 *   PATCH  /admin/users/:uid     { disabled }                 (admin)
 *   DELETE /admin/users/:uid     delete file and entry        (admin)
 *
 * A PUT carries the modifiedTime the device last saw. If the file has moved
 * on since, the write is refused with 409 and the current file is returned,
 * so the device can merge and try again instead of overwriting another
 * device's changes.
 */

export type UserMeta = {
  uid: string;
  email: string;
  name?: string;
  platform?: string;
  createdAt: string;
  lastSeen: string;
  disabled?: boolean;
  bytes?: number;
  modifiedTime?: string;
};

export type DataEnv = {
  users: KVNamespace;
  fetchFn: Fetch;
  verify: Verify;
  oauth: OAuthClient | null;
  adminEmail: string;
  folderName: string;
  maxBytes: number;
  now: () => number;
};

const TOKEN_KEY = '_drive_token';
const FOLDER_KEY = '_drive_folder';
const USER_PREFIX = 'user:';

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function fileName(uid: string): string {
  return `${uid}.json`;
}

/** A Drive client with a live token and the folder id, both cached in KV across requests. */
async function openDrive(env: DataEnv): Promise<{ drive: Drive; folderId: string }> {
  if (!env.oauth) throw new DriveError(503, 'drive not connected');
  let cached = await env.users.get<{ token: string; until: number }>(TOKEN_KEY, 'json');
  if (!cached || cached.until <= env.now()) {
    const t = await accessToken(env.oauth, env.fetchFn);
    cached = { token: t.token, until: env.now() + (t.expiresIn - 60) * 1000 };
    await env.users.put(TOKEN_KEY, JSON.stringify(cached), { expirationTtl: Math.max(60, t.expiresIn - 60) });
  }
  const drive = new Drive(cached.token, env.fetchFn);
  let folderId = await env.users.get(FOLDER_KEY);
  if (!folderId) {
    folderId = (await drive.findFolder(env.folderName)) ?? (await drive.createFolder(env.folderName));
    await env.users.put(FOLDER_KEY, folderId);
  }
  return { drive, folderId };
}

async function readMeta(env: DataEnv, uid: string): Promise<UserMeta | null> {
  return env.users.get<UserMeta>(USER_PREFIX + uid, 'json');
}

async function writeMeta(env: DataEnv, meta: UserMeta): Promise<void> {
  await env.users.put(USER_PREFIX + meta.uid, JSON.stringify(meta));
}

/** Touch the directory entry for this person: who they are, when they were last here, how big the file is. */
async function touch(env: DataEnv, id: Identity, extra: Partial<UserMeta>, file: DriveFile | null): Promise<UserMeta> {
  const prev = await readMeta(env, id.uid);
  const nowIso = new Date(env.now()).toISOString();
  const meta: UserMeta = {
    uid: id.uid,
    email: id.email,
    createdAt: prev?.createdAt ?? nowIso,
    disabled: prev?.disabled,
    name: extra.name ?? prev?.name,
    platform: extra.platform ?? prev?.platform,
    lastSeen: nowIso,
    bytes: file?.size !== undefined ? Number(file.size) : prev?.bytes,
    modifiedTime: file?.modifiedTime ?? prev?.modifiedTime,
  };
  await writeMeta(env, meta);
  return meta;
}

async function identify(req: Request, env: DataEnv): Promise<Identity | Response> {
  const token = bearer(req);
  if (!token) return json({ error: 'unauthorized' }, 401);
  const id = await env.verify(token);
  return id ?? json({ error: 'unauthorized' }, 401);
}

function isAdmin(id: Identity, env: DataEnv): boolean {
  return !!env.adminEmail && id.email === env.adminEmail.toLowerCase();
}

/** Handles a data route, or returns null when the path is not one of ours. */
export async function handleData(req: Request, env: DataEnv, pathname: string): Promise<Response | null> {
  const admin = /^\/admin\/users(?:\/([^/]+))?$/.exec(pathname);
  if (pathname !== '/data' && !admin) return null;

  try {
    const who = await identify(req, env);
    if (who instanceof Response) return who;

    // `return await`, not `return`: a promise handed straight back would reject outside this try.
    if (pathname === '/data') return await ownRoutes(req, env, who);

    if (!isAdmin(who, env)) return json({ error: 'forbidden' }, 403);
    return await adminRoutes(req, env, who, admin![1] ? decodeURIComponent(admin![1]) : null);
  } catch (e) {
    if (e instanceof DriveError) return json({ error: 'drive', status: e.status }, e.status === 503 ? 503 : 502);
    return json({ error: 'internal' }, 500);
  }
}

async function ownRoutes(req: Request, env: DataEnv, id: Identity): Promise<Response> {
  const meta = await readMeta(env, id.uid);
  if (meta?.disabled) return json({ error: 'blocked' }, 403);

  if (req.method === 'GET') {
    const { drive, folderId } = await openDrive(env);
    const file = await drive.findFile(folderId, fileName(id.uid));
    const state = file ? await drive.download(file.id) : null;
    await touch(env, id, {}, file);
    return json({ state, modifiedTime: file?.modifiedTime ?? null });
  }

  if (req.method === 'PUT') {
    if (Number(req.headers.get('Content-Length') ?? 0) > env.maxBytes) return json({ error: 'too large' }, 413);
    let body: { state?: unknown; baseModifiedTime?: unknown; name?: unknown; platform?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return json({ error: 'bad json' }, 400);
    }
    if (typeof body.state !== 'string' || body.state.length > env.maxBytes) return json({ error: 'bad state' }, 400);
    try {
      JSON.parse(body.state);
    } catch {
      return json({ error: 'bad state' }, 400);
    }
    const { drive, folderId } = await openDrive(env);
    const existing = await drive.findFile(folderId, fileName(id.uid));
    // The device says which version it built on. Anything newer means another
    // device wrote in between; hand back the current file to merge with.
    if (body.baseModifiedTime !== undefined) {
      const base = body.baseModifiedTime === null ? null : String(body.baseModifiedTime);
      const current = existing?.modifiedTime ?? null;
      if (base !== current) {
        const state = existing ? await drive.download(existing.id) : null;
        return json({ error: 'stale', state, modifiedTime: current }, 409);
      }
    }
    const file = await drive.upload(folderId, fileName(id.uid), body.state, existing);
    const sized: DriveFile = { ...file, size: file.size ?? String(body.state.length) };
    await touch(env, id, { name: typeof body.name === 'string' ? body.name : undefined, platform: typeof body.platform === 'string' ? body.platform : undefined }, sized);
    return json({ modifiedTime: file.modifiedTime });
  }

  if (req.method === 'DELETE') {
    const { drive, folderId } = await openDrive(env);
    const file = await drive.findFile(folderId, fileName(id.uid));
    if (file) await drive.delete(file.id);
    await env.users.delete(USER_PREFIX + id.uid);
    return json({ ok: true });
  }

  return json({ error: 'method' }, 405);
}

async function listUsers(env: DataEnv): Promise<UserMeta[]> {
  const out: UserMeta[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.users.list({ prefix: USER_PREFIX, cursor, limit: 1000 });
    cursor = page.list_complete ? undefined : page.cursor;
    for (const { name } of page.keys) {
      const m = await env.users.get<UserMeta>(name, 'json');
      if (m) out.push(m);
    }
  } while (cursor);
  return out.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

async function adminRoutes(req: Request, env: DataEnv, me: Identity, uid: string | null): Promise<Response> {
  if (uid === null) {
    if (req.method !== 'GET') return json({ error: 'method' }, 405);
    return json({ users: await listUsers(env) });
  }
  // The admin's own account is managed like anyone else's: from their own device, not from here.
  if (uid === me.uid) return json({ error: 'self' }, 400);
  const meta = await readMeta(env, uid);

  if (req.method === 'PATCH') {
    if (!meta) return json({ error: 'not found' }, 404);
    let body: { disabled?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return json({ error: 'bad json' }, 400);
    }
    if (typeof body.disabled !== 'boolean') return json({ error: 'disabled must be boolean' }, 400);
    await writeMeta(env, { ...meta, disabled: body.disabled });
    return json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { drive, folderId } = await openDrive(env);
    const file = await drive.findFile(folderId, fileName(uid));
    if (file) await drive.delete(file.id);
    await env.users.delete(USER_PREFIX + uid);
    return json({ ok: true });
  }

  return json({ error: 'method' }, 405);
}
