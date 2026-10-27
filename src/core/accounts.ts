/**
 * On a shared device each account's data is kept apart. When another account
 * signs in, what is on the device is put aside under its owner, never thrown
 * away: with sync not set up, or with changes not yet saved, it is the only
 * copy. Whatever was put aside for the incoming account comes back.
 *
 * Only storage calls, in an order that leaves a consistent device if the app
 * is killed between any two: the outgoing data is aside before anything is
 * removed, the device's base goes before the incoming state arrives, and the
 * incoming state arrives in the same call as its owner tag.
 */

/** The part of AsyncStorage this needs. */
export type Store = {
  getAllKeys: () => Promise<readonly string[]>;
  multiGet: (keys: string[]) => Promise<readonly (readonly [string, string | null])[]>;
  multiSet: (pairs: [string, string][]) => Promise<void>;
  multiRemove: (keys: string[]) => Promise<void>;
};

/** Where the device keeps its state, the sync base saved beside it, and whose they are. */
export type StoreKeys = { state: string; base: string; owner: string };

const aside = (key: string, uid: string) => `${key}@${uid}`;

/** Where the state put aside for `uid` is kept. */
export const parkedKey = (stateKey: string, uid: string) => aside(stateKey, uid);

/**
 * Put the device's data aside for `from` and bring back what was aside for
 * `to`, or `empty`. `current` is the state as it is in memory, which may be
 * newer than the copy on disk. With `from` null the device holds nobody's
 * data and nothing goes aside. Resolves with what came back, as stored text.
 * Throws, with nothing removed, if the outgoing data could not be put aside.
 */
export async function switchStored(
  store: Store,
  keys: StoreKeys,
  o: { from: string | null; to: string; current: string; empty: string },
): Promise<{ state: string | null; base: string | null }> {
  const got = new Map(await store.multiGet([keys.base, aside(keys.state, o.to), aside(keys.base, o.to)]));
  const base = got.get(keys.base) ?? null;
  const state = got.get(aside(keys.state, o.to)) ?? null;
  const theirBase = state ? (got.get(aside(keys.base, o.to)) ?? null) : null;

  if (o.from !== null) {
    const out: [string, string][] = [[aside(keys.state, o.from), o.current]];
    if (base) out.push([aside(keys.base, o.from), base]);
    await store.multiSet(out);
  }

  // A base aside from an earlier switch would be paired with this newer state.
  await store.multiRemove(base || o.from === null ? [keys.base] : [keys.base, aside(keys.base, o.from)]);

  const incoming: [string, string][] = [
    [keys.state, state ?? o.empty],
    [keys.owner, o.to],
  ];
  if (theirBase) incoming.push([keys.base, theirBase]);
  await store.multiSet(incoming);

  await store.multiRemove([aside(keys.state, o.to), aside(keys.base, o.to)]);
  return { state, base: theirBase };
}

/**
 * The photos queued in every state put aside. They wait for their account to
 * come back, so a clean-up of files no queue knows must keep them.
 */
export async function parkedPhotoIds(store: Store, stateKey: string): Promise<string[]> {
  const prefix = aside(stateKey, '');
  const keys = (await store.getAllKeys()).filter((k) => k.startsWith(prefix));
  const ids: string[] = [];
  for (const [, text] of await store.multiGet(keys)) {
    try {
      const queue = (JSON.parse(text ?? '') as { photoQueue?: { id?: unknown }[] }).photoQueue;
      if (Array.isArray(queue)) for (const p of queue) if (typeof p?.id === 'string') ids.push(p.id);
    } catch {
      // A damaged copy holds nothing that can be read anyway.
    }
  }
  return ids;
}
