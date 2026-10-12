import Constants from 'expo-constants';

/**
 * The relay's account-data routes, as plain fetch calls. The relay keeps each
 * person's file in the app maker's Google Drive and is the only thing that
 * can reach it; the app never sees a Drive credential. Every call carries the
 * signed-in person's Firebase token, and the relay hands back only that
 * person's own file (or, for the admin, the list of accounts).
 */

export type RemoteFile = { state: string | null; modifiedTime: string | null };
export type PutResult = { ok: true; modifiedTime: string } | { ok: false; stale: RemoteFile };

export type CloudUser = {
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

export class CloudError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(`${code} (HTTP ${status})`);
  }
}

type Fetch = typeof fetch;

/** The relay is one worker; the reminders already live at this address. */
export function relayUrl(): string {
  const extra = (Constants.expoConfig?.extra as { push?: { relayUrl?: string } } | undefined)?.push;
  return (extra?.relayUrl ?? '').replace(/\/$/, '');
}

export function cloudConfigured(): boolean {
  return relayUrl().length > 0;
}

async function call(path: string, token: string, init: RequestInit, fetchFn: Fetch): Promise<Response> {
  const res = await fetchFn(`${relayUrl()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) },
  });
  if (res.ok || res.status === 409) return res;
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  throw new CloudError(res.status, body.error ?? `http_${res.status}`);
}

export async function getData(token: string, fetchFn: Fetch = fetch): Promise<RemoteFile> {
  const res = await call('/data', token, { method: 'GET' }, fetchFn);
  return (await res.json()) as RemoteFile;
}

/**
 * Write the file. `baseModifiedTime` is the version this device built on
 * (null when it believes there is no file yet); if the file has moved past
 * it, the relay refuses and returns the current file to merge with.
 */
export async function putData(
  token: string,
  state: string,
  baseModifiedTime: string | null,
  extra: { name?: string; platform?: string } = {},
  fetchFn: Fetch = fetch,
): Promise<PutResult> {
  const res = await call('/data', token, { method: 'PUT', body: JSON.stringify({ state, baseModifiedTime, ...extra }) }, fetchFn);
  const json = (await res.json()) as { modifiedTime: string | null; state?: string | null };
  if (res.status === 409) return { ok: false, stale: { state: json.state ?? null, modifiedTime: json.modifiedTime } };
  return { ok: true, modifiedTime: String(json.modifiedTime) };
}

export async function deleteData(token: string, fetchFn: Fetch = fetch): Promise<void> {
  await call('/data', token, { method: 'DELETE' }, fetchFn);
}

/** The admin's view and switches. The relay checks the token's email, not the app. */
export const adminApi = {
  list: async (token: string, fetchFn: Fetch = fetch): Promise<CloudUser[]> => {
    const res = await call('/admin/users', token, { method: 'GET' }, fetchFn);
    return ((await res.json()) as { users: CloudUser[] }).users;
  },
  setBlocked: async (token: string, uid: string, disabled: boolean, fetchFn: Fetch = fetch): Promise<void> => {
    await call(`/admin/users/${encodeURIComponent(uid)}`, token, { method: 'PATCH', body: JSON.stringify({ disabled }) }, fetchFn);
  },
  remove: async (token: string, uid: string, fetchFn: Fetch = fetch): Promise<void> => {
    await call(`/admin/users/${encodeURIComponent(uid)}`, token, { method: 'DELETE' }, fetchFn);
  },
};
