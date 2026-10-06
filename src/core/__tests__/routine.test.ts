import { describe, expect, it } from 'vitest';
import foodsJson from '../../data/foods.json';
import {
  avoidedFoodIds,
  avoidHits,
  bhajiFor,
  DEFAULT_ROUTINE,
  planItems,
  planKcal,
  pruneSpend,
  routineFacts,
  ruleForFood,
  slotLines,
  slotLogged,
  spendStatus,
  spentOn,
  toggleBhaji,
  weekdayOf,
  setBhajiOverride,
  slotStatus,
  slotTime,
  slotsDueBetween,
  addLine,
  newSlot,
  removeLine,
  renameSlot,
  setLineQty,
  updateSlot,
  type SpendLog,
} from '../routine';
import type { FoodItem, Meal } from '../types';

const FOODS = foodsJson as unknown as FoodItem[];
// 2026-10-05 is a Monday.
const MON = '2026-10-05';

const meal = (type: Meal['type'], ids: string[], names: string[] = ids): Meal => ({
  id: `${type}-${ids.join()}`,
  at: `${MON}T13:00:00`,
  date: MON,
  type,
  items: ids.map((foodId, i) => ({ foodId: foodId || undefined, name_en: names[i], name_mr: '', grams: 100, kcal: 100, protein: 5, carbs: 10, fat: 2, estimated: false })),
  kcal: 100 * ids.length,
  protein: 5,
});

const spend = (date: string, rupees: number, spreadDays: number): SpendLog => ({ id: `${date}-${rupees}`, date, at: `${date}T10:00:00`, category: 'other', rupees, spreadDays });

describe('the default routine', () => {
  it('only names foods that exist in the database', () => {
    const ids = new Set(FOODS.map((f) => f.id));
    const used = [
      ...DEFAULT_ROUTINE.week.flat(),
      ...DEFAULT_ROUTINE.slots.flatMap((s) => s.options.flat().map((l) => l.foodId)),
      ...DEFAULT_ROUTINE.avoid.flatMap((r) => [...r.foodIds, ...r.swapIds]),
    ];
    expect(used.filter((id) => !ids.has(id))).toEqual([]);
  });

  it('uses portion units each food actually has', () => {
    for (const l of DEFAULT_ROUTINE.slots.flatMap((s) => s.options.flat())) {
      const food = FOODS.find((f) => f.id === l.foodId)!;
      expect(food.portions.map((p) => p.unit), l.foodId).toContain(l.unit);
    }
  });

  it('has a bhaji for every weekday but Sunday', () => {
    expect(weekdayOf(MON)).toBe(1);
    expect(bhajiFor(DEFAULT_ROUTINE, MON)).toEqual(['dudhi-bhaji']);
    expect(bhajiFor(DEFAULT_ROUTINE, '2026-10-06')).toEqual(['palak-bhaji', 'methi-bhaji']);
    expect(bhajiFor(DEFAULT_ROUTINE, '2026-10-11')).toEqual([]);
  });

  it('plans a day well under a weight-loss target', () => {
    const kcal = planKcal(DEFAULT_ROUTINE, FOODS, MON);
    expect(kcal).toBeGreaterThan(500);
    expect(kcal).toBeLessThan(1500);
  });
});

describe('setBhajiOverride', () => {
  it('puts a day\'s own pick ahead of the week and forgets old picks', () => {
    const r = { ...DEFAULT_ROUTINE, overrides: { '2026-09-01': ['mixed-veg'] } };
    const next = { ...r, ...setBhajiOverride(r, '2026-10-07', ['shepu-bhaji'], MON) };
    expect(bhajiFor(next, '2026-10-07')).toEqual(['shepu-bhaji']);
    expect(bhajiFor(next, '2026-10-06')).toEqual(['palak-bhaji', 'methi-bhaji']);
    expect(next.overrides?.['2026-09-01']).toBeUndefined();
  });
});

