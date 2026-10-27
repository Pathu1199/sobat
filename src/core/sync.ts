import type { AppState, Settings } from './types';

/**
 * How the account's copy and the device's copy are reconciled.
 *
 * The account's copy is one file. Two devices editing it would otherwise take
 * turns overwriting each other: the phone logs lunch, the PC logs water, and
 * whichever uploads second wins the whole file. So instead of a whole-file
 * last-write-wins, each record is merged on its own against the last version
 * this device knew the file to be in (`base`): a record this device changed is
 * kept, a record only the other side changed is taken, and anything neither
 * touched stays. Pure, so every case has a test.
 */

/** Settings that describe this machine, not the person: never synced. */
export const DEVICE_SETTINGS = ['ollamaUrl', 'ollamaFallbackUrl', 'textModel', 'visionModel', 'appearance', 'textScale', 'pushRelay', 'driveBackupAt'] as const;
type DeviceKey = (typeof DEVICE_SETTINGS)[number];

/** Per-device caches that have no business in the account. */
const LOCAL_KEYS = ['chat', 'photoQueue', 'usage', 'tips'] as const;
type LocalKey = (typeof LOCAL_KEYS)[number];

export type CloudSettings = Omit<Settings, DeviceKey>;
export type CloudState = Omit<AppState, LocalKey | 'settings'> & { settings: CloudSettings };

type AnyRecord = Record<string, unknown>;

/** The record arrays, each with the field that identifies one record. */
export const COLLECTIONS: { key: keyof CloudState; idOf: (r: AnyRecord) => string }[] = [
  { key: 'meals', idOf: (r) => String(r.id) },
  { key: 'water', idOf: (r) => String(r.id) },
  { key: 'weights', idOf: (r) => String(r.date) },
  { key: 'sleep', idOf: (r) => String(r.date) },
  { key: 'moods', idOf: (r) => String(r.id) },
  { key: 'workouts', idOf: (r) => String(r.id) },
  { key: 'nudges', idOf: (r) => String(r.id) },
  { key: 'customFoods', idOf: (r) => String(r.id) },
  { key: 'memory', idOf: (r) => String(r.id) },
  { key: 'breaks', idOf: (r) => String(r.id) },
  { key: 'steps', idOf: (r) => String(r.date) },
  { key: 'actionsDone', idOf: (r) => `${r.date}:${r.key}` },
  { key: 'activities', idOf: (r) => String(r.id) },
  { key: 'spend', idOf: (r) => String(r.id) },
];

/** Everything else in the file: one value each, merged whole. */
export const SINGLETONS = ['version', 'profile', 'settings', 'breakSettings', 'routine', 'schedule', 'weekPlan', 'celebrated', 'groceryTicks'] as const;

/** JSON with keys in a fixed order, so two equal values always read the same. */
export function stable(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.keys(val as AnyRecord)
          .sort()
          .reduce<AnyRecord>((o, k) => {
            o[k] = (val as AnyRecord)[k];
            return o;
          }, {})
      : val,
  );
}

export function sameCloud(a: CloudState, b: CloudState): boolean {
  return stable(a) === stable(b);
}

/** The part of the state that is the person's record rather than this device's cache. */
export function forCloud(s: AppState): CloudState {
  const { chat, photoQueue, usage, tips, settings, ...rest } = s;
  void chat;
  void photoQueue;
  void usage;
  void tips;
  const cloudSettings = { ...settings } as Partial<Settings>;
  for (const k of DEVICE_SETTINGS) delete cloudSettings[k];
  return { ...rest, settings: cloudSettings as CloudSettings };
}

/** The merged file put back on this device, with its own caches and machine settings kept. */
export function applyCloud(local: AppState, cloud: CloudState): AppState {
  const device: Partial<Settings> = {};
  for (const k of DEVICE_SETTINGS) (device as AnyRecord)[k] = local.settings[k];
  return {
    ...local,
    ...cloud,
    settings: { ...local.settings, ...cloud.settings, ...device } as Settings,
    chat: local.chat,
    photoQueue: local.photoQueue,
    usage: local.usage,
    tips: local.tips,
  };
}

/** A device that has never been used: nothing on it is worth keeping over the account. */
export function isPristine(s: Pick<CloudState, 'profile' | 'meals'>): boolean {
  return !s.profile.onboarded && s.meals.length === 0;
}

function toMap(list: unknown, idOf: (r: AnyRecord) => string): Map<string, AnyRecord> {
  const m = new Map<string, AnyRecord>();
  if (Array.isArray(list)) for (const r of list) m.set(idOf(r as AnyRecord), r as AnyRecord);
  return m;
}

/** Records with a time are kept in time order after a merge, whichever side they came from. */
function timeOf(r: AnyRecord): string {
  return String(r.at ?? r.date ?? '');
}

function mergeCollection(idOf: (r: AnyRecord) => string, base: unknown, local: unknown, remote: unknown): AnyRecord[] {
  const b = toMap(base, idOf);
  const l = toMap(local, idOf);
  const r = toMap(remote, idOf);
  const pick = (k: string): AnyRecord | undefined => {
    const bs = stable(b.get(k));
    const lv = l.get(k);
    const rv = r.get(k);
    if (stable(lv) !== bs) return lv;
    if (stable(rv) !== bs) return rv;
    return lv;
  };
  const out: AnyRecord[] = [];
  const seen = new Set<string>();
  for (const k of l.keys()) {
    seen.add(k);
    const v = pick(k);
    if (v !== undefined) out.push(v);
  }
  for (const k of r.keys()) {
    if (seen.has(k)) continue;
    seen.add(k);
    const v = pick(k);
    if (v !== undefined) out.push(v);
  }
  // Records deleted on both sides are simply absent; those only in base were deleted on one side.
  const hasTime = out.some((x) => x.at !== undefined || x.date !== undefined);
  return hasTime ? [...out].sort((x, y) => timeOf(x).localeCompare(timeOf(y))) : out;
}

