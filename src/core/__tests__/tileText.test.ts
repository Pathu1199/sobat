import { describe, expect, it } from 'vitest';
import { addDays } from '../date';
import { addSkip, type DayMenu } from '../menu';
import { KCAL_FLOOR } from '../nutrition';
import { recordStreak, STREAK_LOOKBACK_DAYS } from '../record';
import { DEFAULT_ROUTINE, type Routine, type RoutineSlot } from '../routine';
import { fill, makeT } from '../../i18n';
import {
  bestRun,
  bestStreak,
  BREATHE_HALF_MS,
  BREATHE_SESSION_MS,
  breathePhase,
  breatheWords,
  clockText,
  lostWords,
  NO_VALUE,
  shortDecimal,
  signedKg,
  sleepWords,
  streakWords,
  walkMinutesOn,
  walkWords,
  waterLabel,
  waterMlOn,
  waterWords,
  weightChangeLine,
  weekWeightChange,
  weightWords,
  shownWeight,
} from '../tileText';
import { weightTrend } from '../insights';
import type { ActivityLog, Lang, Meal } from '../types';
import { shownWords } from '../../ui/tileWords';

const LANGS: Lang[] = ['en', 'mr', 'hi'];

describe('water and walk', () => {
  it('shows litres with one decimal and the bottles left, rounded up', () => {
    expect(waterWords(1000, 3000, 500)).toEqual({ parts: [{ num: '1.0', unitKey: 'tile_unit_l' }], line: { key: 'tile_bottles_left', params: { n: 4 } } });
    expect(waterWords(2600, 3000, 500).line).toEqual({ key: 'tile_bottle_left' });
    // 1.5 L left is two 1 L bottles.
    expect(waterWords(1500, 3000, 1000).line).toEqual({ key: 'tile_bottles_left', params: { n: 2 } });
  });

  it('says the goal is reached, and keeps counting the litres past it', () => {
    expect(waterWords(3500, 3000, 750)).toEqual({ parts: [{ num: '3.5', unitKey: 'tile_unit_l' }], line: { key: 'tile_goal_reached' } });
  });

  it('says "Goal reached" without "today", in every language: the tile shows whichever date is open', () => {
    expect(makeT('en')('tile_goal_reached')).toBe('Goal reached');
    for (const lang of LANGS) expect(makeT(lang)('tile_goal_reached')).not.toMatch(/today|आज/i);
  });

  it('reads the water to a screen reader in litres without a needless ".0": "1.5 of 3 litres"', () => {
    const say = (ml: number, goalMl: number) => {
      const l = waterLabel(ml, goalMl);
      return fill(makeT('en')(l.key), l.params ?? {});
    };
    expect(say(1500, 3000)).toBe('Add one bottle of water. 1.5 of 3 litres.');
    expect(say(0, 2500)).toBe('Add one bottle of water. 0 of 2.5 litres.');
    expect(shortDecimal(3)).toBe('3');
    expect(shortDecimal(1.25)).toBe('1.3');
    expect(shortDecimal(79.5)).toBe('79.5');
  });

  it('shows walking minutes and the minutes left, never "of 30" without a unit', () => {
    expect(walkWords(10, 30)).toEqual({ parts: [{ num: '10', unitKey: 'tile_unit_min' }], line: { key: 'tile_min_left', params: { n: 20 } } });
    expect(walkWords(40, 30).line).toEqual({ key: 'tile_goal_reached' });
  });

  it('adds up the water drunk on that date only', () => {
    const w = (id: string, date: string, ml: number) => ({ id, at: `${date}T06:00:00.000Z`, date, ml });
    const logs = [w('a', '2026-10-27', 500), w('b', '2026-10-27', 750), w('c', '2026-10-26', 1000)];
    expect(waterMlOn(logs, '2026-10-27')).toBe(1250);
    expect(waterMlOn(logs, '2026-10-25')).toBe(0);
    expect(waterMlOn([], '2026-10-27')).toBe(0);
  });

  it('counts only walks toward the walk tile, and only on that date', () => {
    const log = (id: string, date: string, activityId: string, minutes: number): ActivityLog => ({ id, date, at: `${date}T06:00:00.000Z`, activityId, minutes, intensity: 1, kcal: 30 });
    const logs = [log('a', '2026-10-27', 'walk', 10), log('b', '2026-10-27', 'walk', 20), log('c', '2026-10-27', 'yoga', 15), log('d', '2026-10-26', 'walk', 30)];
    expect(walkMinutesOn(logs, '2026-10-27')).toBe(30);
  });
});

