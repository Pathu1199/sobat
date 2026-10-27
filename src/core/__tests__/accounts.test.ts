import { describe, expect, it } from 'vitest';
import { switchStored, type Store } from '../accounts';

const keys = { state: 'state', base: 'base', owner: 'owner' };
const EMPTY = '{"empty":true}';

/** AsyncStorage in memory, with every multiSet recorded and an optional failure. */
function memory(initial: Record<string, string>, failSet = false) {
  const data = new Map(Object.entries(initial));
  const sets: [string, string][][] = [];
  const store: Store = {
    multiGet: async (ks) => ks.map((k) => [k, data.get(k) ?? null] as const),
    multiSet: async (pairs) => {
      if (failSet) throw new Error('disk full');
      sets.push(pairs);
      for (const [k, v] of pairs) data.set(k, v);
    },
    multiRemove: async (ks) => {
      for (const k of ks) data.delete(k);
    },
  };
  return { store, data: () => Object.fromEntries(data), sets };
}

describe('switching accounts on a shared device', () => {
  it('puts the device\'s data aside with its base when another account signs in: nothing is thrown away', async () => {
    const m = memory({ state: 'A-on-disk', base: 'A-base', owner: 'a' });
    const back = await switchStored(m.store, keys, { from: 'a', to: 'b', current: 'A-now', empty: EMPTY });
    expect(back).toEqual({ state: null, base: null });
    expect(m.data()).toEqual({ state: EMPTY, owner: 'b', 'state@a': 'A-now', 'base@a': 'A-base' });
  });

  it('brings the first account\'s data and base back when it signs in again', async () => {
    const m = memory({ state: 'A-on-disk', base: 'A-base', owner: 'a' });
    await switchStored(m.store, keys, { from: 'a', to: 'b', current: 'A-now', empty: EMPTY });
    const back = await switchStored(m.store, keys, { from: 'b', to: 'a', current: 'B-now', empty: EMPTY });
    expect(back).toEqual({ state: 'A-now', base: 'A-base' });
    expect(m.data()).toEqual({ state: 'A-now', base: 'A-base', owner: 'a', 'state@b': 'B-now' });
  });

  it('writes the incoming state and its owner tag in one call, so a crash cannot leave one account\'s data tagged as another\'s', async () => {
    const m = memory({ state: 'A', owner: 'a' });
    await switchStored(m.store, keys, { from: 'a', to: 'b', current: 'A', empty: EMPTY });
    const write = m.sets.find((pairs) => pairs.some(([k]) => k === 'state'));
    expect(write).toContainEqual(['state', EMPTY]);
    expect(write).toContainEqual(['owner', 'b']);
  });

  it('does not keep an old base aside for an account whose state went aside without one', async () => {
    const m = memory({ state: 'A', owner: 'a', 'base@a': 'old-A-base' });
    await switchStored(m.store, keys, { from: 'a', to: 'b', current: 'A', empty: EMPTY });
    expect(m.data()['base@a']).toBeUndefined();
  });

  it('when the data cannot be put aside, raises the error and changes nothing', async () => {
    const m = memory({ state: 'A', base: 'A-base', owner: 'a' }, true);
    await expect(switchStored(m.store, keys, { from: 'a', to: 'b', current: 'A', empty: EMPTY })).rejects.toThrow('disk full');
    expect(m.data()).toEqual({ state: 'A', base: 'A-base', owner: 'a' });
  });
});
