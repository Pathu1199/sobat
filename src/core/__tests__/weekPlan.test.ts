import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import { avoidedFoodIds, DEFAULT_ROUTINE, NEUTRAL_ROUTINE, ruleForFood, type Routine } from '../routine';
import type { FoodItem } from '../types';
import { alignWeekPlan, balanceDay, buildWeekPlan, dayStatus, dayTotals, lineInfo, mealTotals, planDayFor, plannedKcal, roleOf, swapsFor, type WeekPlan } from '../weekPlan';

const foods = foodsJson as FoodItem[];
const byId = (id: string) => foods.find((f) => f.id === id)!;

describe('weekPlan', () => {
  it('builds seven days from the routine, with the weekday bhaji at lunch and a real dinner', () => {
    const plan = buildWeekPlan(DEFAULT_ROUTINE, foods);
    expect(plan.days).toHaveLength(7);
    const monday = plan.days[1];
    const lunch = monday.meals.find((m) => m.id === 'lunch')!;
    expect(lunch.lines[0].foodId).toBe('dudhi-bhaji');
    expect(monday.meals.some((m) => m.id === 'dinner' && m.lines.length >= 3)).toBe(true);
    // The person's own fixed items come through.
    expect(monday.meals.flatMap((m) => m.lines).map((l) => l.foodId)).toEqual(expect.arrayContaining(['almonds', 'black-tea', 'murmura-bhel', 'taak']));
  });

  it('counts a line by its measure: 2 chapati is 2 × 40 g', () => {
    const i = lineInfo({ foodId: 'chapati', unit: 'piece', qty: 2 }, foods)!;
    expect(i.grams).toBe(80);
    expect(i.kcal).toBeGreaterThan(200);
  });

  it('offers same-kind swaps with their calorie change: bhakri for chapati, keeping the count', () => {
    expect(roleOf(byId('chapati'))).toBe('bread');
    expect(roleOf(byId('jowar-bhakri'))).toBe('bread');
    const swaps = swapsFor({ foodId: 'chapati', unit: 'piece', qty: 2 }, foods, new Set());
    const bhakri = swaps.find((s) => s.line.foodId === 'jowar-bhakri')!;
    // One bhakri stands in for two chapati, as it does on a real plate.
    expect(bhakri.line).toEqual({ foodId: 'jowar-bhakri', unit: 'piece', qty: 1 });
    expect(swaps.find((s) => s.line.foodId === 'phulka')!.line.qty).toBe(3);
    expect(typeof bhakri.diff).toBe('number');
    expect(swaps.every((s) => roleOf(byId(s.line.foodId)) === 'bread')).toBe(true);
  });

  it('brings a day that is too low back up to the target, in kitchen-sized steps', () => {
    const plan = buildWeekPlan(DEFAULT_ROUTINE, foods);
    const before = dayTotals(plan.days[1], foods).kcal;
    const target = Math.max(before + 400, 1700);
    expect(dayStatus(before, target, 1500)).toBe('low');
    const { day, changes } = balanceDay(plan.days[1], foods, target, new Set());
    const after = dayTotals(day, foods).kcal;
    expect(after).toBeGreaterThan(before);
    expect(Math.abs(after - target)).toBeLessThan(Math.abs(before - target));
    expect(changes.length).toBeGreaterThan(0);
  });

  it('puts a missing roti and dal back first when a plate was cut to bhaji only', () => {
    const plan = buildWeekPlan(DEFAULT_ROUTINE, foods);
    const cut = { meals: plan.days[5].meals.map((m) => (m.id === 'lunch' || m.id === 'dinner' ? { ...m, lines: m.lines.slice(0, 1) } : m)) };
    const { day, changes } = balanceDay(cut, foods, 1700, new Set());
    expect(changes[0].key).toBe('bal_add_bread');
    const lunch = day.meals.find((m) => m.id === 'lunch')!;
    expect(lunch.lines.some((l) => l.foodId === 'chapati')).toBe(true);
    expect(dayTotals(day, foods).kcal).toBeGreaterThanOrEqual(1700 * 0.95);
  });

  it('never stops under the safe minimum, even when the target sits just above it', () => {
    const plan = buildWeekPlan(DEFAULT_ROUTINE, foods);
    const cut = { meals: plan.days[5].meals.map((m) => (m.id === 'lunch' || m.id === 'dinner' ? { ...m, lines: m.lines.slice(0, 1) } : m)) };
    const { day } = balanceDay(cut, foods, 1524, new Set(), 1500);
    const k = dayTotals(day, foods).kcal;
    expect(k).toBeGreaterThanOrEqual(1500);
    expect(dayStatus(k, 1524, 1500)).not.toBe('low');
  });

  it('lifts a day just under the safe minimum over it, even when the only step that does lands above the band', () => {
    // A new person's Tuesday: every step toward a 1200 kcal day is bigger than the 3 kcal it is short.
    const tuesday = planDayFor(NEUTRAL_ROUTINE, 2, foods);
    const k = dayTotals(balanceDay(tuesday, foods, 1200, new Set(), 1200).day, foods).kcal;
    expect(k).toBeGreaterThanOrEqual(1200);
    expect(k).toBeLessThanOrEqual(1200 * 1.1);
  });

  it('never takes a day under the safe minimum on the way down', () => {
    const plan = buildWeekPlan(DEFAULT_ROUTINE, foods);
    const before = dayTotals(plan.days[1], foods).kcal;
    const k = dayTotals(balanceDay(plan.days[1], foods, 1250, new Set(), 1250).day, foods).kcal;
    expect(k).toBeLessThan(before);
    expect(k).toBeGreaterThanOrEqual(1250);
  });

  it('never adds a food the person avoids, or more of one already on the plate; taking some away is still fine', () => {
    const qtyOf = (day: { meals: { lines: { foodId: string; qty: number }[] }[] }, id: string) =>
      day.meals.flatMap((m) => m.lines).filter((l) => l.foodId === id).reduce((a, l) => a + l.qty, 0);
    for (const routine of [NEUTRAL_ROUTINE, DEFAULT_ROUTINE]) {
      for (let d = 0; d < 7; d++) {
        const raw = planDayFor(routine, d, foods);
        // Everything on the plate is avoided: the bread, the dal, the bhaji.
        const onPlate = new Set(raw.meals.flatMap((m) => m.lines.map((l) => l.foodId)));
        const { day } = balanceDay(raw, foods, 2600, onPlate, 1500);
        for (const id of onPlate) expect(qtyOf(day, id)).toBeLessThanOrEqual(qtyOf(raw, id));
        // With every food avoided, nothing at all can be added.
        const all = new Set(foods.map((f) => f.id));
        expect(balanceDay(raw, foods, 2600, all, 1500).day).toEqual(raw);
      }
    }
    // The plan screen's Balance reads the avoid list from the routine the same way.
    const noChapati = avoidedFoodIds({ ...NEUTRAL_ROUTINE, avoid: [ruleForFood(byId('chapati'))], enabled: true });
    const monday = planDayFor(NEUTRAL_ROUTINE, 1, foods);
    expect(qtyOf(monday, 'chapati')).toBeGreaterThan(0);
    const lifted = balanceDay(monday, foods, 2000, noChapati, 1200);
    expect(qtyOf(lifted.day, 'chapati')).toBeLessThanOrEqual(qtyOf(monday, 'chapati'));
    expect(lifted.changes.length).toBeGreaterThan(0);
    // On the way down an avoided bread can still be cut.
    const heavy = { meals: monday.meals.map((m) => (m.id === 'lunch' ? { ...m, lines: m.lines.map((l) => (l.foodId === 'chapati' ? { ...l, qty: 3 } : l)) } : m)) };
    const cut = balanceDay(heavy, foods, dayTotals(heavy, foods).kcal - 250, noChapati);
    expect(qtyOf(cut.day, 'chapati')).toBeLessThan(qtyOf(heavy, 'chapati'));
  });

  it('brings a day that is too high down, and never below one bread', () => {
    const plan = buildWeekPlan(DEFAULT_ROUTINE, foods);
    const before = dayTotals(plan.days[1], foods).kcal;
    const { day } = balanceDay(plan.days[1], foods, before - 300, new Set());
    expect(dayTotals(day, foods).kcal).toBeLessThan(before);
    for (const m of day.meals) for (const l of m.lines) expect(l.qty).toBeGreaterThan(0);
  });

  it('makes one meal per slot of the pattern, in time order, under the slot ids', () => {
    const plan = buildWeekPlan(DEFAULT_ROUTINE, foods);
    expect(plan.days[1].meals.map((m) => m.id)).toEqual(['fruit', 'dry-fruit', 'lunch', 'tea', 'bhel', 'dinner', 'milk']);
    expect(plan.days[1].meals.map((m) => m.time)).toEqual(['08:30', '11:00', '13:00', '15:45', '18:30', '20:00', '21:00']);
  });

  it('adds a staple only when the plate has none of its kind', () => {
    const bhakriLunch: Routine = {
      ...DEFAULT_ROUTINE,
      slots: DEFAULT_ROUTINE.slots.map((s) => (s.id === 'lunch' ? { ...s, options: [[{ foodId: 'jowar-bhakri', unit: 'piece', qty: 1 }]] } : s)),
    };
    const lunch = buildWeekPlan(bhakriLunch, foods).days[1].meals.find((m) => m.id === 'lunch')!;
    expect(lunch.lines.some((l) => l.foodId === 'chapati')).toBe(false);
    expect(lunch.lines.some((l) => l.foodId === 'jowar-bhakri')).toBe(true);
    expect(lunch.lines.filter((l) => roleOf(byId(l.foodId)) === 'dal')).toHaveLength(1);
  });

  it('names the meal it changed by its type', () => {
    const plan = buildWeekPlan(DEFAULT_ROUTINE, foods);
    const before = dayTotals(plan.days[1], foods).kcal;
    const { changes } = balanceDay(plan.days[1], foods, before + 400, new Set());
    expect(changes.length).toBeGreaterThan(0);
    for (const c of changes) expect(['breakfast', 'lunch', 'snack', 'dinner']).toContain(c.params.meal);
  });

  describe('alignWeekPlan', () => {
    const legacy: WeekPlan = {
      days: Array.from({ length: 7 }, () => ({
        meals: [
          { id: 'breakfast', type: 'breakfast', time: '08:30', lines: [{ foodId: 'poha', unit: 'plate', qty: 1 }] },
          { id: 'mid', type: 'snack', time: '11:00', lines: [{ foodId: 'almonds', unit: 'handful', qty: 1 }] },
          { id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 3 }] },
          { id: 'tea', type: 'snack', time: '15:45', lines: [{ foodId: 'black-tea', unit: 'cup', qty: 1 }] },
          { id: 'evening', type: 'snack', time: '18:30', lines: [{ foodId: 'murmura-bhel', unit: 'katori', qty: 1 }] },
          { id: 'dinner', type: 'dinner', time: '20:00', lines: [{ foodId: 'jowar-bhakri', unit: 'piece', qty: 1 }] },
          { id: 'night', type: 'snack', time: '21:30', lines: [{ foodId: 'taak', unit: 'glass', qty: 1 }] },
          { id: 'ghost', type: 'snack', time: '23:00', lines: [{ foodId: 'banana', unit: 'medium', qty: 1 }] },
        ],
      })),
    };

    it('lands the old seven names on the slots by type and time, keeps their lines, drops the rest', () => {
      const day = alignWeekPlan(legacy, DEFAULT_ROUTINE).days[2];
      expect(day.meals.map((m) => m.id)).toEqual(['fruit', 'dry-fruit', 'lunch', 'tea', 'bhel', 'dinner', 'milk']);
      expect(day.meals.find((m) => m.id === 'fruit')!.lines[0].foodId).toBe('poha');
      expect(day.meals.find((m) => m.id === 'lunch')!.lines[0].qty).toBe(3);
      expect(day.meals.find((m) => m.id === 'milk')!.lines[0].foodId).toBe('taak');
      expect(day.meals.some((m) => m.lines.some((l) => l.foodId === 'banana'))).toBe(false);
    });

    it('gives a new slot an empty meal without foods and a built one with them, and keeps edited lines', () => {
      const withLate: Routine = {
        ...DEFAULT_ROUTINE,
        slots: [...DEFAULT_ROUTINE.slots, { id: 'late', type: 'snack', time: '22:30', label_en: 'Late', label_mr: '', label_hi: '', options: [[{ foodId: 'apple', unit: 'medium', qty: 1 }]], withBhaji: false, share: 5 }],
      };
      const built = buildWeekPlan(DEFAULT_ROUTINE, foods);
      expect(alignWeekPlan(built, withLate).days[0].meals.find((m) => m.id === 'late')!.lines).toEqual([]);
      const withFoods = alignWeekPlan(built, withLate, foods);
      expect(withFoods.days[0].meals.find((m) => m.id === 'late')!.lines[0].foodId).toBe('apple');
      expect(withFoods.days[0].meals.find((m) => m.id === 'lunch')!.lines).toEqual(built.days[0].meals.find((m) => m.id === 'lunch')!.lines);
    });

    it('places an old plan meal that has no time instead of throwing', () => {
      // Read as midnight, a timeless snack lands on the earliest snack slot.
      const noTime = { days: Array.from({ length: 7 }, () => ({ meals: [{ id: 'mid', type: 'snack', lines: [{ foodId: 'almonds', unit: 'handful', qty: 1 }] }] })) } as unknown as WeekPlan;
      const day = alignWeekPlan(noTime, DEFAULT_ROUTINE).days[0];
      expect(day.meals.find((m) => m.id === 'dry-fruit')!.lines).toEqual([{ foodId: 'almonds', unit: 'handful', qty: 1 }]);
    });
  });
});

describe('plannedKcal: what lines plan in calories', () => {
  const foods = foodsJson as unknown as FoodItem[];
  const lines = [
    { foodId: 'poha', unit: 'katori', qty: 1.5 },
    { foodId: 'chapati', unit: 'piece', qty: 2 },
  ];

  it('counts each line from the database, as the menu totals do, and leaves out a food that is gone', () => {
    expect(plannedKcal(lines, foods)).toBe(lines.reduce((a, l) => a + lineInfo(l, foods)!.kcal, 0));
    expect(plannedKcal(lines, foods)).toBe(mealTotals({ id: 'x', type: 'lunch', time: '13:00', lines }, foods).kcal);
    expect(plannedKcal([...lines, { foodId: 'gone', unit: 'piece', qty: 1 }], foods)).toBe(plannedKcal(lines, foods));
    expect(plannedKcal([], foods)).toBe(0);
  });
});
