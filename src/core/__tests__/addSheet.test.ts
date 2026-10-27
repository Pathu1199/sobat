import { describe, expect, it } from 'vitest';
import { addRows, sheetMode, slotLine, startLines, startSlot } from '../addSheet';
import { slotPreview, type BasketLine } from '../basket';
import { slotStates } from '../pattern';
import { DEFAULT_ROUTINE, type Routine, type RoutineSlot } from '../routine';
import type { Meal } from '../types';

const line = (foodId: string): BasketLine => ({ foodId, unit: 'katori', gramsPerUnit: 150, count: 1 });
const base = { mode: 'log' as const, query: '', results: [] as string[], basket: [] as BasketLine[], planned: true, yesterday: true, saved: ['s1'], recents: ['poha', 'chapati'] };
const kinds = (rows: ReturnType<typeof addRows>) =>
  rows.map((r) => (r.kind === 'food' || r.kind === 'basket' ? `${r.kind}:${r.foodId}` : r.kind === 'head' ? `head:${r.titleKey}` : r.kind));

describe('addRows', () => {
  it('with nothing typed: eat as planned, the same as yesterday, saved meals, recent foods, then photo and barcode', () => {
    expect(kinds(addRows(base))).toEqual(['planned', 'yesterday', 'head:me_saved', 'saved', 'head:recent', 'food:poha', 'food:chapati', 'tools']);
  });

  it('puts the meal being built first, and a recent food already in it is not listed twice', () => {
    expect(kinds(addRows({ ...base, basket: [line('poha')] }))).toEqual(['head:add_this_meal', 'basket:poha', 'planned', 'yesterday', 'head:me_saved', 'saved', 'head:recent', 'food:chapati', 'tools']);
  });

  it('with a search typed: the matches only, or one line saying nothing was found', () => {
    expect(kinds(addRows({ ...base, query: 'po', results: ['poha', 'pohe'] }))).toEqual(['food:poha', 'food:pohe']);
    expect(kinds(addRows({ ...base, query: 'zzz' }))).toEqual(['empty']);
  });

  it('logging with nothing planned, nothing yesterday and no saved meals: recent foods, then photo and barcode', () => {
    expect(kinds(addRows({ ...base, planned: false, yesterday: false, saved: [] }))).toEqual(['head:recent', 'food:poha', 'food:chapati', 'tools']);
  });

  it('a search of spaces only is no search: the usual list, not the matches', () => {
    expect(kinds(addRows({ ...base, query: '   ', results: ['poha'] }))).toEqual(kinds(addRows(base)));
  });

  it('changing a menu offers no eating as planned, no yesterday, no photo or barcode', () => {
    expect(kinds(addRows({ ...base, mode: 'plan' }))).toEqual(['head:me_saved', 'saved', 'head:recent', 'food:poha', 'food:chapati']);
  });
});

describe('sheetMode: what Save does', () => {
  it('logs a meal on today or an earlier day, unless the menu is being changed', () => {
    expect(sheetMode('2026-10-28', '2026-10-28')).toBe('log');
    expect(sheetMode('2026-10-27', '2026-10-28')).toBe('log');
    expect(sheetMode('2026-10-27', '2026-10-28', 'plan')).toBe('plan');
  });

  it('changes the menu on a later day, however it was opened, as nothing is logged into the future', () => {
    expect(sheetMode('2026-10-29', '2026-10-28')).toBe('plan');
    expect(sheetMode('2026-11-04', '2026-10-28', 'log')).toBe('plan');
  });
});