describe('sleep', () => {
  it('shows hours and minutes, the hour alone when there are no minutes, a dash before the check-in, and the goal', () => {
    expect(sleepWords(430)).toEqual({ parts: [{ num: '7', unitKey: 'tile_unit_h' }, { num: '10', unitKey: 'tile_unit_m' }], line: { key: 'tile_sleep_goal', params: { h: 8 } } });
    expect(sleepWords(420).parts).toEqual([{ num: '7', unitKey: 'tile_unit_h' }]);
    expect(sleepWords(null).parts).toEqual([{ num: NO_VALUE }]);
  });

  it('says it is empty before the check-in, so a screen reader hears "No check-in yet" and not the dash', () => {
    expect(sleepWords(null)).toEqual({ parts: [{ num: NO_VALUE }], line: { key: 'tile_sleep_goal', params: { h: 8 } }, empty: { key: 'tile_no_sleep' } });
    expect(sleepWords(0).empty).toEqual({ key: 'tile_no_sleep' });
    expect(sleepWords(430).empty).toBeUndefined();
  });
});

describe('no value yet', () => {
  it('is one mark, an en dash', () => {
    expect(NO_VALUE).toBe('\u2013');
  });

  it('has a phrase in plain words for screen readers in every language', () => {
    expect(makeT('en')('tile_no_sleep')).toBe('No check-in yet');
    expect(makeT('en')('tile_no_weight')).toBe('No weigh-in yet');
    for (const lang of LANGS) {
      for (const key of ['tile_no_sleep', 'tile_no_weight']) {
        const said = makeT(lang)(key);
        expect(said).not.toBe(key);
        expect(said).not.toContain(NO_VALUE);
        if (lang !== 'en') expect(said).not.toBe(makeT('en')(key));
      }
    }
  });
});

