import { describe, expect, it } from 'vitest';
import { migrateState, upgradeFile } from '../../store/migrate';
import { allFoods, EMPTY_STATE, STATE_VERSION } from '../../store/defaults';
import { allowance, pattern } from '../pattern';
import { DEFAULT_ROUTINE, DEFAULT_SLOTS, NEUTRAL_ROUTINE } from '../routine';
import { bannerState } from '../remindersBanner';
import { DEFAULT_TODAY_CARDS } from '../tabs';
import foodsJson from '../../data/foods.json';
import { weekDates } from '../date';
import { foodsForDiet } from '../foods';
import { fitFor, isSuggested, menuFor, setMenuLine, viewMenu, withAutoFill } from '../menu';
import { forCloud, landMerge, RoundStop, stable, syncRound, type CloudState } from '../sync';
import type { AppState, FoodItem } from '../types';
import { buildWeekPlan } from '../weekPlan';

const foods = foodsJson as FoodItem[];

// A realistic v1 blob: the shape the app has been writing until now.
const v1 = {
  version: 1,
  profile: { name: 'Varad', sex: 'male', birthYear: 1998, heightCm: 172, weightKg: 98.7, activity: 'sedentary', goalWeightKg: 80, rateKgPerWeek: 0.5, lang: 'mr', onboarded: true },
  settings: { ollamaUrl: 'http://192.168.1.10:11434', ollamaFallbackUrl: '', textModel: 'qwen3:8b', visionModel: 'qwen2.5vl:7b', nudgeMinutes: 30, nudgesEnabled: true, quietStartHour: 22, quietEndHour: 7, waterGoalMl: 3000, glassMl: 250 },
  meals: [{ id: 'm1', at: '2026-09-26T03:10:00.000Z', date: '2026-09-26', type: 'breakfast', items: [], kcal: 300, protein: 6 }],
  water: [], weights: [], sleep: [], moods: [], workouts: [], nudges: [], chat: [], customFoods: [], memory: [], usage: [],
  breaks: [
    { id: 'b1', date: '2026-09-26', at: '2026-09-26T09:20:00.000Z', action: 'taken', workedMinutes: 20 },
    { id: 'b2', date: '2026-09-26', at: '2026-09-26T10:20:00.000Z', action: 'skipped', workedMinutes: 20 },
  ],
  breakSettings: { enabled: true, workMinutes: 20, breakSeconds: 60, allowSkip: true, quietStartHour: 22, quietEndHour: 7 },
  tips: [], photoQueue: [], steps: [], actionsDone: [],
};

// A Wednesday; its week runs from Monday 26 October to Sunday 1 November.
const NOW = new Date('2026-10-28T10:00:00');

