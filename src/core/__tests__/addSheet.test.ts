import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import { addRows, addsIntoMeal, alreadySaved, filledIn, menuSave, offersPlanned, offersYesterday, plannedSummary, removeUndoSteps, repeatItems, sheetMode, slotAllowance, slotBefore, slotLine, startLines, startSlot, switchDraft, undoSteps, yesterdayIn } from '../addSheet';
import { addLine, basketFromLines, lineOf, setCount, slotPreview, type BasketLine } from '../basket';
import { addSkip } from '../menu';
import { kcalForGrams } from '../nutrition';
import { slotStates } from '../pattern';
import { DEFAULT_ROUTINE, type Routine, type RoutineSlot } from '../routine';
import type { FoodItem, Meal, MealItem } from '../types';
import { lineInfo, type PlanMeal } from '../weekPlan';

const line = (foodId: string): BasketLine => ({ foodId, unit: 'katori', gramsPerUnit: 150, count: 1 });
const base = { mode: 'log' as const, query: '', results: [] as string[], basket: [] as BasketLine[], planned: true, yesterday: true, saved: ['s1'], recents: ['poha', 'chapati'] };
const kinds = (rows: ReturnType<typeof addRows>) =>
  rows.map((r) => (r.kind === 'food' || r.kind === 'basket' ? `${r.kind}:${r.foodId}` : r.kind === 'head' ? `head:${r.titleKey}` : r.kind));