describe('weight', () => {
  const w = (date: string, kg: number) => ({ date, kg });

  it('shows the weight smoothed over a week and its change over three weeks, with a real minus sign', () => {
    expect(weightWords([w('2026-10-06', 100), w('2026-10-13', 99.2), w('2026-10-27', 98.4)], 80, '2026-10-27')).toEqual({
      parts: [{ num: '98.4', unitKey: 'unit_kg' }],
      line: { key: 'tile_weight_change', params: { kg: '−1.6', weeks: 3 } },
    });
  });

  it('is the same weight as the trend on Progress, not the last weigh-in alone', () => {
    // 99 six days before and 98.4 today: the week smoothed, later days counting more, is 98.5.
    const weights = [w('2026-10-21', 99), w('2026-10-27', 98.4)];
    expect(weightWords(weights, 80, '2026-10-27').parts).toEqual([{ num: '98.5', unitKey: 'unit_kg' }]);
    expect(shownWeight(weights, '2026-10-27')!.kg).toBe(weightTrend(weights, '2026-10-27')!.current);
  });

  it('says the weeks the change really spans, never a fixed three', () => {
    // The weigh-in it compares with is five weeks and two days before the latest.
    expect(weightWords([w('2026-09-20', 101), w('2026-10-27', 98.4)], 80, '2026-10-27').line).toEqual({ key: 'tile_weight_change', params: { kg: '−2.6', weeks: 5 } });
    expect(shownWeight([w('2026-09-15', 101), w('2026-10-27', 98.4)], '2026-10-27')!.change).toEqual({ kg: -2.6, weeks: 6 });
  });

  it('shows the goal when there is nothing three weeks back to compare, and a dash with no weigh-in', () => {
    expect(weightWords([w('2026-10-20', 99), w('2026-10-27', 98.4)], 80, '2026-10-27').line).toEqual({ key: 'tile_weight_goal', params: { kg: '80' } });
    expect(weightWords([w('2026-08-20', 101), w('2026-10-27', 98.4)], 80, '2026-10-27').line).toEqual({ key: 'tile_weight_goal', params: { kg: '80' } });
    expect(weightWords([], 79.5, '2026-10-27')).toEqual({ parts: [{ num: NO_VALUE }], line: { key: 'tile_weight_goal', params: { kg: '79.5' } }, empty: { key: 'tile_no_weight' } });
    expect(weightWords([w('2026-10-27', 98.4)], 80, '2026-10-27').empty).toBeUndefined();
  });

  it('goes quiet when the latest weigh-in is more than thirty days old: the goal, not a change', () => {
    const old = [w('2026-07-25', 112), w('2026-08-20', 110)];
    expect(shownWeight(old, '2026-10-27')).toEqual({ kg: 110, change: null, asOf: '2026-08-20', stale: true });
    expect(weightWords(old, 80, '2026-10-27')).toEqual({ parts: [{ num: '110.0', unitKey: 'unit_kg' }], line: { key: 'tile_weight_goal', params: { kg: '80' } } });
    // The same weigh-ins seen nearer the time show the change.
    expect(shownWeight(old, '2026-08-25')!.change).toEqual({ kg: -2, weeks: 4 });
    expect(shownWeight([], '2026-10-27')).toBeNull();
  });

  it('words a change by the weeks it spans: a week up to ten days, then whole weeks', () => {
    expect(weightChangeLine(-0.7, 7)).toEqual({ key: 'tile_weight_change_1', params: { kg: '−0.7' } });
    expect(weightChangeLine(-0.5, 10)).toEqual({ key: 'tile_weight_change_1', params: { kg: '−0.5' } });
    expect(weightChangeLine(0.4, 11)).toEqual({ key: 'tile_weight_change', params: { kg: '+0.4', weeks: 2 } });
    expect(weightChangeLine(-3, 42)).toEqual({ key: 'tile_weight_change', params: { kg: '−3.0', weeks: 6 } });
  });

  it('gives Charts the week\'s change with its weeks, and none once the latest weigh-in is more than thirty days old', () => {
    const recent = weightTrend([w('2026-10-13', 81), w('2026-10-20', 80.3)], '2026-10-27');
    expect(weekWeightChange(recent, '2026-10-27')).toEqual({ kg: -0.7, line: { key: 'tile_weight_change_1', params: { kg: '−0.7' } } });
    const old = weightTrend([w('2026-08-13', 81), w('2026-08-20', 80.3)], '2026-10-27');
    expect(old!.change7).toBe(-0.7);
    expect(weekWeightChange(old, '2026-10-27')).toBeNull();
    // Seen nearer the time, the same weigh-ins show it.
    expect(weekWeightChange(old, '2026-09-19')).not.toBeNull();
    expect(weekWeightChange(weightTrend([w('2026-10-20', 80)], '2026-10-27'), '2026-10-27')).toBeNull();
    expect(weekWeightChange(null, '2026-10-27')).toBeNull();
  });

  it('says Gained, never a negative Lost, for someone who weighs more than at the start', () => {
    expect(lostWords(2)).toEqual({ key: 'plan_lost', kg: '2.0' });
    expect(lostWords(0)).toEqual({ key: 'plan_lost', kg: '0.0' });
    expect(lostWords(-1.24)).toEqual({ key: 'plan_gained', kg: '1.2' });
    for (const lang of LANGS) expect(makeT(lang)('plan_gained')).not.toBe('plan_gained');
  });

  it('signs a change: a minus sign, a plus, and no sign at zero', () => {
    expect(signedKg(-1.6)).toBe('−1.6');
    expect(signedKg(0.4)).toBe('+0.4');
    expect(signedKg(-0.04)).toBe('0.0');
  });
});

