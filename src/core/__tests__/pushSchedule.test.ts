import { afterEach, describe, expect, it, vi } from 'vitest';
import { dueAt, LIMITS, validSchedule } from '../../../relay/src/schedule';
import { MAX_TIMES } from '../abhyas';
import { makeT } from '../../i18n';
import { EMPTY_STATE } from '../../store/defaults';
import type { DayMenu } from '../menu';
import { buildPushSchedule, clip, PUSH_LIMITS, pushStep } from '../pushSchedule';
import { abhyasWords } from '../reminders';
import type { AbhyasItem, AbhyasSession, AbhyasTick, AppState, Meal } from '../types';

describe('pushStep', () => {
  const here = { configured: true, relayOn: true, known: true, active: true, payload: '{"v":1}', lastSent: '' };

  it('sends a changed schedule for the person using the device, and only once', () => {
    expect(pushStep(here)).toBe('send');
    expect(pushStep({ ...here, lastSent: here.payload })).toBe('none');
  });

  it("removes the relay's copy on a device that is signed out or reset", () => {
    expect(pushStep({ ...here, active: false, payload: '' })).toBe('stop');
    expect(pushStep({ ...here, active: false, payload: '', lastSent: here.payload })).toBe('stop');
  });

  it('decides nothing before the store and the session are known', () => {
    expect(pushStep({ ...here, known: false, active: false, payload: '' })).toBe('none');
  });

  it('leaves the relay alone when background reminders are off or not set up', () => {
    expect(pushStep({ ...here, relayOn: false, active: false })).toBe('none');
    expect(pushStep({ ...here, configured: false, active: false })).toBe('none');
    expect(pushStep({ ...here, relayOn: false })).toBe('none');
  });
});

describe('clip', () => {
  const x = (n: number) => 'x'.repeat(n);
  // A cut on a whole letter as the reader sees it: a vowel sign stays with its letter, a conjunct whole, an emoji whole.
  const cases: [string, string][] = [
    [`${x(78)}कि abc`, `${x(78)}…`],
    [`${x(77)}क्ष abc`, `${x(77)}…`],
    [`${x(76)}कि abc`, `${x(76)}कि…`],
    [`${x(78)}👨‍👩‍👧abc`, `${x(78)}…`],
    [`${x(76)}👨‍👩‍👧abc`, `${x(76)}…`],
    [`${x(77)}👍🏽abc`, `${x(77)}…`],
    [`${x(78)}😀abc`, `${x(78)}…`],
    [`${x(77)}1️⃣ x abc`, `${x(77)}…`],
  ];
  const joinsBack = /^[\p{M}\u200C\u200D\u{1F3FB}-\u{1F3FF}]/u;
  const loneHalf = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
  const words = ['अभ्यासक्रम ', 'क्षत्रिय ', 'पढ़ाई ', 'श्री ', 'x', ' ', '👨‍👩‍👧', '👍🏽', '😀', '्', 'ि', '\u200D', 'é'];
  let seed = 7;
  const pick = () => words[(seed = (seed * 1103515245 + 12345) % 2147483648) % words.length];

  const check = () => {
    for (const [text, cut] of cases) expect(clip(text, PUSH_LIMITS.text), text).toBe(cut);
    expect(clip('Short', PUSH_LIMITS.text)).toBe('Short');
    for (let k = 0; k < 300; k++) {
      const text = Array.from({ length: 60 }, pick).join('');
      const out = clip(text, PUSH_LIMITS.text);
      if (text.length <= PUSH_LIMITS.text) continue;
      const kept = out.slice(0, -1);
      expect(out.endsWith('…') && out.length <= PUSH_LIMITS.text && text.startsWith(kept), text).toBe(true);
      // Nothing that belongs to the last letter kept is left behind, and no letter ends on a joiner or a virama.
      expect((kept.length > 0 && joinsBack.test(text.slice(kept.length))) || /[\s\u200D\u094D]$/.test(kept) || loneHalf.test(kept), text).toBe(false);
    }
  };

  it('cuts on a whole letter, never inside one, in Marathi and Hindi and with emoji', check);

  it('cuts on a whole letter where the system has no grapheme segmenter', () => {
    const segmenter = Intl.Segmenter;
    Reflect.set(Intl, 'Segmenter', undefined);
    try {
      check();
    } finally {
      Reflect.set(Intl, 'Segmenter', segmenter);
    }
  });
});

