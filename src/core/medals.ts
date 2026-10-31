import { addDays } from './date';
import type { ISODate } from './types';
import { fill } from '../i18n';

/**
 * Medals: the one reward system. A medal is earned from the logs, worked out
 * again every time like everything else in the app, and kept once celebrated:
 * its id goes into `celebrated` (the same "earned, and celebrated once" the
 * old badges used), so a run that ends or a kilo that comes back never takes
 * a medal away. The tracks: days in a row of the meal record and of the
 * routine (3, 7, 21, 30, 66 and 100, each streak with its shield), each kilo
 * lost from the very first start, halfway to the goal, the goal reached, a
 * perfect week of a routine job, and challenges done (10, 30 and 100). The
 * old streak and kilo badges a user won count as the medals they became. A
 * perfect week is kept once celebrated like the rest: editing the job later,
 * with a day added or more minutes asked, never takes it off the shelf.
 * Pure.
 */
export type MedalTrack = 'meals' | 'routine' | 'kg' | 'halfway' | 'goal' | 'week' | 'challenges';

export const STREAK_MEDALS = [3, 7, 21, 30, 66, 100] as const;
export const CHALLENGE_MEDALS = [10, 30, 100] as const;
/** The tracks in the order the shelf and the celebrations take them. */
export const TRACKS: readonly MedalTrack[] = ['meals', 'routine', 'kg', 'halfway', 'goal', 'week', 'challenges'];

/**
 * A medal: its id (what `celebrated` keeps), its track, its number (days, kilos, challenges; 1 for the rest), and for a
 * perfect week the job (`itemId`), the Monday of the week, and the job's name when it is known.
 */
export type Medal = { id: string; track: MedalTrack; n: number; name?: string; itemId?: string; monday?: ISODate };

export type MedalInput = {
  /** The meal record's streak now and its best run over the whole journey, both with the shield. */
  meals: { now: number; best: number };
  /** The routine's streak now and its best run, with the shield; null while the user has no list. */
  routine: { now: number; best: number } | null;
  /** Kilos lost from the very first start to the weight shown, and from that start to the goal: 0 or less is no loss to aim for, and no kilo medals. */
  lostKg: number;
  totalKg: number;
  /** Perfect weeks of routine jobs that hold now (`perfectWeeks`), each with its job's name. */
  weeks: { itemId: string; monday: ISODate; name: string }[];
  /** The name of every job on the list by id, removed ones too (`namesOfJobs`): a perfect week kept after its job changed is named from it. */
  jobNames?: Readonly<Record<string, string>>;
  /** Challenges done (`challengesDone`). */
  challengesDone: number;
  celebrated: readonly string[] | null | undefined;
};

