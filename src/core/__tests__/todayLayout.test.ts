import { describe, expect, it } from 'vitest';
import { caloriesLeft, todayBlocks } from '../todayLayout';

const on = (id: string) => ({ id, on: true });
const off = (id: string) => ({ id, on: false });

describe('todayBlocks', () => {
  it('shows the menu, the coach line and Water and Walk by default', () => {
    expect(todayBlocks(undefined)).toEqual([{ kind: 'menu' }, { kind: 'coach' }, { kind: 'waterWalk' }]);
  });

  it("pairs the single tiles two to a row in order, and keeps the person's order around them", () => {
    expect(todayBlocks([on('menu'), on('weight'), on('sleep'), on('climb'), on('coach'), off('waterWalk')])).toEqual([
      { kind: 'menu' },
      { kind: 'pair', tiles: ['weight', 'sleep'] },
      { kind: 'pair', tiles: ['climb'] },
      { kind: 'coach' },
    ]);
    expect(todayBlocks([on('weight'), on('menu'), on('sleep')])).toEqual([{ kind: 'pair', tiles: ['weight'] }, { kind: 'menu' }, { kind: 'pair', tiles: ['sleep'] }]);
  });

  it('leaves out unknown, repeated and switched-off cards', () => {
    expect(todayBlocks([on('menu'), on('menu'), { id: 'today', on: true }, 42, off('coach'), on('steps'), on('mantra')])).toEqual([{ kind: 'menu' }, { kind: 'steps' }, { kind: 'mantra' }]);
  });
});

describe('caloriesLeft', () => {
  const targets = { kcal: 1800, proteinG: 112 };
  const view = { plannedKcal: 1650, plannedProtein: 70, eatenKcal: 1200, eatenProtein: 38 };
  const budget = { remaining: 650, earned: 50, proteinConsumed: 40 };

  it("today is the live budget, a walk's calories included, with what is planned against the goal", () => {
    expect(caloriesLeft({ mode: 'today', targets, view, budget, suggested: false })).toEqual({
      kcal: 650,
      over: false,
      alarm: false,
      label: 'kcal_left',
      line: { key: 'today_planned_goal', kcal: 1650, goal: 1800 },
      earned: 50,
      protein: { g: 40, target: 112 },
    });
    // Eaten past the budget today is said, in red.
    expect(caloriesLeft({ mode: 'today', targets, view, budget: { ...budget, remaining: -120 }, suggested: false })).toMatchObject({ kcal: 120, over: true, alarm: true, label: 'kcal_over' });
  });

  it('a past day is the goal less what was eaten, with "Eaten X of Y" and no walk added', () => {
    expect(caloriesLeft({ mode: 'past', targets, view, budget, suggested: false })).toEqual({
      kcal: 600,
      over: false,
      alarm: false,
      label: 'kcal_left',
      line: { key: 'today_eaten_of', kcal: 1200, goal: 1800 },
      earned: 0,
      protein: { g: 38, target: 112 },
    });
    // A past day reads what was eaten even when its menu was the app's suggestion.
    expect(caloriesLeft({ mode: 'past', targets, view: { ...view, eatenKcal: 2000 }, budget, suggested: true })).toMatchObject({ kcal: 200, over: true, alarm: true, line: { key: 'today_eaten_of' } });
  });

  it('a future day is what the plan leaves, with the planned protein', () => {
    expect(caloriesLeft({ mode: 'future', targets, view, budget, suggested: false })).toEqual({
      kcal: 150,
      over: false,
      alarm: false,
      label: 'today_left_after_plan',
      line: { key: 'today_planned_goal', kcal: 1650, goal: 1800 },
      earned: 0,
      protein: { g: 70, target: 112 },
    });
    expect(caloriesLeft({ mode: 'future', targets, view: { ...view, plannedKcal: 1900 }, budget, suggested: false })).toMatchObject({ kcal: 100, over: true, alarm: true, label: 'kcal_over' });
  });

  it("names the app's own suggestion as one and never judges it in red", () => {
    expect(caloriesLeft({ mode: 'future', targets, view: { ...view, plannedKcal: 1900 }, budget, suggested: true })).toMatchObject({
      kcal: 100,
      over: true,
      alarm: false,
      line: { key: 'today_suggested_goal', kcal: 1900, goal: 1800 },
    });
    // A suggestion under the safe minimum leaves a lot "left"; the menu says it is low, this number stays plain.
    expect(caloriesLeft({ mode: 'future', targets, view: { ...view, plannedKcal: 900 }, budget, suggested: true })).toMatchObject({ kcal: 900, over: false, alarm: false, label: 'today_left_after_plan' });
    expect(caloriesLeft({ mode: 'today', targets, view, budget, suggested: true }).line).toEqual({ key: 'today_suggested_goal', kcal: 1650, goal: 1800 });
  });
});
