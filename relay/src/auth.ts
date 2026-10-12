/**
 * Who is calling. Every request to the data routes carries the Firebase ID
 * token the app holds for the signed-in person; the relay asks Firebase whom
 * it belongs to rather than verifying the signature itself, which keeps key
 * rotation Google's problem. Answers are remembered for a few minutes so a
 * burst of saves costs one lookup.
 */

export type Identity = { uid: string; email: string };
export type Verify = (idToken: string) => Promise<Identity | null>;

const LOOKUP = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup';
const CACHE_MS = 5 * 60 * 1000;
const CACHE_MAX = 500;

export function bearer(req: Request): string | null {
  const h = req.headers.get('Authorization') ?? '';
  const m = /^Bearer\s+(\S+)$/i.exec(h);
  return m ? m[1] : null;
}

/** A verifier with its own cache. `now` is injectable so expiry can be tested. */
export function makeVerifier(apiKey: string, fetchFn: typeof fetch = fetch, now: () => number = Date.now): Verify {
  const cache = new Map<string, { id: Identity; until: number }>();
  return async (idToken) => {
    if (!idToken) return null;
    const hit = cache.get(idToken);
    if (hit && hit.until > now()) return hit.id;
    let res: Response;
    try {
      res = await fetchFn(`${LOOKUP}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
    } catch {
      return null;
    }
    if (!res.ok) return null;
    const json = (await res.json().catch(() => ({}))) as { users?: { localId?: string; email?: string }[] };
    const u = json.users?.[0];
    if (!u?.localId) return null;
    const id: Identity = { uid: u.localId, email: (u.email ?? '').toLowerCase() };
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(idToken, { id, until: now() + CACHE_MS });
    return id;
  };
}
