import { describe, expect, it } from 'vitest';
import { addItem, archive, closeStale, dayStatus, doneCount, draftProblem, isDone, itemsOn, MAX_SESSION_MIN, minutesOn, reorder, start, stop, streak, type AbhyasData, type AbhyasDraft } from '../abhyas';
import type { AbhyasItem, AbhyasSession, AbhyasTick } from '../types';

// Saturday 31 October 2026; the clock is Asia/Kolkata (vitest.config.mts).
const TODAY = '2026-10-31';
const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00`);
const NOW = at(TODAY, '18:00');
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];
const item = (id: string, extra: Partial<AbhyasItem> = {}): AbhyasItem => ({ id, name: id, icon: 'book-outline', kind: 'repeat', days: ALL_WEEK, times: [], order: 0, createdAt: at('2026-10-01', '09:00').toISOString(), ...extra });
const session = (itemId: string, date: string, minutes: number): AbhyasSession => ({ id: `${itemId}@${date}`, itemId, date, startedAt: at(date, '07:00').toISOString(), endedAt: at(date, '08:00').toISOString(), minutes });
const tick = (itemId: string, date: string): AbhyasTick => ({ id: `${itemId}@${date}`, itemId, date, at: at(date, '09:00').toISOString() });
const data = (extra: Partial<AbhyasData> = {}): AbhyasData => ({ items: [], ticks: [], sessions: [], running: null, ...extra });
const ids = (list: AbhyasItem[]) => list.map((i) => i.id);

describe('itemsOn', () => {
  it("a repeating item is on its weekdays only, in the user's order", () => {
    const yoga = item('yoga', { order: 2 });
    const study = item('study', { order: 1, days: [1, 3, 5] });
    const weekend = item('weekend', { order: 0, days: [0, 6] });
    expect(ids(itemsOn([yoga, study, weekend], TODAY))).toEqual(['weekend', 'yoga']);
    // Monday 26 October.
    expect(ids(itemsOn([yoga, study, weekend], '2026-10-26'))).toEqual(['study', 'yoga']);
  });

  it('a one-off is on its own date and no other, among the repeating items by order', () => {
    const bike = item('bike', { kind: 'once', days: [], date: TODAY, order: 1 });
    expect(ids(itemsOn([item('yoga', { order: 2 }), bike, item('read', { order: 0 })], TODAY))).toEqual(['read', 'bike', 'yoga']);
    expect(itemsOn([bike], '2026-11-01')).toEqual([]);
    expect(itemsOn([bike], '2026-10-30')).toEqual([]);
  });

  it('a removed item leaves the day it was removed and every day after, and stays on the days before', () => {
    const gone = item('gone', { archivedAt: at(TODAY, '10:00').toISOString() });
    expect(itemsOn([gone], TODAY)).toEqual([]);
    expect(itemsOn([gone], '2026-11-02')).toEqual([]);
    expect(ids(itemsOn([gone], '2026-10-30'))).toEqual(['gone']);
    const bike = item('bike', { kind: 'once', days: [], date: '2026-11-03', archivedAt: at(TODAY, '10:00').toISOString() });
    expect(itemsOn([bike], '2026-11-03')).toEqual([]);
  });

  it('a repeating item starts on the day it was added, so the days before it are not left undone; a one-off added later keeps its own date', () => {
    const fresh = item('fresh', { createdAt: at(TODAY, '08:00').toISOString() });
    expect(itemsOn([fresh], '2026-10-30')).toEqual([]);
    expect(ids(itemsOn([fresh], TODAY))).toEqual(['fresh']);
    const late = item('late', { kind: 'once', days: [], date: '2026-10-29', createdAt: at(TODAY, '08:00').toISOString() });
    expect(ids(itemsOn([late], '2026-10-29'))).toEqual(['late']);
  });
});

describe('minutesOn', () => {
  it('adds the finished sessions of the item on that date', () => {
    const sessions = [session('study', TODAY, 20), session('study', TODAY, 15), session('study', '2026-10-30', 40), session('yoga', TODAY, 30)];
    expect(minutesOn(sessions, null, 'study', TODAY, NOW)).toBe(35);
  });

  it("counts the running timer when it is this item's and started that day, never another item's", () => {
    const running = start('study', at(TODAY, '17:48'));
    expect(minutesOn([session('study', TODAY, 20)], running, 'study', TODAY, NOW)).toBe(32);
    expect(minutesOn([], running, 'yoga', TODAY, NOW)).toBe(0);
    expect(minutesOn([], running, 'study', '2026-10-30', NOW)).toBe(0);
  });

  it('never counts a running timer past three hours', () => {
    expect(minutesOn([], start('study', at(TODAY, '07:00')), 'study', TODAY, NOW)).toBe(MAX_SESSION_MIN);
  });
});

describe('isDone and dayStatus', () => {
  it('done by a tick, or by the timer reaching the target; a tick-only item needs its tick', () => {
    const timed = item('study', { targetMin: 30 });
    const plain = item('yoga');
    expect(isDone(timed, TODAY, [], 29)).toBe(false);
    expect(isDone(timed, TODAY, [], 30)).toBe(true);
    expect(isDone(timed, TODAY, [tick('study', TODAY)], 0)).toBe(true);
    expect(isDone(plain, TODAY, [], 500)).toBe(false);
    expect(isDone(plain, TODAY, [tick('yoga', TODAY)], 0)).toBe(true);
    expect(isDone(plain, TODAY, [tick('yoga', '2026-10-30'), tick('read', TODAY)], 0)).toBe(false);
  });

  it("counts the items done of those on the date, and every minute, the running timer's included", () => {
    const d = data({
      items: [item('study', { targetMin: 30 }), item('yoga'), item('read', { targetMin: 20 }), item('swim', { days: [1] })],
      // Swimming is on Mondays only: its tick today is no item done today.
      ticks: [tick('yoga', TODAY), tick('swim', TODAY)],
      sessions: [session('study', TODAY, 25), session('read', '2026-10-30', 20)],
      running: start('study', at(TODAY, '17:50')),
    });
    expect(dayStatus(d, TODAY, NOW)).toEqual({ total: 3, done: 2, minutes: 35 });
    expect(dayStatus(d, '2026-10-30', NOW)).toEqual({ total: 3, done: 1, minutes: 20 });
    expect(dayStatus(data(), TODAY, NOW)).toEqual({ total: 0, done: 0, minutes: 0 });
  });
});

describe('the timer', () => {
  it('starts for an item at the moment given', () => {
    expect(start('study', at(TODAY, '07:00'))).toEqual({ itemId: 'study', startedAt: at(TODAY, '07:00').toISOString() });
  });

  it('a session is the whole minutes on the date it started; less than a minute writes nothing', () => {
    const running = start('study', at(TODAY, '07:00'));
    expect(stop(running, new Date(at(TODAY, '07:45').getTime() + 59_000))).toEqual({
      id: `study@${running.startedAt}`,
      itemId: 'study',
      date: TODAY,
      startedAt: running.startedAt,
      endedAt: new Date(at(TODAY, '07:45').getTime() + 59_000).toISOString(),
      minutes: 45,
    });
    expect(stop(running, new Date(at(TODAY, '07:00').getTime() + 59_000))).toBeNull();
    expect(stop(running, at(TODAY, '07:01'))?.minutes).toBe(1);
  });

  it('never counts past three hours: a session stopped later ends at the three hours', () => {
    const running = start('study', at(TODAY, '07:00'));
    const s = stop(running, at(TODAY, '12:30'))!;
    expect(s.minutes).toBe(MAX_SESSION_MIN);
    expect(s.endedAt).toBe(at(TODAY, '10:00').toISOString());
    expect(stop(running, at(TODAY, '10:00'))!.minutes).toBe(MAX_SESSION_MIN);
  });

  it('a timer stopped after midnight ends at midnight, on the day it started', () => {
    const s = stop(start('read', at('2026-10-30', '23:20')), at(TODAY, '00:30'))!;
    expect(s).toMatchObject({ date: '2026-10-30', minutes: 40, endedAt: at(TODAY, '00:00').toISOString() });
  });

  it('closeStale lets a timer run under three hours, and stops it at three hours', () => {
    const morning = start('study', at(TODAY, '07:00'));
    expect(closeStale(morning, at(TODAY, '09:59'))).toEqual({ running: morning, session: null });
    expect(closeStale(morning, at(TODAY, '10:00'))).toMatchObject({ running: null, session: { minutes: 180, date: TODAY, endedAt: at(TODAY, '10:00').toISOString() } });
    expect(closeStale(morning, at(TODAY, '16:00'))).toMatchObject({ running: null, session: { minutes: 180, endedAt: at(TODAY, '10:00').toISOString() } });
  });

  it('closeStale stops a timer from before today at midnight of its own day', () => {
    const lastNight = start('read', at('2026-10-30', '23:20'));
    expect(closeStale(lastNight, at('2026-10-30', '23:59'))).toEqual({ running: lastNight, session: null });
    expect(closeStale(lastNight, at(TODAY, '00:05'))).toMatchObject({ running: null, session: { minutes: 40, date: '2026-10-30', endedAt: at(TODAY, '00:00').toISOString() } });
    // Started at 22:30, it reaches midnight before its three hours.
    expect(closeStale(start('read', at('2026-10-30', '22:30')), at(TODAY, '09:00'))).toMatchObject({ running: null, session: { minutes: 90, date: '2026-10-30' } });
    // Under a minute before midnight: stopped, and nothing written.
    expect(closeStale(start('read', new Date(at(TODAY, '00:00').getTime() - 30_000)), at(TODAY, '00:01'))).toEqual({ running: null, session: null });
  });

  it('closeStale leaves no timer alone, and drops one whose start is not a time', () => {
    expect(closeStale(null, NOW)).toEqual({ running: null, session: null });
    expect(closeStale({ itemId: 'study', startedAt: 'soon' }, NOW)).toEqual({ running: null, session: null });
  });
});

describe('streak', () => {
  const yoga = item('yoga');
  const study = item('study', { days: [1, 2, 3, 4, 5], targetMin: 30 });
  // Every day from Monday 26 to Friday 30 October done; Saturday 31 is today, with yoga on it.
  const week = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'];
  const full = data({ items: [yoga, study], ticks: week.map((d) => tick('yoga', d)), sessions: week.map((d) => session('study', d, 30)) });
  const fromWed = { ...full, ticks: full.ticks.filter((t) => t.date >= '2026-10-28') };

  it('counts the days in a row with every item done, ending yesterday while today is not done yet', () => {
    expect(streak(fromWed, TODAY, NOW)).toBe(3);
  });

  it('counts today once all of it is done', () => {
    expect(streak({ ...fromWed, ticks: [...fromWed.ticks, tick('yoga', TODAY)] }, TODAY, NOW)).toBe(4);
  });

  it('a day with one item not done breaks it', () => {
    expect(streak({ ...full, sessions: full.sessions.filter((s) => s.date !== '2026-10-29') }, TODAY, NOW)).toBe(1);
    // Yesterday not done: today alone, once done, is the run.
    const notYesterday = { ...full, ticks: [...full.ticks.filter((t) => t.date !== '2026-10-30'), tick('yoga', TODAY)] };
    expect(streak(notYesterday, TODAY, NOW)).toBe(1);
  });

  it('a day with nothing on the list neither breaks it nor counts', () => {
    const weekdays = data({ items: [study], sessions: ['2026-10-29', '2026-10-30'].map((d) => session('study', d, 30)) });
    // Saturday has nothing on it: Thursday and Friday still count.
    expect(streak(weekdays, TODAY, NOW)).toBe(2);
    // Sunday 1 November has nothing either.
    expect(streak(weekdays, '2026-11-01', at('2026-11-01', '09:00'))).toBe(2);
    expect(streak(data(), TODAY, NOW)).toBe(0);
  });

  it('an item added today does not break the days before it', () => {
    const fresh = item('fresh', { createdAt: at(TODAY, '08:00').toISOString() });
    expect(streak({ ...fromWed, items: [...fromWed.items, fresh] }, TODAY, NOW)).toBe(3);
  });

  it('the running timer counts toward today', () => {
    const running = data({ items: [item('read', { targetMin: 30 })], running: start('read', at(TODAY, '17:00')) });
    expect(streak(running, TODAY, at(TODAY, '17:29'))).toBe(0);
    expect(streak(running, TODAY, at(TODAY, '17:30'))).toBe(1);
  });
});

describe('doneCount', () => {
  it('counts each item done on each day up to today, by tick or by minutes, once', () => {
    const d = data({
      items: [item('yoga'), item('read', { targetMin: 20 })],
      ticks: [tick('yoga', '2026-10-26'), tick('yoga', TODAY), tick('read', '2026-10-27')],
      sessions: [session('read', '2026-10-26', 25), session('read', '2026-10-27', 25), session('read', '2026-10-28', 10)],
    });
    // Monday both, Tuesday reading (ticked and timed: once), today yoga; Wednesday's ten minutes are short of the target.
    expect(doneCount(d, TODAY)).toBe(4);
    expect(doneCount({ ...d, ticks: [...d.ticks, tick('yoga', '2026-11-01')] }, TODAY)).toBe(4);
    expect(doneCount(data(), TODAY)).toBe(0);
  });

  it('leaves out a tick for a day the item is not on, and the running timer until it stops', () => {
    const d = data({ items: [item('swim', { days: [1], targetMin: 10 })], ticks: [tick('swim', TODAY)], running: start('swim', at('2026-10-26', '07:00')) });
    expect(doneCount(d, TODAY)).toBe(0);
  });
});

describe('the list', () => {
  const now = at(TODAY, '09:00');
  const draft = (extra: Partial<AbhyasDraft> = {}): AbhyasDraft => ({ name: 'Yoga', icon: 'leaf-outline', kind: 'repeat', days: ALL_WEEK, times: [], ...extra });

  it('adds an item at the end, its name trimmed, its weekdays and times cleaned', () => {
    const first = addItem([], draft({ name: '  Yoga ', days: [5, 1, 1, 9], times: ['18:00', '07:30', '07:30', 'later', '7:00'], date: TODAY }), 'a', now);
    expect(first).toEqual([{ id: 'a', name: 'Yoga', icon: 'leaf-outline', kind: 'repeat', days: [1, 5], times: ['07:30', '18:00'], order: 0, createdAt: now.toISOString() }]);
    const two = addItem([...first, item('old', { order: 7, archivedAt: now.toISOString() })], draft({ name: 'Fix the bike', kind: 'once', days: [1], date: TODAY, targetMin: 30, icon: 'rocket' }), 'b', now);
    expect(two[2]).toEqual({ id: 'b', name: 'Fix the bike', icon: 'book-outline', kind: 'once', days: [], date: TODAY, targetMin: 30, times: [], order: 8, createdAt: now.toISOString() });
    expect(addItem([], draft({ times: ['06:00', '07:00', '08:00', '09:00'] }), 'c', now)[0].times).toEqual(['06:00', '07:00', '08:00']);
  });

  it('saves nothing without a name, a weekday, a date, or a whole-minute target', () => {
    expect(draftProblem(draft())).toBeNull();
    expect(draftProblem(draft({ name: '  ' }))).toBe('name');
    expect(draftProblem(draft({ days: [] }))).toBe('days');
    expect(draftProblem(draft({ days: [7] }))).toBe('days');
    expect(draftProblem(draft({ kind: 'once', days: [] }))).toBe('date');
    expect(draftProblem(draft({ kind: 'once', days: [], date: '2026-02-30' }))).toBe('date');
    expect(draftProblem(draft({ targetMin: 0 }))).toBe('target');
    expect(draftProblem(draft({ targetMin: 12.5 }))).toBe('target');
    expect(draftProblem(draft({ targetMin: 601 }))).toBe('target');
    expect(draftProblem(draft({ targetMin: 45 }))).toBeNull();
    const list = [item('x')];
    expect(addItem(list, draft({ name: '' }), 'a', now)).toBe(list);
  });

  it('removes an item by marking it, so its history stays; the same list when there is nothing to remove', () => {
    const list = [item('a'), item('b')];
    const gone = archive(list, 'a', now);
    expect(gone[0]).toEqual({ ...list[0], archivedAt: now.toISOString() });
    expect(gone[1]).toBe(list[1]);
    expect(list[0].archivedAt).toBeUndefined();
    expect(archive(gone, 'a', at(TODAY, '10:00'))).toBe(gone);
    expect(archive(list, 'nope', now)).toBe(list);
  });

  it('moves an item one place among the items of its kind, and renumbers them so items with the same number still move', () => {
    const a = item('a', { order: 0 });
    const once = item('o', { kind: 'once', days: [], date: TODAY, order: 1 });
    const b = item('b', { order: 2 });
    const sorted = (list: AbhyasItem[]) => ids([...list].sort((x, y) => x.order - y.order));
    expect(sorted(reorder([a, once, b], 'b', -1))).toEqual(['b', 'o', 'a']);
    expect(sorted(reorder([a, once, b], 'a', 1))).toEqual(['b', 'o', 'a']);
    expect(reorder([a, once, b], 'a', -1)).toEqual([a, once, b]);
    expect(reorder([a, once, b], 'b', 1)).toEqual([a, once, b]);
    const tied = [item('x', { order: 3 }), item('y', { order: 3 })];
    expect(sorted(reorder(tied, 'y', -1))).toEqual(['y', 'x']);
    // A removed item is not moved and not stepped over.
    const removed = item('r', { order: 1, archivedAt: NOW.toISOString() });
    expect(reorder([a, removed, b], 'r', -1)).toEqual([a, removed, b]);
    expect(sorted(reorder([a, removed, b], 'b', -1))).toEqual(['b', 'r', 'a']);
  });
});