describe('addRows', () => {
  it('with nothing typed: eat as planned, the same as yesterday, saved meals, recent foods, then photo and barcode', () => {
    expect(kinds(addRows(base))).toEqual(['planned', 'yesterday', 'head:me_saved', 'saved', 'head:recent', 'food:poha', 'food:chapati', 'tools']);
  });

  it('puts the meal being built first, and a recent food already in it is not listed twice', () => {
    expect(kinds(addRows({ ...base, basket: [line('poha')] }))).toEqual(['head:add_this_meal', 'basket:poha', 'yesterday', 'head:me_saved', 'saved', 'head:recent', 'food:chapati', 'tools']);
  });

  it('while a meal is being built, eating as planned is not offered: it would log the plan and drop the foods chosen', () => {
    expect(kinds(addRows({ ...base, basket: [line('poha')] }))).not.toContain('planned');
    expect(kinds(addRows(base))).toContain('planned');
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

describe('slotAllowance: what the slot may hold, as the menu plans it', () => {
  const lines = [
    { foodId: 'chapati', unit: 'piece', qty: 2 },
    { foodId: 'moong-dal', unit: 'katori', qty: 1 },
  ];

  it('a slot with a plan holds its planned calories, from the database; "N left" is that less what the slot already holds', () => {
    const planned = lines.reduce((a, l) => a + lineInfo(l, foods)!.kcal, 0);
    expect(slotAllowance({ lines, foods, share: 425 })).toBe(planned);
    const preview = slotPreview({ allowance: slotAllowance({ lines, foods, share: 425 }), eaten: 100, autoKcal: 0, basketKcal: 50, dayLeft: 900 });
    expect(slotLine({ preview, autoKcal: 0, slot: 'Lunch', isToday: true }).parts[0]).toEqual({ key: 'log_left_for', params: { kcal: planned - 150, slot: 'Lunch' } });
  });

  it('a slot with nothing planned, or only foods gone from the database, keeps its share of the day', () => {
    expect(slotAllowance({ lines: [], foods, share: 425 })).toBe(425);
    expect(slotAllowance({ lines: [{ foodId: 'gone', unit: 'piece', qty: 2 }], foods, share: 425 })).toBe(425);
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

const foods = foodsJson as unknown as FoodItem[];
const food = (id: string) => foods.find((f) => f.id === id)!;
const meal = (id: string, date: string, slotId: string | undefined, source: Meal['source'], items: MealItem[] = [], type: Meal['type'] = 'lunch'): Meal => ({
  id,
  at: new Date(`${date}T13:00:00`).toISOString(),
  date,
  type,
  slotId,
  items,
  kcal: items.reduce((a, i) => a + i.kcal, 0),
  protein: 0,
  source,
});

describe('offersPlanned: eat as planned is offered', () => {
  const lines = [{ foodId: 'poha', unit: 'katori', qty: 1 }];
  const base = { mode: 'log' as const, date: '2026-10-28', today: '2026-10-28', lines, foods, slotMeals: [] as Meal[] };

  it('when logging on today or an earlier day, with planned foods and nothing in the slot but the meal filled in from the plan', () => {
    expect(offersPlanned(base)).toBe(true);
    expect(offersPlanned({ ...base, date: '2026-10-25' })).toBe(true);
    expect(offersPlanned({ ...base, slotMeals: [meal('auto-2026-10-28-lunch', '2026-10-28', 'lunch', 'auto')] })).toBe(true);
  });

  it('never on a date after today, nor while changing a menu, as the store logs nothing into the future', () => {
    expect(offersPlanned({ ...base, date: '2026-10-29' })).toBe(false);
    expect(offersPlanned({ ...base, mode: 'plan' })).toBe(false);
  });

  it('not once something was eaten in the slot: typed in, eaten as planned, confirmed, or logged before there were sources', () => {
    for (const source of ['manual', 'plan', undefined] as const) {
      expect(offersPlanned({ ...base, slotMeals: [meal('m1', '2026-10-28', 'lunch', source)] })).toBe(false);
    }
  });

  it('not when nothing planned would weigh anything: no lines, a food that is gone, an amount of nothing', () => {
    expect(offersPlanned({ ...base, lines: [] })).toBe(false);
    expect(offersPlanned({ ...base, lines: [{ foodId: 'no-such-food', unit: 'katori', qty: 1 }] })).toBe(false);
    expect(offersPlanned({ ...base, lines: [{ foodId: 'poha', unit: 'katori', qty: 0 }] })).toBe(false);
  });
});

describe('yesterdayIn: the same slot the day before', () => {
  const lunch = { id: 'lunch', type: 'lunch' as const };

  it("holds the day before's meals in that slot, and a meal that names no slot by its kind", () => {
    const named = meal('a', '2026-10-27', 'lunch', 'manual');
    const old = meal('b', '2026-10-27', undefined, 'manual');
    const meals = [named, old, meal('c', '2026-10-27', 'dinner', 'manual', [], 'dinner'), meal('d', '2026-10-28', 'lunch', 'manual'), meal('e', '2026-10-26', 'lunch', 'manual'), meal('f', '2026-10-27', undefined, 'manual', [], 'dinner')];
    expect(yesterdayIn(meals, '2026-10-28', lunch)).toEqual([named, old]);
  });

  it('is the day before the date shown, not before today', () => {
    const before = meal('a', '2026-10-24', 'lunch', 'auto');
    expect(yesterdayIn([before], '2026-10-25', lunch)).toEqual([before]);
    expect(yesterdayIn([before], '2026-10-28', lunch)).toEqual([]);
  });
});

describe('repeatItems: the same as yesterday, logged again', () => {
  const item = (foodId: string | undefined, grams: number, kcal: number, estimated = false): MealItem => ({ foodId, name_en: foodId ?? 'Home dal', name_mr: '', grams, kcal, protein: 1, carbs: 1, fat: 1, estimated });

  it('each food from the database at the same grams, with its calories from the database as it is now', () => {
    const [poha] = repeatItems([meal('a', '2026-10-27', 'lunch', 'manual', [item('poha', 150, 999)])], foods);
    expect(poha).toMatchObject({ foodId: 'poha', grams: 150, kcal: kcalForGrams(food('poha'), 150).kcal, estimated: false });
  });

  it("every meal of the slot's foods, in order; a food not in the database as it was logged; a food of the person's own stays estimated", () => {
    const own: FoodItem = { ...food('poha'), id: 'my-poha', tags: ['custom'] };
    const home = item(undefined, 200, 260, true);
    const out = repeatItems([meal('a', '2026-10-27', 'lunch', 'manual', [item('poha', 150, 999), home]), meal('b', '2026-10-27', 'lunch', 'auto', [item('my-poha', 100, 1)])], [...foods, own]);
    expect(out.map((i) => i.foodId ?? i.name_en)).toEqual(['poha', 'Home dal', 'my-poha']);
    expect(out[1]).toBe(home);
    expect(out[2]).toMatchObject({ grams: 100, kcal: kcalForGrams(own, 100).kcal, estimated: true });
  });
});

describe('offersYesterday: the same as yesterday is offered', () => {
  const item = (foodId: string | undefined, grams: number): MealItem => ({ foodId, name_en: foodId ?? 'Read from a photo', name_mr: '', grams, kcal: 200, protein: 1, carbs: 1, fat: 1, estimated: true });
  const photo = [item(undefined, 250)];

  it('to log in one tap whenever yesterday holds something, a meal read from a photo too', () => {
    expect(offersYesterday({ mode: 'log', basket: [], items: photo, foods })).toBe(true);
    expect(offersYesterday({ mode: 'log', basket: [], items: [], foods })).toBe(false);
  });

  it('while foods are being chosen, only when one of its foods can go into the meal: a photo-read food has no measure to add', () => {
    expect(offersYesterday({ mode: 'log', basket: [line('poha')], items: photo, foods })).toBe(false);
    expect(offersYesterday({ mode: 'log', basket: [line('poha')], items: [...photo, item('chapati', 40)], foods })).toBe(true);
    expect(offersYesterday({ mode: 'plan', basket: [], items: photo, foods })).toBe(false);
  });
});

describe('filledIn: what a meal logged in a slot replaces', () => {
  it("the meals the app filled in from the plan in that slot that date, and nothing else", () => {
    const auto = meal('auto-2026-10-28-lunch', '2026-10-28', 'lunch', 'auto');
    const meals = [auto, meal('m1', '2026-10-28', 'lunch', 'manual'), meal('p1', '2026-10-28', 'lunch', 'plan'), meal('auto-2026-10-27-lunch', '2026-10-27', 'lunch', 'auto'), meal('auto-2026-10-28-dinner', '2026-10-28', 'dinner', 'auto'), meal('x', '2026-10-28', undefined, 'auto')];
    expect(filledIn(meals, '2026-10-28', 'lunch')).toEqual([auto]);
  });
});

describe('changing a menu, slot by slot', () => {
  const pohaLine = (qty: number) => ({ foodId: 'poha', unit: 'katori', qty });
  const plan: PlanMeal[] = [
    { id: 'breakfast', type: 'breakfast', time: '08:30', lines: [pohaLine(1), pohaLine(1)] },
    { id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }] },
    { id: 'dinner', type: 'dinner', time: '20:30', lines: [] },
  ];
  const plannedOf = (id: string) => basketFromLines(plan.find((m) => m.id === id)!.lines, foods);

  it('leaving a slot keeps its meal as it was left, and coming back brings it back', () => {
    const changed = setCount(plannedOf('breakfast'), 'poha', 3);
    const away = switchDraft({ drafts: {}, from: 'breakfast', basket: changed, to: 'lunch', planned: plan[1].lines, foods });
    expect(away.basket).toEqual(plannedOf('lunch'));
    const back = switchDraft({ drafts: away.drafts, from: 'lunch', basket: away.basket, to: 'breakfast', planned: plan[0].lines, foods });
    expect(back.basket).toEqual(changed);
  });

  it('a slot not opened yet starts from its planned foods', () => {
    expect(switchDraft({ drafts: {}, from: undefined, basket: [], to: 'lunch', planned: plan[1].lines, foods }).basket).toEqual(plannedOf('lunch'));
  });

  it('Save writes every slot changed, each with its own foods', () => {
    const drafts = { breakfast: setCount(plannedOf('breakfast'), 'poha', 3), dinner: addLine([], lineOf(food('chapati'))) };
    const out = menuSave(plan, drafts, foods)!;
    expect(out.map((m) => m.lines)).toEqual([[pohaLine(3)], plan[1].lines, [{ foodId: 'chapati', unit: 'piece', qty: 1 }]]);
  });

  it('nothing changed is nothing to write, and a slot opened but left alone keeps its lines exactly as they were', () => {
    expect(menuSave(plan, {}, foods)).toBeNull();
    expect(menuSave(plan, { breakfast: plannedOf('breakfast'), lunch: plannedOf('lunch') }, foods)).toBeNull();
    const out = menuSave(plan, { breakfast: plannedOf('breakfast'), dinner: addLine([], lineOf(food('chapati'))) }, foods)!;
    expect(out[0]).toBe(plan[0]);
  });

  it('a change undone before Save is nothing to write', () => {
    const undone = setCount(setCount(plannedOf('lunch'), 'chapati', 3), 'chapati', 2);
    expect(menuSave(plan, { lunch: undone }, foods)).toBeNull();
  });
});

describe('addsIntoMeal: what a tap on the same as yesterday or a saved meal does', () => {
  it('logs it in one tap while nothing is being built', () => {
    expect(addsIntoMeal('log', [])).toBe(false);
  });

  it('adds it into the meal while foods are being chosen, and always while changing a menu', () => {
    expect(addsIntoMeal('log', [line('poha')])).toBe(true);
    expect(addsIntoMeal('plan', [])).toBe(true);
    expect(addsIntoMeal('plan', [line('poha')])).toBe(true);
  });
});

describe('the Undo of a one-tap log', () => {
  const d = '2026-10-25';
  const auto = meal('auto-2026-10-25-lunch', d, 'lunch', 'auto');

  it('remembers, at the tap, the meals filled in from the plan it replaces and whether the slot was marked skipped', () => {
    const meals = [auto, meal('m0', d, 'dinner', 'manual')];
    expect(slotBefore({ meals, slotSkips: [] }, d, 'lunch')).toEqual({ replaced: [auto], wasSkipped: false });
    expect(slotBefore({ meals: [], slotSkips: addSkip([], d, 'lunch') }, d, 'lunch')).toEqual({ replaced: [], wasSkipped: true });
    expect(slotBefore({ meals: [], slotSkips: addSkip([], '2026-10-24', 'lunch') }, d, 'lunch')).toEqual({ replaced: [], wasSkipped: false });
  });

  it('takes the meal away, puts back what it replaced, and leaves the slot not skipped when it was not', () => {
    expect(undoSteps({ id: 'm1', date: d, slotId: 'lunch', replaced: [auto], wasSkipped: false })).toEqual([
      { kind: 'remove', id: 'm1' },
      { kind: 'add', meal: auto },
      { kind: 'unskip', date: d, slotId: 'lunch' },
    ]);
  });

  it('marks the slot skipped again when it was skipped before the tap', () => {
    expect(undoSteps({ id: 'm1', date: d, slotId: 'lunch', replaced: [], wasSkipped: true })).toEqual([
      { kind: 'remove', id: 'm1' },
      { kind: 'skip', date: d, slotId: 'lunch' },
    ]);
  });
});

describe('the Undo of a meal deleted from its sheet', () => {
  const d = '2026-10-25';
  const eaten = meal('m1', d, 'lunch', 'manual');

  it('puts the meal back as the state held it, through addMeal, and leaves its slot not skipped when it was not', () => {
    const stale = { ...eaten, kcal: 1 };
    expect(removeUndoSteps({ meals: [eaten], slotSkips: [] }, stale)).toEqual([
      { kind: 'add', meal: eaten },
      { kind: 'unskip', date: d, slotId: 'lunch' },
    ]);
  });

  it('marks the slot skipped again when it was skipped before the delete', () => {
    expect(removeUndoSteps({ meals: [eaten], slotSkips: addSkip([], d, 'lunch') }, eaten)).toEqual([
      { kind: 'add', meal: eaten },
      { kind: 'skip', date: d, slotId: 'lunch' },
    ]);
  });

  it('a meal that names no slot only comes back; a meal no longer in the state comes back as the sheet had it', () => {
    const loose = meal('m2', d, undefined, 'manual');
    expect(removeUndoSteps({ meals: [loose], slotSkips: [] }, loose)).toEqual([{ kind: 'add', meal: loose }]);
    expect(removeUndoSteps({ meals: [], slotSkips: [] }, eaten)).toEqual([
      { kind: 'add', meal: eaten },
      { kind: 'unskip', date: d, slotId: 'lunch' },
    ]);
  });
});

describe('alreadySaved: no offer to save a meal the person already has', () => {
  const lines = [
    { foodId: 'poha', unit: 'katori', qty: 1 },
    { foodId: 'chapati', unit: 'piece', qty: 2 },
  ];

  it('is true when a saved meal has the same foods, measures and amounts, in any order', () => {
    expect(alreadySaved(lines, [{ lines: [lines[1], lines[0]] }])).toBe(true);
    expect(alreadySaved(lines, [{ lines: [{ foodId: 'poha', unit: 'katori', qty: 1.00001 }, lines[1]] }])).toBe(true);
  });

  it('is false for another amount, another measure, a food more or less, or no saved meals', () => {
    expect(alreadySaved(lines, [])).toBe(false);
    expect(alreadySaved(lines, [{ lines: [lines[0], { ...lines[1], qty: 3 }] }])).toBe(false);
    expect(alreadySaved(lines, [{ lines: [{ ...lines[0], unit: 'plate' }, lines[1]] }])).toBe(false);
    expect(alreadySaved(lines, [{ lines: [lines[0]] }])).toBe(false);
    expect(alreadySaved(lines, [{ lines: [...lines, { foodId: 'poha', unit: 'plate', qty: 1 }] }])).toBe(false);
  });
});

describe('plannedSummary: the foods of eating as planned', () => {
  it('names each food with its measure, without "1 ×" for one of it', () => {
    expect(plannedSummary([{ foodId: 'poha', unit: 'katori', qty: 1 }, { foodId: 'chapati', unit: 'piece', qty: 2 }], foods, 'en')).toBe('Kanda Poha 1 katori (150 g) · Chapati 2 × 1 piece (40 g)');
  });

  it("in the person's language; a food that is gone, or an amount of nothing, is left out as it is when logged", () => {
    expect(plannedSummary([{ foodId: 'poha', unit: 'katori', qty: 1.5 }, { foodId: 'no-such-food', unit: 'katori', qty: 1 }, { foodId: 'chapati', unit: 'piece', qty: 0 }], foods, 'mr')).toBe(`${food('poha').name_mr} 1½ × 1 वाटी (150 ग्रॅ)`);
  });
});