describe('migrateState', () => {
  it('carries the old interval and length into the micro break', () => {
    const s = migrateState({ ...v1, breakSettings: { ...v1.breakSettings, workMinutes: 30, breakSeconds: 45 } });
    expect(s.breakSettings.micro.everyMinutes).toBe(30);
    expect(s.breakSettings.micro.seconds).toBe(45);
    expect(s.breakSettings.enabled).toBe(true);
  });

  it('leaves micro breaks off where the screen is the phone itself', () => {
    // vitest runs under the node platform, which is the non-web branch.
    expect(migrateState(v1).breakSettings.micro.enabled).toBe(false);
    // The kinds that only ever show a notification stay on.
    expect(migrateState(v1).breakSettings.long.enabled).toBe(true);
    expect(migrateState(v1).breakSettings.posture.enabled).toBe(true);
  });

  it('maps the old allowSkip onto a strictness', () => {
    expect(migrateState(v1).breakSettings.strictness).toBe('normal');
    expect(migrateState({ ...v1, breakSettings: { ...v1.breakSettings, allowSkip: false } }).breakSettings.strictness).toBe('strict');
  });

  it('stamps old break logs as micro breaks with the old length', () => {
    const s = migrateState(v1);
    expect(s.breaks).toHaveLength(2);
    expect(s.breaks[0].kind).toBe('micro');
    expect(s.breaks[0].seconds).toBe(60);
    // Everything the old log carried survives.
    expect(s.breaks[1].action).toBe('skipped');
    expect(s.breaks[1].workedMinutes).toBe(20);
  });

  it('keeps every other slice untouched', () => {
    const s = migrateState(v1);
    expect(s.meals).toHaveLength(1);
    expect(s.meals[0].kcal).toBe(300);
    expect(s.profile.name).toBe('Varad');
    expect(s.settings.waterGoalMl).toBe(3000);
  });

  it('gives an older store an empty list of the days the app was opened on, and keeps a list it has', () => {
    expect(migrateState(v1).openedDates).toEqual([]);
    expect(migrateState({ ...v1, openedDates: 'today' }).openedDates).toEqual([]);
    expect(migrateState({ ...v1, openedDates: ['2026-10-26', 7] }).openedDates).toEqual(['2026-10-26']);
  });

  it('marks the result as the current version and is idempotent', () => {
    const once = migrateState(v1);
    expect(once.version).toBe(8);
    const twice = migrateState(once);
    expect(twice).toEqual(once);
  });

  it('fills defaults for a blob with no break settings at all', () => {
    const s = migrateState({ ...v1, breakSettings: undefined });
    expect(s.breakSettings.micro.everyMinutes).toBe(20);
    expect(s.breakSettings.long.everyMinutes).toBe(60);
  });

  it('gives an older store the default routine and keeps an edited one', () => {
    const s = migrateState(v1);
    expect(s.routine).toEqual(EMPTY_STATE.routine);
    expect(s.spend).toEqual([]);
    // A routine saved before a field existed keeps its edits and gains the new field.
    const edited = migrateState({ ...v1, routine: { enabled: false, budgetMin: 150 }, spend: [{ id: 's', date: '2026-09-26', at: '', category: 'fruit', rupees: 300, spreadDays: 7 }] });
    // Since version 7 the pattern is always on: a menu is a list of slots.
    expect(edited.routine.enabled).toBe(true);
    expect(edited.routine.budgetMin).toBe(150);
    expect(edited.routine.budgetMax).toBe(EMPTY_STATE.routine.budgetMax);
    expect(edited.spend).toHaveLength(1);
  });

  it('keeps an address the person typed, and the PC address on a phone', () => {
    const custom = migrateState({ ...v1, settings: { ...v1.settings, ollamaUrl: 'http://10.0.0.5:11434' } });
    expect(custom.settings.ollamaUrl).toBe('http://10.0.0.5:11434');
    // vitest runs as a phone, where localhost would be the phone itself.
    expect(migrateState(v1).settings.ollamaUrl).toBe('http://192.168.1.10:11434');
  });

  it('version 7: the pattern is always on, whatever the store said', () => {
    expect(migrateState({ ...v1, routine: { ...DEFAULT_ROUTINE, enabled: false, slots: DEFAULT_ROUTINE.slots.slice(1) } }).routine.enabled).toBe(true);
    expect(migrateState({ ...v1, version: 7, routine: { ...DEFAULT_ROUTINE, enabled: false } }).routine.enabled).toBe(true);
  });

  it('version 7 stores are never reset again, even holding the old example with the pattern off', () => {
    const kept = migrateState({ ...v1, version: 7, routine: { ...DEFAULT_ROUTINE, enabled: false } }).routine;
    expect(kept.slots).toEqual(DEFAULT_ROUTINE.slots);
    expect(kept.week).toEqual(DEFAULT_ROUTINE.week);
    expect(kept.avoid).toEqual(DEFAULT_ROUTINE.avoid);
    expect([kept.budgetMin, kept.budgetMax]).toEqual([DEFAULT_ROUTINE.budgetMin, DEFAULT_ROUTINE.budgetMax]);
  });

  it('gives routine meals saved without a time their default time', () => {
    // Version 3, the first where a pattern switched on was the person's choice rather than the old default.
    const old = { ...v1, version: 3, routine: { ...DEFAULT_ROUTINE, enabled: true, slots: DEFAULT_ROUTINE.slots.map(({ time: _t, ...s }) => s) } };
    const s = migrateState(old);
    expect(s.routine.slots.find((x) => x.id === 'bhel')?.time).toBe('18:30');
    expect(s.routine.slots.find((x) => x.id === 'lunch')?.time).toBe('13:00');
    const custom = migrateState({ ...v1, routine: { ...EMPTY_STATE.routine, slots: [{ id: 'x', type: 'dinner', label_en: 'X', label_mr: '', label_hi: '', options: [[]], withBhaji: false }] } });
    expect(custom.routine.slots[0].time).toBe('20:30');
  });

  it('returns a fresh state for junk input rather than throwing', () => {
    expect(migrateState(null).version).toBe(EMPTY_STATE.version);
    expect(migrateState('nonsense').profile.onboarded).toBe(false);
  });

  it('version 6: slots get shares, a dinner appears, and plan meals take the slot names', () => {
    const v5 = {
      version: 5,
      profile: { ...EMPTY_STATE.profile, onboarded: true },
      meals: [],
      routine: { ...DEFAULT_ROUTINE, slots: DEFAULT_ROUTINE.slots.filter((s) => s.type !== 'dinner').map((s) => ({ ...s, share: undefined })) },
      weekPlan: {
        days: Array.from({ length: 7 }, () => ({
          meals: [
            { id: 'evening', type: 'snack', time: '18:30', lines: [{ foodId: 'murmura-bhel', unit: 'katori', qty: 2 }] },
            { id: 'dinner', type: 'dinner', time: '20:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }] },
          ],
        })),
      },
    };
    const out = migrateState(v5, NOW);
    expect(out.version).toBe(8);
    expect(out.routine.slots.every((s) => typeof s.share === 'number')).toBe(true);
    expect(out.routine.slots.find((s) => s.id === 'lunch')!.share).toBe(35);
    expect(out.routine.slots.some((s) => s.type === 'dinner')).toBe(true);
    expect(out.weekPlan).toBeNull();
    const day = out.menus.find((m) => m.date === '2026-10-28')!;
    expect(day.meals.find((m) => m.id === 'bhel')!.lines[0].qty).toBe(2);
    expect(day.meals.find((m) => m.id === 'dinner')!.lines[0].foodId).toBe('chapati');
    expect(day.meals.map((m) => m.id)).toContain('fruit');
    expect(migrateState(out, NOW)).toEqual(out);
  });

  it('version 6: a default routine without shares gets the same allowances as a fresh one, not the per-type defaults', () => {
    const v5 = {
      version: 5,
      profile: { ...EMPTY_STATE.profile, onboarded: true },
      meals: [],
      routine: { ...DEFAULT_ROUTINE, enabled: true, slots: DEFAULT_ROUTINE.slots.filter((s) => s.type !== 'dinner').map((s) => ({ ...s, share: undefined })) },
    };
    const kcal = (r: typeof DEFAULT_ROUTINE) => Object.fromEntries(pattern(r).map((p) => [p.id, allowance(1600, p)]));
    const migrated = kcal(migrateState(v5).routine);
    expect(migrated).toEqual(kcal(DEFAULT_ROUTINE));
    expect(migrated).toMatchObject({ fruit: 240, 'dry-fruit': 160, lunch: 560, tea: 80, bhel: 160, dinner: 320, milk: 80 });
  });

  it('does not put back a dinner slot that a version-6 store removed on purpose', () => {
    const v6 = { version: 6, profile: { ...EMPTY_STATE.profile, onboarded: true }, meals: [], routine: { ...DEFAULT_ROUTINE, slots: DEFAULT_ROUTINE.slots.filter((s) => s.type !== 'dinner') } };
    expect(migrateState(v6).routine.slots.some((s) => s.type === 'dinner')).toBe(false);
  });

  it('drops a week plan it cannot reshape instead of failing the whole load', () => {
    const junk = { version: 5, profile: { ...EMPTY_STATE.profile }, meals: [], weekPlan: { days: Array(7).fill({}) } };
    expect(migrateState(junk).weekPlan).toBeNull();
    const noTime = { ...junk, weekPlan: { days: Array.from({ length: 7 }, () => ({ meals: [{ id: 'x', type: 'snack', lines: [] }] })) } };
    expect(() => migrateState(noTime)).not.toThrow();
  });

  it('gives the new dinner a free id when a non-dinner slot is already called dinner', () => {
    const odd = { version: 5, profile: { ...EMPTY_STATE.profile }, meals: [], routine: { ...DEFAULT_ROUTINE, slots: DEFAULT_ROUTINE.slots.filter((s) => s.type !== 'dinner').map((s) => (s.id === 'tea' ? { ...s, id: 'dinner' } : s)) } };
    const slots = migrateState(odd).routine.slots;
    expect(slots.find((s) => s.type === 'dinner')!.id).toBe('dinner-2');
    expect(slots.filter((s) => s.id === 'dinner')).toHaveLength(1);
  });

  it('version 7: the old default glass becomes a 500 ml bottle, a size the person chose stays, and the new settings get their defaults', () => {
    const s = migrateState(v1);
    expect(s.settings.bottleMl).toBe(500);
    expect((s.settings as unknown as Record<string, unknown>).glassMl).toBeUndefined();
    expect(migrateState({ ...v1, settings: { ...v1.settings, glassMl: 750 } }).settings.bottleMl).toBe(750);
    expect(s.settings.walkGoalMin).toBe(30);
    expect(s.settings.tabs).toEqual(['progress']);
    expect(s.settings.features).toEqual({ breaks: false, mantra: false, autoPlates: false });
    expect(s.settings.reminders).toEqual({ mealPrompt: true, abhyas: true, checklist: true, fillYesterday: false, planWeek: false, weeklyReport: false, away: false, water: false, sleepCheckin: false, dayReview: false });
    // "Day so far" comes at its default time on a store from before it existed.
    expect(s.settings.checklistTimes).toEqual(['21:30']);
    expect(s.settings.todayCards.filter((c) => c.on).map((c) => c.id)).toEqual(['menu', 'coach', 'waterWalk', 'abhyas']);
  });

  it('version 7: a choice made after the migration survives the next load, and a bad tab list is cleaned', () => {
    const once = migrateState(v1);
    const chosen = { ...once, settings: { ...once.settings, bottleMl: 1000, tabs: ['coach', 'sleep', 'body'], features: { ...once.settings.features, mantra: true } } };
    const again = migrateState(chosen);
    expect(again.settings.bottleMl).toBe(1000);
    expect(again.settings.tabs).toEqual(['coach', 'sleep']);
    expect(again.settings.features.mantra).toBe(true);
  });

  it('the weeks marked as looked over load as a list of dates, whatever was stored', () => {
    const once = migrateState(v1);
    const withWeeks = (reviewedWeeks: unknown) => migrateState({ ...once, settings: { ...once.settings, reviewedWeeks } }).settings.reviewedWeeks;
    expect(withWeeks(['2026-10-26', '2026-10-19'])).toEqual(['2026-10-26', '2026-10-19']);
    expect(withWeeks('2026-10-26')).toEqual([]);
    expect(withWeeks({ 0: '2026-10-26' })).toEqual([]);
    expect(withWeeks(null)).toEqual([]);
    expect(withWeeks(['2026-10-26', 7, 'next week'])).toEqual(['2026-10-26']);
    expect(once.settings.reviewedWeeks).toEqual([]);
  });

  it('the "Day so far" times load as clock times, each once and in order, at most three; with none left the default 21:30', () => {
    const once = migrateState(v1);
    const withTimes = (checklistTimes: unknown) => migrateState({ ...once, settings: { ...once.settings, checklistTimes } }).settings.checklistTimes;
    expect(withTimes(['21:00', '13:00'])).toEqual(['13:00', '21:00']);
    expect(withTimes(['21:00', 'x', '25:00', 7, '21:00', '08:15'])).toEqual(['08:15', '21:00']);
    expect(withTimes(['07:00', '13:00', '18:00', '21:00'])).toEqual(['07:00', '13:00', '18:00']);
    for (const odd of [undefined, null, '20:30', { 0: '21:00' }, [], ['soon']]) expect(withTimes(odd), JSON.stringify(odd)).toEqual(['21:30']);
    expect(once.settings.checklistTimes).toEqual(['21:30']);
    // A time the user chose, the old default included, stays.
    expect(withTimes(['20:30'])).toEqual(['20:30']);
  });

  it('version 7: the week plan becomes this week\'s menus, date by date, with Sunday at index 0', () => {
    const days = Array.from({ length: 7 }, (_, d) => ({ meals: [{ id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: d + 1 }] }] }));
    const out = migrateState({ version: 6, profile: { ...EMPTY_STATE.profile, onboarded: true }, meals: [], routine: { ...DEFAULT_ROUTINE, enabled: true }, weekPlan: { days } }, NOW);
    expect(out.menus.map((m) => m.date)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
    const lunchQty = (date: string) => out.menus.find((m) => m.date === date)!.meals.find((m) => m.id === 'lunch')!.lines[0].qty;
    expect(lunchQty('2026-10-26')).toBe(2); // Monday is index 1
    expect(lunchQty('2026-11-01')).toBe(1); // Sunday is index 0
    expect(out.menus.every((m) => m.editedAt === '')).toBe(true);
  });

  it('version 7: a date that already has a menu keeps it', () => {
    const days = Array.from({ length: 7 }, () => ({ meals: [{ id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }] }] }));
    const mine = { date: '2026-10-28', editedAt: '2026-10-27T18:00:00.000Z', meals: [{ id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 4 }] }] };
    const out = migrateState({ version: 6, profile: { ...EMPTY_STATE.profile }, meals: [], routine: { ...DEFAULT_ROUTINE, enabled: true }, weekPlan: { days }, menus: [mine] }, NOW);
    expect(out.menus.find((m) => m.date === '2026-10-28')).toEqual(mine);
    expect(out.menus).toHaveLength(7);
  });

  it('version 7: an old plan the app built and nobody changed is not stored, so every date shows the suggestion fitted to the person', () => {
    // The plan screen saved the week it built the first time it was opened.
    const mine = { ...DEFAULT_ROUTINE, enabled: true };
    const store = { version: 6, profile: { ...EMPTY_STATE.profile, onboarded: true }, meals: [], routine: mine, weekPlan: buildWeekPlan(mine, foods) };
    const out = migrateState(store, NOW);
    expect(out.menus).toEqual([]);
    expect(out.weekPlan).toBeNull();
    const fit = fitFor(out.profile, out.routine);
    for (const date of weekDates('2026-10-26')) {
      const shown = viewMenu(date, out.menus, out.routine, '2026-10-28', foods, fit);
      expect(isSuggested(shown, out.routine, foods, fit)).toBe(true);
    }
    expect(migrateState(out, NOW)).toEqual(out);
    // A pattern naming the person's own food was built with it, so it counts as built too.
    const ragi = { ...foods.find((f) => f.id === 'chapati')!, id: 'custom-ragi-roti', name_en: 'My ragi roti', tags: ['custom'] };
    const own = { ...NEUTRAL_ROUTINE, slots: NEUTRAL_ROUTINE.slots.map((s) => (s.type === 'breakfast' ? { ...s, options: [[{ foodId: ragi.id, unit: 'piece', qty: 2 }]] } : s)) };
    const built = buildWeekPlan(own, [...foods, ragi]);
    expect(built.days[3].meals[0].lines.some((l) => l.foodId === ragi.id)).toBe(true);
    const withOwn = migrateState({ ...store, routine: own, customFoods: [ragi], weekPlan: built }, NOW);
    expect(withOwn.menus).toEqual([]);
  });

  it('version 7: of an old plan the app built, only the day the person changed is stored, and a second load changes nothing', () => {
    const mine = { ...DEFAULT_ROUTINE, enabled: true };
    const plan = buildWeekPlan(mine, foods);
    // Wednesday's lunch got a third chapati.
    plan.days[3] = { meals: plan.days[3].meals.map((m) => (m.id === 'lunch' ? { ...m, lines: [...m.lines, { foodId: 'chapati', unit: 'piece', qty: 3 }] } : m)) };
    const out = migrateState({ version: 6, profile: { ...EMPTY_STATE.profile, onboarded: true }, meals: [], routine: mine, weekPlan: plan }, NOW);
    expect(out.menus.map((m) => m.date)).toEqual(['2026-10-28']);
    expect(out.menus[0].meals).toEqual(plan.days[3].meals);
    expect(out.menus[0].editedAt).toBe('');
    expect(migrateState(out, NOW)).toEqual(out);
  });

  it('version 7: a pattern that cannot be built from what is stored does not fail the load; the old plan is written as it was', () => {
    // A food of the person's own, stored without its tags or measures, named in a slot.
    const broken = { id: 'custom-broken', name_en: 'Broken', category: 'grain' };
    const mine = { ...DEFAULT_ROUTINE, enabled: true, slots: DEFAULT_ROUTINE.slots.map((s) => (s.id === 'fruit' ? { ...s, options: [[{ foodId: broken.id, unit: 'piece', qty: 1 }]] } : s)) };
    const plan = buildWeekPlan({ ...DEFAULT_ROUTINE, enabled: true }, foods);
    const store = { version: 6, profile: { ...EMPTY_STATE.profile, onboarded: true }, meals: [], routine: mine, customFoods: [broken], weekPlan: plan };
    expect(() => migrateState(store, NOW)).not.toThrow();
    expect(migrateState(store, NOW).menus).toHaveLength(7);
  });

  it('version 7: someone who never used the pattern starts from the four meals of the day; a planned or used routine keeps its slots', () => {
    const never = migrateState({ version: 6, profile: { ...EMPTY_STATE.profile }, meals: [], routine: { ...DEFAULT_ROUTINE, enabled: false } }, NOW);
    expect(never.routine.slots.map((s) => s.id)).toEqual(['breakfast', 'lunch', 'snack', 'dinner']);
    const planned = migrateState({ version: 6, profile: { ...EMPTY_STATE.profile }, meals: [], routine: { ...DEFAULT_ROUTINE, enabled: false }, weekPlan: { days: Array.from({ length: 7 }, () => ({ meals: [] })) } }, NOW);
    expect(planned.routine.slots.map((s) => s.id)).toContain('bhel');
    const used = migrateState({ version: 6, profile: { ...EMPTY_STATE.profile }, meals: [], routine: { ...DEFAULT_ROUTINE, enabled: true } }, NOW);
    expect(used.routine.slots.map((s) => s.id)).toContain('bhel');
    const none = migrateState({ version: 7, profile: { ...EMPTY_STATE.profile }, meals: [], routine: { ...DEFAULT_ROUTINE, slots: [] } }, NOW);
    expect(none.routine.slots).toEqual(DEFAULT_SLOTS);
  });

  it('version 7: a week the old Food tab saved as it built it does not count as using the pattern: someone who never used it gets the four meals and no menus, whatever their diet', () => {
    const example = { ...DEFAULT_ROUTINE, enabled: false };
    for (const diet of ['veg', 'egg', 'nonveg'] as const) {
      // What the live app saved the first time the Food tab was opened: the week built from the example, with the foods of the person's diet.
      const asBuilt = buildWeekPlan(example, foodsForDiet(allFoods([]), diet));
      const store = { version: 6, profile: { ...EMPTY_STATE.profile, onboarded: true }, settings: { ...EMPTY_STATE.settings, diet }, meals: [], routine: example, weekPlan: asBuilt };
      const out = migrateState(store, NOW);
      expect(out.routine.slots.map((s) => s.id)).toEqual(['breakfast', 'lunch', 'snack', 'dinner']);
      expect(out.routine.avoid).toEqual([]);
      expect(out.menus).toEqual([]);
      expect(out.weekPlan).toBeNull();
      expect(migrateState(out, NOW)).toEqual(out);
    }
    // A week the person changed is theirs: the example stays, and the day they changed is stored.
    const changed = buildWeekPlan(example, foodsForDiet(allFoods([]), 'veg'));
    changed.days[3] = { meals: changed.days[3].meals.map((m) => (m.id === 'lunch' ? { ...m, lines: [...m.lines, { foodId: 'chapati', unit: 'piece', qty: 3 }] } : m)) };
    const kept = migrateState({ version: 6, profile: { ...EMPTY_STATE.profile, onboarded: true }, meals: [], routine: example, weekPlan: changed }, NOW);
    expect(kept.routine.slots.map((s) => s.id)).toEqual(DEFAULT_ROUTINE.slots.map((s) => s.id));
    expect(kept.menus.map((m) => m.date)).toEqual(['2026-10-28']);
    expect(migrateState(kept, NOW)).toEqual(kept);
  });

  it('version 7: skip keys move to slot skips with their dates, and other done-keys stay', () => {
    const out = migrateState({ ...v1, actionsDone: [{ date: '2026-10-28', key: 'skip_lunch' }, { date: '2026-10-28', key: 'weigh_later' }, { date: '2026-10-27', key: 'skip_dinner' }] }, NOW);
    expect(out.slotSkips).toEqual([
      { id: '2026-10-28:lunch', date: '2026-10-28', slotId: 'lunch' },
      { id: '2026-10-27:dinner', date: '2026-10-27', slotId: 'dinner' },
    ]);
    expect(out.actionsDone).toEqual([{ date: '2026-10-28', key: 'weigh_later' }]);
  });

  it('version 7: nothing logged is touched, and a second load changes nothing', () => {
    const logs = {
      meals: [{ id: 'm1', at: '2026-10-27T07:30:00.000Z', date: '2026-10-27', type: 'lunch', items: [], kcal: 520, protein: 18 }],
      water: [{ id: 'w1', at: '2026-10-27T05:00:00.000Z', date: '2026-10-27', ml: 250 }],
      weights: [{ date: '2026-10-25', kg: 98.4 }],
      sleep: [{ date: '2026-10-27', bed: '23:00', wake: '06:30', quality: 4, wakeups: 0, energy: 4, minutes: 450, score: 80 }],
      activities: [{ id: 'a1', date: '2026-10-27', at: '2026-10-27T01:00:00.000Z', activityId: 'walk', minutes: 30, intensity: 1, kcal: 150 }],
    };
    const once = migrateState({ ...v1, ...logs }, NOW);
    expect(once.meals).toEqual(logs.meals);
    expect(once.water).toEqual(logs.water);
    expect(once.weights).toEqual(logs.weights);
    expect(once.sleep).toEqual(logs.sleep);
    expect(once.activities).toEqual(logs.activities);
    expect(migrateState(once, NOW)).toEqual(once);
  });

  it('a meal eaten in a slot replaces the one the app filled in there, on load and when another device\'s meals arrive', () => {
    // The phone logged lunch by hand; the PC filled lunch in from the plan. Both land in one list.
    const typed = { id: 'm1', at: '2026-10-27T09:30:00.000Z', date: '2026-10-27', type: 'lunch', slotId: 'lunch', items: [], kcal: 450, protein: 15, source: 'manual' };
    const filled = { id: 'auto-2026-10-27-lunch', at: '2026-10-27T07:30:00.000Z', date: '2026-10-27', type: 'lunch', slotId: 'lunch', items: [], kcal: 600, protein: 20, source: 'auto' };
    const dinner = { ...filled, id: 'auto-2026-10-27-dinner', type: 'dinner', slotId: 'dinner' };
    const tea = { ...filled, id: 'auto-2026-10-27-snack', type: 'snack', slotId: 'snack' };
    const once = migrateState({ ...v1, version: 7, meals: [filled, typed, dinner, tea], slotSkips: [{ id: '2026-10-27:snack', date: '2026-10-27', slotId: 'snack' }] }, NOW);
    expect(once.meals).toEqual([typed, dinner]);
    expect(migrateState(once, NOW)).toEqual(once);
  });

  it('a new person starts with the four meals of the day and nothing about anyone else\'s life', () => {
    const r = EMPTY_STATE.routine;
    expect(r.enabled).toBe(true);
    expect(r.walk).toBe(false);
    expect(r.week).toEqual([[], [], [], [], [], [], []]);
    expect(r.avoid).toEqual([]);
    expect(r.budgetMin).toBe(0);
    expect(r.budgetMax).toBe(0);
    expect(r.overrides).toEqual({});
    expect(r.slots).toEqual(DEFAULT_SLOTS);
    expect(r.slots.map((s) => s.id)).toEqual(['breakfast', 'lunch', 'snack', 'dinner']);
    expect(r.slots.some((s) => s.withBhaji)).toBe(false);
    expect(r).toEqual(NEUTRAL_ROUTINE);
    // A copy: no two states share the arrays a person edits.
    expect(r.week).not.toBe(NEUTRAL_ROUTINE.week);
    expect(r.week[0]).not.toBe(NEUTRAL_ROUTINE.week[0]);
    expect(r.slots).not.toBe(DEFAULT_SLOTS);
    expect(r.avoid).not.toBe(NEUTRAL_ROUTINE.avoid);
  });

  it('version 7: an old store that never used the shipped example routine gets the neutral one, not its bhaji, avoid list, budget or walk', () => {
    const old = { ...v1, version: 6, routine: { ...DEFAULT_ROUTINE, overrides: { '2026-10-20': ['palak-bhaji'] } } };
    const r = migrateState(old, NOW).routine;
    // An override is a bhaji the person picked for a date, so it is theirs and stays; everything else is neutral.
    expect(r).toEqual({ ...NEUTRAL_ROUTINE, overrides: { '2026-10-20': ['palak-bhaji'] } });
    // A store from before version 3 had the pattern on by default, not by choice, so it is the same.
    expect(migrateState({ ...v1, version: 2, routine: { ...DEFAULT_ROUTINE, enabled: true } }, NOW).routine).toEqual(NEUTRAL_ROUTINE);
  });

  it('version 7: a store from version 3 on that switched the example on keeps all of it', () => {
    const r = migrateState({ version: 3, profile: { ...EMPTY_STATE.profile }, meals: [], routine: { ...DEFAULT_ROUTINE, enabled: true } }, NOW).routine;
    expect(r).toEqual({ ...DEFAULT_ROUTINE, enabled: true, overrides: {} });
  });

  it('version 7: the never-used reset keeps every field the person changed from the example, and clears only the untouched ones', () => {
    const never = (changes: Partial<typeof DEFAULT_ROUTINE>) =>
      migrateState({ version: 6, profile: { ...EMPTY_STATE.profile }, meals: [], routine: { ...DEFAULT_ROUTINE, ...changes } }, NOW).routine;
    // Their own avoid list and budget stay; the week and the walk, never touched, become neutral.
    const avoid = [DEFAULT_ROUTINE.avoid[1]];
    const listed = never({ avoid, budgetMin: 100, budgetMax: 150 });
    expect(listed.avoid).toEqual(avoid);
    expect([listed.budgetMin, listed.budgetMax]).toEqual([100, 150]);
    expect(listed.slots).toEqual(DEFAULT_SLOTS);
    expect(listed.week).toEqual(NEUTRAL_ROUTINE.week);
    expect(listed.walk).toBe(NEUTRAL_ROUTINE.walk);
    expect(listed).toEqual({ ...NEUTRAL_ROUTINE, avoid, budgetMin: 100, budgetMax: 150 });
    // Their own bhaji week stays; the rest is neutral.
    const week = DEFAULT_ROUTINE.week.map((d, i) => (i === 3 ? ['bhindi-bhaji'] : d));
    expect(never({ week })).toEqual({ ...NEUTRAL_ROUTINE, week });
    // The budget is one pair: one end changed keeps both.
    expect(never({ budgetMax: 250 })).toEqual({ ...NEUTRAL_ROUTINE, budgetMin: DEFAULT_ROUTINE.budgetMin, budgetMax: 250 });
  });

  it('version 7: a never-used version-6 store migrates once, and a second load changes nothing', () => {
    const raw = { ...v1, version: 6, routine: { ...DEFAULT_ROUTINE, avoid: [DEFAULT_ROUTINE.avoid[0]] }, actionsDone: [{ date: '2026-10-27', key: 'skip_lunch' }] };
    const once = migrateState(raw, NOW);
    expect(once.routine.slots).toEqual(DEFAULT_SLOTS);
    expect(once.routine.avoid).toEqual([DEFAULT_ROUTINE.avoid[0]]);
    expect(migrateState(once, NOW)).toEqual(once);
    expect(migrateState(raw, NOW)).toEqual(once);
  });

  it('version 7: the same skip written twice becomes one slot skip', () => {
    const out = migrateState({ ...v1, actionsDone: [{ date: '2026-10-28', key: 'skip_lunch' }, { date: '2026-10-28', key: 'skip_lunch' }] }, NOW);
    expect(out.slotSkips).toEqual([{ id: '2026-10-28:lunch', date: '2026-10-28', slotId: 'lunch' }]);
    expect(out.actionsDone).toEqual([]);
  });

  it('version 7: someone who switched the app\'s reminders off does not get the meal-time prompt switched on by an update', () => {
    expect(migrateState({ ...v1, settings: { ...v1.settings, nudgesEnabled: false } }).settings.reminders.mealPrompt).toBe(false);
    expect(migrateState(v1).settings.reminders.mealPrompt).toBe(true);
    // Once the record exists it is the person's choice, whatever the other switch says.
    const chosen = { ...v1, version: 7, settings: { ...v1.settings, nudgesEnabled: false, reminders: { mealPrompt: true, fillYesterday: false, planWeek: false, weeklyReport: false } } };
    expect(migrateState(chosen).settings.reminders.mealPrompt).toBe(true);
    const off = migrateState({ ...v1, settings: { ...v1.settings, nudgesEnabled: false } });
    expect(migrateState(off)).toEqual(off);
  });

  it('version 7: the hourly nudges are switched off once, after the meal-time prompt has followed them as stored, and a later choice stays', () => {
    // Nudges off before: the prompt stays off.
    const off = migrateState({ ...v1, version: 6, settings: { ...v1.settings, nudgesEnabled: false } });
    expect([off.settings.nudgesEnabled, off.settings.reminders.mealPrompt]).toEqual([false, false]);
    // Nudges on before: the prompt is on, though the nudges now start off; a second load keeps both.
    const on = migrateState({ ...v1, version: 6, settings: { ...v1.settings, nudgesEnabled: true } });
    expect([on.settings.nudgesEnabled, on.settings.reminders.mealPrompt]).toEqual([false, true]);
    expect(migrateState(on)).toEqual(on);
    // Switched on again after the update, the nudges stay on.
    expect(migrateState({ ...on, settings: { ...on.settings, nudgesEnabled: true } }).settings.nudgesEnabled).toBe(true);
    // A store already on version 7 keeps its own choice.
    expect(migrateState({ ...v1, version: 7, settings: { ...v1.settings, nudgesEnabled: true } }).settings.nudgesEnabled).toBe(true);
    // The old reminders each have their own switch now, all off, whatever the nudges were.
    const { away, water, sleepCheckin, dayReview } = on.settings.reminders;
    expect([away, water, sleepCheckin, dayReview]).toEqual([false, false, false, false]);
  });

  it('version 7: the office-day check-ins are switched off once, and a store already on version 7 keeps its choice', () => {
    const office = { enabled: true, days: [1, 2, 3, 4, 5], blocks: [{ id: 'start', kind: 'start', start: '10:00' }] };
    // The live site's people, on version 6, had them on by default: they start off, the days and the times kept.
    const moved = migrateState({ ...v1, version: 6, schedule: office });
    expect(moved.schedule).toEqual({ ...office, enabled: false });
    // A second load is the same; switched on again after the update, they stay on.
    expect(migrateState(moved)).toEqual(moved);
    expect(migrateState({ ...moved, schedule: { ...moved.schedule, enabled: true } }).schedule.enabled).toBe(true);
    // A store already on version 7 keeps its own choice either way.
    expect(migrateState({ ...v1, version: 7, schedule: office }).schedule.enabled).toBe(true);
    expect(migrateState({ ...v1, version: 7, schedule: { ...office, enabled: false } }).schedule.enabled).toBe(false);
    // A store with no office day at all gets the default, off.
    expect(migrateState({ ...v1, version: 6 }).schedule.enabled).toBe(false);
  });

  it('a nudges switch stored as anything but true or false never turns the meal-time prompt or the nudges on', () => {
    for (const bad of [null, 'yes', 1, 'true', {}]) {
      const s = migrateState({ ...v1, version: 6, settings: { ...v1.settings, nudgesEnabled: bad } }).settings;
      expect([s.nudgesEnabled, s.reminders.mealPrompt], String(bad)).toEqual([false, false]);
      expect(migrateState({ ...v1, version: 7, settings: { ...v1.settings, nudgesEnabled: bad } }).settings.nudgesEnabled, String(bad)).toBe(false);
    }
    // One never stored at all is the default: the prompt on, the nudges off.
    const fresh = migrateState({ ...v1, version: 6, settings: { ...v1.settings, nudgesEnabled: undefined } }).settings;
    expect([fresh.nudgesEnabled, fresh.reminders.mealPrompt]).toEqual([false, true]);
  });

  it('version 7: a routine someone switched on, planned or edited keeps its bhaji week, avoid list, budget and walk exactly', () => {
    const mine = { ...DEFAULT_ROUTINE, budgetMin: 120, budgetMax: 150, overrides: { '2026-10-28': ['bhindi-bhaji'] } };
    const keeps = (r: typeof DEFAULT_ROUTINE) => {
      expect(r.week).toEqual(DEFAULT_ROUTINE.week);
      expect(r.avoid).toEqual(DEFAULT_ROUTINE.avoid);
      expect(r.budgetMin).toBe(120);
      expect(r.budgetMax).toBe(150);
      expect(r.walk).toBe(true);
      expect(r.overrides).toEqual({ '2026-10-28': ['bhindi-bhaji'] });
      expect(r.slots.map((s) => s.id)).toEqual(DEFAULT_ROUTINE.slots.map((s) => s.id));
    };
    keeps(migrateState({ version: 6, profile: { ...EMPTY_STATE.profile }, meals: [], routine: { ...mine, enabled: true } }, NOW).routine);
    keeps(migrateState({ version: 6, profile: { ...EMPTY_STATE.profile }, meals: [], routine: mine, weekPlan: { days: Array.from({ length: 7 }, () => ({ meals: [] })) } }, NOW).routine);
    const edited = migrateState({ version: 6, profile: { ...EMPTY_STATE.profile }, meals: [], routine: { ...mine, slots: DEFAULT_ROUTINE.slots.map((s) => (s.id === 'tea' ? { ...s, time: '16:15' } : s)) } }, NOW).routine;
    keeps(edited);
    expect(edited.slots.find((s) => s.id === 'tea')!.time).toBe('16:15');
    // A version-7 store that emptied its slots gets the four meals back and keeps the rest.
    const emptied = migrateState({ version: 7, profile: { ...EMPTY_STATE.profile }, meals: [], routine: { ...mine, slots: [] } }, NOW).routine;
    expect(emptied.slots).toEqual(DEFAULT_SLOTS);
    expect(emptied.avoid).toEqual(DEFAULT_ROUTINE.avoid);
    expect(emptied.budgetMax).toBe(150);
  });
});

