import { describe, expect, it } from 'vitest';
import type { DayRecord } from '../record';
import { t } from '../../i18n';
import { markOf, stripSince, swipeStep, weekStrip } from '../weekStrip';

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
