import { describe, expect, it } from 'vitest';
import { streak, streakRun } from '../abhyas';
import { chapterStreaks } from '../chapter';
import { addDays } from '../date';
import { addSkip, type DayMenu } from '../menu';
import { KCAL_FLOOR } from '../nutrition';
import { recordRun, recordStreak, type StreakStep } from '../record';
import { DEFAULT_ROUTINE, type Routine } from '../routine';
import { runOf, shieldNote, type RunDay } from '../shield';
import type { AbhyasItem, AbhyasTick, Meal, SlotSkip } from '../types';

// Monday 19 October 2026 to Sunday 1 November: two whole weeks.
const MON = '2026-10-19';
/** A run of days from Monday 19 October, one step a day; every break may be covered unless `stuck` names its index. */
const days = (steps: StreakStep[], stuck: number[] = []): RunDay[] => steps.map((step, i) => ({ date: addDays(MON, i), step, coverable: !stuck.includes(i) }));

describe('runOf without the shield', () => {
  it('counts the days at the end and the best run, every break ending a run, a held day neither', () => {
    expect(runOf(days(['count', 'count', 'break', 'count', 'hold', 'count']), false)).toEqual({ days: 2, best: 2, covered: [] });
    expect(runOf(days(['count', 'count', 'count', 'break']), false)).toEqual({ days: 0, best: 3, covered: [] });
    expect(runOf([], false)).toEqual({ days: 0, best: 0, covered: [] });
  });
});

describe('runOf with the shield', () => {
  it('lets the first break of a week hold a run going on, and shows the day it covered', () => {
    expect(runOf(days(['count', 'count', 'break', 'count']), true)).toEqual({ days: 3, best: 3, covered: ['2026-10-21'] });
  });

  it('a second break in the same week ends the run; the next week has a shield of its own', () => {
    // Mon, Tue count; Wed covered; Thu ends it; Fri, Sat, Sun count; next Monday covered; Tuesday counts.
    const r = runOf(days(['count', 'count', 'break', 'break', 'count', 'count', 'count', 'break', 'count']), true);
    expect(r).toEqual({ days: 4, best: 4, covered: ['2026-10-21', '2026-10-26'] });
  });

  it('is not used by a break with no run to keep: a week that starts with a quiet day still has its shield', () => {
    expect(runOf(days(['break', 'count', 'break', 'count']), true)).toEqual({ days: 2, best: 2, covered: ['2026-10-21'] });
  });

  it('never covers a break it may not (a day of meals all skipped), and is still ready for a later one that week', () => {
    expect(runOf(days(['count', 'break', 'count', 'break', 'count'], [1]), true)).toEqual({ days: 2, best: 2, covered: ['2026-10-22'] });
  });

  it('weeks run Monday to Sunday: a break on Sunday and one on the Monday after are in two weeks', () => {
    const steps: StreakStep[] = ['count', 'count', 'count', 'count', 'count', 'count', 'break', 'break', 'count'];
    expect(runOf(days(steps), true)).toEqual({ days: 7, best: 7, covered: ['2026-10-25', '2026-10-26'] });
  });

  it('is the same run as without the shield when nothing breaks', () => {
    const steps: StreakStep[] = ['count', 'hold', 'count', 'count'];
    expect(runOf(days(steps), true)).toEqual(runOf(days(steps), false));
  });
});

describe('shieldNote', () => {
  it('is used while the shield covered a day of this week, ready from the Monday after', () => {
    expect(shieldNote(['2026-10-21'], '2026-10-25')).toBe('used');
    expect(shieldNote(['2026-10-21'], '2026-10-26')).toBe('ready');
    expect(shieldNote([], '2026-10-25')).toBe('ready');
  });
});

