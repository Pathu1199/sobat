import { itemsOn, type AbhyasData } from './abhyas';
import { WALK_ACTIVITY_ID } from './activity';
import { addDays, daysBetween, localDate } from './date';
import type { ActivityLog, ISODate, Meal, WaterLog } from './types';
import { isOffDay } from './week';
import { fill } from '../i18n';

/**
 * Today's challenge: one small, achievable step a day, worked out from the
 * user's own last seven days, new every day and harder as they improve. One
 * area a day, in turn among those the last week says something about: water,
 * walk minutes, the start time of a timed routine job, and protein. (Logging
 * the first meal by a time is not one: a meal logged from the plan is stamped
 * with its slot's time, so it would count as done without the user doing
 * anything.) The target is a little past the user's own usual and capped so
 * it stays doable: never past the day's water goal or protein target, a walk
 * never past an hour, a start time never earlier than the earliest the week
 * already managed. With no history yet there is still one: two bottles of
 * water or a ten-minute walk. Nothing on an off day, nor when every area is
 * switched off. Worked out from the days before, never from the day itself,
 * so it holds all day; pure, so the count of challenges done is worked out
 * again from the logs whenever it is needed, the same on every device.
 */
export type ChallengeKind = 'water' | 'walk' | 'start' | 'protein';

export type DailyChallenge = {
  date: ISODate;
  kind: ChallengeKind;
  /** Bottles, walk minutes or grams of protein; for 'start', the minute of the day to do it by. */
  target: number;
  /** The user's usual over the last seven days, in the same unit. */
  usual: number;
  /** For 'start': the job, and its name for the words. */
  itemId?: string;
  name?: string;
};

export type ChallengeData = {
  meals: Meal[];
  water: WaterLog[];
  activities: ActivityLog[];
  /** The routine list; the running timer counts as started when it started on the day. */
  abhyas: AbhyasData;
  bottleMl: number;
  waterGoalMl: number;
  proteinTarget: number;
  offDays: number[];
  /** Whether the Today card `waterWalk` is on (`settings.todayCards`); left out is on. Off offers no water or walk challenge. */
  waterWalk?: boolean;
  /** Whether the Today card `abhyas` is on (`settings.todayCards`); left out is on. Off offers no job-start challenge. */
  routine?: boolean;
};

/** The days the challenge reads before its own. */
export const CHALLENGE_WINDOW = 7;
/** The fewest bottles a water challenge asks for, below the goal. */
export const WATER_MIN = 2;
/** The walk challenge's floor and ceiling, in minutes. */
export const WALK_MIN = 10;
export const WALK_MAX = 60;
/** Days of the last seven with something to go by before a start time or protein is a challenge. */
export const DAYS_TO_GO_BY = { start: 2, protein: 3 } as const;
/** How far back the count of challenges done looks. */
export const CHALLENGE_LOOKBACK_DAYS = 400;
/** The day the turn of areas counts from: any Monday. */
const EPOCH = '2026-01-05';

/** What one day held: water, walking, protein, whether anything was eaten, and when each job's timer first started. */
type DayFacts = { waterMl: number; walkMin: number; protein: number; ate: boolean; starts: Map<string, number> };

const minuteOf = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const up5 = (n: number) => Math.ceil(n / 5) * 5;
const down5 = (n: number) => Math.floor(n / 5) * 5;

function byDate<T extends { date: ISODate }>(list: T[]): Map<ISODate, T[]> {
  const out = new Map<ISODate, T[]>();
  for (const r of list) out.set(r.date, [...(out.get(r.date) ?? []), r]);
  return out;
}

/** Each date's facts, worked out once per date for as long as the index lives. */
function factsIndex(data: ChallengeData): (date: ISODate) => DayFacts {
  const meals = byDate(data.meals);
  const water = byDate(data.water);
  const walks = byDate(data.activities.filter((a) => a.activityId === WALK_ACTIVITY_ID));
  const sessions = byDate(data.abhyas.sessions);
  const cache = new Map<ISODate, DayFacts>();
  return (date) => {
    const kept = cache.get(date);
    if (kept) return kept;
    const eaten = meals.get(date) ?? [];
    const starts = new Map<string, number>();
    const started = (itemId: string, at: number) => starts.set(itemId, Math.min(at, starts.get(itemId) ?? at));
    for (const s of sessions.get(date) ?? []) started(s.itemId, minuteOf(s.startedAt));
    const run = data.abhyas.running;
    if (run && localDate(run.startedAt) === date) started(run.itemId, minuteOf(run.startedAt));
    const facts: DayFacts = {
      waterMl: (water.get(date) ?? []).reduce((a, w) => a + w.ml, 0),
      walkMin: (walks.get(date) ?? []).reduce((a, w) => a + w.minutes, 0),
      protein: eaten.reduce((a, m) => a + m.protein, 0),
      ate: eaten.length > 0,
      starts,
    };
    cache.set(date, facts);
    return facts;
  };
}