/**
 * One sync round on this device against an account holding `file`, landed the way the store lands it (the merge, then the
 * migration), with the very upgrade the app hands every round. Returns the device after it and every file written.
 */
async function syncWith(file: unknown, o: { local?: AppState; base?: CloudState | null; modifiedTime?: string | null; upgrade?: (f: CloudState) => CloudState } = {}) {
  let now: AppState = o.local ?? { ...EMPTY_STATE };
  let account = { state: JSON.stringify(file), modifiedTime: 't1' };
  const written: CloudState[] = [];
  const round = (base: CloudState | null, modifiedTime: string | null) =>
    syncRound({
      pull: true,
      base,
      modifiedTime,
      supported: STATE_VERSION,
      upgrade: o.upgrade ?? upgradeFile(NOW),
      io: {
        readNow: async () => now,
        land: (local, merged) => {
          now = migrateState(landMerge(now, local, merged), NOW);
        },
        get: async () => account,
        put: async (s, at) => {
          if (at !== account.modifiedTime) return { ok: false, stale: account };
          written.push(s);
          account = { state: JSON.stringify(s), modifiedTime: `t${written.length + 1}` };
          return { ok: true, modifiedTime: account.modifiedTime };
        },
        live: () => true,
      },
    });
  const out = await round(o.base ?? null, o.modifiedTime ?? null);
  return { now: () => now, written, out, round };
}

