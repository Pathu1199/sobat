import { describe, expect, it } from 'vitest';
import { addDays } from '../date';
import { perfectDates, perfectDay, perfectWeeks, PERFECT_WEEK_MIN_DAYS } from '../perfect';
import type { AbhyasItem, AbhyasSession, AbhyasTick } from '../types';

const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00`);
const item = (id: string, extra: Partial<AbhyasItem> = {}): AbhyasItem => ({ id, name: id, icon: 'book-outline', kind: 'repeat', days: [0, 1, 2, 3, 4, 5, 6], times: [], order: 0, createdAt: at('2026-10-12', '06:00').toISOString(), ...extra });
const tick = (itemId: string, date: string): AbhyasTick => ({ id: `${itemId}@${date}`, itemId, date, at: at(date, '07:00').toISOString() });
const session = (itemId: string, date: string, minutes: number): AbhyasSession => ({ id: `${itemId}@${date}`, itemId, date, startedAt: at(date, '07:00').toISOString(), endedAt: at(date, '08:00').toISOString(), minutes });
/** The seven days of the week of Monday 19 October 2026. */
const WEEK = Array.from({ length: 7 }, (_, i) => addDays('2026-10-19', i));
const SUNDAY = '2026-10-25';

describe('perfectDay', () => {
  const day = { step: 'count' as const, jobs: { done: 3, total: 3 }, waterMl: 3000, waterGoalMl: 3000 };

  it('is a full day eaten at the safe minimum, every job done and the water goal met', () => {
    expect(perfectDay(day)).toBe(true);
    // No job due that day: the other two decide.
    expect(perfectDay({ ...day, jobs: { done: 0, total: 0 } })).toBe(true);
  });

  it('is not a day the streak only holds (eaten under the safe minimum, an off day) or ends', () => {
    expect(perfectDay({ ...day, step: 'hold' })).toBe(false);
    expect(perfectDay({ ...day, step: 'break' })).toBe(false);
  });

  it('is not a day with a job not done, or water short of the goal, or with no water goal to meet', () => {
    expect(perfectDay({ ...day, jobs: { done: 2, total: 3 } })).toBe(false);
    expect(perfectDay({ ...day, waterMl: 2500 })).toBe(false);
    expect(perfectDay({ ...day, waterMl: 0, waterGoalMl: 0 })).toBe(false);
  });
});

describe('perfectDates', () => {
  const always = () => true;

  it('stars perfect days from the day the user started, and none before it, however perfect the numbers say they were', () => {
    const days = ['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21'];
    expect([...perfectDates(days, '2026-10-20', always)]).toEqual(['2026-10-20', '2026-10-21']);
    // The day they started is the first one that can shine.
    expect(perfectDates(['2026-10-20'], '2026-10-20', always).has('2026-10-20')).toBe(true);
    expect(perfectDates(['2026-10-19'], '2026-10-20', always).size).toBe(0);
  });

  it('asks about a day only when it can be starred, and stars only the days that are perfect', () => {
    const asked: string[] = [];
    const out = perfectDates(['2026-10-19', '2026-10-20', '2026-10-21'], '2026-10-20', (d) => {
      asked.push(d);
      return d === '2026-10-21';
    });
    expect([...out]).toEqual(['2026-10-21']);
    expect(asked).toEqual(['2026-10-20', '2026-10-21']);
  });
});

describe('perfectWeeks', () => {
  it('finds the week a job was done on each of its days, Monday to Sunday', () => {
    const yoga = item('yoga');
    expect(perfectWeeks({ items: [yoga], ticks: WEEK.map((d) => tick('yoga', d)), sessions: [] }, '2026-10-28')).toEqual([{ itemId: 'yoga', monday: '2026-10-19' }]);
    // One day not done: no perfect week.
    expect(perfectWeeks({ items: [yoga], ticks: WEEK.filter((d) => d !== '2026-10-22').map((d) => tick('yoga', d)), sessions: [] }, '2026-10-28')).toEqual([]);
  });

  it("counts a job's own days only, its timer target met as done, and needs three due days or more", () => {
    expect(PERFECT_WEEK_MIN_DAYS).toBe(3);
    const study = item('study', { days: [1, 3, 5], targetMin: 30 });
    const sessions = ['2026-10-19', '2026-10-21', '2026-10-23'].map((d) => session('study', d, 30));
    expect(perfectWeeks({ items: [study], ticks: [], sessions }, '2026-10-28')).toEqual([{ itemId: 'study', monday: '2026-10-19' }]);
    // 25 minutes of 30 on Friday: not done.
    expect(perfectWeeks({ items: [study], ticks: [], sessions: [...sessions.slice(0, 2), session('study', '2026-10-23', 25)] }, '2026-10-28')).toEqual([]);
    const weekend = item('weekend', { days: [0, 6] });
    expect(perfectWeeks({ items: [weekend], ticks: ['2026-10-24', '2026-10-25'].map((d) => tick('weekend', d)), sessions: [] }, '2026-10-28')).toEqual([]);
  });

  it("is earned on the week's last due day once it is done, never before", () => {
    const yoga = item('yoga');
    const ticks = WEEK.map((d) => tick('yoga', d));
    expect(perfectWeeks({ items: [yoga], ticks, sessions: [] }, SUNDAY)).toEqual([{ itemId: 'yoga', monday: '2026-10-19' }]);
    expect(perfectWeeks({ items: [yoga], ticks: ticks.slice(0, 6), sessions: [] }, '2026-10-24')).toEqual([]);
  });

  it("keeps the user's order within a week and the weeks oldest first, and has none with no list", () => {
    const yoga = item('yoga', { order: 1 });
    const read = item('read', { order: 0 });
    const two = [...WEEK, ...WEEK.map((d) => addDays(d, 7))];
    const ticks = [...two.map((d) => tick('yoga', d)), ...WEEK.map((d) => tick('read', d))];
    expect(perfectWeeks({ items: [yoga, read], ticks, sessions: [] }, '2026-11-01')).toEqual([
      { itemId: 'read', monday: '2026-10-19' },
      { itemId: 'yoga', monday: '2026-10-19' },
      { itemId: 'yoga', monday: '2026-10-26' },
    ]);
    expect(perfectWeeks({ items: [], ticks: [], sessions: [] }, SUNDAY)).toEqual([]);
  });

  it('a job added on Thursday is due from Thursday, so Thursday to Sunday done is a perfect week', () => {
    const late = item('late', { createdAt: at('2026-10-22', '06:00').toISOString() });
    expect(perfectWeeks({ items: [late], ticks: WEEK.slice(3).map((d) => tick('late', d)), sessions: [] }, SUNDAY)).toEqual([{ itemId: 'late', monday: '2026-10-19' }]);
  });

  it('is earned on the last day a Monday, Wednesday and Friday job is due: not on the Thursday before, not while Friday is still to come', () => {
    const mwf = item('mwf', { days: [1, 3, 5] });
    const ticks = ['2026-10-19', '2026-10-21', '2026-10-23'].map((d) => tick('mwf', d));
    // Friday 23 October is the last due day: earned that day, and the week stays earned on every day after it.
    expect(perfectWeeks({ items: [mwf], ticks, sessions: [] }, '2026-10-23')).toEqual([{ itemId: 'mwf', monday: '2026-10-19' }]);
    expect(perfectWeeks({ items: [mwf], ticks, sessions: [] }, '2026-10-25')).toEqual([{ itemId: 'mwf', monday: '2026-10-19' }]);
    // Thursday: Friday has not come, so the week is not decided; Wednesday likewise.
    expect(perfectWeeks({ items: [mwf], ticks, sessions: [] }, '2026-10-22')).toEqual([]);
    expect(perfectWeeks({ items: [mwf], ticks, sessions: [] }, '2026-10-21')).toEqual([]);
    // Friday itself not done: no week.
    expect(perfectWeeks({ items: [mwf], ticks: ticks.slice(0, 2), sessions: [] }, '2026-10-25')).toEqual([]);
  });

  describe('a job removed before its week ends earns no medal for it', () => {
    const removedOn = (date: string, extra: Partial<AbhyasItem> = {}) => item('yoga', { archivedAt: at(date, '09:00').toISOString(), ...extra });
    const ticks = WEEK.map((d) => tick('yoga', d));

    it('a daily job removed on the Thursday, the Saturday or the Sunday: its days before were done, and there is no medal', () => {
      for (const gone of ['2026-10-22', '2026-10-24', SUNDAY]) {
        expect(perfectWeeks({ items: [removedOn(gone)], ticks, sessions: [] }, '2026-10-28'), gone).toEqual([]);
      }
    });

    it('a Monday, Wednesday and Friday job removed on the Saturday after its three days were done: no medal either', () => {
      const mwf = removedOn('2026-10-24', { days: [1, 3, 5] });
      expect(perfectWeeks({ items: [mwf], ticks: ['2026-10-19', '2026-10-21', '2026-10-23'].map((d) => tick('yoga', d)), sessions: [] }, '2026-10-28')).toEqual([]);
    });

    it('removed on the Monday after, the week was whole: it stands', () => {
      expect(perfectWeeks({ items: [removedOn('2026-10-26')], ticks, sessions: [] }, '2026-10-28')).toEqual([{ itemId: 'yoga', monday: '2026-10-19' }]);
    });

    it('does not take back an earlier week of a job removed later, and a removal that cannot be read earns none', () => {
      const two = [...WEEK, ...WEEK.map((d) => addDays(d, 7))].map((d) => tick('yoga', d));
      expect(perfectWeeks({ items: [removedOn('2026-10-29')], ticks: two, sessions: [] }, '2026-11-01')).toEqual([{ itemId: 'yoga', monday: '2026-10-19' }]);
      expect(perfectWeeks({ items: [item('yoga', { archivedAt: 'not a date' })], ticks, sessions: [] }, '2026-10-28')).toEqual([]);
    });
  });

  it('a one-off job is due on one day only, so it never makes a week', () => {
    const once = item('once', { kind: 'once', date: '2026-10-20' });
    expect(perfectWeeks({ items: [once], ticks: [tick('once', '2026-10-20')], sessions: [] }, '2026-10-28')).toEqual([]);
  });
});