describe('buildPushSchedule: meal-time prompts', () => {
  // Set up on Monday 12 October 2026.
  const state: AppState = { ...EMPTY_STATE, profile: { ...EMPTY_STATE.profile, onboarded: true, onboardedOn: '2026-10-12' } };
  const build = (s: AppState, today: string) => buildPushSchedule(s, today, (k) => k, 'Asia/Kolkata');

  it('sends each slot at its time plus the grace, from the day after setup', () => {
    const slots = build(state, '2026-10-13').slots;
    expect(slots.map((s) => [s.id, s.at])).toEqual([
      ['breakfast', '09:15'],
      ['lunch', '13:45'],
      ['snack', '16:45'],
      ['dinner', '21:15'],
    ]);
    expect(slots[0]).toMatchObject({ title: 'Breakfast?', body: 'slot_prompt' });
  });

  it('sends none on the day the person finished setup', () => {
    expect(build(state, '2026-10-12').slots).toEqual([]);
  });

  it('sends none with the meal-time prompt off', () => {
    const off: AppState = { ...state, settings: { ...state.settings, reminders: { ...state.settings.reminders, mealPrompt: false } } };
    expect(build(off, '2026-10-13').slots).toEqual([]);
  });

  it('sends the free days, so the relay asks about no meal on one, as the phone and the app ask about none', () => {
    const free: AppState = { ...state, settings: { ...state.settings, offDays: [0, 6] } };
    expect(build(free, '2026-10-13').offDays).toEqual([0, 6]);
    expect(build({ ...state, settings: { ...state.settings, offDays: [] } }, '2026-10-13').offDays).toEqual([]);
    expect(build(state, '2026-10-13').offDays).toEqual(state.settings.offDays);
  });
});

describe('buildPushSchedule: the parts of the app switched on in Settings', () => {
  const state: AppState = { ...EMPTY_STATE, profile: { ...EMPTY_STATE.profile, onboarded: true, onboardedOn: '2026-10-12' } };
  const build = (s: AppState) => buildPushSchedule(s, '2026-10-13', (k) => k, 'Asia/Kolkata');
  const withFeatures = (features: Partial<AppState['settings']['features']>): AppState => ({ ...state, settings: { ...state.settings, features: { ...state.settings.features, ...features } } });

  it('sends no short breaks while eye-care breaks are off, whatever the break panel says, and none outside an office day switched on', () => {
    const office = (s: AppState): AppState => ({ ...s, schedule: { ...s.schedule, enabled: true } });
    expect(state.settings.features.breaks).toBe(false);
    expect(build(office(state)).breaks).toBeNull();
    expect(build(office(withFeatures({ breaks: true }))).breaks).toMatchObject({ everyMinutes: 20, from: '09:00', to: '18:00', title: 'brk_micro' });
    // The short breaks keep to the working hours: with the office day off, as it starts, there are none.
    expect(build(withFeatures({ breaks: true })).breaks).toBeNull();
  });

  it("sends the day's lines only while the day's line is switched on", () => {
    expect(state.settings.features.mantra).toBe(false);
    expect(build(state).mantras).toEqual([]);
    const on = build(withFeatures({ mantra: true })).mantras;
    expect(on).toHaveLength(7);
    expect(on[0]).toMatchObject({ date: '2026-10-13', title: 'mantra_title' });
  });

  it('sends the weigh day, like water, only while the nudges are switched on', () => {
    const nudges = (on: boolean): AppState => ({ ...state, settings: { ...state.settings, nudgesEnabled: on, weighDay: 3 } });
    expect(build(nudges(false)).weigh).toBeNull();
    expect(build(nudges(false)).water).toBeNull();
    expect(build(nudges(true)).weigh).toEqual({ weekday: 3, title: 'weigh_q', body: 'weigh_hint' });
  });
});