describe('slots on the clock', () => {
  const lunch = DEFAULT_ROUTINE.slots.find((s) => s.id === 'lunch')!;
  it('has a time for every default slot and a fallback by meal', () => {
    expect(slotTime(lunch)).toBe('13:00');
    expect(slotTime({ ...lunch, time: undefined })).toBe('13:00');
    expect(slotTime({ ...lunch, type: 'dinner', time: 'soon' })).toBe('20:30');
  });
  it('is later, then now, then missed, unless logged or skipped', () => {
    const at = 13 * 60;
    expect(slotStatus(lunch, at - 60, false, false)).toBe('later');
    expect(slotStatus(lunch, at - 10, false, false)).toBe('now');
    expect(slotStatus(lunch, at + 44, false, false)).toBe('now');
    expect(slotStatus(lunch, at + 46, false, false)).toBe('missed');
    expect(slotStatus(lunch, at + 46, true, false)).toBe('done');
    expect(slotStatus(lunch, at + 46, false, true)).toBe('skipped');
  });
  it('knows which prompts fall inside a tick', () => {
    expect(slotsDueBetween(DEFAULT_ROUTINE, 13 * 60 + 44, 13 * 60 + 45).map((s) => s.id)).toEqual(['lunch']);
    expect(slotsDueBetween(DEFAULT_ROUTINE, 13 * 60 + 45, 13 * 60 + 46)).toEqual([]);
  });
});

describe('toggleBhaji', () => {
  it('adds, removes, and keeps at most two a day', () => {
    let week = toggleBhaji(DEFAULT_ROUTINE.week, 0, 'dudhi-bhaji');
    expect(week[0]).toEqual(['dudhi-bhaji']);
    week = toggleBhaji(week, 0, 'palak-bhaji');
    week = toggleBhaji(week, 0, 'methi-bhaji');
    expect(week[0]).toEqual(['palak-bhaji', 'methi-bhaji']);
    week = toggleBhaji(week, 0, 'palak-bhaji');
    expect(week[0]).toEqual(['methi-bhaji']);
    // Other days are untouched.
    expect(week[1]).toEqual(DEFAULT_ROUTINE.week[1]);
  });
});

describe('slots', () => {
  const lunch = DEFAULT_ROUTINE.slots.find((s) => s.id === 'lunch')!;
  const tea = DEFAULT_ROUTINE.slots.find((s) => s.id === 'tea')!;

  it('puts the day’s bhaji in front of the chosen option', () => {
    const lines = slotLines(DEFAULT_ROUTINE, lunch, 1, 'dudhi-bhaji');
    expect(lines.map((l) => l.foodId)).toEqual(['dudhi-bhaji', 'moong-dal']);
    expect(slotLines(DEFAULT_ROUTINE, tea, 0, 'dudhi-bhaji').map((l) => l.foodId)).toEqual(['black-tea']);
  });

  it('turns lines into real numbers from the database', () => {
    const items = planItems([{ foodId: 'chapati', unit: 'piece', qty: 2 }], FOODS);
    expect(items[0].grams).toBe(80);
    expect(items[0].kcal).toBe(Math.round((297 * 80) / 100));
    expect(planItems([{ foodId: 'gone', unit: 'x', qty: 1 }], FOODS)).toEqual([]);
  });

  it('counts a slot as done only from a meal of its own type', () => {
    expect(slotLogged(lunch, ['dudhi-bhaji'], [meal('lunch', ['chapati'])])).toBe(true);
    expect(slotLogged(lunch, ['dudhi-bhaji'], [meal('lunch', ['dudhi-bhaji'])])).toBe(true);
    expect(slotLogged(lunch, ['dudhi-bhaji'], [meal('dinner', ['chapati'])])).toBe(false);
    expect(slotLogged(tea, [], [meal('snack', ['chai-with-sugar'])])).toBe(false);
  });
});

describe('editing slots', () => {
  const slot = newSlot('snack', 'Evening');
  const chana = { foodId: 'roasted-chana', unit: 'handful', qty: 1 };

  it('adds a food, and merges the same food into a bigger portion', () => {
    const once = addLine(slot, 0, chana);
    expect(once.options[0]).toEqual([chana]);
    expect(addLine(once, 0, chana).options[0]).toEqual([{ ...chana, qty: 2 }]);
  });

  it('changes a portion and removes a food', () => {
    const s = addLine(addLine(slot, 0, chana), 0, { foodId: 'taak', unit: 'glass', qty: 1 });
    expect(setLineQty(s, 0, 'taak', 2).options[0][1].qty).toBe(2);
    expect(removeLine(s, 0, 'taak').options[0]).toEqual([chana]);
  });

  it('drops an emptied alternative but always keeps one option', () => {
    const two = { ...slot, options: [[chana], [{ foodId: 'taak', unit: 'glass', qty: 1 }]] };
    expect(removeLine(two, 1, 'taak').options).toEqual([[chana]]);
    expect(removeLine(slot, 0, 'nothing').options).toEqual([[]]);
  });

  it('renames in one language and fills the English fallback', () => {
    const mr = renameSlot(slot, 'mr', 'संध्याकाळ');
    expect(mr.label_mr).toBe('संध्याकाळ');
    expect(mr.label_en).toBe('Evening');
    expect(renameSlot(newSlot('snack', ''), 'hi', 'शाम').label_en).toBe('शाम');
    expect(updateSlot([slot], slot.id, { type: 'dinner' })[0].type).toBe('dinner');
  });
});

