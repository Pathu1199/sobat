import { describe, expect, it } from 'vitest';
import { migrateState, upgradeFile } from '../../store/migrate';
import { EMPTY_STATE, STATE_VERSION } from '../../store/defaults';
import { allowance, pattern } from '../pattern';
import { DEFAULT_ROUTINE, DEFAULT_SLOTS, NEUTRAL_ROUTINE } from '../routine';
import { DEFAULT_TODAY_CARDS } from '../tabs';
import foodsJson from '../../data/foods.json';
import { weekDates } from '../date';
import { fitFor, isSuggested, menuFor, setMenuLine, viewMenu } from '../menu';
import { landMerge, RoundStop, syncRound, type CloudState } from '../sync';
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
    expect(once.version).toBe(7);
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
    expect(out.version).toBe(7);
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
    expect(s.settings.reminders).toEqual({ mealPrompt: true, fillYesterday: false, planWeek: false, weeklyReport: false });
    expect(s.settings.todayCards.filter((c) => c.on).map((c) => c.id)).toEqual(['menu', 'coach', 'waterWalk']);
  });

  it('version 7: a choice made after the migration survives the next load, and a bad tab list is cleaned', () => {
    const once = migrateState(v1);
    const chosen = { ...once, settings: { ...once.settings, bottleMl: 1000, tabs: ['coach', 'sleep', 'body'], features: { ...once.settings.features, mantra: true } } };
    const again = migrateState(chosen);
    expect(again.settings.bottleMl).toBe(1000);
    expect(again.settings.tabs).toEqual(['coach', 'sleep']);
    expect(again.settings.features.mantra).toBe(true);
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
async function syncWith(file: unknown, o: { local?: AppState; base?: CloudState | null; modifiedTime?: string | null } = {}) {
  let now: AppState = o.local ?? { ...EMPTY_STATE };
  let account = { state: JSON.stringify(file), modifiedTime: 't1' };
  const written: CloudState[] = [];
  const round = (base: CloudState | null, modifiedTime: string | null) =>
    syncRound({
      pull: true,
      base,
      modifiedTime,
      supported: STATE_VERSION,
      upgrade: upgradeFile(NOW),
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
  const REMINDERS = { mealPrompt: true, fillYesterday: false, planWeek: false, weeklyReport: false };

  it('the Today cards: every known card once, in the order stored, the unknown and second copies dropped, the missing ones added off', () => {
    const cards = settingsOf({ todayCards: [{ id: 'steps', on: true }, { id: 'nope', on: true }, { id: 'menu', on: 'yes' }, { id: 'steps', on: false }] }).todayCards;
    expect(cards.map((c) => c.id)).toEqual(['steps', 'menu', 'coach', 'waterWalk', 'weight', 'sleep', 'climb', 'mantra']);
    expect(cards.filter((c) => c.on).map((c) => c.id)).toEqual(['steps']);
    expect(settingsOf({ todayCards: { menu: true } }).todayCards).toEqual(DEFAULT_TODAY_CARDS);
  });

  it('the feature and reminder switches: each known one true or false, anything else its default, unknown keys dropped', () => {
    const s = settingsOf({ features: { mantra: true, breaks: 'yes', autoPlates: 1, dark: true }, reminders: { mealPrompt: null, planWeek: true, weeklyReport: [], extra: false } });
    expect(s.features).toEqual({ breaks: false, mantra: true, autoPlates: false });
    expect(s.reminders).toEqual({ mealPrompt: true, fillYesterday: false, planWeek: true, weeklyReport: false });
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
