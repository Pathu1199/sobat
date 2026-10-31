import { isAbhyasSession, ranOut, sessionId, stop, withSession } from './abhyas';
import type { AbhyasRunning, AbhyasSession, AppState, Settings } from './types';

/**
 * How the account's copy and the device's copy are reconciled.
 *
 * The account's copy is one file. Two devices editing it would otherwise take
 * turns overwriting each other: the phone logs lunch, the PC logs water, and
 * whichever uploads second wins the whole file. So instead of a whole-file
 * last-write-wins, each record is merged on its own against the last version
 * this device knew the file to be in (`base`): a record this device changed is
 * kept, a record only the other side changed is taken, and anything neither
 * touched stays. A day's menu says when it was last edited, so when both sides
 * changed the same date the newer edit wins, wherever it was made; and since
 * nothing ever takes a menu out, a date one side does not have is one it never
 * had, never one it deleted. The Abhyas timer that is running is one value
 * with a rule of its own (`mergeRunning`), so a timer started on the phone
 * shows on the PC and can be stopped there. Pure, so every case has a test.
 */

/** Settings that describe this machine, not the person: never synced. */
export const DEVICE_SETTINGS = ['ollamaUrl', 'ollamaFallbackUrl', 'textModel', 'visionModel', 'appearance', 'textScale', 'pushRelay', 'driveBackupAt', 'remindersBannerHiddenOn'] as const;
type DeviceKey = (typeof DEVICE_SETTINGS)[number];

/** Per-device caches that have no business in the account. */
const LOCAL_KEYS = ['chat', 'photoQueue', 'usage', 'tips', 'openedDates'] as const;
type LocalKey = (typeof LOCAL_KEYS)[number];

export type CloudSettings = Omit<Settings, DeviceKey>;
export type CloudState = Omit<AppState, LocalKey | 'settings'> & { settings: CloudSettings };

type AnyRecord = Record<string, unknown>;

/**
 * The record arrays, each with the field that identifies one record, for some the field that says when it was last edited
 * (changed on both sides, the newer wins, or with `firstWins` the older of the copies the app can read, `valid`), whether
 * its records are never deleted, so one missing on a side is kept from the other whatever the base held, and for a list
 * the user puts in order, each record's place (`orderOf`).
 */
export const COLLECTIONS: {
  key: keyof CloudState;
  idOf: (r: AnyRecord) => string;
  stampOf?: (r: AnyRecord) => string;
  firstWins?: true;
  valid?: (r: unknown) => boolean;
  neverDeleted?: true;
  orderOf?: (r: AnyRecord) => number;
}[] = [
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
  // One menu per date. A menu the app wrote has an empty stamp, so any real edit beats it. Nothing takes a date's menu out
  // (a reset empties the whole device, which then takes the account's file whole), so a date missing on one side is one
  // that side never had: a device whose store moved to this version in another week has other weeks' menus from the old
  // template, and another device's edit to this week must not read as undone there.
  // So no merge ever removes a menu date: erasing everywhere or restoring a backup cannot take away menus another device
  // holds, which come back with its next round. Any future pruning of old menus must be one shared, deterministic date
  // cutoff applied the same way on every side; a removal made on one device alone is undone by the next merge.
  { key: 'menus', idOf: (r) => String(r.date), stampOf: (r) => String(r.editedAt ?? ''), neverDeleted: true },
  { key: 'slotSkips', idOf: (r) => String(r.id) },
  { key: 'savedMeals', idOf: (r) => String(r.id) },
  // The user's own list (Abhyas). A tick's id is its item's and its date's, and a session's its item's and its start's, so
  // the same tick made on two devices is one tick, and the same timer stopped on two is one session: the stop that came
  // first, since a later one only stopped a copy still running there. The items stay in the user's order (`order`); two in
  // the same place, one added on each device, go by id, so every device holds the list the same way.
  { key: 'abhyasItems', idOf: (r) => String(r.id), orderOf: (r) => (typeof r.order === 'number' && Number.isFinite(r.order) ? r.order : Infinity) },
  { key: 'abhyasSessions', idOf: (r) => String(r.id), stampOf: (r) => String(r.endedAt ?? ''), firstWins: true, valid: isAbhyasSession },
  { key: 'abhyasTicks', idOf: (r) => String(r.id) },
];

