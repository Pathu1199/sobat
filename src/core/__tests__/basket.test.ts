import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import {
  addLine,
  basketFromLines,
  basketItems,
  basketMeal,
  basketTotals,
  countFromGrams,
  formatQty,
  itemsMeal,
  lineGrams,
  lineOf,
  linesFromBasket,
  parseGrams,
  putLine,
  setCount,
  setGrams,
  sheetStep,
  slotPreview,
  stepCount,
  stepFor,
} from '../basket';
import { kcalForGrams } from '../nutrition';
import type { FoodItem } from '../types';

const foods = foodsJson as unknown as FoodItem[];
const food = (id: string) => foods.find((f) => f.id === id)!;
const NOW = new Date('2026-10-27T10:00:00');
const lunch = { id: 'lunch', type: 'lunch' as const, time: '13:00' };

describe('steps', () => {
  it('counts chapatis whole and katoris by halves, and snaps a typed amount onto the step', () => {
    expect(stepFor('piece')).toBe(1);
    expect(stepFor('katori')).toBe(0.5);
    expect(stepCount(1, 'piece', 1)).toBe(2);
    expect(stepCount(1, 'piece', -1)).toBe(0);
    expect(stepCount(1, 'katori', 1)).toBe(1.5);
    expect(stepCount(1.33, 'katori', 1)).toBe(1.5);
    expect(stepCount(1.33, 'katori', -1)).toBe(1);
  });

  it('− and + move exactly one step on the grid, so − on 1.4 chapatis keeps the line', () => {
    expect(stepCount(1.4, 'piece', -1)).toBe(1);
    expect(stepCount(0.7, 'piece', -1)).toBe(0);
    expect(stepCount(0.7, 'katori', -1)).toBe(0.5);
    expect(stepCount(0.6, 'piece', 1)).toBe(1);
    expect(stepCount(1.6, 'piece', 1)).toBe(2);
    expect(stepCount(1.6, 'katori', 1)).toBe(2);
    expect(stepCount(2, 'piece', -1)).toBe(1);
  });

  it('in the food sheet − never goes under one step nor makes a typed amount larger, and says when it can do nothing', () => {
    expect(sheetStep(2, 'piece', -1)).toBe(1);
    expect(sheetStep(1.4, 'piece', -1)).toBe(1);
    expect(sheetStep(1, 'piece', -1)).toBe(1);
    expect(sheetStep(0.3, 'piece', -1)).toBe(0.3);
    expect(sheetStep(0.5, 'katori', -1)).toBe(0.5);
    expect(sheetStep(0.6, 'piece', 1)).toBe(1);
    expect(sheetStep(0, 'piece', 1)).toBe(1);
    expect(sheetStep(0, 'katori', -1)).toBe(0);
  });

  it('an amount halfway between steps moves to the next step its way, never a step and a half', () => {
    expect(stepCount(1.5, 'piece', 1)).toBe(2);
    expect(stepCount(1.5, 'piece', -1)).toBe(1);
    expect(stepCount(0.5, 'piece', 1)).toBe(1);
    expect(stepCount(0.5, 'piece', -1)).toBe(0);
    expect(stepCount(0.25, 'katori', 1)).toBe(0.5);
    expect(stepCount(0.75, 'katori', -1)).toBe(0.5);
  });
});