describe('the short line in Marathi and Hindi', () => {
  // Measured at text size 1.25 (15 points), Devanagari runs at most about 7 points a character that takes room (a nukta or
  // a virama joins the letter beside it and adds none), and a tile's words have 135 points on a 375 point phone and 128 on
  // a 360 one: 18 such characters is the most that keeps clear of the edge ("3 आठवड्यांत −10.5" is 16, about 116 points).
  const MAX = 18;
  const room = (text: string) => text.replace(/[\u093C\u094D]/g, '').length;
  const w = (date: string, kg: number) => ({ date, kg });
  const longest = [
    waterWords(0, 5000, 500),
    waterWords(2500, 3000, 500),
    waterWords(3000, 3000, 500),
    walkWords(0, 120),
    sleepWords(null, 450),
    weightWords([w('2026-10-06', 110), w('2026-10-27', 99.5)], 80, '2026-10-27'),
    weightWords([w('2026-09-15', 110), w('2026-10-27', 99.5)], 80, '2026-10-27'),
    weightWords([w('2026-10-20', 110), w('2026-10-27', 99.5)], 80, '2026-10-27'),
    weightWords([w('2026-09-01', 110)], 105.5, '2026-10-27'),
    streakWords(90, 90),
    breatheWords(null),
    breatheWords(0),
    breatheWords(BREATHE_HALF_MS),
  ];

  it('fits the tile at the largest text size, the weight change too, so its meaning is never cut off', () => {
    for (const lang of ['mr', 'hi'] as const) {
      for (const words of longest) {
        const line = shownWords(words, makeT(lang)).line;
        expect(room(line), `${lang}: ${line}`).toBeLessThanOrEqual(MAX);
      }
    }
  });

  it('keeps the change and its weeks in the words; the kilos are the number\'s unit just above', () => {
    const three = shownWords(weightWords([w('2026-10-06', 110), w('2026-10-27', 99.5)], 80, '2026-10-27'), makeT('mr')).line;
    expect(three).toContain('−10.5');
    expect(three).toContain('3');
    expect(shownWords(weightWords([w('2026-10-06', 99), w('2026-10-27', 98.4)], 80, '2026-10-27'), makeT('hi')).line).toContain('−0.6');
  });
});