/**
 * Everything else in the file: one value each, merged whole, but for the profile and the settings, merged field by field
 * (`BY_FIELD`), and the Abhyas timer, by its own rule (`mergeRunning`).
 */
export const SINGLETONS = ['version', 'profile', 'settings', 'breakSettings', 'routine', 'schedule', 'weekPlan', 'celebrated', 'groceryTicks', 'abhyasRunning'] as const;

/**
 * Single objects merged field by field, each field one value: merged whole, a
 * chapter started on the phone would lose to a language picked on the PC in
 * the same round. The settings' switches (`features`, `reminders`) are merged
 * switch by switch the same way, so a reminder switched on on the phone and
 * another on the PC both stay. Inside a field the rule is the one for any
 * single value (`pick`).
 */
const BY_FIELD = new Map<string, readonly string[]>([
  ['profile', []],
  ['settings', ['features', 'reminders']],
]);

/** One value against the base: this device's change wins, else the other side's; changed nowhere, this device's. */
function pick<T>(b: unknown, l: T, r: T): T {
  const bv = stable(b);
  if (stable(l) !== bv) return l;
  if (stable(r) !== bv) return r;
  return l;
}

/** Each field picked on its own against the base (`pick`), the `nested` ones key by key; a field taken out on one side stays out. */
function mergeFields(b: AnyRecord, l: AnyRecord, r: AnyRecord, nested: readonly string[] = []): AnyRecord {
  const out: AnyRecord = {};
  for (const f of new Set([...Object.keys(l), ...Object.keys(r)])) {
    const [bv, lv, rv] = [b[f], l[f], r[f]];
    const v = nested.includes(f) && isObject(bv) && isObject(lv) && isObject(rv) ? mergeFields(bv, lv, rv) : pick(bv, lv, rv);
    if (v !== undefined) out[f] = v;
  }
  return out;
}

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
  const { chat, photoQueue, usage, tips, openedDates, settings, ...rest } = s;
  void chat;
  void photoQueue;
  void usage;
  void tips;
  void openedDates;
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
    openedDates: local.openedDates,
  };
}

/** A device that has never been used: nothing on it is worth keeping over the account. */
export function isPristine(s: Pick<CloudState, 'profile' | 'meals'>): boolean {
  return !s.profile.onboarded && s.meals.length === 0;
}

const isObject = (v: unknown): v is AnyRecord => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A list's records by id. Anything in it that is not a record (a null in a file) is left out: reading its id would fail every round. */
function toMap(list: unknown, idOf: (r: AnyRecord) => string): Map<string, AnyRecord> {
  const m = new Map<string, AnyRecord>();
  if (Array.isArray(list)) for (const r of list) if (isObject(r)) m.set(idOf(r), r);
  return m;
}

/** Records with a time are kept in time order after a merge, whichever side they came from. */
function timeOf(r: AnyRecord): string {
  return String(r.at ?? r.date ?? '');
}