/** The badge each medal was before medals, so a badge already won is the medal won. */
const LEGACY: Record<string, string> = {
  'medal:meals:7': 'badge:streak_7',
  'medal:meals:30': 'badge:streak_30',
  'medal:kg:1': 'badge:kg_1',
  'medal:kg:5': 'badge:kg_5',
  'medal:halfway': 'badge:halfway',
  'medal:goal': 'badge:summit',
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The most kilo medals one can have: a number past it is a damaged file, and no reason to loop on. */
const MAX_KG_MEDALS = 300;

/** A kilo count as a finite number: one that is not a number (damaged data) is no kilos at all. */
const finite = (n: number) => (Number.isFinite(n) ? n : 0);

/** The name of every job in the list by its id, a removed (archived) job's too, for `MedalInput.jobNames`. */
export function namesOfJobs(items: readonly { id: string; name: string }[]): Record<string, string> {
  return Object.fromEntries(items.map((i) => [i.id, i.name]));
}

const WEEK_ID = /^medal:week:(.+):(\d{4}-\d{2}-\d{2})$/;

/** The perfect weeks to show: those that hold now, then every one celebrated whether or not its job's days or minutes still make it one, oldest week first. */
function weekMedals(input: MedalInput, kept: ReadonlySet<string>): Medal[] {
  const weeks: { itemId: string; monday: ISODate; name: string | undefined }[] = input.weeks.map((w) => ({ ...w, name: w.name || input.jobNames?.[w.itemId] }));
  const have = new Set(weeks.map((w) => `medal:week:${w.itemId}:${w.monday}`));
  for (const id of kept) {
    const found = WEEK_ID.exec(id);
    if (found && !have.has(id)) weeks.push({ itemId: found[1], monday: found[2], name: input.jobNames?.[found[1]] });
  }
  // Array.sort is stable: the weeks of one Monday stay in the user's order, those that still hold first.
  weeks.sort((a, b) => (a.monday < b.monday ? -1 : a.monday > b.monday ? 1 : 0));
  return weeks.map((w) => ({ id: `medal:week:${w.itemId}:${w.monday}`, track: 'week', n: 1, itemId: w.itemId, monday: w.monday, ...(w.name ? { name: w.name } : {}) }));
}

/** Every medal earned, in the shelf's order: by rule now, or kept because it was celebrated (as itself or as the badge it was). */
export function earnedMedals(input: MedalInput): Medal[] {
  const kept = new Set(input.celebrated ?? []);
  const has = (id: string) => kept.has(id) || (LEGACY[id] !== undefined && kept.has(LEGACY[id]));
  const out: Medal[] = [];
  const steps = (track: MedalTrack, list: readonly number[], reached: number) => {
    for (const n of list) if (reached >= n || has(`medal:${track}:${n}`)) out.push({ id: `medal:${track}:${n}`, track, n });
  };
  steps('meals', STREAK_MEDALS, Math.max(input.meals.now, input.meals.best));
  steps('routine', STREAK_MEDALS, input.routine ? Math.max(input.routine.now, input.routine.best) : 0);
  const [lostKg, totalKg] = [finite(input.lostKg), finite(input.totalKg)];
  const kilos = new Set<number>();
  if (totalKg > 0) for (let k = 1; k <= Math.min(Math.floor(lostKg + 1e-9), MAX_KG_MEDALS); k++) kilos.add(k);
  for (const id of Object.keys(LEGACY)) if (id.startsWith('medal:kg:') && has(id)) kilos.add(Number(id.slice(9)));
  for (const id of kept) if (/^medal:kg:\d+$/.test(id)) kilos.add(Number(id.slice(9)));
  for (const k of [...kilos].sort((a, b) => a - b)) out.push({ id: `medal:kg:${k}`, track: 'kg', n: k });
  if ((totalKg > 0 && lostKg >= totalKg / 2) || has('medal:halfway')) out.push({ id: 'medal:halfway', track: 'halfway', n: 1 });
  if ((totalKg > 0 && lostKg >= totalKg) || has('medal:goal')) out.push({ id: 'medal:goal', track: 'goal', n: 1 });
  out.push(...weekMedals(input, kept));
  steps('challenges', CHALLENGE_MEDALS, input.challengesDone);
  return out;
}

/** A medal still to earn, with how far it is: days, kilos (to one decimal) or challenges. */
export type NextMedal = Medal & { toGo: number };

/** The next medal of each track still to earn, in the shelf's order: none for a track with every medal earned, the routine with no list, or the kilos with no loss to aim for. */
export function nextMedals(input: MedalInput, earned: readonly Medal[]): NextMedal[] {
  const ids = new Set(earned.map((m) => m.id));
  const out: NextMedal[] = [];
  const step = (track: MedalTrack, list: readonly number[], now: number) => {
    const n = list.find((x) => !ids.has(`medal:${track}:${x}`));
    if (n !== undefined) out.push({ id: `medal:${track}:${n}`, track, n, toGo: Math.max(1, n - now) });
  };
  step('meals', STREAK_MEDALS, input.meals.now);
  if (input.routine) step('routine', STREAK_MEDALS, input.routine.now);
  const [lostKg, totalKg] = [finite(input.lostKg), finite(input.totalKg)];
  if (totalKg > 0) {
    const top = earned.filter((m) => m.track === 'kg').reduce((a, m) => Math.max(a, m.n), 0);
    const k = top + 1;
    if (k <= Math.ceil(totalKg)) out.push({ id: `medal:kg:${k}`, track: 'kg', n: k, toGo: Math.max(0.1, round1(k - lostKg)) });
    if (!ids.has('medal:halfway')) out.push({ id: 'medal:halfway', track: 'halfway', n: 1, toGo: Math.max(0.1, round1(totalKg / 2 - lostKg)) });
    if (!ids.has('medal:goal')) out.push({ id: 'medal:goal', track: 'goal', n: 1, toGo: Math.max(0.1, round1(totalKg - lostKg)) });
  }
  step('challenges', CHALLENGE_MEDALS, input.challengesDone);
  return out;
}

/** One place on the trophy shelf: a medal earned (the kilos as the highest one, a job's perfect weeks as one with how many), or the next to earn. */
export type ShelfTile = { key: string; track: MedalTrack; n: number; earned: boolean; name?: string; count?: number; toGo?: number };

/** The trophy shelf: every medal earned, then the next one of each track, each in the tracks' order. */
export function shelf(input: MedalInput): ShelfTile[] {
  const earned = earnedMedals(input);
  const tiles: ShelfTile[] = [];
  for (const m of earned) {
    if (m.track === 'kg') continue;
    if (m.track === 'week') {
      const same = tiles.find((x) => x.track === 'week' && x.key === `week:${m.itemId}`);
      if (same) {
        same.count = (same.count ?? 1) + 1;
        same.name ??= m.name;
      } else tiles.push({ key: `week:${m.itemId}`, track: 'week', n: 1, earned: true, ...(m.name ? { name: m.name } : {}), count: 1 });
      continue;
    }
    tiles.push({ key: m.id, track: m.track, n: m.n, earned: true });
  }
  const kilos = earned.filter((m) => m.track === 'kg');
  if (kilos.length > 0) tiles.push({ key: 'medal:kg', track: 'kg', n: kilos[kilos.length - 1].n, earned: true });
  tiles.sort((a, b) => TRACKS.indexOf(a.track) - TRACKS.indexOf(b.track));
  for (const m of nextMedals(input, earned)) tiles.push({ key: `next:${m.id}`, track: m.track, n: m.n, earned: false, toGo: m.toGo });
  return tiles;
}

/** What a medal's face carries: its number for a streak, a kilo or challenges, ½ halfway, ★ at the goal, ✓ for a perfect week. */
export function medalFace(track: MedalTrack, n: number): string {
  if (track === 'halfway') return '½';
  if (track === 'goal') return '★';
  if (track === 'week') return '✓';
  return String(n);
}

/** A medal's title and its line, for the celebration: "21 days of your routine in a row", and a word of what it took. */
export function medalWords(m: Pick<Medal, 'track' | 'n' | 'name'>, t: (key: string) => string): { title: string; line: string } {
  const title =
    m.track === 'meals' || m.track === 'routine' || m.track === 'kg' || m.track === 'challenges'
      ? fill(t(`medal_${m.track}_title`), { n: m.n })
      : m.track === 'week'
        ? m.name
          ? fill(t('medal_week'), { name: m.name })
          : t('medal_week_any')
        : t(`medal_${m.track}`);
  const line = t(m.track === 'meals' || m.track === 'routine' ? 'medal_sub_streak' : `medal_sub_${m.track}`);
  return { title, line };
}

/** A shelf tile's words: its name ("21 days", "Halfway to your goal") and, under it, its track for a streak and how far a medal still to earn is. */
export function shelfWords(tile: ShelfTile, t: (key: string) => string): { label: string; sub: string | null } {
  const streak = tile.track === 'meals' || tile.track === 'routine';
  const label = streak ? fill(t('medal_streak_days'), { n: tile.n }) : tile.track === 'kg' || tile.track === 'challenges' ? fill(t(`medal_${tile.track}_title`), { n: tile.n }) : medalWords(tile, t).title;
  const toGo = tile.toGo === undefined ? null : fill(t(tile.track === 'kg' || tile.track === 'halfway' || tile.track === 'goal' ? 'medal_to_go_kg' : 'medal_to_go'), { n: tile.toGo });
  const parts = [streak ? t(`medal_track_${tile.track}`) : null, toGo, tile.count && tile.count > 1 ? `×${tile.count}` : null].filter((x): x is string => x !== null);
  return { label, sub: parts.length > 0 ? parts.join(' · ') : null };
}

/** Marks the store's celebrated ids as seeded for medals: until it is there, every medal already earned is marked seen at once, with no celebration. */
export const MEDALS_SEEDED = 'medals:seeded';

/** The id a day's challenge done is celebrated under. */
export function challengeWinId(date: ISODate): string {
  return `challenge:day:${date}`;
}

export type Win = { id: string; kind: 'medal'; medal: Medal } | { id: string; kind: 'challenge'; date: ISODate };

/** A perfect week whose Sunday is more than this many days back is no news: it turns up when a job's edit makes an old week hold again. */
export const WEEK_NEWS_DAYS = 7;

/**
 * Which win to celebrate next: a medal earned, then today's challenge done,
 * each once. The first time this runs with medals (no `MEDALS_SEEDED` in the
 * ids yet, a new user or one coming from the badges) everything already
 * earned is marked seen, the challenge too, rather than celebrated in a
 * flood. Later, a perfect week not seen yet whose last day was more than
 * `WEEK_NEWS_DAYS` ago (a job edit brought old weeks back, perhaps many) is
 * marked seen the same way and never celebrated: it comes back in `seed` and
 * is left out of `next`, whether or not something is `waiting`, as marking
 * says nothing. While `waiting` (the add sheet open, a toast or a line with
 * Undo on screen) nothing is celebrated yet.
 */
export function nextWin(input: { medals: readonly Medal[]; challengeDone: boolean; today: ISODate; celebrated: readonly string[] | null | undefined; waiting?: boolean }): { seed: string[] | null; next: Win | null } {
  const wins: Win[] = [...input.medals.map((medal) => ({ id: medal.id, kind: 'medal' as const, medal })), ...(input.challengeDone ? [{ id: challengeWinId(input.today), kind: 'challenge' as const, date: input.today }] : [])];
  if (!input.celebrated?.includes(MEDALS_SEEDED)) return { seed: [MEDALS_SEEDED, ...wins.map((w) => w.id)], next: null };
  const seen = new Set(input.celebrated);
  const from = addDays(input.today, -WEEK_NEWS_DAYS);
  const old = new Set(wins.filter((w) => w.kind === 'medal' && w.medal.track === 'week' && w.medal.monday !== undefined && addDays(w.medal.monday, 6) < from && !seen.has(w.id)).map((w) => w.id));
  const seed = old.size > 0 ? [...old] : null;
  if (input.waiting) return { seed, next: null };
  return { seed, next: wins.find((w) => !seen.has(w.id) && !old.has(w.id)) ?? null };
}

/** How long a day's challenge stays among the celebrated ids: a fortnight, so the list never grows by one a day for good. */
export const CHALLENGE_IDS_KEEP_DAYS = 14;

/** The celebrated ids with `ids` added, once each, and every day's challenge older than a fortnight dropped; medals, badges and everything else stay. */
export function withCelebrated(celebrated: readonly string[] | null | undefined, ids: readonly string[], today: ISODate): string[] {
  const from = addDays(today, -CHALLENGE_IDS_KEEP_DAYS);
  const day = challengeWinId('');
  return [...new Set([...(celebrated ?? []), ...ids])].filter((id) => !(id.startsWith(day) && id.slice(day.length) < from));
}