/**
 * Three-way merge. `base` is the file as this device last saw it; null means
 * this device has never synced. With no base there is nothing to say which
 * side changed, so a record present on both sides is taken from the device
 * (what the person is looking at). A device holding nothing takes the
 * account's copy wholesale: never used, or reset with an old base still
 * about, its emptiness is not a deletion.
 */
export function merge3(base: CloudState | null, local: CloudState, remote: CloudState): CloudState {
  if (isPristine(local) && (base === null || !isPristine(base))) return remote;
  const b = (base ?? {}) as Partial<CloudState>;
  const out = {} as AnyRecord;

  for (const { key, idOf } of COLLECTIONS) {
    out[key] = mergeCollection(idOf, b[key], local[key], remote[key]);
  }

  for (const key of SINGLETONS) {
    if (key === 'version') {
      out.version = Math.max(Number(local.version ?? 0), Number(remote.version ?? 0));
      continue;
    }
    const bv = stable(b[key]);
    const lv = local[key];
    const rv = remote[key];
    if (base === null) {
      // Unknown history: keep what this device has, fall back to the account's.
      out[key] = lv !== undefined && lv !== null ? lv : rv;
    } else if (stable(lv) !== bv) {
      out[key] = lv;
    } else if (stable(rv) !== bv) {
      out[key] = rv;
    } else {
      out[key] = lv;
    }
  }

  // Keys this build does not know were written by a newer one. They are
  // merged like any single value and never dropped: a dropped key would reach
  // every other device as a deletion. A device that never had one has not
  // changed it.
  const known = new Set<string>([...COLLECTIONS.map((c) => c.key), ...SINGLETONS, ...LOCAL_KEYS]);
  const l = local as unknown as AnyRecord;
  const r = remote as unknown as AnyRecord;
  for (const key of new Set([...Object.keys(l), ...Object.keys(r)])) {
    if (known.has(key)) continue;
    const mine = key in l && (base === null || stable(l[key]) !== stable((b as AnyRecord)[key]));
    const v = mine ? l[key] : r[key];
    if (v !== undefined) out[key] = v;
  }

  return out as unknown as CloudState;
}

/**
 * A file written by a build newer than this one. This build must not write
 * over it: whatever it does not understand, it would drop or turn back.
 */
export function fromNewerApp(file: CloudState, supported: number): boolean {
  return typeof file.version === 'number' && file.version > supported;
}

/**
 * Put a merge result on the device. The merge was worked out from `local`,
 * the device as it was when the request went out; whatever was done here
 * since is kept on top of it, the same way the merge kept this device's
 * edits over the account's.
 */
export function landMerge(now: AppState, local: CloudState, merged: CloudState): AppState {
  return applyCloud(now, merge3(local, forCloud(now), merged));
}

/**
 * The account file as this device last saw it, and which version that was:
 * the base every merge is worked out against. Kept on disk beside the state
 * so a restart still knows which side changed what; without it, every record
 * deleted or edited on another device since would come back as it is here.
 */
export type SavedBase = { uid: string; base: CloudState; modifiedTime: string | null };

export function encodeSavedBase(s: SavedBase): string {
  return JSON.stringify(s);
}

export function readSavedBase(raw: string | null): SavedBase | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<SavedBase> | null;
    const b = v?.base as Partial<CloudState> | undefined;
    if (!v || typeof v.uid !== 'string' || !b || typeof b !== 'object' || !b.profile || !Array.isArray(b.meals)) return null;
    if (v.modifiedTime !== null && typeof v.modifiedTime !== 'string') return null;
    return { uid: v.uid, base: v.base as CloudState, modifiedTime: v.modifiedTime };
  } catch {
    return null;
  }
}

/**
 * Where the first sync after binding to an account starts from. Data another
 * account left on the device is wiped before anything syncs, so none of it
 * can reach this one, and the device is tagged as this account's at once,
 * not after a sync that may never come. A saved base only describes the
 * account it was saved for, and only the state it was saved beside: if that
 * state could not be read, nothing on disk is known to be anyone's.
 */
export function bindStart(o: { uid: string; owner: string | null; saved: SavedBase | null; loaded: boolean }): {
  wipe: boolean;
  tag: boolean;
  base: CloudState | null;
  modifiedTime: string | null;
} {
  if (!o.loaded) return { wipe: false, tag: false, base: null, modifiedTime: null };
  const holder = o.owner ?? o.saved?.uid ?? null;
  if (holder !== null && holder !== o.uid) return { wipe: true, tag: true, base: null, modifiedTime: null };
  if (!o.saved || o.saved.uid !== o.uid) return { wipe: false, tag: true, base: null, modifiedTime: null };
  return { wipe: false, tag: true, base: o.saved.base, modifiedTime: o.saved.modifiedTime };
}

/**
 * What signing out does to this device. It is only handed back empty when
 * the account is known to hold everything; with sync not set up there is no
 * account copy at all, so the device's copy is the only one. Otherwise the
 * person is asked first, and if they sign out anyway the data stays on the
 * device for the same account to pick up again.
 */
export function signOutPlan(o: { configured: boolean; upToDate: boolean; force: boolean }): 'wipe' | 'keep' | 'ask' {
  if (o.configured && o.upToDate) return 'wipe';
  return o.force ? 'keep' : 'ask';
}