// What a version-6 build writes to the account: no device settings, no caches, a glass and no bottle.
const accountFile = (glassMl: number) => ({
  version: 6,
  profile: { ...v1.profile },
  settings: { nudgeMinutes: 60, nudgesEnabled: true, quietStartHour: 22, quietEndHour: 7, waterGoalMl: 3000, glassMl },
  meals: v1.meals,
});

describe('an account file from before version 7 arriving on a device that was never used', () => {
  const signInWith = async (file: unknown) => (await syncWith(file)).now();

  it('the glass size the account holds becomes the bottle, not the bottle this device started with', async () => {
    const chosen = await signInWith(accountFile(300));
    expect(chosen.profile.name).toBe('Varad');
    expect(chosen.settings.bottleMl).toBe(300);
    expect((chosen.settings as unknown as Record<string, unknown>).glassMl).toBeUndefined();
    expect((await signInWith(accountFile(250))).settings.bottleMl).toBe(500);
  });

  it('a bottle size someone picked is never replaced by a glass beside it', () => {
    expect(migrateState({ ...v1, settings: { ...v1.settings, glassMl: 300, bottleMl: 750 } }).settings.bottleMl).toBe(750);
  });

  it('is migrated as version 6: the untouched example with the pattern off becomes the four meals, reminders off keep the meal-time prompt off, and it goes back as this version once', async () => {
    const file = { ...accountFile(250), settings: { ...accountFile(250).settings, nudgesEnabled: false }, routine: { ...DEFAULT_ROUTINE, enabled: false } };
    const s = await syncWith(file);
    const landed = s.now();
    expect(landed.routine.slots).toEqual(DEFAULT_SLOTS);
    expect(landed.routine.slots.map((x) => x.id)).toEqual(['breakfast', 'lunch', 'snack', 'dinner']);
    expect(landed.routine.avoid).toEqual([]);
    expect(landed.settings.reminders.mealPrompt).toBe(false);
    expect(s.written).toHaveLength(1);
    expect(s.written[0].version).toBe(STATE_VERSION);
    expect(s.written[0].routine.slots).toEqual(DEFAULT_SLOTS);
    expect(s.written[0].settings.reminders.mealPrompt).toBe(false);
    // The migration fills in this device's caches and machine settings; none of them reach the account.
    expect(s.written[0].settings).not.toHaveProperty('ollamaUrl');
    for (const key of ['chat', 'usage', 'photoQueue', 'tips', 'openedDates']) expect(s.written[0]).not.toHaveProperty(key);
    // The next round finds the account as it left it: nothing is written again.
    expect(await s.round(s.out!.base, s.out!.modifiedTime)).toBeNull();
    expect(s.written).toHaveLength(1);
  });

  it('a file newer than this build still stops the round, upgrade or not', async () => {
    await expect(syncWith({ ...accountFile(250), version: STATE_VERSION + 1 })).rejects.toEqual(new RoundStop('update_app'));
  });
});

