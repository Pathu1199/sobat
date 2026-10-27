import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import { dayPlan, fullDayPlan } from '../dayPlan';
import { pattern } from '../pattern';
import { DEFAULT_ROUTINE, DEFAULT_SLOTS, type RoutineSlot } from '../routine';
import type { FoodItem } from '../types';

const foods = foodsJson as FoodItem[];
const four = pattern({ ...DEFAULT_ROUTINE, slots: DEFAULT_SLOTS });

describe('dayPlan', () => {
  it('splits what is left across the meals still to come and keeps each plate within budget', () => {
    const p = dayPlan({ remaining: 980, hour: 14, foods, avoided: new Set(), slots: four, loggedSlotIds: ['breakfast'] });
    expect(p.stop).toBe(false);
    expect(p.now).toBe('lunch');
    expect(p.slots.map((s) => s.type)).toEqual(['lunch', 'snack', 'dinner']);
    const budgets = p.slots.reduce((a, s) => a + s.budget, 0);
    expect(Math.abs(budgets - 980)).toBeLessThanOrEqual(2);
    for (const s of p.slots) {
      expect(s.picks.length).toBeGreaterThan(0);
      expect(s.kcal).toBeLessThanOrEqual(s.budget);
      expect(new Set(s.picks.map((x) => x.food.id)).size).toBe(s.picks.length);
    }
  });

  it('says stop when almost nothing is left, and never suggests the avoided', () => {
    expect(dayPlan({ remaining: 40, hour: 20, foods, avoided: new Set(), slots: four }).stop).toBe(true);
    const all = dayPlan({ remaining: 1200, hour: 9, foods, avoided: new Set(['poha']), slots: four });
    expect(all.slots.flatMap((s) => s.picks).some((p) => p.food.id === 'poha')).toBe(false);
  });

  it('puts the routine bhaji first and reshuffles the rest with the seed', () => {
    const veg = foods.find((f) => f.category === 'veg')!;
    const a = dayPlan({ remaining: 1000, hour: 12, foods, avoided: new Set(), preferred: [veg.id], slots: four, loggedSlotIds: ['breakfast'] });
    expect(a.slots[0].picks[0].food.id).toBe(veg.id);
    const b = dayPlan({ remaining: 1000, hour: 12, foods, avoided: new Set(), seed: 3, slots: four, loggedSlotIds: ['breakfast'] });
    const c = dayPlan({ remaining: 1000, hour: 12, foods, avoided: new Set(), seed: 4, slots: four, loggedSlotIds: ['breakfast'] });
    expect(b.slots[0].picks.map((p) => p.food.id)).not.toEqual(c.slots[0].picks.map((p) => p.food.id));
  });

  it('offers lighter swaps and a full-day sheet with all four meals', () => {
    const full = fullDayPlan({ remaining: 1700, foods, avoided: new Set(), slots: four });
    expect(full.slots.map((s) => s.type)).toEqual(['breakfast', 'lunch', 'snack', 'dinner']);
    const withAlts = full.slots.flatMap((s) => s.picks).filter((p) => (p.alts?.length ?? 0) > 0);
    expect(withAlts.length).toBeGreaterThan(0);
    for (const p of withAlts) for (const a of p.alts!) expect(a.kcal).toBeLessThanOrEqual(p.kcal);
  });

  it('with the pattern on, the meals ahead are its slots, each with its share of what is left', () => {
    const slot = (id: string, type: RoutineSlot['type'], time: string, share: number): RoutineSlot => ({ id, type, time, label_en: id, label_mr: '', label_hi: '', options: [[]], withBhaji: false, share });
    const slots = pattern({ ...DEFAULT_ROUTINE, slots: [slot('morning', 'breakfast', '08:30', 25), slot('lunch', 'lunch', '13:00', 40), slot('dinner', 'dinner', '19:30', 35)] });
    const base = { remaining: 1000, hour: 14, foods, avoided: new Set<string>(), slots, loggedSlotIds: ['morning'] };
    const p = dayPlan({ ...base, nowMinutes: 14 * 60 });
    expect(p.slots.map((s) => s.id)).toEqual(['lunch', 'dinner']);
    expect(p.nowId).toBe('lunch');
    expect(p.now).toBe('lunch');
    expect(p.slots[0].budget).toBe(Math.round((1000 * 0.4) / 0.75));
    // Once dinner's window is near, a lunch never eaten drops off.
    const late = dayPlan({ ...base, nowMinutes: 19 * 60 + 10 });
    expect(late.slots.map((s) => s.id)).toEqual(['dinner']);
  });

  it('splits evenly when every slot still ahead has a share of zero', () => {
    const slot = (id: string, type: RoutineSlot['type'], time: string, share: number): RoutineSlot => ({ id, type, time, label_en: id, label_mr: '', label_hi: '', options: [[]], withBhaji: false, share });
    const slots = pattern({ ...DEFAULT_ROUTINE, slots: [slot('morning', 'breakfast', '08:30', 100), slot('lunch', 'lunch', '13:00', 0), slot('dinner', 'dinner', '19:30', 0)] });
    const p = dayPlan({ remaining: 800, hour: 14, foods, avoided: new Set<string>(), slots, loggedSlotIds: ['morning'], nowMinutes: 14 * 60 });
    expect(p.slots.map((s) => s.budget)).toEqual([400, 400]);
  });
});
