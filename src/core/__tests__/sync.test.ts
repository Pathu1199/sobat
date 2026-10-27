import { describe, expect, it } from 'vitest';
import { EMPTY_STATE } from '../../store/defaults';
import { applyCloud, bindStart, encodeSavedBase, forCloud, isPristine, landMerge, merge3, readSavedBase, sameCloud, signOutPlan, stable, type CloudState } from '../sync';
import type { AppState, Meal } from '../types';

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
    const local = cloudOf(used([], { settings: { ...EMPTY_STATE.settings, waterGoalMl: 3000, glassMl: 300 } }));
    const remote = cloudOf(used([], { settings: { ...EMPTY_STATE.settings, waterGoalMl: 2500 } }));
    // Settings is one value: the side that changed it wins whole.
    expect(merge3(base, local, remote).settings.glassMl).toBe(300);
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

describe('signing out', () => {
  it('with sync not set up nothing is in any account, so it asks first and never wipes the device', () => {
    expect(signOutPlan({ configured: false, upToDate: false, force: false })).toBe('ask');
    expect(signOutPlan({ configured: false, upToDate: true, force: false })).toBe('ask');
    expect(signOutPlan({ configured: false, upToDate: false, force: true })).toBe('keep');
  });

  it('everything in the account: the device is handed back empty', () => {
    expect(signOutPlan({ configured: true, upToDate: true, force: false })).toBe('wipe');
  });

  it('changes still waiting: asks, and signing out anyway keeps them on the device', () => {
    expect(signOutPlan({ configured: true, upToDate: false, force: false })).toBe('ask');
    expect(signOutPlan({ configured: true, upToDate: false, force: true })).toBe('keep');
  });
});

describe('after a restart', () => {
  const a = meal('a', '2026-10-10T08:00:00.000Z');
  const b = meal('b', '2026-10-10T13:00:00.000Z');
  const synced = cloudOf(used([a, b]));
  const saved = readSavedBase(encodeSavedBase({ uid: 'u1', base: synced, modifiedTime: 't1' }));

  it('the base saved beside the state comes back for the same account', () => {
    expect(saved).toEqual({ uid: 'u1', base: synced, modifiedTime: 't1' });
    expect(bindStart({ uid: 'u1', owner: 'u1', saved, loaded: true })).toMatchObject({ base: synced, modifiedTime: 't1' });
  });

  it('a meal deleted on another device while this one was closed stays deleted', () => {
    const start = bindStart({ uid: 'u1', owner: 'u1', saved, loaded: true });
    expect(merge3(start.base, synced, cloudOf(used([b]))).meals.map((m) => m.id)).toEqual(['b']);
  });

  it('an edit made on another device while this one was closed is not reverted', () => {
    const start = bindStart({ uid: 'u1', owner: 'u1', saved, loaded: true });
    expect(merge3(start.base, synced, cloudOf(used([{ ...a, kcal: 450 }, b]))).meals.find((m) => m.id === 'a')?.kcal).toBe(450);
  });

  it('is not used for another account, nor when the stored state could not be read', () => {
    expect(bindStart({ uid: 'u2', owner: 'u2', saved, loaded: true }).base).toBeNull();
    expect(bindStart({ uid: 'u1', owner: 'u1', saved, loaded: false }).base).toBeNull();
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

  it('a device holding another account\'s data starts from nothing, with no base, before anything syncs', () => {
    expect(bindStart({ uid: 'b', owner: 'a', saved: leftover, loaded: true })).toEqual({ wipe: true, tag: true, base: null, modifiedTime: null });
  });

  it('a base saved for another account marks the device as theirs even when the owner tag is missing', () => {
    expect(bindStart({ uid: 'b', owner: null, saved: leftover, loaded: true }).wipe).toBe(true);
  });

  it('the same account, or a device nobody has claimed, keeps what is on it and is tagged at once', () => {
    expect(bindStart({ uid: 'a', owner: 'a', saved: null, loaded: true })).toMatchObject({ wipe: false, tag: true });
    expect(bindStart({ uid: 'a', owner: null, saved: null, loaded: true })).toMatchObject({ wipe: false, tag: true });
  });

  it('a store that could not be read is neither wiped nor claimed: what is on disk is not known to be anyone\'s', () => {
    expect(bindStart({ uid: 'b', owner: 'a', saved: null, loaded: false })).toEqual({ wipe: false, tag: false, base: null, modifiedTime: null });
  });
});
