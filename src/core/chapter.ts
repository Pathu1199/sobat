import { daysBetween, isIsoDate } from './date';
import type { DayMenu } from './menu';
import { recordStreak, STREAK_LOOKBACK_DAYS } from './record';
import type { Routine } from './routine';
import { bestStreak, shownWeight } from './tileText';
import type { ISODate, Meal, Profile, SlotSkip, WeightLog } from './types';

/**
 * A new chapter: the climb starts again from the weight Progress shows (the
 * weight smoothed over a week, `shownWeight`, so Lost reads 0 on the first
 * day) and today, and the weekly challenge, the streak shown and the best run
 * count from that day. The very first start is kept, so the kilo badges still
 * count the whole journey, and the points and the streak badges count the
 * streak of the whole journey. Nothing is deleted. Pure.
 */
export function newChapter(
  profile: Pick<Profile, 'weightKg' | 'startWeightKg' | 'firstStartWeightKg'>,
  weights: WeightLog[],
  today: ISODate,
): Required<Pick<Profile, 'startWeightKg' | 'chapterStart' | 'firstStartWeightKg'>> {
  const earliest = [...weights].sort((a, b) => a.date.localeCompare(b.date))[0];
  return {
    startWeightKg: shownWeight(weights, today)?.kg ?? profile.weightKg,
    chapterStart: today,
    // The start as planFrom reads it: the profile's, else the first weigh-in, else the profile weight.
    firstStartWeightKg: profile.firstStartWeightKg ?? profile.startWeightKg ?? earliest?.kg ?? profile.weightKg,
  };
}

/**
 * The chapter's first day, while there is a chapter: a real date, on or
 * before today. A start that is not a date (a damaged file) or still to come
 * (a clock ahead on another device) is no chapter, and limits nothing.
 */
export function chapterSince(start: unknown, today: ISODate): ISODate | undefined {
  return isIsoDate(start) && start <= today ? start : undefined;
}

/** How many days back from today, today included, the streak may look: no further than the chapter's first day, and never more than `max`. */
export function chapterDays(start: ISODate | undefined, today: ISODate, max: number): number {
  const since = chapterSince(start, today);
  return since ? Math.min(max, daysBetween(since, today) + 1) : max;
}

export type ChapterStreaks = {
  /** Full record days in a row, from the chapter's first day at most: the streak tile's number. */
  days: number;
  /** The best run in the same window: the streak tile's "Best". */
  best: number;
  /** The same two over the whole journey (the streak's own window), a chapter or not: the points and the streak badges count these. */
  lifetimeDays: number;
  lifetimeBest: number;
};

/**
 * The streak and the best run twice over: from the chapter's first day, as
 * the streak tile shows them, and over the whole journey, which the points and
 * the streak badges count, so a new chapter takes none of them away. Both by
 * the record's one rule (`recordStreak`, `bestStreak`). Each date's menu is
 * read once for all four.
 */
export function chapterStreaks(input: {
  today: ISODate;
  routine: Routine;
  meals: Meal[];
  skips: SlotSkip[];
  offDays: number[];
  floor: number;
  menuOn: (date: ISODate) => DayMenu | null;
  chapterStart?: ISODate;
}): ChapterStreaks {
  const menus = new Map<ISODate, DayMenu | null>();
  const menuOn = (date: ISODate) => {
    if (!menus.has(date)) menus.set(date, input.menuOn(date));
    return menus.get(date) ?? null;
  };
  const record = { today: input.today, routine: input.routine, meals: input.meals, skips: input.skips, offDays: input.offDays, floor: input.floor, menuOn };
  const window = chapterDays(input.chapterStart, input.today, STREAK_LOOKBACK_DAYS);
  const lifetimeDays = recordStreak({ ...record, limit: STREAK_LOOKBACK_DAYS });
  const lifetimeBest = bestStreak({ ...record, days: STREAK_LOOKBACK_DAYS });
  if (window === STREAK_LOOKBACK_DAYS) return { days: lifetimeDays, best: lifetimeBest, lifetimeDays, lifetimeBest };
  return { days: recordStreak({ ...record, limit: window }), best: bestStreak({ ...record, days: window }), lifetimeDays, lifetimeBest };
}