describe('an account file from before version 7 merged on a device already on version 7', () => {
  // The file a version-6 build last wrote: the shipped example, never switched on.
  const base6 = { ...accountFile(250), routine: { ...DEFAULT_ROUTINE, enabled: false } };
  // This device loaded the same file under this build, so its own store moved to version 7 on load, and it logged a meal since.
  const dinner = { id: 'm2', at: '2026-10-27T15:00:00.000Z', date: '2026-10-27', type: 'dinner', items: [], kcal: 600, protein: 25 };
  const local = (): AppState => {
    const s = migrateState({ ...base6, settings: { ...base6.settings, ollamaUrl: 'http://pc:11434' } }, NOW);
    return { ...s, meals: [...s.meals, dinner as AppState['meals'][number]] };
  };

  it('a pattern another version-6 device switched on after the base survives this device\'s own migration', async () => {
    const remote = { ...base6, routine: { ...DEFAULT_ROUTINE, enabled: true } };
    const s = await syncWith(remote, { local: local(), base: base6 as unknown as CloudState, modifiedTime: 't0' });
    const ids = DEFAULT_ROUTINE.slots.map((x) => x.id);
    expect(s.now().routine.slots.map((x) => x.id)).toEqual(ids);
    expect(s.now().routine.avoid).toEqual(DEFAULT_ROUTINE.avoid);
    expect(s.now().meals.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(s.written).toHaveLength(1);
    expect(s.written[0].version).toBe(STATE_VERSION);
    expect(s.written[0].routine.slots.map((x) => x.id)).toEqual(ids);
  });

  it('an avoid list another version-6 device edited after the base survives this device\'s own migration', async () => {
    const avoid = [DEFAULT_ROUTINE.avoid[1]];
    const remote = { ...base6, routine: { ...DEFAULT_ROUTINE, enabled: false, avoid } };
    const s = await syncWith(remote, { local: local(), base: base6 as unknown as CloudState, modifiedTime: 't0' });
    expect(s.now().routine.avoid).toEqual(avoid);
    expect(s.now().routine.slots).toEqual(DEFAULT_SLOTS);
    expect(s.now().meals.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(s.written[0].routine.avoid).toEqual(avoid);
    expect(s.written[0].version).toBe(STATE_VERSION);
  });
});

describe('this week\'s menus on devices whose stores moved to version 7 in different weeks', () => {
  // The relay was down for weeks, so every device brought its own store up in whatever week it was opened, and each has
  // that week's menus from the template; the round brings the base up at NOW, which gives this week's.
  const twoWeeksAgo = new Date('2026-10-14T10:00:00');
  const lastWeek = new Date('2026-10-21T10:00:00');
  const THU = '2026-10-29';
  const lunch = (qty: number) => [{ id: 'lunch', type: 'lunch' as const, time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty }] }];
  // The file a version-6 build last wrote: the pattern in use and a planned week, a different lunch each day.
  const base6 = { ...accountFile(250), routine: { ...DEFAULT_ROUTINE, enabled: true }, weekPlan: { days: Array.from({ length: 7 }, (_, d) => ({ meals: lunch(d + 1) })) } };
  const qtyOn = (menus: AppState['menus'], date: string) => menuFor(date, menus)?.meals.find((m) => m.id === 'lunch')?.lines[0]?.qty;

  /** The account file every device below shares; a write built on a version that is not the newest is refused. */
  function sharedAccount() {
    let current = { state: JSON.stringify(base6), modifiedTime: 't0' };
    let writes = 0;
    return {
      file: () => JSON.parse(current.state) as CloudState,
      get: async () => current,
      put: async (s: CloudState, at: string | null) => {
        if (at !== current.modifiedTime) return { ok: false as const, stale: current };
        current = { state: JSON.stringify(s), modifiedTime: `t${++writes}` };
        return { ok: true as const, modifiedTime: current.modifiedTime };
      },
    };
  }

  /** A device whose store moved to version 7 at `movedAt` and that last saw the account as the version-6 file. */
  function deviceOn(account: ReturnType<typeof sharedAccount>, movedAt: Date) {
    let now = migrateState(base6, movedAt);
    let seen: { base: CloudState; modifiedTime: string | null } = { base: base6 as unknown as CloudState, modifiedTime: 't0' };
    return {
      now: () => now,
      edit: (fn: (s: AppState) => AppState) => {
        now = fn(now);
      },
      round: async (pull: boolean) => {
        const out = await syncRound({
          pull,
          base: seen.base,
          modifiedTime: seen.modifiedTime,
          supported: STATE_VERSION,
          upgrade: upgradeFile(NOW),
          io: {
            readNow: async () => now,
            land: (local, merged) => {
              now = migrateState(landMerge(now, local, merged), NOW);
            },
            get: account.get,
            put: account.put,
            live: () => true,
          },
        });
        if (out) seen = out;
      },
    };
  }

  it('an edit to this Thursday made on a device that moved two weeks ago reaches the account and a device that moved last week', async () => {
    const account = sharedAccount();
    const first = deviceOn(account, twoWeeksAgo);
    await first.round(true);
    // The first device now shows this week as planned, Thursday being the template's Thursday.
    expect(qtyOn(first.now().menus, THU)).toBe(5);
    const nine = { foodId: 'chapati', unit: 'piece', qty: 9 };
    first.edit((s) => ({ ...s, menus: setMenuLine(s.menus, menuFor(THU, s.menus)!, 'lunch', 0, nine, new Date('2026-10-28T09:00:00')) }));
    expect(qtyOn(first.now().menus, THU)).toBe(9);
    await first.round(false);
    const second = deviceOn(account, lastWeek);
    const had = [...first.now().menus, ...second.now().menus].map((m) => m.date);
    await second.round(true);
    expect(qtyOn(account.file().menus, THU)).toBe(9);
    expect(qtyOn(second.now().menus, THU)).toBe(9);
    // Nothing either device had is gone: their own weeks stay, in the account and on the second device.
    for (const date of had) {
      expect(menuFor(date, account.file().menus)).not.toBeNull();
      expect(menuFor(date, second.now().menus)).not.toBeNull();
    }
  });

  it('a device that moved this week keeps this week\'s menus after one that moved two weeks ago wrote the file', async () => {
    const account = sharedAccount();
    await deviceOn(account, twoWeeksAgo).round(true);
    const current = deviceOn(account, NOW);
    const week = current.now().menus;
    expect(week).toHaveLength(7);
    await current.round(true);
    for (const m of week) {
      expect(menuFor(m.date, current.now().menus)).toEqual(m);
      expect(menuFor(m.date, account.file().menus)).toEqual(m);
    }
  });
});