describe('the basket', () => {
  it('adding a food already there adds to its count, in its own measure', () => {
    const once = addLine([], lineOf(food('poha')));
    expect(once).toEqual([{ foodId: 'poha', unit: 'katori', gramsPerUnit: 150, count: 1 }]);
    expect(addLine(once, lineOf(food('poha')))[0].count).toBe(2);
    // A 200 g plate on top of a 150 g katori is 1.33 katoris more.
    const plate = addLine(once, { foodId: 'poha', unit: 'plate', gramsPerUnit: 200, count: 1 });
    expect(plate[0].count).toBeCloseTo(2.33);
    expect(lineGrams(plate[0])).toBe(350);
    expect(addLine(once, lineOf(food('chapati'), 2)).map((b) => b.foodId)).toEqual(['poha', 'chapati']);
  });

  it('a portion that weighs nothing adds nothing', () => {
    expect(addLine([], { foodId: 'poha', unit: 'katori', gramsPerUnit: 0, count: 1 })).toEqual([]);
    const once = addLine([], lineOf(food('poha')));
    expect(addLine(once, { foodId: 'poha', unit: 'plate', gramsPerUnit: 0, count: 2 })).toEqual(once);
    const weightless = [{ foodId: 'poha', unit: 'katori', gramsPerUnit: 0, count: 1 }];
    expect(Number.isFinite(addLine(weightless, { foodId: 'poha', unit: 'plate', gramsPerUnit: 200, count: 1 })[0].count)).toBe(true);
  });

  it('the detail sheet replaces a line; a count or grams of 0 takes it out', () => {
    const b = addLine([], lineOf(food('poha')));
    expect(putLine(b, { foodId: 'poha', unit: 'plate', gramsPerUnit: 200, count: 1 })).toEqual([{ foodId: 'poha', unit: 'plate', gramsPerUnit: 200, count: 1 }]);
    expect(setCount(b, 'poha', 0)).toEqual([]);
    const typed = setGrams(b, 'poha', 200);
    expect(typed[0].count).toBeCloseTo(1.33);
    expect(lineGrams(typed[0])).toBe(200);
    expect(setGrams(b, 'poha', 0)).toEqual([]);
  });

  it('typed grams are kept exactly: 100 g in a 150 g katori is 100 g, not 101 g', () => {
    const b = addLine([], lineOf(food('poha')));
    const typed = setGrams(b, 'poha', 100);
    expect(lineGrams(typed[0])).toBe(100);
    expect(basketItems(typed, foods)[0].grams).toBe(100);
    // Adding more on top keeps the typed grams too.
    expect(lineGrams(addLine(typed, lineOf(food('poha')))[0])).toBe(250);
    // A typed amount that would count as nothing is refused, and the line stays as it was.
    expect(setGrams(b, 'poha', 0.4)).toEqual(b);
  });

  it('the grams box takes a plain number of grams and nothing else', () => {
    expect(parseGrams('100')).toBe(100);
    expect(parseGrams(' 80 ')).toBe(80);
    expect(parseGrams('12.5')).toBe(12.5);
    expect(parseGrams('12abc')).toBeNull();
    expect(parseGrams('1e3')).toBeNull();
    expect(parseGrams('')).toBeNull();
    expect(parseGrams('0')).toBeNull();
    expect(parseGrams('-5')).toBeNull();
    expect(parseGrams('3001')).toBeNull();
    expect(countFromGrams('100', 150)).toBeCloseTo(0.6667, 4);
    expect(Math.round(150 * countFromGrams('100', 150)!)).toBe(100);
    expect(countFromGrams('1', 220)).toBeNull();
    expect(countFromGrams('12abc', 150)).toBeNull();
    expect(countFromGrams('100', 0)).toBeNull();
  });

  it('counts calories from the database at the grams, and the items and protein for the bar', () => {
    const b = addLine(addLine([], lineOf(food('chapati'), 2)), lineOf(food('moong-dal')));
    const items = basketItems(b, foods);
    expect(items[0]).toMatchObject({ foodId: 'chapati', grams: 80, kcal: kcalForGrams(food('chapati'), 80).kcal, estimated: false });
    expect(basketTotals(b, foods)).toEqual({ items: 2, kcal: items[0].kcal + items[1].kcal, protein: Math.round(items[0].protein + items[1].protein) });
  });

  it("planned lines go in at their measure and come back out in the food's own measures", () => {
    const b = basketFromLines([{ foodId: 'chapati', unit: 'piece', qty: 2 }, { foodId: 'gone', unit: 'piece', qty: 1 }], foods);
    expect(b).toEqual([{ foodId: 'chapati', unit: 'piece', gramsPerUnit: 40, count: 2 }]);
    expect(linesFromBasket(b, foods)).toEqual([{ foodId: 'chapati', unit: 'piece', qty: 2 }]);
    // Four big spoons of poha (60 g) is 0.4 of its 150 g katori.
    expect(linesFromBasket([{ foodId: 'poha', unit: 'spoon_big', gramsPerUnit: 15, count: 4 }], foods)).toEqual([{ foodId: 'poha', unit: 'katori', qty: 0.4 }]);
  });

  it('a line is rounded where it is written, and one that rounds to nothing is not written', () => {
    expect(linesFromBasket(setGrams(addLine([], lineOf(food('poha'))), 'poha', 100), foods)).toEqual([{ foodId: 'poha', unit: 'katori', qty: 0.67 }]);
    expect(linesFromBasket([{ foodId: 'poha', unit: 'katori', gramsPerUnit: 150, count: 0.001 }], foods)).toEqual([]);
  });
});

describe('the meal it saves', () => {
  it("is logged now for today and at the slot's time for another day, typed by hand unless said otherwise", () => {
    const b = [lineOf(food('poha'))];
    const today = basketMeal({ id: 'm1', date: '2026-10-27', slot: lunch, basket: b, foods, now: NOW })!;
    expect(today).toMatchObject({ id: 'm1', date: '2026-10-27', type: 'lunch', slotId: 'lunch', source: 'manual', at: NOW.toISOString() });
    expect(today.kcal).toBe(kcalForGrams(food('poha'), 150).kcal);
    expect(basketMeal({ id: 'm2', date: '2026-10-25', slot: lunch, basket: b, foods, now: NOW })!.at).toBe(new Date('2026-10-25T13:00:00').toISOString());
    expect(basketMeal({ id: 'm3', date: '2026-10-27', slot: lunch, basket: [], foods, now: NOW })).toBeNull();
    expect(itemsMeal({ id: 'm4', date: '2026-10-27', slot: lunch, items: today.items, now: NOW, source: 'plan' })!.source).toBe('plan');
  });

  it('a slot holding only the meal filled in from the plan is replaced, not counted twice', () => {
    expect(slotPreview({ allowance: 500, eaten: 400, autoKcal: 400, basketKcal: 450, dayLeft: 300 })).toEqual({ replaces: true, slotLeft: 50, dayLeft: 250 });
    expect(slotPreview({ allowance: 500, eaten: 600, autoKcal: 400, basketKcal: 450, dayLeft: 300 })).toEqual({ replaces: false, slotLeft: -550, dayLeft: -150 });
    expect(slotPreview({ allowance: 500, eaten: 0, autoKcal: 0, basketKcal: 450, dayLeft: 300 })).toEqual({ replaces: false, slotLeft: 50, dayLeft: -150 });
  });
});

describe('formatQty', () => {
  it('writes halves and quarters as fractions, and anything else as it is', () => {
    expect([2, 0.5, 1.5, 0.25, 2.75, 1.33, 0.4].map((q) => formatQty(q))).toEqual(['2', '½', '1½', '¼', '2¾', '1.33', '0.4']);
  });
});
