import { describe, expect, it } from 'vitest';
import { EMPTY_STATE, STATE_VERSION } from '../../store/defaults';
import { applyCloud, bindStart, encodeSavedBase, forCloud, fromNewerApp, inAccount, isPristine, landMerge, merge3, RoundStop, syncRound, type AccountFile, type RoundIO, readSavedBase, sameCloud, signOutPlan, stable, type CloudState } from '../sync';
import type { AppState, Meal } from '../types';
import type { DayMenu } from '../menu';

const meal = (id: string, at: string, kcal = 300): Meal => ({
  id,
  at,
  date: at.slice(0, 10),
  type: 'lunch',
  items: [],
  kcal,
  protein: 10,
});

/** A used device: onboarded, with the meals given. */
function used(meals: Meal[], extra: Partial<AppState> = {}): AppState {
  return { ...EMPTY_STATE, profile: { ...EMPTY_STATE.profile, name: 'V', onboarded: true }, meals, ...extra };
}

const cloudOf = (s: AppState): CloudState => forCloud(s);

describe('forCloud / applyCloud', () => {
  it('strips the caches and the machine settings', () => {
    const s = used([meal('m1', '2026-10-12T08:00:00.000Z')], {
      chat: [{ id: 'c', role: 'user', text: 'hi', at: '' }],
      usage: [{ date: '2026-10-12', hour: 9, activeMinutes: 10 }],
      settings: { ...EMPTY_STATE.settings, ollamaUrl: 'http://pc:11434', textScale: 1.2, waterGoalMl: 2500 },
    });
    const c = cloudOf(s) as unknown as Record<string, unknown>;
    expect(c.chat).toBeUndefined();
    expect(c.usage).toBeUndefined();
    expect(c.photoQueue).toBeUndefined();
    expect(c.tips).toBeUndefined();
    const settings = c.settings as Record<string, unknown>;
    expect(settings.ollamaUrl).toBeUndefined();
    expect(settings.textScale).toBeUndefined();
    expect(settings.waterGoalMl).toBe(2500);
  });

  it('puts a merged file back without touching this device\'s caches or machine settings', () => {
    const local = used([], {
      chat: [{ id: 'c', role: 'user', text: 'hi', at: '' }],
      settings: { ...EMPTY_STATE.settings, ollamaUrl: 'http://phone-side', appearance: 'light', waterGoalMl: 2000 },
    });
    const cloud = cloudOf(used([meal('m9', '2026-10-12T08:00:00.000Z')], { settings: { ...EMPTY_STATE.settings, waterGoalMl: 3500 } }));
    const next = applyCloud(local, cloud);
    expect(next.meals.map((m) => m.id)).toEqual(['m9']);
    expect(next.chat).toHaveLength(1);
    expect(next.settings.ollamaUrl).toBe('http://phone-side');
    expect(next.settings.appearance).toBe('light');
    expect(next.settings.waterGoalMl).toBe(3500);
  });
});

describe('the days this device was opened on', () => {
  it('stay on this device: never uploaded, and kept through a landing whatever the file holds', () => {
    const local = used([], { openedDates: ['2026-10-26', '2026-10-27'] });
    expect(cloudOf(local)).not.toHaveProperty('openedDates');
    const remote = cloudOf(used([meal('m9', '2026-10-12T08:00:00.000Z')]));
    expect(applyCloud(local, remote).openedDates).toEqual(['2026-10-26', '2026-10-27']);
    expect(applyCloud(local, { ...remote, openedDates: ['2026-01-01'] } as CloudState).openedDates).toEqual(['2026-10-26', '2026-10-27']);
    const landed = landMerge(local, cloudOf(local), remote);
    expect(landed.openedDates).toEqual(['2026-10-26', '2026-10-27']);
    expect(landed.meals.map((m) => m.id)).toEqual(['m9']);
  });
});

describe('stable', () => {
  it('reads the same whatever the key order', () => {
    expect(stable({ b: 1, a: { d: 2, c: 3 } })).toBe(stable({ a: { c: 3, d: 2 }, b: 1 }));
    expect(stable([{ z: 1, y: 2 }])).toBe(stable([{ y: 2, z: 1 }]));
  });
});

describe('first sync (no base)', () => {
  const remote = cloudOf(used([meal('r1', '2026-10-10T12:00:00.000Z')], { profile: { ...EMPTY_STATE.profile, name: 'Account', onboarded: true, weightKg: 95 } }));

  it('a never-used device takes the account wholesale', () => {
    const fresh = cloudOf({ ...EMPTY_STATE });
    expect(isPristine(fresh)).toBe(true);
    const out = merge3(null, fresh, remote);
    expect(out).toBe(remote);
  });

  it('a used device keeps its own records and the account\'s, and its own profile', () => {
    const local = cloudOf(used([meal('l1', '2026-10-11T12:00:00.000Z')], { profile: { ...EMPTY_STATE.profile, name: 'Device', onboarded: true } }));
    const out = merge3(null, local, remote);
    expect(out.meals.map((m) => m.id)).toEqual(['r1', 'l1']);
    expect(out.profile.name).toBe('Device');
  });

  it('with no base, a record on both sides comes from the device', () => {
    const local = cloudOf(used([meal('x', '2026-10-11T12:00:00.000Z', 500)]));
    const rem = cloudOf(used([meal('x', '2026-10-11T12:00:00.000Z', 700)]));
    expect(merge3(null, local, rem).meals[0].kcal).toBe(500);
  });

  it('with no base, a null on the device yields to the account', () => {
    const local = cloudOf(used([], { weekPlan: null }));
    const rem = cloudOf(used([], { weekPlan: { days: [] } as never }));
    expect(merge3(null, local, rem).weekPlan).toEqual({ days: [] });
  });
});