describe('settings in an odd shape, from sync or an old file', () => {
  // A version-6 store whose settings carry every shape the migration has to clean.
  const v6 = (settings: Record<string, unknown>) => ({ ...v1, version: 6, settings: { ...v1.settings, glassMl: undefined, ...settings } });
  const settingsOf = (settings: Record<string, unknown>) => migrateState(v6(settings), NOW).settings;
  const FEATURES = { breaks: false, mantra: false, autoPlates: false };
  const REMINDERS = { mealPrompt: true, abhyas: true, checklist: true, fillYesterday: false, planWeek: false, weeklyReport: false, away: false, water: false, sleepCheckin: false, dayReview: false };

  it('the Today cards: every known card once, in the order stored, the unknown and second copies dropped, the missing ones added off but Abhyas, new in version 8', () => {
    const cards = settingsOf({ todayCards: [{ id: 'steps', on: true }, { id: 'nope', on: true }, { id: 'menu', on: 'yes' }, { id: 'steps', on: false }] }).todayCards;
    expect(cards.map((c) => c.id)).toEqual(['steps', 'menu', 'coach', 'waterWalk', 'abhyas', 'weight', 'sleep', 'climb', 'mantra']);
    expect(cards.filter((c) => c.on).map((c) => c.id)).toEqual(['steps', 'abhyas']);
    expect(settingsOf({ todayCards: { menu: true } }).todayCards).toEqual(DEFAULT_TODAY_CARDS);
  });

  it('the feature and reminder switches: each known one true or false, one stored as anything else off, a missing one its default, unknown keys dropped', () => {
    const s = settingsOf({ features: { mantra: true, breaks: 'yes', autoPlates: 1, dark: true }, reminders: { planWeek: true, weeklyReport: [], fillYesterday: 'true', extra: false } });
    expect(s.features).toEqual({ breaks: false, mantra: true, autoPlates: false });
    // The meal-time prompt is missing and the app's reminders are on (v1's), so it takes its default, on.
    expect(s.reminders).toEqual({ ...REMINDERS, planWeek: true });
  });

  it('a corrupt switch never turns a reminder on: the meal-time prompt stored as anything but true or false reads off, whatever the app\'s reminders switch says', () => {
    expect(settingsOf({ reminders: { mealPrompt: null }, nudgesEnabled: false }).reminders.mealPrompt).toBe(false);
    expect(settingsOf({ reminders: { mealPrompt: 'yes', planWeek: true }, nudgesEnabled: false }).reminders).toEqual({ ...REMINDERS, mealPrompt: false, planWeek: true });
    for (const bad of [null, 'yes', 1, 'true', {}]) expect(settingsOf({ reminders: { mealPrompt: bad } }).reminders.mealPrompt, String(bad)).toBe(false);
    // Only a missing one follows the app's reminders switch: on with them on, off with them off.
    expect(settingsOf({ reminders: { planWeek: true } }).reminders.mealPrompt).toBe(true);
    expect(settingsOf({ reminders: { planWeek: true }, nudgesEnabled: false }).reminders.mealPrompt).toBe(false);
    // One the person chose stays, whatever the other switch says.
    expect(settingsOf({ reminders: { mealPrompt: true }, nudgesEnabled: false }).reminders.mealPrompt).toBe(true);
    expect(settingsOf({ reminders: { mealPrompt: false } }).reminders.mealPrompt).toBe(false);
  });

  it('an app reminders switch stored as anything but true or false never turns on a meal-time prompt nobody set', () => {
    for (const bad of [null, 'yes', 1, 'true', {}]) {
      expect(settingsOf({ reminders: { planWeek: true }, nudgesEnabled: bad }).reminders.mealPrompt, String(bad)).toBe(false);
      expect(settingsOf({ nudgesEnabled: bad }).reminders.mealPrompt, String(bad)).toBe(false);
    }
  });

  it('a list where the switches should be is not a record of switches: that group takes its defaults', () => {
    const s = settingsOf({ features: [true, true, true], reminders: ['mealPrompt'] });
    expect(s.features).toEqual(FEATURES);
    expect(s.reminders).toEqual(REMINDERS);
    // With no record of reminders, reminders switched off before the switches existed still keep the meal-time prompt off.
    expect(settingsOf({ reminders: [], nudgesEnabled: false }).reminders.mealPrompt).toBe(false);
  });

  it('a bottle or walk goal that is not a number, is not a number at all, or is 0 or less takes the default', () => {
    for (const bad of ['500', null, Number.NaN, 0, -250, [], {}]) {
      const s = settingsOf({ bottleMl: bad, walkGoalMin: bad });
      expect(s.bottleMl).toBe(500);
      expect(s.walkGoalMin).toBe(30);
    }
  });

  it('a bottle size already a number is kept as it is, with or without a glass beside it', () => {
    expect(settingsOf({ bottleMl: 750 }).bottleMl).toBe(750);
    expect(settingsOf({ bottleMl: 750, glassMl: 300 }).bottleMl).toBe(750);
    expect(settingsOf({ bottleMl: 1000, walkGoalMin: 45 }).walkGoalMin).toBe(45);
    // A bottle that is no size at all does not hide the glass beside it.
    expect(settingsOf({ bottleMl: Number.NaN, glassMl: 300 }).bottleMl).toBe(300);
  });

  it('a second load changes nothing, whatever shape the settings came in', () => {
    const odd = [
      { todayCards: [{ id: 'steps', on: 1 }, { id: 'nope' }, 'menu'], features: [true], reminders: { mealPrompt: 'no', extra: true }, bottleMl: Number.NaN, walkGoalMin: -5 },
      { todayCards: 'menu', features: { mantra: true, x: 1 }, reminders: [], nudgesEnabled: false, bottleMl: '500', walkGoalMin: 0, glassMl: 300 },
      { todayCards: null, features: null, reminders: null, bottleMl: 0, walkGoalMin: null, tabs: 'coach' },
    ];
    for (const settings of odd) {
      const once = migrateState(v6(settings), NOW);
      expect(migrateState(once, NOW)).toEqual(once);
    }
  });
});

describe('the day a store moved to this version', () => {
  // A version-6 store in use: the pattern switched on, breakfast logged yesterday and the app used yesterday.
  const UPGRADE = new Date('2026-10-27T09:00:00');
  const v6 = {
    ...v1,
    version: 6,
    routine: { ...DEFAULT_ROUTINE, enabled: true },
    meals: [{ id: 'b1', at: new Date('2026-10-26T08:40:00').toISOString(), date: '2026-10-26', type: 'breakfast', items: [], kcal: 350, protein: 12 }],
    usage: [{ date: '2026-10-26', hour: 20, activeMinutes: 15 }],
  };
  /** The app's own run at `now`, as the store runs it. */
  const run = (state: AppState, now: Date) => {
    const fit = fitFor(state.profile, state.routine, now);
    return withAutoFill(state, now, allFoods(state.customFoods), fit.target, fit);
  };

  it('fills in nothing that day or the day before, though both were lived; the next day it fills in only that day', () => {
    const s = migrateState(v6, UPGRADE);
    expect(s.profile.autoFillFrom).toBe('2026-10-27');
    const evening = run(s, new Date('2026-10-27T22:00:00'));
    expect(evening.meals).toEqual(s.meals);
    const next = run(evening, new Date('2026-10-28T22:00:00'));
    const added = next.meals.filter((m) => !s.meals.some((x) => x.id === m.id));
    expect(added.length).toBeGreaterThan(0);
    expect(new Set(added.map((m) => m.date))).toEqual(new Set(['2026-10-28']));
    // A second load, on any day, changes nothing.
    expect(migrateState(s, new Date('2026-11-05T09:00:00'))).toEqual(s);
  });

  it('stamps only someone who finished setup, keeps a stamp already there, and never stamps a store already on this version', () => {
    expect(migrateState({ ...v6, profile: { ...v6.profile, onboarded: false } }, UPGRADE).profile.autoFillFrom).toBeUndefined();
    expect(migrateState({ ...v6, profile: { ...v6.profile, autoFillFrom: '2026-10-20' } }, UPGRADE).profile.autoFillFrom).toBe('2026-10-20');
    expect(migrateState({ ...v6, version: 7 }, UPGRADE).profile.autoFillFrom).toBeUndefined();
  });

  it('a sync round brings an older account file and its base up with the same stamp, so the stamp never reads as a change on either side', () => {
    const at = new Date('2026-10-29T10:00:00');
    const file = upgradeFile(at)(v6 as unknown as CloudState);
    const base = upgradeFile(at)({ ...v6, meals: [] } as unknown as CloudState);
    expect(file.profile.autoFillFrom).toBe('2026-10-29');
    expect(base.profile.autoFillFrom).toBe('2026-10-29');
    expect(stable(file.profile)).toBe(stable(base.profile));
  });

  it('a device that moved on an earlier day brings them up with its own stamp, so a profile change another device made since is kept', async () => {
    // The account file and the base this device last saw: what a version-6 build wrote.
    const base6 = { ...accountFile(250), routine: { ...DEFAULT_ROUTINE, enabled: true } };
    const local = migrateState(base6, UPGRADE);
    expect(local.profile.autoFillFrom).toBe('2026-10-27');
    // Another version-6 device changed the goal after the base; the round runs on 28 October.
    const remote = { ...base6, profile: { ...base6.profile, goalWeightKg: 75 } };
    const s = await syncWith(remote, { local, base: base6 as unknown as CloudState, modifiedTime: 't0', upgrade: upgradeFile(NOW, local.profile.autoFillFrom) });
    expect(s.now().profile.goalWeightKg).toBe(75);
    expect(s.now().profile.autoFillFrom).toBe('2026-10-27');
    expect(s.written[0].profile.goalWeightKg).toBe(75);
    // Stamped on the round's day instead, the file's stamp is a day later than this device's, and the later day wins: every day
    // up to the round's is then never filled in. The goal changed there is kept either way, as the profile merges field by field.
    const stale = await syncWith(remote, { local, base: base6 as unknown as CloudState, modifiedTime: 't0' });
    expect(stale.now().profile.autoFillFrom).toBe('2026-10-28');
    expect(stale.now().profile.goalWeightKg).toBe(75);
  });

  it('an account file reaching a device that was never used carries the stamp of the round', async () => {
    const s = await syncWith({ ...accountFile(250), routine: { ...DEFAULT_ROUTINE, enabled: true } });
    expect(s.now().profile.autoFillFrom).toBe('2026-10-28');
    expect(s.written[0].profile.autoFillFrom).toBe('2026-10-28');
    expect(forCloud(s.now()).profile).toEqual(s.written[0].profile);
  });
});