describe('streak', () => {
  it('shows the streak in days, one day singular, and the best never below today', () => {
    expect(streakWords(5, 12)).toEqual({ parts: [{ num: '5', unitKey: 'tile_unit_days' }], line: { key: 'tile_best', params: { n: 12 } } });
    expect(streakWords(1, 0)).toEqual({ parts: [{ num: '1', unitKey: 'tile_unit_day' }], line: { key: 'tile_best', params: { n: 1 } } });
  });

  it('finds the longest run of days that count; a day that holds neither breaks it nor counts', () => {
    expect(bestRun(['count', 'count', 'break', 'count', 'hold', 'count', 'count', 'break'])).toBe(3);
    expect(bestRun([])).toBe(0);
  });

  it('looks back over the menus as shown; a day with nothing eaten ends the run, and one eaten under the safe minimum neither counts nor ends it', () => {
    const slot = (id: string, type: RoutineSlot['type'], time: string, share: number): RoutineSlot => ({ id, type, time, label_en: id, label_mr: '', label_hi: '', options: [[]], withBhaji: false, share });
    const routine: Routine = { ...DEFAULT_ROUTINE, enabled: true, slots: [slot('lunch', 'lunch', '13:00', 100)] };
    const menuOn = (date: string): DayMenu => ({ date, editedAt: '', meals: [{ id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }] }] });
    const ate = (date: string, kcal = 1300): Meal => ({ id: date, at: new Date(`${date}T13:00:00`).toISOString(), date, type: 'lunch', slotId: 'lunch', items: [], kcal, protein: 9 });
    const meals = ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-24', '2026-10-25'].map((d) => ate(d));
    const base = { today: '2026-10-27', menuOn, routine, meals, skips: [], offDays: [] as number[], floor: KCAL_FLOOR.female };
    expect(bestStreak(base)).toBe(3);
    // 23 October skipped: a complete record, but nothing eaten, so the run ends there, as it ends the streak: skipping is never rewarded.
    expect(bestStreak({ ...base, skips: addSkip([], '2026-10-23', 'lunch') })).toBe(3);
    // A cup of tea, 40 kcal, is nothing eaten: the run ends there too.
    expect(bestStreak({ ...base, meals: [...meals, ate('2026-10-23', 40)] })).toBe(3);
    // Eaten, but 500 kcal: under the safe minimum, it neither counts nor ends the run.
    expect(bestStreak({ ...base, meals: [...meals, ate('2026-10-23', 500)] })).toBe(5);
    expect(bestStreak({ ...base, meals: [...meals, ate('2026-10-23')] })).toBe(6);
    // The best run and the streak follow one rule: a run that reaches yesterday is the streak.
    const toYesterday = [...meals, ate('2026-10-23', 500), ate('2026-10-26')];
    expect(bestStreak({ ...base, meals: toYesterday })).toBe(6);
    expect(recordStreak({ ...base, meals: toYesterday })).toBe(6);
  });

  it('the streak and the best run look back over one window, so a 75-day run reads 75 days and is the best', () => {
    const routine: Routine = { ...DEFAULT_ROUTINE, enabled: true, slots: [{ id: 'lunch', type: 'lunch', time: '13:00', label_en: 'lunch', label_mr: '', label_hi: '', options: [[]], withBhaji: false, share: 100 }] };
    const menuOn = (date: string): DayMenu => ({ date, editedAt: '', meals: [{ id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }] }] });
    const run = (days: number): Meal[] =>
      Array.from({ length: days }, (_, i) => addDays('2026-10-27', -i)).map((date) => ({ id: date, at: new Date(`${date}T13:00:00`).toISOString(), date, type: 'lunch', slotId: 'lunch', items: [], kcal: 1300, protein: 9 }));
    const base = { today: '2026-10-27', menuOn, routine, skips: [], offDays: [] as number[], floor: KCAL_FLOOR.female };
    expect(STREAK_LOOKBACK_DAYS).toBe(90);
    expect(recordStreak({ ...base, meals: run(75) })).toBe(75);
    expect(bestStreak({ ...base, meals: run(75) })).toBe(75);
    expect(streakWords(recordStreak({ ...base, meals: run(75) }), bestStreak({ ...base, meals: run(75) })).line).toEqual({ key: 'tile_best', params: { n: 75 } });
    // A longer run reads the window in both, never one number for the streak and another for the best.
    expect(recordStreak({ ...base, meals: run(120) })).toBe(STREAK_LOOKBACK_DAYS);
    expect(bestStreak({ ...base, meals: run(120) })).toBe(STREAK_LOOKBACK_DAYS);
  });
});

describe('breathe', () => {
  it('breathes in for four seconds and out for four, eight whole breaths', () => {
    expect(BREATHE_SESSION_MS).toBe(64000);
    expect(BREATHE_SESSION_MS % (2 * BREATHE_HALF_MS)).toBe(0);
    expect(breathePhase(0)).toEqual({ done: false, inhale: true, leftSec: 64 });
    expect(breathePhase(4000).inhale).toBe(false);
    expect(breathePhase(8000).inhale).toBe(true);
    expect(breathePhase(18000).leftSec).toBe(46);
    expect(breathePhase(60000).done).toBe(false);
    expect(breathePhase(BREATHE_SESSION_MS).done).toBe(true);
  });

  it('ends on a breath out, so the circle is small when the session stops', () => {
    expect(breathePhase(BREATHE_SESSION_MS - 1).inhale).toBe(false);
    expect(breathePhase(BREATHE_SESSION_MS - 1).done).toBe(false);
  });

  it('shows "1 min" and "Tap to start" at rest, and the time left with in or out during a session', () => {
    expect(breatheWords(null)).toEqual({ parts: [{ num: '1', unitKey: 'tile_unit_min' }], line: { key: 'tile_tap_to_start' } });
    expect(breatheWords(18000)).toEqual({ parts: [{ num: '0:46' }], line: { key: 'breathe_in' } });
    expect(breatheWords(5000).line).toEqual({ key: 'breathe_out' });
    expect(clockText(60)).toBe('1:00');
  });

  it('reads "1 min" at rest in words, a whole number of minutes', () => {
    expect(shownWords(breatheWords(null), makeT('en')).value).toBe('1 min');
  });
});