describe("the record's streak with the shield", () => {
  const routine: Routine = { ...DEFAULT_ROUTINE, enabled: true, slots: [{ id: 'lunch', type: 'lunch', time: '13:00', label_en: 'lunch', label_mr: '', label_hi: '', options: [[]], withBhaji: false, share: 100 }] };
  const menuOn = (date: string): DayMenu => ({ date, editedAt: '', meals: [{ id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }] }] });
  const ate = (date: string): Meal => ({ id: date, at: new Date(`${date}T13:00:00`).toISOString(), date, type: 'lunch', slotId: 'lunch', items: [], kcal: 1300, protein: 9 });
  // Wednesday 28 October; lunch logged every day from Monday 19 October but Thursday 22 and Monday 26.
  const TODAY = '2026-10-28';
  const dates = Array.from({ length: 10 }, (_, i) => addDays('2026-10-19', i)).filter((d) => d !== '2026-10-22' && d !== '2026-10-26');
  const base = { today: TODAY, menuOn, routine, meals: dates.map(ate), skips: [] as SlotSkip[], offDays: [] as number[], floor: KCAL_FLOOR.female };

  it('without the shield is the record streak as ever', () => {
    expect(recordRun(base)).toEqual({ days: 2, best: 3, covered: [] });
    expect(recordRun(base).days).toBe(recordStreak(base));
  });

  it('with it, the day with lunch not logged in each week holds the run: ten days, two of them covered', () => {
    expect(recordRun({ ...base, shield: true })).toEqual({ days: 8, best: 8, covered: ['2026-10-22', '2026-10-26'] });
  });

  it('never covers a day of meals all skipped: skipping is never kept alive by the streak', () => {
    const skipped = { ...base, skips: addSkip([], '2026-10-26', 'lunch') };
    expect(recordRun({ ...skipped, shield: true })).toEqual({ days: 2, best: 6, covered: ['2026-10-22'] });
  });

  it('a today not logged yet holds and uses no shield; the chapter streaks say the days covered', () => {
    const morning = { ...base, today: '2026-10-29' };
    expect(recordRun({ ...morning, shield: true })).toMatchObject({ days: 8, covered: ['2026-10-22', '2026-10-26'] });
    expect(chapterStreaks({ ...morning, shield: true })).toEqual({ days: 8, best: 8, lifetimeDays: 8, lifetimeBest: 8, covered: ['2026-10-22', '2026-10-26'] });
    // A chapter started on Saturday 24 October: its window starts there, and only the Monday it covered is in it.
    expect(chapterStreaks({ ...morning, shield: true, chapterStart: '2026-10-24' })).toEqual({ days: 4, best: 4, lifetimeDays: 8, lifetimeBest: 8, covered: ['2026-10-26'] });
  });
});

describe('the routine streak with the shield', () => {
  const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00`);
  const yoga: AbhyasItem = { id: 'yoga', name: 'Yoga', icon: 'leaf-outline', kind: 'repeat', days: [0, 1, 2, 3, 4, 5, 6], times: [], order: 0, createdAt: at('2026-10-19', '06:00').toISOString() };
  const tick = (date: string): AbhyasTick => ({ id: `yoga@${date}`, itemId: 'yoga', date, at: at(date, '07:00').toISOString() });
  const TODAY = '2026-10-28';
  const ticks = Array.from({ length: 10 }, (_, i) => addDays('2026-10-19', i)).filter((d) => d !== '2026-10-21').map(tick);
  const data = { items: [yoga], ticks, sessions: [], running: null };

  it('holds the run over the one day not done this week, and says so', () => {
    expect(streakRun(data, TODAY, at(TODAY, '20:00'))).toEqual({ days: 7, best: 7, covered: [] });
    expect(streakRun(data, TODAY, at(TODAY, '20:00'), true)).toEqual({ days: 9, best: 9, covered: ['2026-10-21'] });
    expect(streak(data, TODAY, at(TODAY, '20:00'))).toBe(7);
  });

  it('today not done yet holds; a second day not done in the same week ends the run', () => {
    const morning = { ...data, ticks: ticks.filter((t) => t.date !== TODAY) };
    expect(streakRun(morning, TODAY, at(TODAY, '08:00'), true)).toEqual({ days: 8, best: 8, covered: ['2026-10-21'] });
    expect(streakRun({ ...data, ticks: ticks.filter((t) => t.date !== '2026-10-22') }, TODAY, at(TODAY, '20:00'), true)).toEqual({ days: 6, best: 6, covered: ['2026-10-21'] });
  });
});