describe('records in an odd shape, from sync or an old file', () => {
  const line = { foodId: 'chapati', unit: 'piece', qty: 2 };
  const goodMenu = { date: '2026-10-28', editedAt: '', meals: [{ id: 'lunch', type: 'lunch', time: '13:00', lines: [line] }] };
  const skip = { id: '2026-10-27:lunch', date: '2026-10-27', slotId: 'lunch' };
  const saved = { id: 's1', name: 'My thali', lines: [line] };

  it('keeps only well-formed menus, skips and saved meals; a malformed one is dropped and the load goes on', () => {
    const menus = [
      goodMenu,
      null,
      'monday',
      { date: 5, meals: [] },
      { date: '2026-10-29' },
      { date: '2026-10-30', meals: 'none' },
      { date: '2026-10-31', meals: [null] },
      { date: '2026-11-01', meals: [{ type: 'lunch', lines: [] }] },
      { date: '2026-11-02', meals: [{ id: 'lunch' }] },
      { date: '2026-11-03', meals: [{ id: 'lunch', lines: [null] }] },
      // A meal with no type or no time cannot be placed in the day.
      { date: '2026-11-04', meals: [{ id: 'lunch', lines: [] }] },
      { date: '2026-11-05', meals: [{ id: 'lunch', type: 'lunch', lines: [] }] },
      { date: '2026-11-06', meals: [{ id: 'lunch', time: '13:00', lines: [] }] },
      { date: '2026-11-07', meals: [{ id: 'lunch', type: 3, time: null, lines: [] }] },
    ];
    const slotSkips = [skip, null, { id: 1, date: '2026-10-27', slotId: 'x' }, { id: 'a', date: '2026-10-27' }, { id: 'b', date: null, slotId: 'lunch' }];
    const savedMeals = [saved, null, { id: 's2', lines: [] }, { id: 's3', name: 'x' }, { id: 's4', name: 'y', lines: [7] }, { name: 'z', lines: [] }];
    const s = migrateState({ ...v1, version: 7, menus, slotSkips, savedMeals }, NOW);
    expect(s.menus).toEqual([goodMenu]);
    expect(s.slotSkips).toEqual([skip]);
    expect(s.savedMeals).toEqual([saved]);
    // What is left shows, and a second load changes nothing.
    expect(viewMenu('2026-10-28', s.menus, s.routine, '2026-10-28', foods).meals.find((m) => m.id === 'lunch')?.lines).toEqual([line]);
    expect(migrateState(s, NOW)).toEqual(s);
  });

  it('drops a menu meal the day cannot place: one with a type the app does not know and a time that is not a clock time', () => {
    const lost = { date: '2026-11-08', editedAt: '', meals: [{ id: 'x', type: 'brunch', time: '25:99', lines: [] }] };
    // A known meal type gives a time for a bad one, and a clock time places a type the app does not know.
    const knownType = { date: '2026-11-09', editedAt: '', meals: [{ id: 'lunch', type: 'lunch', time: '25:99', lines: [line] }] };
    const clockTime = { date: '2026-11-10', editedAt: '', meals: [{ id: 'x', type: 'brunch', time: '11:00', lines: [line] }] };
    const s = migrateState({ ...v1, version: 7, menus: [goodMenu, lost, knownType, clockTime] }, NOW);
    expect(s.menus).toEqual([goodMenu, knownType, clockTime]);
    expect(migrateState({ ...v1, version: 7, menus: [{ ...lost, meals: [{ id: 'x', type: 'toString', time: '', lines: [] }] }] }, NOW).menus).toEqual([]);
  });

  it('drops only the meal it cannot read: the rest of that date\'s menu stays, so a lived day never vanishes for one bad meal', () => {
    const lunch = { id: 'lunch', type: 'lunch', time: '13:00', lines: [line] };
    const dinner = { id: 'dinner', type: 'dinner', time: '20:00', lines: [line] };
    const mixed = { date: '2026-10-26', editedAt: '2026-10-26T09:00:00.000Z', frozen: true, meals: [lunch, { id: 'x', type: 'brunch', time: '25:99', lines: [] }, null, { id: 'y', lines: [7] }, dinner] };
    const s = migrateState({ ...v1, version: 7, menus: [goodMenu, mixed] }, NOW);
    expect(s.menus).toEqual([goodMenu, { ...mixed, meals: [lunch, dinner] }]);
    // A day planned with nothing stays a day planned with nothing, and a second load changes nothing.
    const empty = { date: '2026-10-27', editedAt: '', meals: [] };
    expect(migrateState({ ...v1, version: 7, menus: [empty] }, NOW).menus).toEqual([empty]);
    expect(migrateState(s, NOW)).toEqual(s);
  });

  it('keeps every field of a well-formed record as it was, and a list that is not a list at all is an empty one', () => {
    const kept = { ...goodMenu, frozen: true };
    expect(migrateState({ ...v1, version: 7, menus: [kept] }, NOW).menus).toEqual([kept]);
    const s = migrateState({ ...v1, version: 7, menus: { a: goodMenu }, slotSkips: 'skip', savedMeals: 3 }, NOW);
    expect([s.menus, s.slotSkips, s.savedMeals]).toEqual([[], [], []]);
  });

  it('never throws on a meal, a slot, a weight or a food of the person\'s own that is not a record: it is dropped and the rest loads', () => {
    const meal = { id: 'm1', at: '2026-10-27T07:30:00.000Z', date: '2026-10-27', type: 'lunch', items: [], kcal: 520, protein: 18, source: 'auto', slotId: 'lunch' };
    const slots = [null, 7, {}, ...DEFAULT_ROUTINE.slots];
    const raw = {
      ...v1,
      version: 6,
      meals: [null, meal, 7, 'x'],
      routine: { ...DEFAULT_ROUTINE, enabled: true, slots },
      menus: [{ ...goodMenu, meals: [null, ...goodMenu.meals] }],
      weights: [null, { date: '2026-10-01', kg: 99 }],
      customFoods: [null],
      // A week whose meals carry no lines.
      weekPlan: { days: Array.from({ length: 7 }, () => ({ meals: [{ id: 'lunch', type: 'lunch', time: '13:00' }] })) },
    };
    let s = EMPTY_STATE;
    expect(() => (s = migrateState(raw, NOW))).not.toThrow();
    expect(s.profile.onboarded).toBe(true);
    expect(s.meals).toEqual([meal]);
    expect(s.routine.slots).toEqual(DEFAULT_ROUTINE.slots);
    expect(s.menus.find((m) => m.date === goodMenu.date)).toEqual(goodMenu);
    expect(s.profile.startWeightKg).toBe(99);
    expect(s.customFoods).toEqual([]);
    expect(migrateState(s, NOW)).toEqual(s);
    // A load that drops nothing keeps the very lists it was given, so nothing that reads them is worked out again.
    expect(migrateState(s, NOW).meals).toBe(s.meals);
    expect(migrateState(s, NOW).customFoods).toBe(s.customFoods);
    // A version-7 store too, and a list of slots with nothing a slot can be in it.
    expect(() => migrateState({ ...v1, version: 7, meals: [null], routine: { ...DEFAULT_ROUTINE, slots: [null] } }, NOW)).not.toThrow();
    expect(migrateState({ ...v1, version: 7, meals: [null], routine: { ...DEFAULT_ROUTINE, slots: [null] } }, NOW).routine.slots).toEqual(DEFAULT_SLOTS);
  });

  it('turns a skip key from an older build into a skip as before, beside the well-formed skips kept', () => {
    const s = migrateState({ ...v1, version: 6, slotSkips: [skip, { id: 'x' }], actionsDone: [{ date: '2026-10-28', key: 'skip_dinner' }] }, NOW);
    expect(s.slotSkips.map((x) => x.id)).toEqual(['2026-10-27:lunch', '2026-10-28:dinner']);
  });
});

describe('the lived days the app kept', () => {
  const line = { foodId: 'chapati', unit: 'piece', qty: 2 };
  const kept = (date: string, extra: object = {}) => ({ date, editedAt: '', frozen: true as const, meals: [{ id: 'lunch', type: 'lunch', time: '13:00', lines: [line] }], ...extra });

  it('drops one more than 120 days old, on every load and every landing, and keeps a newer one, an edited one and one the app wrote but did not keep', () => {
    // 28 October 2026 less 120 days is 30 June.
    const old = kept('2026-06-29');
    const edge = kept('2026-06-30');
    const edited = kept('2026-03-01', { editedAt: '2026-03-01T09:00:00.000Z' });
    const unfrozen = { ...kept('2026-03-02'), frozen: undefined };
    delete unfrozen.frozen;
    const s = migrateState({ ...v1, version: 7, menus: [old, edge, edited, unfrozen] }, NOW);
    expect(s.menus).toEqual([edge, edited, unfrozen]);
    expect(migrateState(s, NOW)).toEqual(s);
    // A day later the edge goes too, the same way on every device.
    expect(migrateState(s, new Date('2026-10-29T10:00:00')).menus).toEqual([edited, unfrozen]);
  });
});

