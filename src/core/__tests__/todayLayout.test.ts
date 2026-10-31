import { describe, expect, it } from 'vitest';
import { caloriesLeft, dayReviewShown, firstName, greetingKey, todayBlocks, todayGreeting, withReview } from '../todayLayout';

const on = (id: string) => ({ id, on: true });
const off = (id: string) => ({ id, on: false });

describe('todayBlocks', () => {
  it('shows the menu, the coach line, Water and Walk and the Abhyas list by default', () => {
    expect(todayBlocks(undefined)).toEqual([{ kind: 'menu' }, { kind: 'coach' }, { kind: 'waterWalk' }, { kind: 'abhyas' }]);
  });

  it('shows the Abhyas list on every day, in its place, and nothing for it while its card is off', () => {
    const cards = [on('abhyas'), on('menu'), on('weight')];
    for (const mode of ['today', 'past', 'future'] as const) {
      expect(todayBlocks(cards, mode)).toEqual([{ kind: 'abhyas' }, { kind: 'menu' }, { kind: 'pair', tiles: ['weight'] }]);
    }
    expect(todayBlocks([on('menu'), off('abhyas')])).toEqual([{ kind: 'menu' }]);
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

  it('leaves the Sleep tile out of a day still to come, where there is no night to check in yet, and pairs the rest', () => {
    const cards = [on('menu'), on('weight'), on('sleep'), on('climb')];
    expect(todayBlocks(cards, 'future')).toEqual([{ kind: 'menu' }, { kind: 'pair', tiles: ['weight', 'climb'] }]);
    expect(todayBlocks([on('sleep'), on('menu')], 'future')).toEqual([{ kind: 'menu' }]);
    expect(todayBlocks(cards, 'past')).toEqual(todayBlocks(cards, 'today'));
    expect(todayBlocks(cards, 'today')).toEqual([{ kind: 'menu' }, { kind: 'pair', tiles: ['weight', 'sleep'] }, { kind: 'pair', tiles: ['climb'] }]);
  });

  it('leaves out unknown, repeated and switched-off cards', () => {
    expect(todayBlocks([on('menu'), on('menu'), { id: 'today', on: true }, 42, off('coach'), on('steps'), on('mantra')], 'today', true)).toEqual([{ kind: 'menu' }, { kind: 'steps' }, { kind: 'mantra' }]);
  });

  it("never shows the day's line while it is switched off in Settings, even with its card on", () => {
    const cards = [on('menu'), on('mantra'), on('coach')];
    expect(todayBlocks(cards, 'today', false)).toEqual([{ kind: 'menu' }, { kind: 'coach' }]);
    expect(todayBlocks(cards)).toEqual([{ kind: 'menu' }, { kind: 'coach' }]);
    expect(todayBlocks(cards, 'today', true)).toEqual([{ kind: 'menu' }, { kind: 'mantra' }, { kind: 'coach' }]);
  });
});

describe('caloriesLeft', () => {
  const targets = { kcal: 1800, proteinG: 112 };
  const view = { plannedKcal: 1650, plannedProtein: 70, eatenKcal: 1200, eatenProtein: 38, judged: true };
  const budget = { remaining: 650, earned: 50, proteinConsumed: 40 };
  /** Everything else as on an ordinary day in the record. */
  const base = { offDay: false, dayEarned: 0 };

  it("today is the live budget, a walk's calories included, with what is planned against the goal", () => {
    expect(caloriesLeft({ mode: 'today', targets, view, budget, suggested: false, ...base })).toEqual({
      kcal: 650,
      over: false,
      alarm: false,
      label: 'kcal_left',
      line: { key: 'today_planned_goal', kcal: 1650, goal: 1800 },
      earned: 50,
      protein: { g: 40, target: 112 },
      // The bar: eaten out of the goal and what the walk earned back.
      bar: { used: 1200, of: 1850 },
    });
    // Eaten past the budget today is said, in red.
    expect(caloriesLeft({ mode: 'today', targets, view, budget: { ...budget, remaining: -120 }, suggested: false, ...base })).toMatchObject({ kcal: 120, over: true, alarm: true, label: 'kcal_over' });
  });

  it('a past day is the goal less what was eaten, with "Eaten X of Y"', () => {
    expect(caloriesLeft({ mode: 'past', targets, view, budget, suggested: false, ...base })).toEqual({
      kcal: 600,
      over: false,
      alarm: false,
      label: 'kcal_left',
      line: { key: 'today_eaten_of', kcal: 1200, goal: 1800 },
      earned: 0,
      protein: { g: 38, target: 112 },
      bar: { used: 1200, of: 1800 },
    });
    // A past day reads what was eaten even when its menu was the app's suggestion.
    expect(caloriesLeft({ mode: 'past', targets, view: { ...view, eatenKcal: 2000 }, budget, suggested: true, ...base })).toMatchObject({ kcal: 200, over: true, alarm: true, line: { key: 'today_eaten_of' } });
  });

  it('a future day is what the plan leaves, with the planned protein', () => {
    expect(caloriesLeft({ mode: 'future', targets, view, budget, suggested: false, ...base })).toEqual({
      kcal: 150,
      over: false,
      alarm: false,
      label: 'today_left_after_plan',
      line: { key: 'today_planned_goal', kcal: 1650, goal: 1800 },
      earned: 0,
      protein: { g: 70, target: 112 },
      // A day still to come fills its bar with what is planned.
      bar: { used: 1650, of: 1800 },
    });
    expect(caloriesLeft({ mode: 'future', targets, view: { ...view, plannedKcal: 1900 }, budget, suggested: false, ...base })).toMatchObject({ kcal: 100, over: true, alarm: true, label: 'kcal_over' });
  });

  it("names the app's own suggestion as one and never judges it in red", () => {
    expect(caloriesLeft({ mode: 'future', targets, view: { ...view, plannedKcal: 1900 }, budget, suggested: true, ...base })).toMatchObject({
      kcal: 100,
      over: true,
      alarm: false,
      line: { key: 'today_suggested_goal', kcal: 1900, goal: 1800 },
    });
    // A suggestion under the safe minimum leaves a lot "left"; the menu says it is low, this number stays plain.
    expect(caloriesLeft({ mode: 'future', targets, view: { ...view, plannedKcal: 900 }, budget, suggested: true, ...base })).toMatchObject({ kcal: 900, over: false, alarm: false, label: 'today_left_after_plan' });
    expect(caloriesLeft({ mode: 'today', targets, view, budget, suggested: true, ...base }).line).toEqual({ key: 'today_suggested_goal', kcal: 1650, goal: 1800 });
  });

  it("a past day counts that day's walks, so its number is the one today showed and does not change at midnight", () => {
    expect(caloriesLeft({ mode: 'past', targets, view, budget, suggested: false, offDay: false, dayEarned: 60 })).toMatchObject({ kcal: 660, earned: 60, line: { key: 'today_eaten_of', kcal: 1200, goal: 1800 } });
    // A day still to come has earned nothing yet.
    expect(caloriesLeft({ mode: 'future', targets, view, budget, suggested: false, offDay: false, dayEarned: 60 })).toMatchObject({ kcal: 150, earned: 0 });
  });

  it('today with the app\'s own suggestion and food eaten past the goal is still said in red', () => {
    expect(caloriesLeft({ mode: 'today', targets, view, budget: { ...budget, remaining: -120 }, suggested: true, ...base })).toMatchObject({ kcal: 120, over: true, alarm: true });
  });

  it('never raises the red alarm on a free day, today, past or still to come', () => {
    const free = { ...view, judged: false };
    expect(caloriesLeft({ mode: 'today', targets, view: free, budget: { ...budget, remaining: -300 }, suggested: false, offDay: true, dayEarned: 0 })).toMatchObject({ over: true, alarm: false, label: 'kcal_over' });
    expect(caloriesLeft({ mode: 'past', targets, view: { ...free, eatenKcal: 2400 }, budget, suggested: false, offDay: true, dayEarned: 0 })).toMatchObject({ kcal: 600, over: true, alarm: false });
    expect(caloriesLeft({ mode: 'future', targets, view: { ...free, plannedKcal: 2400 }, budget, suggested: false, offDay: true, dayEarned: 0 })).toMatchObject({ over: true, alarm: false });
  });

  it("fills the bar past its end when the day goes over, and counts a past day's walks in its length", () => {
    expect(caloriesLeft({ mode: 'today', targets, view, budget: { ...budget, remaining: -120 }, suggested: false, ...base }).bar).toEqual({ used: 1970, of: 1850 });
    expect(caloriesLeft({ mode: 'past', targets, view, budget, suggested: false, offDay: false, dayEarned: 60 }).bar).toEqual({ used: 1200, of: 1860 });
  });

  it('a day before the person started shows what was eaten, with no "left" and no alarm', () => {
    const before = caloriesLeft({ mode: 'past', targets, view: { ...view, eatenKcal: 2400, judged: false }, budget, suggested: false, offDay: false, dayEarned: 0 });
    expect(before).toMatchObject({ label: null, alarm: false, line: { key: 'today_eaten_of', kcal: 2400, goal: 1800 } });
  });
});

describe('dayReviewShown', () => {
  const evening = { on: true, mode: 'today' as const, hour: 21, hasData: true };

  it('shows the evening review on Today from 20:00 while its reminder is on, once there is something to say', () => {
    expect(dayReviewShown(evening)).toBe(true);
    expect(dayReviewShown({ ...evening, hour: 20 })).toBe(true);
    expect(dayReviewShown({ ...evening, hour: 23 })).toBe(true);
  });

  it('never while the reminder is off, before the evening, on another day, or with nothing logged today', () => {
    expect(dayReviewShown({ ...evening, on: false })).toBe(false);
    expect(dayReviewShown({ ...evening, hour: 19 })).toBe(false);
    expect(dayReviewShown({ ...evening, mode: 'past' })).toBe(false);
    expect(dayReviewShown({ ...evening, mode: 'future' })).toBe(false);
    expect(dayReviewShown({ ...evening, hasData: false })).toBe(false);
  });
});

describe('withReview: the evening review within the five blocks under the top', () => {
  const menu = { kind: 'menu' as const };
  const coach = { kind: 'coach' as const };
  const waterWalk = { kind: 'waterWalk' as const };
  const abhyas = { kind: 'abhyas' as const };
  const steps = { kind: 'steps' as const };
  const pair = { kind: 'pair' as const, tiles: ['weight' as const] };

  it('comes after the cards while there is room: with the cards Today starts with, it is the fifth block under the top', () => {
    expect(withReview([menu, coach, waterWalk, abhyas], true)).toEqual([menu, coach, waterWalk, abhyas, { kind: 'review' }]);
    expect(withReview([menu, coach, waterWalk, abhyas], false)).toEqual([menu, coach, waterWalk, abhyas]);
    expect(withReview([menu, steps, coach, waterWalk], true)).toEqual([menu, steps, coach, waterWalk, { kind: 'review' }]);
  });

  it('takes the place of the last card the person added, never a sixth block, and never in place of the menu, the coach, Water and Walk or the Abhyas list', () => {
    expect(withReview([menu, steps, coach, waterWalk, abhyas], true)).toEqual([menu, { kind: 'review' }, coach, waterWalk, abhyas]);
    expect(withReview([menu, pair, coach, steps, waterWalk], true)).toEqual([menu, pair, coach, { kind: 'review' }, waterWalk]);
    expect(withReview([abhyas, menu, pair, coach, waterWalk, steps], true)).toEqual([abhyas, menu, pair, coach, waterWalk, { kind: 'review' }]);
  });
});

describe("Today's greeting", () => {
  it('greets by the hour: morning from 4:00, afternoon from noon, evening from 17:00 and through the night', () => {
    expect([4, 11, 12, 16, 17, 23, 0, 3].map(greetingKey)).toEqual([
      'greet_morning',
      'greet_morning',
      'greet_afternoon',
      'greet_afternoon',
      'greet_evening',
      'greet_evening',
      'greet_evening',
      'greet_evening',
    ]);
  });

  it('takes the first word of the name, and nothing from a name left empty', () => {
    expect(firstName('Varad Shinde')).toBe('Varad');
    expect(firstName('  वरद  शिंदे ')).toBe('वरद');
    expect(firstName('')).toBeNull();
    expect(firstName('   ')).toBeNull();
    expect(firstName(undefined)).toBeNull();
  });

  it("says it in the user's language, with the first name, or the greeting alone with no name", () => {
    expect(todayGreeting(8, 'Varad Shinde', 'en')).toBe('Good morning, Varad');
    expect(todayGreeting(8, 'वरद शिंदे', 'mr')).toBe('शुभ सकाळ, वरद');
    expect(todayGreeting(14, 'Varad', 'hi')).toBe('शुभ दोपहर, Varad');
    expect(todayGreeting(20, '', 'en')).toBe('Good evening');
    expect(todayGreeting(20, undefined, 'mr')).toBe('शुभ संध्याकाळ');
  });
});