describe('three-way merge of records', () => {
  const a = meal('a', '2026-10-10T08:00:00.000Z');
  const b = meal('b', '2026-10-10T13:00:00.000Z');
  const base = cloudOf(used([a, b]));

  it('an edit made here is kept; an edit made elsewhere is taken', () => {
    const local = cloudOf(used([{ ...a, kcal: 999 }, b]));
    const remote = cloudOf(used([a, { ...b, kcal: 111 }]));
    const out = merge3(base, local, remote);
    expect(out.meals.find((m) => m.id === 'a')?.kcal).toBe(999);
    expect(out.meals.find((m) => m.id === 'b')?.kcal).toBe(111);
  });

  it('both edited the same record: this device wins', () => {
    const local = cloudOf(used([{ ...a, kcal: 1 }, b]));
    const remote = cloudOf(used([{ ...a, kcal: 2 }, b]));
    expect(merge3(base, local, remote).meals.find((m) => m.id === 'a')?.kcal).toBe(1);
  });

  it('a record added on each side ends up on both, in time order', () => {
    const c = meal('c', '2026-10-10T10:00:00.000Z');
    const d = meal('d', '2026-10-10T20:00:00.000Z');
    const local = cloudOf(used([a, b, d]));
    const remote = cloudOf(used([a, b, c]));
    expect(merge3(base, local, remote).meals.map((m) => m.id)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('deleted here, untouched there: stays deleted', () => {
    const local = cloudOf(used([b]));
    const remote = cloudOf(used([a, b]));
    expect(merge3(base, local, remote).meals.map((m) => m.id)).toEqual(['b']);
  });

  it('deleted there, untouched here: stays deleted', () => {
    const local = cloudOf(used([a, b]));
    const remote = cloudOf(used([b]));
    expect(merge3(base, local, remote).meals.map((m) => m.id)).toEqual(['b']);
  });

  it('deleted here but edited there: the deletion made here wins', () => {
    const local = cloudOf(used([b]));
    const remote = cloudOf(used([{ ...a, kcal: 5 }, b]));
    expect(merge3(base, local, remote).meals.map((m) => m.id)).toEqual(['b']);
  });

  it('nothing changed anywhere: the file is unchanged', () => {
    const out = merge3(base, cloudOf(used([a, b])), cloudOf(used([a, b])));
    expect(sameCloud(out, base)).toBe(true);
  });

  it('records keyed by date merge too', () => {
    const basew = cloudOf(used([], { weights: [{ date: '2026-10-01', kg: 100 }] }));
    const local = cloudOf(used([], { weights: [{ date: '2026-10-01', kg: 100 }, { date: '2026-10-08', kg: 99 }] }));
    const remote = cloudOf(used([], { weights: [{ date: '2026-10-01', kg: 100.5 }] }));
    const out = merge3(basew, local, remote);
    expect(out.weights).toEqual([
      { date: '2026-10-01', kg: 100.5 },
      { date: '2026-10-08', kg: 99 },
    ]);
  });
});

describe('three-way merge of single values', () => {
  const base = cloudOf(used([], { settings: { ...EMPTY_STATE.settings, waterGoalMl: 3000 } }));

  it('a setting changed elsewhere arrives; one changed here is kept', () => {
    const local = cloudOf(used([], { settings: { ...EMPTY_STATE.settings, waterGoalMl: 3000, bottleMl: 750 } }));
    const remote = cloudOf(used([], { settings: { ...EMPTY_STATE.settings, waterGoalMl: 2500 } }));
    // Settings is one value: the side that changed it wins whole.
    expect(merge3(base, local, remote).settings.bottleMl).toBe(750);
    expect(merge3(base, cloudOf(used([])), remote).settings.waterGoalMl).toBe(2500);
  });

  it('profile edited here beats the account\'s older copy', () => {
    const local = cloudOf(used([], { profile: { ...EMPTY_STATE.profile, onboarded: true, weightKg: 97 } }));
    const remote = cloudOf(used([], { profile: { ...EMPTY_STATE.profile, onboarded: true, weightKg: 98 } }));
    const b = cloudOf(used([], { profile: { ...EMPTY_STATE.profile, onboarded: true, weightKg: 98 } }));
    expect(merge3(b, local, remote).profile.weightKg).toBe(97);
  });

  it('the newer store version wins', () => {
    const local = { ...cloudOf(used([])), version: 5 };
    const remote = { ...cloudOf(used([])), version: 7 };
    expect(merge3(base, local, remote).version).toBe(7);
  });
});

describe('the day the store moved to this version', () => {
  const P = '2026-10-24';
  const P3 = '2026-10-27';
  const device = (autoFillFrom: string | undefined, profile: Partial<AppState['profile']> = {}) =>
    cloudOf(used([], { profile: { ...EMPTY_STATE.profile, name: 'V', onboarded: true, ...(autoFillFrom ? { autoFillFrom } : {}), ...profile } }));

  it('is the later of the two devices\' days, whichever device merges and whichever changed the profile, so a lived day is never filled in again', () => {
    const b = device(P);
    // This device moved on P and has changed the goal since; the other moved on P+3.
    const here = device(P, { goalWeightKg: 65 });
    const there = device(P3);
    expect(merge3(b, here, there).profile).toMatchObject({ goalWeightKg: 65, autoFillFrom: P3 });
    expect(merge3(b, there, here).profile.autoFillFrom).toBe(P3);
    expect(merge3(null, here, there).profile.autoFillFrom).toBe(P3);
    expect(merge3(null, there, here).profile.autoFillFrom).toBe(P3);
    // Merged on either device, then again, both end on the same day.
    const once = merge3(b, here, there);
    expect(merge3(once, there, once).profile.autoFillFrom).toBe(P3);
    expect(merge3(once, once, here).profile.autoFillFrom).toBe(P3);
  });

  it('is kept when only one side has it, and left out when neither does', () => {
    const none = device(undefined, { goalWeightKg: 65 });
    expect(merge3(device(undefined), none, device(P)).profile.autoFillFrom).toBe(P);
    expect(merge3(device(undefined), device(P), none).profile.autoFillFrom).toBe(P);
    expect(merge3(device(undefined), none, device(undefined)).profile).not.toHaveProperty('autoFillFrom');
  });
});

describe('signing out', () => {
  const ok = { configured: true, upToDate: true, force: false, loaded: true };

  it('with sync not set up nothing is in any account, so it asks first and never wipes the device', () => {
    expect(signOutPlan({ ...ok, configured: false, upToDate: false })).toBe('ask');
    expect(signOutPlan({ ...ok, configured: false })).toBe('ask');
    expect(signOutPlan({ ...ok, configured: false, upToDate: false, force: true })).toBe('keep');
  });

  it('everything in the account: the device is handed back empty', () => {
    expect(signOutPlan(ok)).toBe('wipe');
  });

  it('changes still waiting: asks, and signing out anyway keeps them on the device', () => {
    expect(signOutPlan({ ...ok, upToDate: false })).toBe('ask');
    expect(signOutPlan({ ...ok, upToDate: false, force: true })).toBe('keep');
  });

  it('a store that could not be read is never wiped: what is on disk may be in no account', () => {
    expect(signOutPlan({ ...ok, loaded: false })).toBe('ask');
    expect(signOutPlan({ ...ok, loaded: false, force: true })).toBe('keep');
  });
});

describe('what is in the account', () => {
  const synced = used([meal('a', '2026-10-10T08:00:00.000Z')]);

  it('only what the account was last seen holding: an edit made since is not in it, whatever the status line says', () => {
    expect(inAccount(cloudOf(synced), synced)).toBe(true);
    expect(inAccount(cloudOf(synced), { ...synced, settings: { ...synced.settings, waterGoalMl: 1234 } })).toBe(false);
    expect(inAccount(null, synced)).toBe(false);
  });

  it('this device\'s own caches and machine settings are not the account\'s business', () => {
    expect(inAccount(cloudOf(synced), { ...synced, chat: [{ id: 'c', role: 'user', text: 'hi', at: '' }], settings: { ...synced.settings, textScale: 1.3 } })).toBe(true);
  });
});

describe('after a restart', () => {
  const a = meal('a', '2026-10-10T08:00:00.000Z');
  const b = meal('b', '2026-10-10T13:00:00.000Z');
  const synced = cloudOf(used([a, b]));
  const saved = readSavedBase(encodeSavedBase({ uid: 'u1', base: synced, modifiedTime: 't1' }));

  it('the base saved beside the state comes back for the same account', () => {
    expect(saved).toEqual({ uid: 'u1', base: synced, modifiedTime: 't1' });
    expect(bindStart({ uid: 'u1', owner: 'u1', saved, loaded: true, parked: false, empty: false })).toMatchObject({ base: synced, modifiedTime: 't1' });
  });

  it('a meal deleted on another device while this one was closed stays deleted', () => {
    const start = bindStart({ uid: 'u1', owner: 'u1', saved, loaded: true, parked: false, empty: false });
    expect(merge3(start.base, synced, cloudOf(used([b]))).meals.map((m) => m.id)).toEqual(['b']);
  });

  it('an edit made on another device while this one was closed is not reverted', () => {
    const start = bindStart({ uid: 'u1', owner: 'u1', saved, loaded: true, parked: false, empty: false });
    expect(merge3(start.base, synced, cloudOf(used([{ ...a, kcal: 450 }, b]))).meals.find((m) => m.id === 'a')?.kcal).toBe(450);
  });

  it('is not used for another account, nor when the stored state could not be read', () => {
    expect(bindStart({ uid: 'u2', owner: 'u2', saved, loaded: true, parked: false, empty: false }).base).toBeNull();
    expect(bindStart({ uid: 'u1', owner: 'u1', saved, loaded: false, parked: false, empty: false }).base).toBeNull();
  });

  it('a damaged record is ignored', () => {
    expect(readSavedBase(null)).toBeNull();
    expect(readSavedBase('{')).toBeNull();
    expect(readSavedBase(JSON.stringify({ uid: 'u1', modifiedTime: 't1' }))).toBeNull();
  });

  it('a device holding nothing never deletes the account\'s records, whatever base it was left with', () => {
    // A reset device whose old base is still about must not read as "everything was deleted here".
    expect(merge3(synced, cloudOf({ ...EMPTY_STATE }), synced).meals.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('a device that synced before onboarding still keeps what it changed since', () => {
    const fresh = cloudOf({ ...EMPTY_STATE });
    const picked = cloudOf({ ...EMPTY_STATE, profile: { ...EMPTY_STATE.profile, lang: 'mr' } });
    expect(merge3(fresh, picked, fresh).profile.lang).toBe('mr');
  });
});

describe('a merge landing after edits made while the request was out', () => {
  const a = meal('a', '2026-10-10T08:00:00.000Z');
  const r = meal('r', '2026-10-10T10:00:00.000Z');
  const n = meal('n', '2026-10-10T12:00:00.000Z');
  // The round started from [a]; the account had r as well, so the merge came back as [a, r].
  const local = cloudOf(used([a]));
  const merged = cloudOf(used([a, r]));

  it('a meal logged meanwhile is kept, next to the one that came from the account', () => {
    expect(landMerge(used([a, n]), local, merged).meals.map((m) => m.id)).toEqual(['a', 'r', 'n']);
  });

  it('a meal deleted meanwhile stays deleted', () => {
    expect(landMerge(used([]), local, merged).meals.map((m) => m.id)).toEqual(['r']);
  });

  it('a setting changed meanwhile is kept, and so are this device\'s caches', () => {
    const now = used([a], { settings: { ...EMPTY_STATE.settings, waterGoalMl: 2000 }, chat: [{ id: 'c', role: 'user', text: 'hi', at: '' }] });
    const out = landMerge(now, local, merged);
    expect(out.settings.waterGoalMl).toBe(2000);
    expect(out.chat).toHaveLength(1);
    expect(out.meals.map((m) => m.id)).toEqual(['a', 'r']);
  });
});

describe('binding to an account', () => {
  const leftover = { uid: 'a', base: cloudOf(used([meal('x', '2026-10-10T08:00:00.000Z')])), modifiedTime: 't1' };

  it('a device holding another account\'s data puts it aside for them before anything syncs, and its base with it', () => {
    expect(bindStart({ uid: 'b', owner: 'a', saved: leftover, loaded: true, parked: false, empty: false })).toEqual({ move: { from: 'a' }, tag: true, base: null, modifiedTime: null });
  });

  it('a base saved for another account marks the device as theirs even when the owner tag is missing', () => {
    expect(bindStart({ uid: 'b', owner: null, saved: leftover, loaded: true, parked: false, empty: false }).move).toEqual({ from: 'a' });
  });

  it('the same account, or a device nobody has claimed, keeps what is on it and is tagged at once', () => {
    expect(bindStart({ uid: 'a', owner: 'a', saved: null, loaded: true, parked: false, empty: false })).toMatchObject({ move: null, tag: true });
    expect(bindStart({ uid: 'a', owner: null, saved: null, loaded: true, parked: false, empty: false })).toMatchObject({ move: null, tag: true });
  });

  it('an account whose data was put aside here gets it back on a device a sign-out left empty', () => {
    expect(bindStart({ uid: 'b', owner: null, saved: null, loaded: true, parked: true, empty: true }).move).toEqual({ from: null });
  });

  it('but never over something on the device: an unclaimed device that holds data keeps it', () => {
    expect(bindStart({ uid: 'b', owner: null, saved: null, loaded: true, parked: true, empty: false }).move).toBeNull();
  });

  it('a store that could not be read is neither moved nor claimed: what is on disk is not known to be anyone\'s', () => {
    expect(bindStart({ uid: 'b', owner: 'a', saved: null, loaded: false, parked: true, empty: true })).toEqual({ move: null, tag: false, base: null, modifiedTime: null });
  });
});

describe('a file written by a newer build', () => {
  // `fasting` stands for any key a later build adds and this one has never heard of.
  const withKey = (s: CloudState, v: unknown) => ({ ...s, fasting: v }) as unknown as CloudState;
  const fastingOf = (s: CloudState) => (s as unknown as Record<string, unknown>).fasting;
  const plain = cloudOf(used([meal('a', '2026-10-10T08:00:00.000Z')]));

  it('keeps keys this build does not know: dropping them would reach every device as a deletion', () => {
    expect(fastingOf(merge3(withKey(plain, { on: true }), plain, withKey(plain, { on: true })))).toEqual({ on: true });
    expect(fastingOf(merge3(null, plain, withKey(plain, { on: true })))).toEqual({ on: true });
  });

  it('merges such a key like any other value: changed elsewhere arrives, carried here and unchanged yields', () => {
    expect(fastingOf(merge3(withKey(plain, { on: true }), withKey(plain, { on: true }), withKey(plain, { on: false })))).toEqual({ on: false });
    expect(fastingOf(merge3(withKey(plain, { on: true }), withKey(plain, { on: false }), withKey(plain, { on: true })))).toEqual({ on: false });
  });

  it('is recognised by its version, so this build never writes over it', () => {
    expect(fromNewerApp({ ...plain, version: 7 }, 6)).toBe(true);
    expect(fromNewerApp({ ...plain, version: 6 }, 6)).toBe(false);
    expect(fromNewerApp({ ...plain, version: 5 }, 6)).toBe(false);
    expect(fromNewerApp({ ...plain, version: undefined as unknown as number }, 6)).toBe(false);
  });
});

describe('a sync round', () => {
  const v = (id: string, kcal: number) => meal(id, '2026-10-10T08:00:00.000Z', kcal);
  const n = meal('n', '2026-10-10T12:00:00.000Z');
  /** For rounds whose files are all at this version: nothing to bring up. */
  const same = (f: CloudState) => f;

  /** The relay: refuses a write built on a version that is not the newest, and lets another device write in before a given put. */
  function relay(initial: CloudState | null, before: Record<number, CloudState> = {}) {
    let file: AccountFile = { state: initial ? JSON.stringify(initial) : null, modifiedTime: initial ? 't0' : null };
    let clock = 0;
    let puts = 0;
    const written = (s: CloudState) => {
      file = { state: JSON.stringify(s), modifiedTime: `t${++clock}` };
    };
    return {
      get: async () => file,
      put: async (s: CloudState, base: string | null) => {
        const elsewhere = before[puts++];
        if (elsewhere) written(elsewhere);
        if (base !== file.modifiedTime) return { ok: false as const, stale: file };
        written(s);
        return { ok: true as const, modifiedTime: file.modifiedTime as string };
      },
      file: () => (file.state ? (JSON.parse(file.state) as CloudState) : null),
      setRaw: (state: string) => {
        file = { state, modifiedTime: `t${++clock}` };
      },
    };
  }

  /** This device: the state as it is now, with merges landed on top of whatever was done meanwhile. */
  function device(initial: AppState, r: ReturnType<typeof relay>, extra: Partial<RoundIO> = {}) {
    let now = initial;
    const io: RoundIO = {
      readNow: async () => now,
      land: (local, merged) => {
        now = landMerge(now, local, merged);
      },
      get: r.get,
      put: r.put,
      live: () => true,
      ...extra,
    };
    return { io, now: () => now, edit: (fn: (s: AppState) => AppState) => (now = fn(now)) };
  }

  it('a write refused twice is merged against the file it last saw, so an edit made elsewhere in between is not reverted', async () => {
    const base = cloudOf(used([v('r', 50)]));
    // Another device sets r to 100 before this device's first write, then to 999 before its second.
    const r = relay(base, { 0: cloudOf(used([v('r', 100)])), 1: cloudOf(used([v('r', 999)])) });
    const d = device(used([v('r', 50), n]), r);
    const out = await syncRound({ pull: false, base, modifiedTime: 't0', supported: STATE_VERSION, upgrade: same, io: d.io });
    expect(r.file()?.meals.map((m) => [m.id, m.kcal])).toEqual([['r', 999], ['n', 300]]);
    expect(d.now().meals.find((m) => m.id === 'r')?.kcal).toBe(999);
    expect(out && sameCloud(out.base, r.file() as CloudState)).toBe(true);
  });

  it('an edit made on this device while the request is out stays on the device', async () => {
    const base = cloudOf(used([v('a', 1)]));
    const r = relay(cloudOf(used([v('a', 1), v('r', 2)])));
    let d: ReturnType<typeof device> | null = null;
    d = device(used([v('a', 1)]), r, {
      get: async () => {
        d?.edit((s) => ({ ...s, meals: [...s.meals, n] }));
        return r.get();
      },
    });
    await syncRound({ pull: true, base, modifiedTime: 'old', supported: STATE_VERSION, upgrade: same, io: d.io });
    expect(d.now().meals.map((m) => m.id)).toEqual(['a', 'r', 'n']);
  });

  it('a file written by a newer build is neither merged nor written over', async () => {
    const newer = { ...cloudOf(used([v('a', 1)])), version: STATE_VERSION + 1 };
    const r = relay(newer);
    const d = device(used([v('b', 1)]), r);
    await expect(syncRound({ pull: true, base: null, modifiedTime: null, supported: STATE_VERSION, upgrade: same, io: d.io })).rejects.toEqual(new RoundStop('update_app'));
    expect(r.file()).toEqual(newer);
    expect(d.now().meals.map((m) => m.id)).toEqual(['b']);
  });

  it('an account file that cannot be read is never written over, and nothing on the device changes', async () => {
    for (const raw of ['{', JSON.stringify({}), JSON.stringify({ profile: {}, meals: 'x' }), JSON.stringify({ profile: {}, meals: [], water: {} })]) {
      const r = relay(null);
      r.setRaw(raw);
      const d = device(used([v('b', 1)]), r);
      await expect(syncRound({ pull: true, base: cloudOf(used([v('b', 1)])), modifiedTime: 't0', supported: STATE_VERSION, upgrade: same, io: d.io })).rejects.toEqual(new RoundStop('unreadable'));
      expect(d.now().meals.map((m) => m.id)).toEqual(['b']);
    }
  });

  it('an answer that arrives after the account changed is dropped: nothing lands, nothing is written', async () => {
    const r = relay(cloudOf(used([v('a', 1), v('r', 2)])));
    let alive = true;
    const d = device(used([v('a', 1)]), r, {
      live: () => alive,
      get: async () => {
        alive = false;
        return r.get();
      },
    });
    await expect(syncRound({ pull: true, base: cloudOf(used([v('a', 1)])), modifiedTime: 'old', supported: STATE_VERSION, upgrade: same, io: d.io })).rejects.toEqual(new RoundStop('abandoned'));
    expect(d.now().meals.map((m) => m.id)).toEqual(['a']);
  });

  it('a record that is not a record at all, in a file at this version, is left out: the round goes on and writes the file back without it', async () => {
    const good = cloudOf(used([v('a', 1)]));
    const r = relay(null);
    r.setRaw(JSON.stringify({ ...good, meals: [null, ...good.meals, 7], menus: [null], slotSkips: ['x'] }));
    const d = device(used([v('a', 1), n]), r);
    const out = await syncRound({ pull: true, base: good, modifiedTime: 'old', supported: STATE_VERSION, upgrade: same, io: d.io });
    expect(out).not.toBeNull();
    expect(r.file()?.meals.map((m) => m.id)).toEqual(['a', 'n']);
    expect([r.file()?.menus, r.file()?.slotSkips]).toEqual([[], []]);
    expect(d.now().meals.map((m) => m.id)).toEqual(['a', 'n']);
  });

  it('nothing changed on either side: no write, and nothing new to remember', async () => {
    const base = cloudOf(used([v('a', 1)]));
    const r = relay(base);
    const d = device(used([v('a', 1)]), r);
    expect(await syncRound({ pull: true, base, modifiedTime: 't0', supported: STATE_VERSION, upgrade: same, io: d.io })).toBeNull();
  });

  it('gives up when the file keeps changing under it', async () => {
    const base = cloudOf(used([v('a', 1)]));
    // Three tries, four writes: each one beaten by another device.
    const r = relay(base, { 0: cloudOf(used([v('a', 2)])), 1: cloudOf(used([v('a', 3)])), 2: cloudOf(used([v('a', 4)])), 3: cloudOf(used([v('a', 5)])) });
    const d = device(used([v('a', 1), n]), r);
    await expect(syncRound({ pull: false, base, modifiedTime: 't0', supported: STATE_VERSION, upgrade: same, io: d.io })).rejects.toEqual(new RoundStop('kept_changing'));
  });

  describe('an account file from an older build', () => {
    const old = (s: CloudState): CloudState => ({ ...s, version: STATE_VERSION - 1 });
    const routine = (r: Partial<AppState['routine']>) => ({ routine: { ...EMPTY_STATE.routine, ...r } });
    /** This build's migration in small: the newer version switched the pattern on for everyone. Records what it was handed. */
    function upgrader() {
      const seen: CloudState[] = [];
      const upgrade = (f: CloudState): CloudState => {
        seen.push(f);
        return { ...f, version: STATE_VERSION, routine: { ...f.routine, enabled: true } };
      };
      return { seen, upgrade };
    }
    /** Counts the writes that reach the relay. */
    const counted = (r: ReturnType<typeof relay>) => {
      const c = {
        puts: 0,
        put: (s: CloudState, at: string | null) => {
          c.puts++;
          return r.put(s, at);
        },
      };
      return c;
    };

    it('is brought up to this version before it is merged, and written back once even when the device has nothing to add', async () => {
      const file = old(cloudOf(used([v('a', 1)], routine({ enabled: false }))));
      const r = relay(file);
      const c = counted(r);
      const d = device({ ...EMPTY_STATE }, r, { put: c.put });
      const { seen, upgrade } = upgrader();
      const out = await syncRound({ pull: true, base: null, modifiedTime: null, supported: STATE_VERSION, upgrade, io: d.io });
      expect(seen.length).toBeGreaterThan(0);
      expect(seen.every((f) => f.version === STATE_VERSION - 1)).toBe(true);
      expect(c.puts).toBe(1);
      expect(r.file()?.version).toBe(STATE_VERSION);
      expect(r.file()?.routine.enabled).toBe(true);
      expect(d.now().routine.enabled).toBe(true);
      // What is remembered is what the account holds, never an upgraded copy that was not written.
      expect(out && sameCloud(out.base, r.file() as CloudState)).toBe(true);
      // The next round finds the account as it left it: nothing is written again.
      expect(await syncRound({ pull: true, base: out!.base, modifiedTime: out!.modifiedTime, supported: STATE_VERSION, upgrade, io: d.io })).toBeNull();
      expect(c.puts).toBe(1);
    });

    it('the base is brought up too, so a change another older device made survives this device\'s own upgrade, also across refused writes', async () => {
      const base = old(cloudOf(used([v('a', 1)], routine({ enabled: false }))));
      // Another device still on the older build sets a budget before this device's first write, then a lower end before its second.
      const first = old(cloudOf(used([v('a', 1)], routine({ enabled: false, budgetMax: 150 }))));
      const second = old(cloudOf(used([v('a', 1)], routine({ enabled: false, budgetMin: 100, budgetMax: 150 }))));
      const r = relay(base, { 0: first, 1: second });
      // This device loaded the same file under this build, so its pattern is on, and it logged a meal since.
      const d = device(used([v('a', 1), n], routine({ enabled: true })), r);
      const { upgrade } = upgrader();
      await syncRound({ pull: false, base, modifiedTime: 't0', supported: STATE_VERSION, upgrade, io: d.io });
      const file = r.file() as CloudState;
      expect([file.routine.budgetMin, file.routine.budgetMax]).toEqual([100, 150]);
      expect(file.routine.enabled).toBe(true);
      expect(file.version).toBe(STATE_VERSION);
      expect(file.meals.map((m) => m.id)).toEqual(['a', 'n']);
      expect([d.now().routine.budgetMin, d.now().routine.budgetMax]).toEqual([100, 150]);
    });

    it('a file newer than this build still stops the round: the upgrade, which stamps this version, never hides it', async () => {
      const newer = { ...cloudOf(used([v('a', 1)])), version: STATE_VERSION + 1 };
      const r = relay(newer);
      const d = device(used([v('b', 1)]), r);
      const { seen, upgrade } = upgrader();
      await expect(syncRound({ pull: true, base: null, modifiedTime: null, supported: STATE_VERSION, upgrade, io: d.io })).rejects.toEqual(new RoundStop('update_app'));
      expect(seen).toEqual([]);
      expect(r.file()).toEqual(newer);
      expect(d.now().meals.map((m) => m.id)).toEqual(['b']);
    });

    it('a file already at this version is never upgraded, and with nothing changed nothing is written', async () => {
      const file = cloudOf(used([v('a', 1)]));
      const r = relay(file);
      const c = counted(r);
      const d = device(used([v('a', 1)]), r, { put: c.put });
      const { seen, upgrade } = upgrader();
      // Pulled as if the file might have moved since this device last saw it, so the round reads it and merges.
      const out = await syncRound({ pull: true, base: file, modifiedTime: 'old', supported: STATE_VERSION, upgrade, io: d.io });
      expect(seen).toEqual([]);
      expect(c.puts).toBe(0);
      expect(out && sameCloud(out.base, file)).toBe(true);
    });
  });
});

describe('menus, skips and saved meals', () => {
  const menu = (date: string, qty: number, editedAt: string): DayMenu => ({ date, editedAt, meals: [{ id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty }] }] });
  const qtyOn = (s: CloudState, date: string) => s.menus.find((m) => m.date === date)?.meals[0].lines[0].qty;
  const base = cloudOf(used([], { menus: [menu('2026-10-28', 2, ''), menu('2026-10-29', 2, '')] }));

  it('two devices editing different dates both keep their edit', () => {
    const local = cloudOf(used([], { menus: [menu('2026-10-28', 3, '2026-10-27T09:00:00.000Z'), menu('2026-10-29', 2, '')] }));
    const remote = cloudOf(used([], { menus: [menu('2026-10-28', 2, ''), menu('2026-10-29', 4, '2026-10-27T10:00:00.000Z')] }));
    const out = merge3(base, local, remote);
    expect(qtyOn(out, '2026-10-28')).toBe(3);
    expect(qtyOn(out, '2026-10-29')).toBe(4);
  });

  it('the same date edited on both: the newer edit wins, whichever device made it', () => {
    const early = cloudOf(used([], { menus: [menu('2026-10-28', 3, '2026-10-27T09:00:00.000Z'), menu('2026-10-29', 2, '')] }));
    const late = cloudOf(used([], { menus: [menu('2026-10-28', 5, '2026-10-27T10:00:00.000Z'), menu('2026-10-29', 2, '')] }));
    expect(qtyOn(merge3(base, early, late), '2026-10-28')).toBe(5);
    expect(qtyOn(merge3(base, late, early), '2026-10-28')).toBe(5);
  });

  it('with no base, an edit beats a menu the app wrote', () => {
    const written = cloudOf(used([meal('a', '2026-10-27T08:00:00.000Z')], { menus: [menu('2026-10-28', 2, '')] }));
    const edited = cloudOf(used([meal('a', '2026-10-27T08:00:00.000Z')], { menus: [menu('2026-10-28', 4, '2026-10-27T09:00:00.000Z')] }));
    expect(qtyOn(merge3(null, written, edited), '2026-10-28')).toBe(4);
    expect(qtyOn(merge3(null, edited, written), '2026-10-28')).toBe(4);
  });

  it('the same date edited on both at the same moment: this device\'s edit stays', () => {
    const here = cloudOf(used([], { menus: [menu('2026-10-28', 3, '2026-10-27T09:00:00.000Z'), menu('2026-10-29', 2, '')] }));
    const there = cloudOf(used([], { menus: [menu('2026-10-28', 5, '2026-10-27T09:00:00.000Z'), menu('2026-10-29', 2, '')] }));
    expect(qtyOn(merge3(base, here, there), '2026-10-28')).toBe(3);
    expect(qtyOn(merge3(base, there, here), '2026-10-28')).toBe(5);
  });

  it('a menu with no edit stamp at all counts as one the app wrote, and a real edit beats it', () => {
    const unstamped = (qty: number): DayMenu => {
      const { editedAt, ...rest } = menu('2026-10-28', qty, '');
      void editedAt;
      return rest as DayMenu;
    };
    const app = cloudOf(used([], { menus: [unstamped(6), menu('2026-10-29', 2, '')] }));
    const edited = cloudOf(used([], { menus: [menu('2026-10-28', 4, '2026-10-27T09:00:00.000Z'), menu('2026-10-29', 2, '')] }));
    expect(qtyOn(merge3(base, app, edited), '2026-10-28')).toBe(4);
    expect(qtyOn(merge3(base, edited, app), '2026-10-28')).toBe(4);
  });

  it('a date gone on one side and edited on the other keeps the edit, whichever side made it', () => {
    // Menus are never deleted, so a date missing on one side is one that device never had, not one it took out.
    const gone = cloudOf(used([], { menus: [menu('2026-10-29', 2, '')] }));
    const edited = cloudOf(used([], { menus: [menu('2026-10-28', 4, '2026-10-27T09:00:00.000Z'), menu('2026-10-29', 2, '')] }));
    expect(qtyOn(merge3(base, gone, edited), '2026-10-28')).toBe(4);
    expect(qtyOn(merge3(base, edited, gone), '2026-10-28')).toBe(4);
  });

  it('a date one side never had keeps the menu the other side holds, edited or not', () => {
    const gone = cloudOf(used([], { menus: [menu('2026-10-29', 2, '')] }));
    expect(qtyOn(merge3(base, base, gone), '2026-10-28')).toBe(2);
    expect(qtyOn(merge3(base, gone, base), '2026-10-28')).toBe(2);
    // With no base at all it is the same: a date only one side has is kept.
    expect(qtyOn(merge3(null, base, gone), '2026-10-28')).toBe(2);
    expect(qtyOn(merge3(null, gone, base), '2026-10-28')).toBe(2);
    // Every other record still goes when one side took it out: a meal is not a menu.
    const withMeal = cloudOf(used([meal('a', '2026-10-27T08:00:00.000Z')], { menus: base.menus }));
    const noMeal = cloudOf(used([], { menus: base.menus }));
    expect(merge3(withMeal, noMeal, withMeal).meals).toEqual([]);
  });

  it('a day the app kept once it was lived, against a real edit of that date from another device: the edit wins, whichever side holds which', () => {
    const kept: DayMenu = { ...menu('2026-10-26', 2, ''), frozen: true };
    const edited = menu('2026-10-26', 4, '2026-10-27T09:00:00.000Z');
    const here = cloudOf(used([], { menus: [...base.menus, kept] }));
    const there = cloudOf(used([], { menus: [...base.menus, edited] }));
    // Neither had the date when they last synced, no sync yet, or the kept day already in the account.
    for (const [name, b] of [['before', base], ['none', null], ['kept', here]] as const) {
      expect(merge3(b, here, there).menus.find((m) => m.date === '2026-10-26'), name).toEqual(edited);
      expect(merge3(b, there, here).menus.find((m) => m.date === '2026-10-26'), name).toEqual(edited);
    }
  });

  it('skips and saved meals merge record by record', () => {
    const skip = (date: string, slotId: string) => ({ id: `${date}:${slotId}`, date, slotId });
    const thali = { id: 's1', name: 'Thali', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }] };
    const b = cloudOf(used([], { slotSkips: [skip('2026-10-26', 'lunch')] }));
    const local = cloudOf(used([], { slotSkips: [skip('2026-10-26', 'lunch'), skip('2026-10-27', 'dinner')], savedMeals: [thali] }));
    const remote = cloudOf(used([], { slotSkips: [skip('2026-10-27', 'morning')] }));
    const out = merge3(b, local, remote);
    // Lunch on the 26th was un-skipped on the other device; each side added one skip.
    expect(out.slotSkips.map((s) => s.id).sort()).toEqual(['2026-10-27:dinner', '2026-10-27:morning']);
    expect(out.savedMeals).toEqual([thali]);
  });
});