describe("version 8: the user's own list (Abhyas)", () => {
  const v7 = { ...v1, version: 7, settings: { ...v1.settings, glassMl: undefined, reminders: { mealPrompt: true, fillYesterday: true } } };
  const item = { id: 'a', name: 'Yoga', icon: 'leaf-outline', kind: 'repeat', days: [1, 3, 5], times: ['07:00'], order: 0, createdAt: '2026-10-20T03:00:00.000Z' };
  const once = { ...item, id: 'o', name: 'Fix the bike', kind: 'once', days: [], date: '2026-10-29', targetMin: 30, times: [], order: 1, archivedAt: '2026-10-28T03:00:00.000Z' };
  const session = { id: 'a@2026-10-26T03:00:00.000Z', itemId: 'a', date: '2026-10-26', startedAt: '2026-10-26T03:00:00.000Z', endedAt: '2026-10-26T03:20:00.000Z', minutes: 20 };
  const tick = { id: 'a@2026-10-26', itemId: 'a', date: '2026-10-26', at: '2026-10-26T04:00:00.000Z' };
  const running = { itemId: 'a', startedAt: '2026-10-28T04:00:00.000Z' };
  const cards = (s: AppState) => s.settings.todayCards.map((c) => `${c.id}${c.on ? '' : ' off'}`);

  it('gives an older store an empty list and no timer, and touches nothing logged', () => {
    const s = migrateState(v7, NOW);
    expect([s.abhyasItems, s.abhyasSessions, s.abhyasTicks, s.abhyasRunning]).toEqual([[], [], [], null]);
    expect(s.version).toBe(8);
    // Everything but the settings reads as it would with no step to version 8 at all.
    expect({ ...s, settings: null }).toEqual({ ...migrateState({ ...v7, version: 8 }, NOW), settings: null });
    expect(s.meals.map((m) => m.kcal)).toEqual([300]);
    expect(s.breaks.map((b) => b.id)).toEqual(['b1', 'b2']);
  });

  it('switches the Abhyas reminders and "Day so far" on for an older store with a reminder on, and keeps every other switch it had', () => {
    const s = migrateState(v7, NOW);
    expect(s.settings.reminders).toMatchObject({ mealPrompt: true, fillYesterday: true, abhyas: true, checklist: true });
    // Any one switch on is enough, the meal-time prompt or another.
    const on = (reminders: Record<string, unknown>) => migrateState({ ...v7, settings: { ...v7.settings, reminders } }, NOW).settings.reminders;
    expect(on({ mealPrompt: true })).toMatchObject({ abhyas: true, checklist: true });
    expect(on({ mealPrompt: false, water: true })).toMatchObject({ mealPrompt: false, water: true, abhyas: true, checklist: true });
  });

  it('leaves both off for an older store whose reminders were every one switched off, so the update starts none and the banner stays away', () => {
    const allOff = { mealPrompt: false, fillYesterday: false, planWeek: false, weeklyReport: false, away: false, water: false, sleepCheckin: false, dayReview: false };
    const s = migrateState({ ...v7, settings: { ...v7.settings, reminders: allOff } }, NOW);
    expect(s.settings.reminders).toEqual({ ...allOff, abhyas: false, checklist: false });
    const banner = { platform: 'web', appleMobile: true, standalone: true, permission: 'default' as const, pushConfigured: true, pushRelay: false, today: '2026-10-28' };
    expect(bannerState({ ...banner, reminders: s.settings.reminders })).toBeNull();
    // A second load keeps them off, and a choice made after the update stays.
    expect(migrateState(s, NOW)).toEqual(s);
    const chosen = migrateState({ ...s, settings: { ...s.settings, reminders: { ...s.settings.reminders, abhyas: true } } }, NOW);
    expect(chosen.settings.reminders).toMatchObject({ abhyas: true, checklist: false });
    // Only a switch stored on counts, not the default a missing one takes; one stored as anything but true reads off.
    expect(migrateState({ ...v7, settings: { ...v7.settings, reminders: { mealPrompt: false, abhyas: false } } }, NOW).settings.reminders).toMatchObject({ abhyas: false, checklist: false });
    expect(migrateState({ ...v7, settings: { ...v7.settings, reminders: { ...allOff, water: 'yes' } } }, NOW).settings.reminders).toMatchObject({ abhyas: false, checklist: false });
    // From before the switches existed, the app's reminders switch off keeps the meal-time prompt off, and these two with it.
    const older = migrateState({ ...v1, version: 6, settings: { ...v1.settings, nudgesEnabled: false } }, NOW).settings.reminders;
    expect(Object.values(older).every((v) => v === false)).toBe(true);
    expect(migrateState({ ...v1, version: 6 }, NOW).settings.reminders).toMatchObject({ mealPrompt: true, abhyas: true, checklist: true });
  });

  it('a new user starts with the defaults: the meal-time prompt, Abhyas and "Day so far" on', () => {
    expect(migrateState({ version: STATE_VERSION, profile: { ...EMPTY_STATE.profile } }, NOW).settings.reminders).toEqual(EMPTY_STATE.settings.reminders);
    expect(EMPTY_STATE.settings.reminders).toMatchObject({ mealPrompt: true, abhyas: true, checklist: true });
  });

  it('puts the Abhyas card on Today, switched on, right after water and walk, wherever the user moved those and whatever else they switched', () => {
    const mine = [{ id: 'steps', on: true }, { id: 'menu', on: true }, { id: 'waterWalk', on: false }, { id: 'coach', on: true }];
    expect(cards(migrateState({ ...v7, settings: { ...v7.settings, todayCards: mine } }, NOW)).slice(0, 6)).toEqual(['steps', 'menu', 'waterWalk off', 'abhyas', 'coach', 'weight off']);
    // A list from before water and walk were a card: both are added, the water and walk off as before, Abhyas on after it.
    expect(cards(migrateState({ ...v7, settings: { ...v7.settings, todayCards: [{ id: 'menu', on: true }] } }, NOW))).toEqual(['menu', 'coach off', 'waterWalk off', 'abhyas', 'weight off', 'sleep off', 'steps off', 'climb off', 'mantra off']);
    // A list that already names Abhyas, off at the end (as a load at version 7 of this build left it), still gets it on after water and walk.
    const appended = [...DEFAULT_TODAY_CARDS.filter((c) => c.id !== 'abhyas'), { id: 'abhyas', on: false }];
    expect(cards(migrateState({ ...v7, settings: { ...v7.settings, todayCards: appended } }, NOW)).slice(0, 5)).toEqual(['menu', 'coach', 'waterWalk', 'abhyas', 'weight off']);
    // A store with no cards at all gets the default list, Abhyas on in its place.
    expect(migrateState({ ...v7, settings: { ...v7.settings, todayCards: undefined } }, NOW).settings.todayCards).toEqual(DEFAULT_TODAY_CARDS);
  });

  it('a store at version 8 keeps the card and the switch as the user set them: off, or moved', () => {
    const moved = [{ id: 'abhyas', on: true }, ...DEFAULT_TODAY_CARDS.filter((c) => c.id !== 'abhyas')];
    const s = migrateState({ ...v7, version: 8, settings: { ...v7.settings, todayCards: moved, reminders: { abhyas: false } } }, NOW);
    expect(s.settings.todayCards).toEqual(moved);
    expect(s.settings.reminders.abhyas).toBe(false);
    const off = DEFAULT_TODAY_CARDS.map((c) => (c.id === 'abhyas' ? { ...c, on: false } : c));
    expect(migrateState({ ...v7, version: 8, settings: { ...v7.settings, todayCards: off } }, NOW).settings.todayCards).toEqual(off);
  });

  it('a second load changes nothing, from an older store or one at version 8', () => {
    const once = migrateState(v7, NOW);
    expect(migrateState(once, NOW)).toEqual(once);
    const kept = migrateState({ ...v7, version: 8, abhyasItems: [item, once], abhyasSessions: [session], abhyasTicks: [tick], abhyasRunning: running }, NOW);
    expect(migrateState(kept, NOW)).toEqual(kept);
  });

  it('keeps the list, the minutes, the ticks and the running timer as they were', () => {
    const s = migrateState({ ...v7, version: 8, abhyasItems: [item, once], abhyasSessions: [session], abhyasTicks: [tick], abhyasRunning: running }, NOW);
    expect(s.abhyasItems).toEqual([item, once]);
    expect(s.abhyasSessions).toEqual([session]);
    expect(s.abhyasTicks).toEqual([tick]);
    expect(s.abhyasRunning).toEqual(running);
  });

  it('drops a record in another shape, from a file or sync, and keeps the rest; a timer that is not one is no timer; a list that is not a list is empty', () => {
    const s = migrateState(
      {
        ...v7,
        version: 8,
        abhyasItems: [
          item,
          null,
          'yoga',
          { ...item, id: 'b', kind: 'once' },
          { ...item, id: 'c', days: 'daily' },
          { ...item, id: 'd', order: Number.NaN },
          { ...item, id: 'e', targetMin: '30' },
          { ...item, id: 'f', times: [7] },
          { ...item, id: 'g', kind: 'often' },
          { ...item, id: 'h', archivedAt: 5 },
          { ...item, id: 7 },
        ],
        abhyasSessions: [session, null, { ...session, id: 't', minutes: 'twenty' }, { ...session, id: 'u', endedAt: null }, { ...session, id: 'v', minutes: Number.POSITIVE_INFINITY }],
        abhyasTicks: [tick, { id: 'x' }, { ...tick, id: 'y', at: 3 }, 'tick'],
        abhyasRunning: { itemId: 'a' },
      },
      NOW,
    );
    expect(s.abhyasItems.map((i) => i.id)).toEqual(['a']);
    expect(s.abhyasSessions.map((x) => x.id)).toEqual([session.id]);
    expect(s.abhyasTicks.map((x) => x.id)).toEqual([tick.id]);
    expect(s.abhyasRunning).toBeNull();
    expect(migrateState(s, NOW)).toEqual(s);
    for (const bad of ['a', 7, [running], { itemId: 1, startedAt: running.startedAt }]) expect(migrateState({ ...v7, version: 8, abhyasRunning: bad }, NOW).abhyasRunning, JSON.stringify(bad)).toBeNull();
    const lists = migrateState({ ...v7, version: 8, abhyasItems: { a: item }, abhyasSessions: 'none', abhyasTicks: 3 }, NOW);
    expect([lists.abhyasItems, lists.abhyasSessions, lists.abhyasTicks]).toEqual([[], [], []]);
  });

  it('an account file from a build before version 8 comes up the same way through a sync round', () => {
    const file = forCloud(migrateState(v7, NOW)) as unknown as Record<string, unknown>;
    const older = { ...file, version: 7 } as unknown as CloudState;
    for (const k of ['abhyasItems', 'abhyasSessions', 'abhyasTicks', 'abhyasRunning']) delete (older as unknown as Record<string, unknown>)[k];
    const up = upgradeFile(NOW)(older);
    expect([up.abhyasItems, up.abhyasSessions, up.abhyasTicks, up.abhyasRunning]).toEqual([[], [], [], null]);
    expect(up.settings.reminders.abhyas).toBe(true);
    expect(up.version).toBe(8);
  });
});

describe('a new chapter in the profile', () => {
  it('an older store has none and reads unchanged; a chapter already started is kept as it was', () => {
    const old = migrateState({ ...v1, version: 7 }, NOW);
    expect(old.profile).not.toHaveProperty('chapterStart');
    expect(old.profile).not.toHaveProperty('firstStartWeightKg');
    const started = migrateState({ ...v1, version: 7, profile: { ...v1.profile, startWeightKg: 92, chapterStart: '2026-10-20', firstStartWeightKg: 98.7 } }, NOW);
    expect(started.profile).toMatchObject({ startWeightKg: 92, chapterStart: '2026-10-20', firstStartWeightKg: 98.7 });
    expect(migrateState(started, NOW)).toEqual(started);
  });

  it('a chapter day that is not a date, or a first start that is not a weight, from a damaged file, is left out', () => {
    const s = migrateState({ ...v1, version: 7, profile: { ...v1.profile, chapterStart: 'soon', firstStartWeightKg: 'heavy' } }, NOW);
    expect(s.profile).not.toHaveProperty('chapterStart');
    expect(s.profile).not.toHaveProperty('firstStartWeightKg');
    expect(migrateState({ ...v1, version: 7, profile: { ...v1.profile, chapterStart: '2026-02-30', firstStartWeightKg: -4 } }, NOW).profile).not.toHaveProperty('chapterStart');
  });
});