describe('avoidHits', () => {
  it('matches by database id', () => {
    const hits = avoidHits(meal('snack', ['cashews', 'almonds']).items, DEFAULT_ROUTINE.avoid);
    expect(hits.map((h) => h.rule.id)).toEqual(['cashews']);
  });

  it('matches whole words in names that have no database food', () => {
    const items = meal('snack', ['', ''], ['Kaju handful', 'Sev puri']).items;
    expect(avoidHits(items, DEFAULT_ROUTINE.avoid).map((h) => h.rule.id)).toEqual(['cashews', 'fried-snacks']);
  });

  it('does not catch a word inside another word', () => {
    const items = meal('breakfast', ['', ''], ['Sevai Upma', 'Chai without sugar']).items;
    expect(avoidHits(items, DEFAULT_ROUTINE.avoid)).toEqual([]);
  });

  it('reports one hit per rule', () => {
    expect(avoidHits(meal('snack', ['shev', 'chivda', 'marie-biscuit']).items, DEFAULT_ROUTINE.avoid)).toHaveLength(1);
  });

  it('builds a rule for a single food', () => {
    const rule = ruleForFood(FOODS.find((f) => f.id === 'gulab-jamun') ?? FOODS[0]);
    expect(rule.foodIds).toHaveLength(1);
    expect(avoidedFoodIds({ ...DEFAULT_ROUTINE, avoid: [rule] }).has(rule.foodIds[0])).toBe(true);
    expect(avoidedFoodIds({ ...DEFAULT_ROUTINE, enabled: false }).size).toBe(0);
  });
});

describe('spending', () => {
  it('spreads a bulk buy over the days it lasts', () => {
    const logs = [spend('2026-10-01', 900, 30), spend(MON, 60, 1)];
    expect(spentOn(logs, MON)).toBe(90);
    expect(spentOn(logs, '2026-10-06')).toBe(30);
    // The month ends on day 30, not 31.
    expect(spentOn(logs, '2026-10-30')).toBe(30);
    expect(spentOn(logs, '2026-10-31')).toBe(0);
    expect(spentOn(logs, '2026-09-30')).toBe(0);
  });

  it('places a total against the range', () => {
    expect(spendStatus(150, 170, 200)).toBe('under');
    expect(spendStatus(170, 170, 200)).toBe('in');
    expect(spendStatus(201, 170, 200)).toBe('over');
  });

  it('drops logs only once their spread is long over', () => {
    const logs = [spend('2026-01-01', 10, 1), spend('2026-06-01', 900, 30), spend('2026-09-01', 10, 1)];
    // 120 days back is 7 June; the June month-long buy still ran until 1 July.
    expect(pruneSpend(logs, MON).map((l) => l.date)).toEqual(['2026-06-01', '2026-09-01']);
    expect(pruneSpend(logs, MON, 60).map((l) => l.date)).toEqual(['2026-09-01']);
  });
});

describe('routineFacts', () => {
  it('tells the coach the bhaji, the avoid list and the money', () => {
    const facts = routineFacts(DEFAULT_ROUTINE, FOODS, MON, [meal('snack', ['cashews'], ['Cashews'])], 120).join('\n');
    expect(facts).toContain('Dudhi Bhaji');
    expect(facts).toContain('Cashews');
    expect(facts).toContain('₹170');
    expect(facts).toContain('₹120');
    expect(facts).toContain('Eaten today despite the avoid list: Cashews');
  });

  it('says nothing when the routine is off', () => {
    expect(routineFacts({ ...DEFAULT_ROUTINE, enabled: false }, FOODS, MON, [], 0)).toEqual([]);
  });
});
