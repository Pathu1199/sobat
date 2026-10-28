import { describe, expect, it } from 'vitest';
import type { DayRecord } from '../record';
import { t } from '../../i18n';
import { formatDayLabel } from '../date';
import { markOf, stripDayLabel, stripSince, swipeStep, weekStrip } from '../weekStrip';

const r = (state: DayRecord['state'], fromPlan = false, nothingEaten = false): DayRecord => ({ state, fromPlan, nothingEaten });
const MON = '2026-10-26';
// A Wednesday.
const TODAY = '2026-10-28';

describe('weekStrip', () => {
  it('marks each day: full, missing, today still going, planned, off; lighter while filled in from the plan', () => {
    const days = weekStrip({ monday: MON, today: TODAY, viewed: TODAY, since: '2026-10-01', records: [r('full'), r('partial', true), r('partial'), r('planned'), r('planned'), r('off'), r('planned')] });
    expect(days.map((d) => d.mark)).toEqual(['full', 'missing', 'today', 'planned', 'planned', 'off', 'planned']);
    expect(days.map((d) => d.light)).toEqual([false, true, false, false, false, false, false]);
    expect(days.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(days.map((d) => d.day)).toEqual([26, 27, 28, 29, 30, 31, 1]);
    expect(days.filter((d) => d.selected).map((d) => d.date)).toEqual([TODAY]);
    expect(days.filter((d) => d.isToday).map((d) => d.date)).toEqual([TODAY]);
  });

  it('a day before the person started has nothing to miss', () => {
    const days = weekStrip({ monday: MON, today: TODAY, viewed: MON, since: '2026-10-27', records: [r('empty'), r('empty'), r('empty'), r('planned'), r('planned'), r('planned'), r('planned')] });
    expect(days.slice(0, 3).map((d) => d.mark)).toEqual(['none', 'missing', 'today']);
    expect(days[0].selected).toBe(true);
  });
});

describe('stripSince', () => {
  it('starts on the day setup finished, else the first meal, else today', () => {
    expect(stripSince('2026-10-20', [{ date: '2026-09-01' }], TODAY)).toBe('2026-10-20');
    expect(stripSince(undefined, [{ date: '2026-10-05' }, { date: '2026-09-30' }], TODAY)).toBe('2026-09-30');
    expect(stripSince(undefined, [], TODAY)).toBe(TODAY);
  });
});

describe('swipeStep', () => {
  it('a sideways swipe left is the next week and right the week before; short or up-and-down is nothing', () => {
    expect(swipeStep(-80, 10)).toBe(1);
    expect(swipeStep(80, 10)).toBe(-1);
    expect(swipeStep(30, 0)).toBe(0);
    expect(swipeStep(80, 60)).toBe(0);
  });
});

describe('markOf', () => {
  it('marks one day the way the strip does, for the calendar', () => {
    expect(markOf(r('full', true), '2026-10-20', TODAY, '2026-10-01')).toEqual({ mark: 'full', light: true });
    expect(markOf(r('partial'), '2026-10-20', TODAY, '2026-10-01')).toEqual({ mark: 'missing', light: false });
    expect(markOf(r('partial'), TODAY, TODAY, '2026-10-01')).toEqual({ mark: 'today', light: false });
    expect(markOf(r('empty'), '2026-09-20', TODAY, '2026-10-01')).toEqual({ mark: 'none', light: false });
    expect(markOf(r('planned'), '2026-10-30', TODAY, '2026-10-01')).toEqual({ mark: 'planned', light: false });
    expect(markOf(r('off', true), '2026-10-25', TODAY, '2026-10-01')).toEqual({ mark: 'off', light: false });
  });

  it('shows nothing before the person started, a free weekday too', () => {
    for (const state of ['off', 'full', 'partial', 'empty'] as const) {
      expect(markOf(r(state, true), '2026-09-20', TODAY, '2026-10-01'), state).toEqual({ mark: 'none', light: false });
    }
    // The strip keeps the start: a free day before it reads as before the start, a free day after it as free.
    const days = weekStrip({ monday: MON, today: TODAY, viewed: TODAY, since: '2026-10-28', records: [r('off'), r('partial'), r('partial'), r('planned'), r('planned'), r('off'), r('planned')] });
    expect(days.map((d) => d.mark)).toEqual(['none', 'none', 'today', 'planned', 'planned', 'off', 'planned']);
  });
});

describe('a day with every meal skipped and nothing eaten', () => {
  it('is never a teal full day: its own quiet mark, on the strip and on the calendar alike, today too', () => {
    const skipped = r('full', false, true);
    expect(markOf(skipped, '2026-10-20', TODAY, '2026-10-01')).toEqual({ mark: 'skipped', light: false });
    expect(markOf(skipped, TODAY, TODAY, '2026-10-01')).toEqual({ mark: 'skipped', light: false });
    // Before the start it has nothing to show, as any day there.
    expect(markOf(skipped, '2026-09-20', TODAY, '2026-10-01')).toEqual({ mark: 'none', light: false });
    const days = weekStrip({ monday: MON, today: TODAY, viewed: TODAY, since: '2026-10-01', records: [skipped, r('full'), skipped, r('planned'), r('planned'), r('planned'), r('planned')] });
    expect(days.slice(0, 3).map((d) => d.mark)).toEqual(['skipped', 'full', 'skipped']);
  });

  it('is named plainly in every language, and not as a full day', () => {
    for (const lang of ['en', 'mr', 'hi'] as const) {
      expect(t(lang, 'strip_skipped'), lang).not.toBe('strip_skipped');
      expect(t(lang, 'strip_skipped'), lang).not.toBe(t(lang, 'strip_full'));
    }
    expect(t('mr', 'strip_skipped')).not.toBe(t('en', 'strip_skipped'));
    expect(t('hi', 'strip_skipped')).not.toBe(t('en', 'strip_skipped'));
  });
});

describe('weekStrip: more days', () => {
  it('today once full is a full day, still today; a past free day is free; today filled in from the plan is a lighter outline', () => {
    const days = weekStrip({ monday: MON, today: TODAY, viewed: TODAY, since: '2026-10-01', records: [r('off'), r('full'), r('full'), r('planned'), r('planned'), r('off'), r('planned')] });
    expect(days[2]).toMatchObject({ mark: 'full', isToday: true });
    expect(days[0].mark).toBe('off');
    const light = weekStrip({ monday: MON, today: TODAY, viewed: TODAY, since: '2026-10-01', records: [r('full'), r('full'), r('partial', true), r('planned'), r('planned'), r('planned'), r('planned')] });
    expect(light[2]).toMatchObject({ mark: 'today', light: true });
  });

  it('runs over the end of the year, Monday to Sunday', () => {
    const days = weekStrip({ monday: '2026-12-28', today: '2026-12-30', viewed: '2027-01-02', since: '2026-10-01', records: Array.from({ length: 7 }, () => r('planned')) });
    expect(days.map((d) => d.date)).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
    expect(days.map((d) => d.day)).toEqual([28, 29, 30, 31, 1, 2, 3]);
    expect(days.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(days.filter((d) => d.selected).map((d) => d.date)).toEqual(['2027-01-02']);
    expect(days.map((d) => d.mark)).toEqual(['missing', 'missing', 'today', 'planned', 'planned', 'planned', 'planned']);
  });

  it('a past day with nothing planned and nothing eaten has no dot and is never meals missing', () => {
    const unplanned: DayRecord = { state: 'empty', fromPlan: false, nothingEaten: true, nothingPlanned: true };
    expect(markOf(unplanned, '2026-10-20', TODAY, '2026-10-01')).toEqual({ mark: 'unplanned', light: false });
    expect(markOf(unplanned, TODAY, TODAY, '2026-10-01').mark).toBe('today');
    expect(markOf(r('empty'), '2026-10-20', TODAY, '2026-10-01').mark).toBe('missing');
  });

  it('calls a day "All meals skipped" only when a meal was skipped: a drink on a day that planned nothing is nothing planned', () => {
    const drink: DayRecord = { state: 'full', fromPlan: false, nothingEaten: true, nothingPlanned: true };
    expect(markOf(drink, '2026-10-20', TODAY, '2026-10-01').mark).toBe('unplanned');
    expect(markOf({ ...drink, skipped: true }, '2026-10-20', TODAY, '2026-10-01').mark).toBe('skipped');
    expect(markOf({ state: 'full', fromPlan: false, nothingEaten: true, skipped: true }, '2026-10-20', TODAY, '2026-10-01').mark).toBe('skipped');
  });

  it('today keeps its mark while it planned nothing: the day is still going, and nothing eaten yet is not a day with nothing planned', () => {
    const nothing: DayRecord = { state: 'full', fromPlan: false, nothingEaten: true, nothingPlanned: true };
    expect(markOf(nothing, TODAY, TODAY, '2026-10-01')).toEqual({ mark: 'today', light: false });
    expect(markOf({ ...nothing, state: 'empty' }, TODAY, TODAY, '2026-10-01').mark).toBe('today');
    // Something eaten today makes it full, as on any day.
    expect(markOf({ ...nothing, nothingEaten: false }, TODAY, TODAY, '2026-10-01').mark).toBe('full');
  });
});

describe('stripDayLabel: what a screen reader hears for a day', () => {
  const day = { date: TODAY, mark: 'full' as const, light: false, isToday: true };

  it('names today as today, whatever its mark, and never twice', () => {
    expect(stripDayLabel(day, 'en')).toBe(`${formatDayLabel(TODAY, 'en')}, ${t('en', 'today_short')}, ${t('en', 'strip_full')}`);
    expect(stripDayLabel({ ...day, mark: 'today' }, 'en')).toBe(`${formatDayLabel(TODAY, 'en')}, ${t('en', 'strip_today')}`);
    expect(stripDayLabel({ ...day, isToday: false, light: true }, 'mr')).toBe(`${formatDayLabel(TODAY, 'mr')}, ${t('mr', 'strip_full')}, ${t('mr', 'strip_from_plan')}`);
  });

  it('says a free day in the words used for a free day everywhere, and a day with nothing planned as nothing planned', () => {
    for (const lang of ['en', 'mr', 'hi'] as const) {
      expect(stripDayLabel({ ...day, isToday: false, mark: 'off' }, lang)).toBe(`${formatDayLabel(TODAY, lang)}, ${t(lang, 'free_day')}`);
      expect(stripDayLabel({ ...day, isToday: false, mark: 'unplanned' }, lang)).toBe(`${formatDayLabel(TODAY, lang)}, ${t(lang, 'menu_nothing_planned')}`);
    }
  });
});