/** Two keys in order by their characters, the same on every device whatever its language (`localeCompare` is not). */
function compare(a: string | number, b: string | number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** In time order, and records at the same time by id, so every device holds the list the same way and a round that changed nothing writes nothing. */
function inTimeOrder(list: AnyRecord[], idOf: (r: AnyRecord) => string): AnyRecord[] {
  return [...list].sort((x, y) => compare(timeOf(x), timeOf(y)) || compare(idOf(x), idOf(y)));
}

/**
 * Of two copies of one record, the one that came first (`firstWins`). Only a copy the app can read (`valid`) and whose
 * stamp is a time counts: a damaged one, its end missing, would read as the first and win, the store's load would drop it,
 * and the next write would take the record out everywhere. Of two that do not count, this device's.
 */
function firstOf(l: AnyRecord, r: AnyRecord, stampOf: (r: AnyRecord) => string, valid: (r: unknown) => boolean = () => true): AnyRecord {
  const when = (v: AnyRecord) => (valid(v) ? momentOf(stampOf(v)) : -Infinity);
  const [lt, rt] = [when(l), when(r)];
  if (rt === -Infinity) return l;
  return lt === -Infinity || rt < lt ? r : l;
}

function mergeCollection(
  { idOf, stampOf, firstWins, valid, neverDeleted, orderOf }: Omit<(typeof COLLECTIONS)[number], 'key'>,
  base: unknown,
  local: unknown,
  remote: unknown,
): AnyRecord[] {
  const b = toMap(base, idOf);
  const l = toMap(local, idOf);
  const r = toMap(remote, idOf);
  const pick = (k: string): AnyRecord | undefined => {
    const bs = stable(b.get(k));
    const lv = l.get(k);
    const rv = r.get(k);
    // A record that is never deleted and is on one side only: that side has it, the other never did.
    if (neverDeleted && (!lv || !rv)) return lv ?? rv;
    const mine = stable(lv) !== bs;
    const theirs = stable(rv) !== bs;
    // Changed on both sides, and the records say when: the newer edit wins, wherever it was made (the older, `firstWins`).
    if (mine && theirs && stampOf && lv && rv) return firstWins ? firstOf(lv, rv, stampOf, valid) : stampOf(rv) > stampOf(lv) ? rv : lv;
    if (mine) return lv;
    if (theirs) return rv;
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
  // Records deleted on both sides are simply absent; those only in base were deleted on one side, unless they are never deleted.
  if (orderOf) return out.sort((x, y) => compare(orderOf(x), orderOf(y)) || compare(idOf(x), idOf(y)));
  const hasTime = out.some((x) => x.at !== undefined || x.date !== undefined);
  return hasTime ? inTimeOrder(out, idOf) : out;
}

/** The running timer as the merge reads it: an item and a start. Anything else, from a damaged file, is no timer. */
function timerOf(v: unknown): AbhyasRunning | null {
  return isObject(v) && typeof v.itemId === 'string' && typeof v.startedAt === 'string' ? (v as AbhyasRunning) : null;
}

/** A time as a number to put moves in order by; one that is not a time comes before every other. */
function momentOf(iso: unknown): number {
  const t = Date.parse(String(iso));
  return Number.isFinite(t) ? t : -Infinity;
}

/**
 * When a side moved its timer since the base: each start (of the timer running there, and of each session it holds that
 * the base does not) and each stop (where those sessions end), each a time. With a timer running at the base, only moments
 * after its start: that timer was started before the base, and so was anything before it, such as a third device's
 * sessions from then, merged in since. A session that ran out at three hours or midnight was stopped by nobody, and a stop
 * inside a timer's first minute writes no session, so neither leaves a moment to go by. A session the app cannot read
 * says nothing.
 */
function movesOf(state: CloudState, before: Map<string, AnyRecord>, b: AbhyasRunning | null): number[] {
  const timer = timerOf(state.abhyasRunning);
  const out = timer ? [momentOf(timer.startedAt)] : [];
  for (const s of toMap(state.abhyasSessions, (r) => String(r.id)).values()) {
    if (!isAbhyasSession(s) || before.has(s.id)) continue;
    out.push(momentOf(s.startedAt));
    if (!ranOut(s)) out.push(momentOf(s.endedAt));
  }
  const since = b ? momentOf(b.startedAt) : -Infinity;
  return out.filter((m) => m > since);
}

/** The base's timer stopped on this side inside its first minute: the side moved off it and holds no session for it. A timer in a shape the app cannot read says nothing either way. */
function stoppedAtOnce(b: AbhyasRunning, state: CloudState, timer: AbhyasRunning | null): boolean {
  if (state.abhyasRunning !== null && timer === null) return false;
  return stable(timer) !== stable(b) && !toMap(state.abhyasSessions, (r) => String(r.id)).has(sessionId(b));
}

/**
 * The Abhyas timer that is running, one value merged three ways, and the sessions with any it stops.
 *
 * One rule, whatever was running at the base. A side has moved when its timer is not the base's or it made a move since: a
 * timer started and stopped there between two syncs leaves the timer as the base had it, and that side still moved. Moved
 * on one side only, that side's timer: a stop on the phone ends a timer the PC left alone, and a start on the PC shows on
 * the phone. Moved on both, the two sides' moves are put in time order, as one device would have made them (`movesOf`): the
 * side that moved last decides, and a timer still running on the other side stops at the first move made after it started
 * there, keeping its minutes, as starting a second item stops the first. So:
 * - started on one device, stopped on the other: a start made after the stop keeps running; a stop made after the start
 *   stops it there, whether it stopped the base's timer or one started since. A stop that leaves nothing to say when it was
 *   made (a timer that ran out by itself, or one stopped inside its first minute) never ends a timer started on the other
 *   side.
 * - a different item started on each: the later start runs, and the earlier timer ends where the later began. The same
 *   item started on both counts from the first start, as one timer would.
 * - stopped on both: no timer, and the same timer's session is one, the stop that came first (`COLLECTIONS`). A stop inside
 *   the first minute writes no session, so when one side stopped the base's timer that way, a session the other side wrote
 *   for it because it ran out by itself (three hours or midnight, `closeStale`) is dropped: Start and Stop tapped by
 *   mistake on the phone, then the PC, closed meanwhile, closing that timer when it opens, leave no three hours nobody
 *   spent. One the other side stopped by hand stays, since the user was at it there.
 * At the same moment a start beats a stop, and of two starts the item first by id, so every device ends on the same timer.
 * With no base every session on a side is new and the same rule applies; with none written, a timer on either side is
 * kept, and of two the later start runs.
 * Sessions already written stay as written: a stop ends only a timer still running. So timers that ran on two devices at
 * once, neither knowing of the other, can overlap for that time, three hours at most.
 */
function mergeRunning(base: Partial<CloudState>, local: CloudState, remote: CloudState, merged: AnyRecord[]): { abhyasRunning: AbhyasRunning | null; abhyasSessions: AnyRecord[] } {
  const [b, l, r] = [timerOf(base.abhyasRunning), timerOf(local.abhyasRunning), timerOf(remote.abhyasRunning)];
  const before = toMap(base.abhyasSessions, (x) => String(x.id));
  const [lm, rm] = [movesOf(local, before, b), movesOf(remote, before, b)];
  const once = b && (stoppedAtOnce(b, local, l) || stoppedAtOnce(b, remote, r)) ? sessionId(b) : null;
  const sessions = once ? merged.filter((s) => !(s.id === once && isAbhyasSession(s) && ranOut(s))) : merged;
  const [movedL, movedR] = [stable(l) !== stable(b) || lm.length > 0, stable(r) !== stable(b) || rm.length > 0];
  if (!movedR || stable(l) === stable(r)) return { abhyasRunning: l, abhyasSessions: sessions };
  if (!movedL) return { abhyasRunning: r, abhyasSessions: sessions };
  const [lastL, lastR] = [Math.max(...lm), Math.max(...rm)];
  const theirs = lastR > lastL || (lastR === lastL && (l === null || (r !== null && r.itemId < l.itemId)));
  const [won, lost, moves] = theirs ? [r, l, rm] : [l, r, lm];
  if (!lost) return { abhyasRunning: won, abhyasSessions: sessions };
  const from = momentOf(lost.startedAt);
  const cut = stop(lost, new Date(Math.min(...moves.filter((m) => m >= from))));
  return { abhyasRunning: won, abhyasSessions: cut ? inTimeOrder(withSession(sessions as AbhyasSession[], cut), (s) => String(s.id)) : sessions };
}

/**
 * Three-way merge. `base` is the file as this device last saw it; null means
 * this device has never synced. With no base there is nothing to say which
 * side changed, so a record present on both sides is taken from the device
 * (what the person is looking at), except a menu: the newer edit stamp wins,
 * so one the app wrote never beats a real edit. A device holding nothing
 * takes the account's copy wholesale: never used, or reset with an old base
 * still about, its emptiness is not a deletion.
 */
export function merge3(base: CloudState | null, local: CloudState, remote: CloudState): CloudState {
  if (isPristine(local) && (base === null || !isPristine(base))) return remote;
  const b = (base ?? {}) as Partial<CloudState>;
  const out = {} as AnyRecord;

  for (const c of COLLECTIONS) {
    out[c.key] = mergeCollection(c, b[c.key], local[c.key], remote[c.key]);
  }

  for (const key of SINGLETONS) {
    if (key === 'version') {
      out.version = Math.max(Number(local.version ?? 0), Number(remote.version ?? 0));
      continue;
    }
    if (key === 'abhyasRunning') {
      Object.assign(out, mergeRunning(b, local, remote, out.abhyasSessions as AnyRecord[]));
      continue;
    }
    const lv = local[key];
    const rv = remote[key];
    const bk = b[key];
    if (base === null) {
      // Unknown history: keep what this device has, fall back to the account's.
      out[key] = lv !== undefined && lv !== null ? lv : rv;
    } else if (BY_FIELD.has(key) && isObject(lv) && isObject(rv) && isObject(bk)) {
      out[key] = mergeFields(bk, lv, rv, BY_FIELD.get(key));
    } else {
      out[key] = pick(bk, lv, rv);
    }
  }

  // Nothing on or before the day the store moved to this version (`autoFillFrom`) is filled in from the plan. Two devices
  // that moved on different days keep the later, whichever side the profile came from: a day lived with nothing filled in
  // is never filled in afterwards, and every device ends on the same day.
  const moved = [local.profile?.autoFillFrom, remote.profile?.autoFillFrom].filter((d): d is string => typeof d === 'string').sort().pop();
  if (moved && isObject(out.profile) && out.profile.autoFillFrom !== moved) out.profile = { ...out.profile, autoFillFrom: moved };

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

/** The account file as the relay hands it over: its text, and which version that is. */
export type AccountFile = { state: string | null; modifiedTime: string | null };
export type WriteResult = { ok: true; modifiedTime: string } | { ok: false; stale: AccountFile };

/** Why a round stopped without an answer to remember. */
export class RoundStop extends Error {
  constructor(public readonly reason: 'abandoned' | 'update_app' | 'unreadable' | 'kept_changing') {
    super(reason);
  }
}

export type RoundIO = {
  /** This device's state as it is now, every change already made included. */
  readNow: () => Promise<AppState>;
  /** Put a merge worked out from `local` on the device. */
  land: (local: CloudState, merged: CloudState) => void;
  get: () => Promise<AccountFile>;
  /** Write the file, built on version `baseModifiedTime`; refused if the file has moved past it. */
  put: (state: CloudState, baseModifiedTime: string | null) => Promise<WriteResult>;
  /** False once the account changed: whatever comes back then belongs to nobody here. */
  live: () => boolean;
};

/**
 * The account's file as a state, or null when there is no file yet. A file
 * that is there but not a state is refused: merged, it would read as every
 * record deleted elsewhere; written over, it would be gone.
 */
export function readAccountFile(text: string | null): CloudState | null {
  if (!text) return null;
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    throw new RoundStop('unreadable');
  }
  if (!isObject(v) || !isObject(v.profile) || !Array.isArray(v.meals)) throw new RoundStop('unreadable');
  if (COLLECTIONS.some(({ key }) => v[key] !== undefined && !Array.isArray(v[key]))) throw new RoundStop('unreadable');
  return v as unknown as CloudState;
}

/**
 * One round: push if there are changes, pull if asked, merge whatever the
 * relay says is newer, land it on the device and write it back. Resolves with
 * the file the account now holds, or null when nothing moved on either side.
 *
 * When a write is refused because another device wrote first, this device
 * already holds the file it just merged, so that file, not the older base, is
 * what the next try is merged against: otherwise an edit made elsewhere
 * between the two tries would read as undone here.
 */
export async function syncRound(o: {
  pull: boolean;
  base: CloudState | null;
  modifiedTime: string | null;
  /** The newest state version this build understands. */
  supported: number;
  /**
   * Brings a file from an older build up to this one: the store's migration, handed in because this module cannot reach
   * it. The file and the base both go through it, so it must give the same answer for the same file all round.
   */
  upgrade: (file: CloudState) => CloudState;
  io: RoundIO;
  tries?: number;
}): Promise<{ base: CloudState; modifiedTime: string | null } | null> {
  const { io } = o;
  const check = () => {
    if (!io.live()) throw new RoundStop('abandoned');
  };
  const older = (f: CloudState) => typeof f.version !== 'number' || f.version < o.supported;
  let base = o.base;
  let baseTime = o.modifiedTime;
  // A file already in hand, from a refused write.
  let inHand: AccountFile | null = null;
  for (let attempt = 0; attempt < (o.tries ?? 3); attempt++) {
    if (base && fromNewerApp(base, o.supported)) throw new RoundStop('update_app');
    const local = forCloud(await io.readNow());
    check();
    let remote = inHand;
    if (!remote) {
      const changed = base === null || !sameCloud(local, base);
      if (changed && !o.pull && base !== null) {
        // The common case: push on top of the version we know.
        const res = await io.put(local, baseTime);
        check();
        if (res.ok) return { base: local, modifiedTime: res.modifiedTime };
        remote = res.stale;
      } else {
        remote = await io.get();
        check();
        if (!changed && remote.modifiedTime === baseTime) return null;
      }
    }
    // Checked as read: brought up first, it would carry this build's version and hide that it is newer.
    const raw = readAccountFile(remote.state);
    if (raw && fromNewerApp(raw, o.supported)) throw new RoundStop('update_app');
    // An older file, and the base it is merged against, go through this build's migration first. Merged as they are, the
    // file's version would be lost to this one and its migration skipped, and this device's own migration would read as
    // an edit made here and win over a change another older device made since.
    const theirs = raw && older(raw) ? o.upgrade(raw) : raw;
    const from = base && older(base) ? o.upgrade(base) : base;
    const merged = theirs ? merge3(from, local, theirs) : local;
    if (!sameCloud(merged, local)) io.land(local, merged);
    // The account already has exactly this; nothing to write. Compared with the file as it is, so an older one is written
    // back once at this version, and a copy brought up here is never remembered as the account's without being written.
    if (raw && sameCloud(merged, raw)) return { base: merged, modifiedTime: remote.modifiedTime };
    const res = await io.put(merged, remote.modifiedTime);
    check();
    if (res.ok) return { base: merged, modifiedTime: res.modifiedTime };
    // The base is what the account really held; the next try brings it up again.
    base = raw;
    baseTime = remote.modifiedTime;
    inHand = res.stale;
  }
  throw new RoundStop('kept_changing');
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
 * account left on the device is put aside for them before anything syncs
 * (`move.from` names whose it is), so none of it reaches this account and none
 * of it is lost; what was put aside for this account comes back with it,
 * also onto a device a sign-out left empty (`move.from` null). The device is
 * tagged as this account's at once, not after a sync that may never come. A
 * saved base only describes the account it was saved for, and only the state
 * it was saved beside: if that state could not be read, nothing on disk is
 * known to be anyone's.
 */
export function bindStart(o: {
  uid: string;
  owner: string | null;
  saved: SavedBase | null;
  loaded: boolean;
  /** Something was put aside on this device for this account. */
  parked: boolean;
  /** The device holds nothing worth keeping. */
  empty: boolean;
}): {
  move: { from: string | null } | null;
  tag: boolean;
  base: CloudState | null;
  modifiedTime: string | null;
} {
  if (!o.loaded) return { move: null, tag: false, base: null, modifiedTime: null };
  const holder = o.owner ?? o.saved?.uid ?? null;
  if (holder !== null && holder !== o.uid) return { move: { from: holder }, tag: true, base: null, modifiedTime: null };
  if (holder === null && o.parked && o.empty) return { move: { from: null }, tag: true, base: null, modifiedTime: null };
  if (!o.saved || o.saved.uid !== o.uid) return { move: null, tag: true, base: null, modifiedTime: null };
  return { move: null, tag: true, base: o.saved.base, modifiedTime: o.saved.modifiedTime };
}

/**
 * Whether the account holds everything on this device that it should: the
 * file it was last seen holding is exactly the device's record. A status that
 * says "synced" can be a moment behind an edit; this cannot.
 */
export function inAccount(base: CloudState | null, now: AppState): boolean {
  return base !== null && sameCloud(forCloud(now), base);
}

/**
 * What signing out does to this device. It is only handed back empty when
 * the account is known to hold everything; with sync not set up there is no
 * account copy at all, so the device's copy is the only one, and a store that
 * could not be read may hold what no account has. Otherwise the person is
 * asked first, and if they sign out anyway the data stays on the device for
 * the same account to pick up again.
 */
export function signOutPlan(o: { configured: boolean; upToDate: boolean; force: boolean; loaded: boolean }): 'wipe' | 'keep' | 'ask' {
  if (o.configured && o.upToDate && o.loaded) return 'wipe';
  return o.force ? 'keep' : 'ask';
}
