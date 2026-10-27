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
  multiGet: (keys: string[]) => Promise<readonly (readonly [string, string | null])[]>;
  multiSet: (pairs: [string, string][]) => Promise<void>;
  multiRemove: (keys: string[]) => Promise<void>;
};

/** Where the device keeps its state, the sync base saved beside it, and whose they are. */
export type StoreKeys = { state: string; base: string; owner: string };

const aside = (key: string, uid: string) => `${key}@${uid}`;

/**
 * Put the device's data aside for `from` and bring back what was aside for
 * `to`, or `empty`. `current` is the state as it is in memory, which may be
 * newer than the copy on disk. Resolves with what came back, as stored text.
 * Throws, with nothing removed, if the outgoing data could not be put aside.
 */
export async function switchStored(
  store: Store,
  keys: StoreKeys,
  o: { from: string; to: string; current: string; empty: string },
): Promise<{ state: string | null; base: string | null }> {
  const got = new Map(await store.multiGet([keys.base, aside(keys.state, o.to), aside(keys.base, o.to)]));
  const base = got.get(keys.base) ?? null;
  const state = got.get(aside(keys.state, o.to)) ?? null;
  const theirBase = state ? (got.get(aside(keys.base, o.to)) ?? null) : null;

  const out: [string, string][] = [[aside(keys.state, o.from), o.current]];
  if (base) out.push([aside(keys.base, o.from), base]);
  await store.multiSet(out);

  // A base aside from an earlier switch would be paired with this newer state.
  await store.multiRemove(base ? [keys.base] : [keys.base, aside(keys.base, o.from)]);

  const incoming: [string, string][] = [
    [keys.state, state ?? o.empty],
    [keys.owner, o.to],
  ];
  if (theirBase) incoming.push([keys.base, theirBase]);
  await store.multiSet(incoming);

  await store.multiRemove([aside(keys.state, o.to), aside(keys.base, o.to)]);
  return { state, base: theirBase };
}
