import { describe, expect, it } from 'vitest';
import { addSkip, type DayMenu } from '../menu';
import { DEFAULT_ROUTINE, type Routine, type RoutineSlot } from '../routine';
import {
  bestRun,
  bestStreak,
  breathePhase,
  breatheWords,
  clockText,
  signedKg,
  sleepWords,
  streakWords,
  walkMinutesOn,
  walkWords,
  waterWords,
  weightWords,
} from '../tileText';
import type { ActivityLog, Meal } from '../types';

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

  it('shows walking minutes and the minutes left, never "of 30" without a unit', () => {
    expect(walkWords(10, 30)).toEqual({ parts: [{ num: '10', unitKey: 'tile_unit_min' }], line: { key: 'tile_min_left', params: { n: 20 } } });
    expect(walkWords(40, 30).line).toEqual({ key: 'tile_goal_reached' });
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
    expect(sleepWords(null).parts).toEqual([{ num: '—' }]);
  });
});

describe('weight', () => {
  const w = (date: string, kg: number) => ({ date, kg });

  it('shows the latest weigh-in and the change over the last three weeks, with a real minus sign', () => {
    expect(weightWords([w('2026-10-06', 100), w('2026-10-13', 99.2), w('2026-10-27', 98.4)], 80, '2026-10-27')).toEqual({
      parts: [{ num: '98.4', unitKey: 'unit_kg' }],
      line: { key: 'tile_weight_change', params: { kg: '−1.6', weeks: 3 } },
    });
    expect(weightWords([w('2026-10-20', 99), w('2026-10-27', 98.4)], 80, '2026-10-27').line).toEqual({ key: 'tile_weight_change_1', params: { kg: '−0.6' } });
  });

  it('shows the goal when there is nothing to compare in the last three weeks, and a dash with no weigh-in', () => {
    expect(weightWords([w('2026-09-20', 101), w('2026-10-27', 98.4)], 80, '2026-10-27').line).toEqual({ key: 'tile_weight_goal', params: { kg: '80' } });
    expect(weightWords([], 79.5, '2026-10-27')).toEqual({ parts: [{ num: '—' }], line: { key: 'tile_weight_goal', params: { kg: '79.5' } } });
  });

  it('signs a change: a minus sign, a plus, and no sign at zero', () => {
    expect(signedKg(-1.6)).toBe('−1.6');
    expect(signedKg(0.4)).toBe('+0.4');
    expect(signedKg(-0.04)).toBe('0.0');
  });
});

describe('streak', () => {
  it('shows the streak in days, one day singular, and the best never below today', () => {
    expect(streakWords(5, 12)).toEqual({ parts: [{ num: '5', unitKey: 'tile_unit_days' }], line: { key: 'tile_best', params: { n: 12 } } });
    expect(streakWords(1, 0)).toEqual({ parts: [{ num: '1', unitKey: 'tile_unit_day' }], line: { key: 'tile_best', params: { n: 1 } } });
  });

  it('finds the longest run of full days; an off day neither breaks it nor counts', () => {
    expect(bestRun(['full', 'full', 'partial', 'full', 'off', 'full', 'full', 'empty'])).toBe(3);
    expect(bestRun([])).toBe(0);
  });

  it('looks back over the menus as shown, and a day of nothing but skips does not count', () => {
    const slot = (id: string, type: RoutineSlot['type'], time: string, share: number): RoutineSlot => ({ id, type, time, label_en: id, label_mr: '', label_hi: '', options: [[]], withBhaji: false, share });
    const routine: Routine = { ...DEFAULT_ROUTINE, enabled: true, slots: [slot('lunch', 'lunch', '13:00', 100)] };
    const menuOn = (date: string): DayMenu => ({ date, editedAt: '', meals: [{ id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }] }] });
    const ate = (date: string): Meal => ({ id: date, at: new Date(`${date}T13:00:00`).toISOString(), date, type: 'lunch', slotId: 'lunch', items: [], kcal: 300, protein: 9 });
    const meals = ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-24', '2026-10-25'].map(ate);
    const base = { today: '2026-10-27', menuOn, routine, meals, skips: [], offDays: [] as number[] };
    expect(bestStreak(base)).toBe(3);
    // 23 October skipped: a complete record, but not a day eaten, so the run still ends there.
    expect(bestStreak({ ...base, skips: addSkip([], '2026-10-23', 'lunch') })).toBe(3);
    expect(bestStreak({ ...base, meals: [...meals, ate('2026-10-23')] })).toBe(6);
  });
});

describe('breathe', () => {
  it('breathes in for four seconds and out for four, for one minute', () => {
    expect(breathePhase(0)).toEqual({ done: false, inhale: true, leftSec: 60 });
    expect(breathePhase(4000).inhale).toBe(false);
    expect(breathePhase(8000).inhale).toBe(true);
    expect(breathePhase(18000).leftSec).toBe(42);
    expect(breathePhase(60000).done).toBe(true);
  });

  it('shows "1 min" and "Tap to start" at rest, and the time left with in or out during a session', () => {
    expect(breatheWords(null)).toEqual({ parts: [{ num: '1', unitKey: 'tile_unit_min' }], line: { key: 'tile_tap_to_start' } });
    expect(breatheWords(18000)).toEqual({ parts: [{ num: '0:42' }], line: { key: 'breathe_in' } });
    expect(breatheWords(5000).line).toEqual({ key: 'breathe_out' });
    expect(clockText(60)).toBe('1:00');
  });
});
