import { describe, expect, it } from 'vitest';
import { start, type AbhyasData } from '../abhyas';
import { abhyasCard, draftOf, formDraft, newDraft, parseTime, targetText, TARGET_CHOICES, WEEK_ORDER, type SheetForm } from '../abhyasView';
import type { AbhyasItem, AbhyasSession, AbhyasTick } from '../types';

// Saturday 31 October 2026; the clock is Asia/Kolkata (vitest.config.mts).
const TODAY = '2026-10-31';
const YESTERDAY = '2026-10-30';
const TOMORROW = '2026-11-01';
const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00`);
const NOW = at(TODAY, '18:00');
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];
const item = (id: string, extra: Partial<AbhyasItem> = {}): AbhyasItem => ({ id, name: id, icon: 'book-outline', kind: 'repeat', days: ALL_WEEK, times: [], order: 0, createdAt: at('2026-10-01', '09:00').toISOString(), ...extra });
const session = (itemId: string, date: string, minutes: number): AbhyasSession => ({ id: `${itemId}@${date}`, itemId, date, startedAt: at(date, '07:00').toISOString(), endedAt: at(date, '08:00').toISOString(), minutes });
const tick = (itemId: string, date: string): AbhyasTick => ({ id: `${itemId}@${date}`, itemId, date, at: at(date, '09:00').toISOString() });
const data = (extra: Partial<AbhyasData> = {}): AbhyasData => ({ items: [], ticks: [], sessions: [], running: null, ...extra });

describe("abhyasCard: the card's header and rows for a date", () => {
  const yoga = item('yoga', { order: 0 });
  const study = item('study', { order: 1, targetMin: 30 });
  const bike = item('bike', { order: 2, kind: 'once', days: [], date: TODAY });

  it('one row per item on the date, in order, and the header counts the done ones', () => {
    const card = abhyasCard(data({ items: [bike, study, yoga], ticks: [tick('yoga', TODAY)] }), TODAY, TODAY, NOW);
    expect(card.rows.map((r) => r.item.id)).toEqual(['yoga', 'study', 'bike']);
    expect(card.done).toBe(1);
    expect(card.total).toBe(3);
    expect(abhyasCard(data({ items: [bike] }), TOMORROW, TODAY, NOW)).toEqual({ rows: [], done: 0, total: 0 });
  });

  it('today: a tick-only item ticks and unticks, has no minutes and no timer', () => {
    const [row] = abhyasCard(data({ items: [yoga] }), TODAY, TODAY, NOW).rows;
    expect(row).toMatchObject({ done: false, tick: { checked: false, off: null }, minutes: null, running: false, timer: null, timerOff: null });
    const [ticked] = abhyasCard(data({ items: [yoga], ticks: [tick('yoga', TODAY)] }), TODAY, TODAY, NOW).rows;
    expect(ticked).toMatchObject({ done: true, tick: { checked: true, off: null } });
  });

  it("today: a timed item shows its minutes against the target and Start; the running one counts live and shows Stop", () => {
    const [idle] = abhyasCard(data({ items: [study], sessions: [session('study', TODAY, 12)] }), TODAY, TODAY, NOW).rows;
    expect(idle).toMatchObject({ done: false, minutes: { n: 12, of: 30 }, running: false, timer: 'start', timerOff: null });
    const running = start('study', at(TODAY, '17:45'));
    const [live] = abhyasCard(data({ items: [study], sessions: [session('study', TODAY, 12)], running }), TODAY, TODAY, NOW).rows;
    expect(live).toMatchObject({ done: false, minutes: { n: 27, of: 30 }, running: true, timer: 'stop' });
    const [later] = abhyasCard(data({ items: [study], sessions: [session('study', TODAY, 12)], running }), TODAY, TODAY, at(TODAY, '18:03')).rows;
    expect(later).toMatchObject({ done: true, minutes: { n: 30, of: 30 }, timer: 'stop' });
  });

  it('a timer for another item leaves the row on Start, and the row of the running item says so', () => {
    const rows = abhyasCard(data({ items: [study, item('read', { order: 3, targetMin: 20 })], running: start('read', at(TODAY, '17:00')) }), TODAY, TODAY, NOW).rows;
    expect(rows.map((r) => [r.item.id, r.running, r.timer])).toEqual([
      ['study', false, 'start'],
      ['read', true, 'stop'],
    ]);
  });

  it('done by the timer: the tick is filled and cannot be taken away, even with a tick under it', () => {
    const [byTimer] = abhyasCard(data({ items: [study], sessions: [session('study', TODAY, 30)] }), TODAY, TODAY, NOW).rows;
    expect(byTimer).toMatchObject({ done: true, tick: { checked: true, off: 'timer' } });
    const [both] = abhyasCard(data({ items: [study], sessions: [session('study', TODAY, 45)], ticks: [tick('study', TODAY)] }), TODAY, TODAY, NOW).rows;
    expect(both.tick).toEqual({ checked: true, off: 'timer' });
  });

  it('a past day: ticks can still be set; no timer starts, and the reason is the past', () => {
    const rows = abhyasCard(data({ items: [yoga, study], sessions: [session('study', YESTERDAY, 10)] }), YESTERDAY, TODAY, NOW).rows;
    expect(rows[0]).toMatchObject({ tick: { checked: false, off: null }, timer: null, timerOff: null });
    expect(rows[1]).toMatchObject({ tick: { checked: false, off: null }, minutes: { n: 10, of: 30 }, timer: null, timerOff: 'past' });
  });

  it("a day still to come: the list shows what is planned; ticks wait for the day, and so does the timer", () => {
    const rows = abhyasCard(data({ items: [yoga, study, item('trip', { order: 4, kind: 'once', days: [], date: TOMORROW })] }), TOMORROW, TODAY, NOW).rows;
    expect(rows.map((r) => r.item.id)).toEqual(['yoga', 'study', 'trip']);
    for (const r of rows) expect(r.tick).toEqual({ checked: false, off: 'future' });
    expect(rows[1]).toMatchObject({ minutes: { n: 0, of: 30 }, timer: null, timerOff: 'future' });
    expect(rows[0].timerOff).toBeNull();
  });

  it("today, a timer left from yesterday that has not been closed yet still offers Stop, and counts nothing for today", () => {
    const [row] = abhyasCard(data({ items: [study], running: start('study', at(YESTERDAY, '23:30')) }), TODAY, TODAY, at(TODAY, '00:00')).rows;
    expect(row).toMatchObject({ running: true, timer: 'stop', minutes: { n: 0, of: 30 } });
    // On yesterday, where it started, it is that day's timer.
    const [there] = abhyasCard(data({ items: [study], running: start('study', at(YESTERDAY, '23:30')) }), YESTERDAY, TODAY, at(TODAY, '00:00')).rows;
    expect(there).toMatchObject({ running: true, timer: 'stop', minutes: { n: 30, of: 30 }, done: true });
  });

  it('an item whose target was taken away while its timer runs still offers Stop, with no minutes line', () => {
    const [row] = abhyasCard(data({ items: [yoga], running: start('yoga', at(TODAY, '17:30')) }), TODAY, TODAY, NOW).rows;
    expect(row).toMatchObject({ minutes: null, running: true, timer: 'stop' });
  });
});

describe('the item sheet', () => {
  it('a new item repeats every day, or is a one-off on the date the sheet was opened for, named by the user with the first icon', () => {
    expect(newDraft('once', TODAY)).toEqual({ name: '', icon: 'book-outline', kind: 'once', days: ALL_WEEK, date: TODAY, times: [] });
    expect(newDraft('repeat', TOMORROW)).toMatchObject({ kind: 'repeat', days: ALL_WEEK, date: TOMORROW });
  });

  it('an item as the sheet edits it: a repeating one keeps its days and gets the date in case it becomes a one-off; a one-off gets every day in case it repeats', () => {
    const study = item('study', { days: [1, 3], targetMin: 30, times: ['07:00'] });
    expect(draftOf(study, TODAY)).toEqual({ name: 'study', icon: 'book-outline', kind: 'repeat', days: [1, 3], date: TODAY, targetMin: 30, times: ['07:00'] });
    expect(draftOf(item('bike', { kind: 'once', days: [], date: TOMORROW }), TODAY)).toEqual({ name: 'bike', icon: 'book-outline', kind: 'once', days: ALL_WEEK, date: TOMORROW, times: [] });
  });

  it('weekdays run Monday to Sunday, and the target chips are 15 to 60 minutes', () => {
    expect(WEEK_ORDER).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(TARGET_CHOICES).toEqual([15, 30, 45, 60]);
  });

  it('reads a clock time the way people type one, on the 24-hour clock', () => {
    expect(parseTime('07:30')).toBe('07:30');
    expect(parseTime('7:30')).toBe('07:30');
    expect(parseTime(' 0730 ')).toBe('07:30');
    expect(parseTime('19.05')).toBe('19:05');
    expect(parseTime('7')).toBe('07:00');
    expect(parseTime('23:59')).toBe('23:59');
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('7:60')).toBeNull();
    expect(parseTime('7:5')).toBeNull();
    expect(parseTime('seven')).toBeNull();
    expect(parseTime('')).toBeNull();
  });

  it('the minutes box keeps digits only and never goes past the largest target', () => {
    expect(targetText('')).toEqual({ text: '', value: undefined });
    expect(targetText('20')).toEqual({ text: '20', value: 20 });
    expect(targetText(' 2a0 ')).toEqual({ text: '20', value: 20 });
    expect(targetText('999')).toEqual({ text: '600', value: 600 });
    expect(targetText('0')).toEqual({ text: '0', value: 0 });
    expect(targetText('007')).toEqual({ text: '7', value: 7 });
  });

  describe('formDraft: what Save saves, or why it cannot', () => {
    const form = (extra: Partial<SheetForm> = {}): SheetForm => ({ name: 'Yoga', icon: 'leaf-outline', kind: 'repeat', days: ALL_WEEK, date: TODAY, target: undefined, times: [], ...extra });

    it('the times as typed, read on the clock; a box left empty is no time', () => {
      expect(formDraft(form({ times: ['7:30', '', ' 18.00 '] }))).toEqual({
        draft: { name: 'Yoga', icon: 'leaf-outline', kind: 'repeat', days: ALL_WEEK, date: TODAY, times: ['07:30', '18:00'] },
        problem: null,
      });
      expect(formDraft(form({ target: 45 })).draft.targetMin).toBe(45);
    });

    it("the draft's own problem first, then a time that is not one", () => {
      expect(formDraft(form({ name: ' ' })).problem).toBe('name');
      expect(formDraft(form({ days: [] })).problem).toBe('days');
      expect(formDraft(form({ kind: 'once', days: [] })).problem).toBeNull();
      expect(formDraft(form({ target: 0 })).problem).toBe('target');
      expect(formDraft(form({ times: ['25:00'] })).problem).toBe('time');
      expect(formDraft(form({ name: '', times: ['later'] })).problem).toBe('name');
    });
  });
});