describe('buildPushSchedule: Abhyas and the day so far (version 2)', () => {
  // Set up on Monday 12 October 2026; today is Tuesday the 13th. Sunday is the free day, as it starts.
  const TODAY = '2026-10-13';
  const item = (id: string, name: string, p: Partial<AbhyasItem> = {}): AbhyasItem => ({ id, name, icon: 'book-outline', kind: 'repeat', days: [1, 2, 3, 4, 5], times: ['18:00'], order: 0, createdAt: '2026-10-01T08:00:00.000Z', ...p });
  const tick = (itemId: string, date = TODAY): AbhyasTick => ({ id: `${itemId}@${date}`, itemId, date, at: `${date}T09:00:00.000Z` });
  const session = (itemId: string, minutes: number, date = TODAY): AbhyasSession => ({ id: `${itemId}@${date}`, itemId, date, startedAt: `${date}T06:00:00.000Z`, endedAt: `${date}T07:00:00.000Z`, minutes });
  const meal = (slotId: string, date = TODAY): Meal => ({ id: `${slotId}@${date}`, at: `${date}T08:00:00.000Z`, date, type: 'breakfast', slotId, items: [], kcal: 300, protein: 10 });

  const coding = item('coding', 'Coding', { days: [2], times: ['20:00'], order: 0 });
  const yoga = item('yoga', 'Yoga', { days: [5, 1, 2, 2], times: ['18:00', '07:30'], targetMin: 20, order: 1 });
  const bank = item('bank', 'Bank', { kind: 'once', days: [], date: TODAY, times: ['11:00'], targetMin: 30, order: 2 });
  const bike = item('bike', 'Fix the bike', { kind: 'once', days: [], date: '2026-10-14', times: ['10:00', '09:00'], order: 3 });
  const items: AbhyasItem[] = [
    yoga,
    coding,
    bank,
    bike,
    // None of these remind: no time, removed, a day gone by, and a one-off already done on its day.
    item('silent', 'Silent', { times: [], order: 4 }),
    item('gone', 'Gone', { archivedAt: '2026-10-10T08:00:00.000Z', order: 5 }),
    item('past', 'Past', { kind: 'once', days: [], date: '2026-10-10', times: ['10:00'], order: 6 }),
    item('donelater', 'Done ahead', { kind: 'once', days: [], date: '2026-10-15', times: ['10:00'], order: 7 }),
  ];
  const state: AppState = {
    ...EMPTY_STATE,
    profile: { ...EMPTY_STATE.profile, onboarded: true, onboardedOn: '2026-10-12' },
    abhyasItems: items,
    abhyasTicks: [tick('donelater', '2026-10-15')],
  };
  const en = makeT('en');
  const build = (s: AppState, today = TODAY) => buildPushSchedule(s, today, en, 'Asia/Kolkata');
  const withSettings = (s: AppState, p: Partial<AppState['settings']>): AppState => ({ ...s, settings: { ...s.settings, ...p } });

  it('is version 2', () => {
    expect(build(state).v).toBe(2);
  });

  it('sends each repeating item in the user\'s order with its weekdays and times, and the words for a fresh day', () => {
    expect(build(state).abhyas).toEqual([
      { id: 'coding', days: [2], times: ['20:00'], title: 'Coding', body: "Today's list", order: 0 },
      { id: 'yoga', days: [1, 2, 5], times: ['07:30', '18:00'], title: 'Yoga', body: '0 of 20 min today', order: 1 },
    ]);
  });

  it('sends each one-off from today on that is not done yet, one row a time, soonest first', () => {
    expect(build(state).once).toEqual([
      { date: TODAY, time: '11:00', title: 'Bank', body: '0 of 30 min today', order: 2 },
      { date: '2026-10-14', time: '09:00', title: 'Fix the bike', body: "Today's list", order: 3 },
      { date: '2026-10-14', time: '10:00', title: 'Fix the bike', body: "Today's list", order: 3 },
    ]);
    // Ticked on its day, a one-off is gone.
    expect(build({ ...state, abhyasTicks: [...state.abhyasTicks, tick('bike', '2026-10-14')] }).once.map((o) => o.title)).toEqual(['Bank']);
  });

  it("says the minutes counted today on today's words, and on a one-off's", () => {
    const s = build({ ...state, abhyasSessions: [session('yoga', 12), session('bank', 10), session('yoga', 15, '2026-10-12')] });
    expect(s.abhyas[1]).toMatchObject({ body: '0 of 20 min today', bodyToday: '12 of 20 min today' });
    expect(s.abhyas[0].bodyToday).toBeUndefined();
    expect(s.once[0].body).toBe('10 of 30 min today');
  });

  it('names the items done today, by a tick or by the minutes target, for today only', () => {
    expect(build(state)).toMatchObject({ doneToday: [], doneDate: TODAY });
    const done = build({ ...state, abhyasTicks: [tick('coding')], abhyasSessions: [session('yoga', 20)] });
    expect(done).toMatchObject({ doneToday: ['coding', 'yoga'], doneDate: TODAY });
    // Done, so it says no minutes for today.
    expect(done.abhyas[1].bodyToday).toBeUndefined();
    // Yesterday's tick does not count.
    expect(build({ ...state, abhyasTicks: [tick('coding', '2026-10-12')] }).doneToday).toEqual([]);
  });

  it('sends no Abhyas while its reminders are off', () => {
    const off = withSettings(state, { reminders: { ...state.settings.reminders, abhyas: false } });
    expect(build(off)).toMatchObject({ abhyas: [], once: [], doneToday: [], doneDate: TODAY });
  });

  it('keeps to what the relay takes: the first rows, and long words cut', () => {
    const many: AppState = {
      ...state,
      abhyasItems: Array.from({ length: 40 }, (_, i) => item(`r${i}`, `${'Long name '.repeat(20)}${i}`, { order: 40 - i, times: ['06:00', '12:00', '18:00'] }))
        .concat(Array.from({ length: 40 }, (_, i) => item(`o${i}`, `One-off ${i}`, { kind: 'once', days: [], date: '2026-10-20', times: ['06:00', '12:00', '18:00'], order: 100 + i }))),
    };
    const s = build(many);
    expect(s.abhyas).toHaveLength(PUSH_LIMITS.rows);
    // The user's order: the last one made has the first place.
    expect(s.abhyas[0].id).toBe('r39');
    expect(s.abhyas.every((a) => a.title.length <= PUSH_LIMITS.text && a.title.endsWith('…'))).toBe(true);
    expect(s.once).toHaveLength(PUSH_LIMITS.rows);
    expect(validSchedule(JSON.parse(JSON.stringify(s)))).toBe(true);
    // Under the request size the relay takes.
    expect(new TextEncoder().encode(JSON.stringify(s)).length).toBeLessThan(64 * 1024);
  });

  it('says what the phone says for each item', () => {
    const s = build({ ...state, abhyasSessions: [session('yoga', 12), session('bank', 10)] });
    expect(s.abhyas[1]).toMatchObject({ title: abhyasWords(yoga, 0, en).title, body: abhyasWords(yoga, 0, en).body, bodyToday: abhyasWords(yoga, 12, en).body });
    expect(s.once[0]).toMatchObject(abhyasWords(bank, 10, en));
  });

  it("matches the relay's limits, the reminder times an item may have among them", () => {
    expect(PUSH_LIMITS).toEqual(LIMITS);
    expect(MAX_TIMES).toBe(LIMITS.times);
  });

  it("has the relay send Abhyas items and one-offs due in the same minute in the user's order", () => {
    // A one-off placed first in the list, at the same time as two repeating items.
    const first = item('call', 'Call home', { kind: 'once', days: [], date: TODAY, times: ['20:00'], order: -1 });
    const s = JSON.parse(JSON.stringify(build({ ...state, abhyasItems: [...items, first, item('read', 'Read', { days: [2], times: ['20:00'], order: 9 })] })));
    expect(dueAt(s, { date: TODAY, weekday: 2, minutes: 20 * 60 }).map((r) => r.title)).toEqual(['Call home', 'Coding', 'Read']);
  });

  it('is a schedule the relay takes, in every language', () => {
    for (const lang of ['en', 'mr', 'hi'] as const) {
      const s: AppState = { ...state, profile: { ...state.profile, lang }, abhyasSessions: [session('yoga', 12)] };
      expect(validSchedule(JSON.parse(JSON.stringify(buildPushSchedule(s, TODAY, makeT(lang), 'Asia/Kolkata')))), lang).toBe(true);
    }
  });

  it('sends the day so far as today stands, at its times, for today', () => {
    const s = build({ ...state, meals: [meal('breakfast')], abhyasTicks: [tick('coding')] });
    expect(s.checklist).toMatchObject({ times: ['20:30'], title: 'Dhyey · Day so far', date: TODAY });
    const lines = s.checklist!.body.split('\n');
    expect(lines[0]).toMatch(/^✓ Breakfast · ○ Lunch/);
    // Every item on today is on the list, one with no reminder time too.
    expect(lines[1]).toBe('✓ Coding · ○ Yoga 0/20 min · ○ Bank 0/30 min · ○ Silent');
    // Its times as Settings keeps them.
    expect(build(withSettings(state, { checklistTimes: ['21:00', 'x', '13:00'] })).checklist!.times).toEqual(['13:00', '21:00']);
  });

  it('says what the day so far says on the phone, from the same menu', () => {
    const menu: DayMenu = {
      date: TODAY,
      editedAt: '',
      meals: [
        { id: 'breakfast', type: 'breakfast', time: '09:00', lines: [] },
        { id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }] },
      ],
    };
    // Breakfast planned empty and not eaten is left off, as the phone leaves it.
    expect(buildPushSchedule(state, TODAY, en, 'Asia/Kolkata', menu).checklist!.body.split('\n')[0]).toBe('○ Lunch');
  });

  it('sends no day so far while it is off, on the day setup was finished, on a free day, or with everything done', () => {
    expect(build(withSettings(state, { reminders: { ...state.settings.reminders, checklist: false } })).checklist).toBeNull();
    expect(build(state, '2026-10-12').checklist).toBeNull();
    // Sunday 18 October is the free day.
    expect(build(state, '2026-10-18').checklist).toBeNull();
    expect(build(withSettings(state, { offDays: [] }), '2026-10-18').checklist).not.toBeNull();
    const allDone: AppState = {
      ...withSettings(state, { waterGoalMl: 0, walkGoalMin: 0 }),
      abhyasItems: [],
      meals: ['breakfast', 'lunch', 'snack', 'dinner'].map((id) => meal(id)),
    };
    expect(build(allDone).checklist).toBeNull();
  });

  it('changes with a tick, a meal or a stopped timer, so the app sends it again, and not with the running timer or the time of day', () => {
    const json = (s: AppState) => JSON.stringify(build(s));
    const base = json(state);
    expect(json({ ...state, abhyasTicks: [...state.abhyasTicks, tick('coding')] })).not.toBe(base);
    expect(json({ ...state, meals: [meal('breakfast')] })).not.toBe(base);
    expect(json({ ...state, abhyasSessions: [session('yoga', 5)] })).not.toBe(base);
    expect(json({ ...state, abhyasRunning: { itemId: 'yoga', startedAt: `${TODAY}T05:00:00.000Z` } })).toBe(base);
  });

  describe('at any time of the day', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('builds the same schedule morning and evening', () => {
      const s: AppState = { ...state, abhyasSessions: [session('yoga', 12)], abhyasRunning: { itemId: 'yoga', startedAt: `${TODAY}T05:00:00.000Z` } };
      vi.useFakeTimers();
      vi.setSystemTime(new Date(`${TODAY}T07:00:00`));
      const morning = JSON.stringify(build(s));
      vi.setSystemTime(new Date(`${TODAY}T21:45:00`));
      expect(JSON.stringify(build(s))).toBe(morning);
    });
  });
});