/** Every area the last seven days say something about, in turn order. */
function choicesWith(data: ChallengeData, facts: (date: ISODate) => DayFacts, date: ISODate): DailyChallenge[] {
  const past = Array.from({ length: CHALLENGE_WINDOW }, (_, i) => facts(addDays(date, i - CHALLENGE_WINDOW)));
  const out: DailyChallenge[] = [];
  if (data.waterWalk !== false) {
    if (data.waterGoalMl > 0 && data.bottleMl > 0) {
      const goal = Math.ceil(data.waterGoalMl / data.bottleMl);
      const usual = Math.round(avg(past.map((f) => f.waterMl)) / data.bottleMl);
      out.push({ date, kind: 'water', target: Math.min(goal, Math.max(WATER_MIN, usual + 1)), usual });
    }
    const walked = Math.round(avg(past.map((f) => f.walkMin)));
    out.push({ date, kind: 'walk', target: Math.min(WALK_MAX, Math.max(WALK_MIN, up5(walked + 5))), usual: walked });
  }
  const jobs = data.routine === false ? [] : itemsOn(data.abhyas.items, date);
  for (const item of jobs) {
    if (!(typeof item.targetMin === 'number' && item.targetMin > 0)) continue;
    const starts = past.map((f) => f.starts.get(item.id)).filter((m): m is number => m !== undefined);
    if (starts.length < DAYS_TO_GO_BY.start) continue;
    const usual = Math.round(avg(starts));
    out.push({ date, kind: 'start', target: Math.max(Math.min(...starts), down5(usual) - 15), usual, itemId: item.id, name: item.name });
    break;
  }
  const ate = past.filter((f) => f.ate);
  const protein = Math.round(avg(ate.map((f) => f.protein)));
  if (data.proteinTarget > 0 && ate.length >= DAYS_TO_GO_BY.protein && protein < data.proteinTarget) {
    out.push({ date, kind: 'protein', target: Math.min(data.proteinTarget, up5(protein + 10)), usual: protein });
  }
  return out;
}

function challengeWith(data: ChallengeData, facts: (date: ISODate) => DayFacts, date: ISODate): DailyChallenge | null {
  if (isOffDay(data.offDays, date)) return null;
  const list = choicesWith(data, facts, date);
  if (list.length === 0) return null;
  const turn = daysBetween(EPOCH, date) % list.length;
  return list[(turn + list.length) % list.length];
}

/** Every challenge a date could have, one per area its last seven days say something about, in turn order; the day's is one of them (`dailyChallenge`). */
export function challengeChoices(data: ChallengeData, date: ISODate): DailyChallenge[] {
  return choicesWith(data, factsIndex(data), date);
}

/** The challenge for a date: one area in turn among those its last seven days say something about; null on an off day or with every area switched off. */
export function dailyChallenge(data: ChallengeData, date: ISODate): DailyChallenge | null {
  return challengeWith(data, factsIndex(data), date);
}

export type ChallengeProgress = { n: number; of: number; done: boolean };

function progressWith(data: ChallengeData, facts: (date: ISODate) => DayFacts, ch: DailyChallenge): ChallengeProgress {
  const f = facts(ch.date);
  if (ch.kind === 'start') {
    const at = f.starts.get(ch.itemId ?? '');
    const done = at !== undefined && at <= ch.target;
    return { n: done ? 1 : 0, of: 1, done };
  }
  const n = ch.kind === 'water' ? Math.floor(f.waterMl / Math.max(1, data.bottleMl)) : ch.kind === 'walk' ? f.walkMin : Math.round(f.protein);
  return { n, of: ch.target, done: n >= ch.target };
}

/** How far the day has come: bottles, minutes or grams of the target, or for a start time, 1 of 1 once the job started by then. */
export function challengeProgress(data: ChallengeData, ch: DailyChallenge): ChallengeProgress {
  return progressWith(data, factsIndex(data), ch);
}

/** The first date with anything logged: a meal, water, a walk, a tick or a timer. Null with nothing. */
function firstLogged(data: ChallengeData): ISODate | null {
  let first: ISODate | null = null;
  for (const list of [data.meals, data.water, data.activities, data.abhyas.ticks, data.abhyas.sessions] as { date: ISODate }[][]) {
    for (const r of list) if (first === null || r.date < first) first = r.date;
  }
  return first;
}

/**
 * Challenges done, each day's once, from the first day with anything logged
 * (at most `CHALLENGE_LOOKBACK_DAYS` back) to today: the "challenges done"
 * medals count these. Finished timers only, so the count moves when a timer
 * stops, not while it runs.
 */
export function challengesDone(data: ChallengeData, today: ISODate): number {
  const first = firstLogged(data);
  if (!first) return 0;
  const finished = { ...data, abhyas: { ...data.abhyas, running: null } };
  const facts = factsIndex(finished);
  const from = first > addDays(today, 1 - CHALLENGE_LOOKBACK_DAYS) ? first : addDays(today, 1 - CHALLENGE_LOOKBACK_DAYS);
  let n = 0;
  for (let date = from; date <= today; date = addDays(date, 1)) {
    const ch = challengeWith(finished, facts, date);
    if (ch && progressWith(finished, facts, ch).done) n += 1;
  }
  return n;
}

/** A minute of the day as the app writes a time, "07:05". */
export function clockOf(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

/** The challenge in the user's language: "Walk 15 min, 5 more than your usual", "Start Coding by 20:00". */
export function challengeText(ch: DailyChallenge, t: (key: string) => string): string {
  switch (ch.kind) {
    case 'water': {
      // One bottle is a singular word in Marathi and English, so it has its own line.
      const more = ch.target > ch.usual;
      const key = ch.target === 1 ? (more ? 'chal_water_more_one' : 'chal_water_one') : more ? 'chal_water_more' : 'chal_water';
      return fill(t(key), { n: ch.target, d: ch.target - ch.usual });
    }
    case 'walk':
      return fill(t(ch.target > ch.usual ? 'chal_walk_more' : 'chal_walk'), { n: ch.target, d: ch.target - ch.usual });
    case 'protein':
      return fill(t('chal_protein'), { n: ch.target, d: ch.target - ch.usual });
    case 'start':
      return fill(t(ch.target < ch.usual ? 'chal_start_earlier' : 'chal_start'), { name: ch.name ?? '', time: clockOf(ch.target) });
  }
}