describe('startSlot: the slot the sheet opens on', () => {
  const slot = (id: string, type: RoutineSlot['type'], time: string): RoutineSlot => ({ id, type, time, label_en: id, label_mr: '', label_hi: '', options: [[]], withBhaji: false });
  const routine: Routine = { ...DEFAULT_ROUTINE, enabled: true, slots: [slot('morning', 'breakfast', '08:30'), slot('lunch', 'lunch', '13:00'), slot('dinner', 'dinner', '19:30')] };
  const ids = ['morning', 'lunch', 'dinner'];
  const ate = (slotId: string, type: Meal['type'], hhmm: string): Meal => ({ id: slotId, at: new Date(`2026-10-28T${hhmm}:00`).toISOString(), date: '2026-10-28', type, slotId, items: [], kcal: 400, protein: 0, source: 'manual' });
  const day = (meals: Meal[], minute: number, skippedSlots: string[] = []) => slotStates({ routine, target: 1600, meals, nowMinutes: minute, skippedSlots });

  it('is the slot asked for when the day has it', () => {
    expect(startSlot({ asked: 'dinner', ids, isToday: true, states: day([], 9 * 60), minute: 9 * 60 })).toBe('dinner');
  });

  it('today, without one asked for (or one the day does not have): the slot whose turn it is', () => {
    const states = day([ate('morning', 'breakfast', '08:40')], 13 * 60 + 30);
    expect(startSlot({ ids, isToday: true, states, minute: 13 * 60 + 30 })).toBe('lunch');
    expect(startSlot({ asked: 'brunch', ids, isToday: true, states, minute: 13 * 60 + 30 })).toBe('lunch');
  });

  it("another day: its first slot still open, past the ones eaten or skipped", () => {
    expect(startSlot({ ids, isToday: false, states: day([ate('morning', 'breakfast', '08:40')], 1440), minute: 600 })).toBe('lunch');
    expect(startSlot({ ids, isToday: false, states: day([], 1440, ['morning']), minute: 600 })).toBe('lunch');
  });

  it("the day's first slot when every slot is eaten, and nothing on a day with no slots", () => {
    const full = day([ate('morning', 'breakfast', '08:40'), ate('lunch', 'lunch', '13:10'), ate('dinner', 'dinner', '19:40')], 1440);
    expect(startSlot({ ids, isToday: false, states: full, minute: 600 })).toBe('morning');
    expect(startSlot({ ids: [], isToday: true, states: [], minute: 600 })).toBeUndefined();
  });
});

describe('slotLine: the line under the slot chips', () => {
  it('a slot holding only the meal filled in from the plan says that meal is replaced, and never warns about its calories', () => {
    // The planned 500 kcal is more than the slot's 400, but it goes when the basket is saved.
    const preview = slotPreview({ allowance: 400, eaten: 500, autoKcal: 500, basketKcal: 300, dayLeft: 200 });
    expect(slotLine({ preview, autoKcal: 500, slot: 'Lunch', isToday: true })).toEqual({
      parts: [
        { key: 'add_replaces_plan', params: { kcal: 500 } },
        { key: 'log_left_today', params: { kcal: 400 } },
      ],
      tone: 'calm',
    });
  });

  it('a slot that goes over with a meal eaten by hand says so, and the day is "for the day" on another date', () => {
    const preview = slotPreview({ allowance: 400, eaten: 300, autoKcal: 0, basketKcal: 300, dayLeft: 500 });
    expect(slotLine({ preview, autoKcal: 0, slot: 'Lunch', isToday: false })).toEqual({
      parts: [
        { key: 'log_over_for', params: { kcal: 200, slot: 'Lunch' } },
        { key: 'add_left_day', params: { kcal: 200 } },
      ],
      tone: 'warn',
    });
  });

  it('a day that goes over is the strongest warning, today and on another date', () => {
    const preview = slotPreview({ allowance: 600, eaten: 0, autoKcal: 0, basketKcal: 300, dayLeft: 250 });
    expect(slotLine({ preview, autoKcal: 0, slot: 'Dinner', isToday: true })).toEqual({
      parts: [
        { key: 'log_left_for', params: { kcal: 300, slot: 'Dinner' } },
        { key: 'log_over_today', params: { kcal: 50 } },
      ],
      tone: 'over',
    });
    expect(slotLine({ preview, autoKcal: 0, slot: 'Dinner', isToday: false }).parts[1]).toEqual({ key: 'add_over_day', params: { kcal: 50 } });
  });
});

describe('startLines: the foods the sheet starts with', () => {
  const planned = [{ foodId: 'poha', unit: 'katori', qty: 1 }];

  it('the foods it was opened with, when "Change" hands them over', () => {
    const given = [{ foodId: 'upma', unit: 'katori', qty: 1 }];
    expect(startLines({ lines: given, mode: 'plan', planned })).toBe(given);
    expect(startLines({ lines: given, mode: 'log', planned })).toBe(given);
  });

  it("changing a menu with no foods handed over starts from the slot's planned foods, so saving never drops them", () => {
    expect(startLines({ mode: 'plan', planned })).toBe(planned);
  });

  it('logging with none handed over starts empty', () => {
    expect(startLines({ mode: 'log', planned })).toEqual([]);
  });
});
