import { describe, expect, it } from 'vitest';
import { checklistTimes, dayChecklist, DEFAULT_CHECKLIST_TIMES, withChecklistTime, withTimeAt, type ChecklistInput } from '../checklist';
import type { DayMenu } from '../menu';
import { skipId } from '../menu';
import { DEFAULT_ROUTINE, type Routine, type RoutineSlot } from '../routine';
import type { AbhyasItem, AbhyasSession, AbhyasTick, ActivityLog, Meal, WaterLog } from '../types';
import { makeT } from '../../i18n';

// 2026-10-12 is a Monday.
const DAY = '2026-10-12';
const slot = (id: string, type: RoutineSlot['type'], time: string, en: string, mr: string): RoutineSlot => ({ id, type, time, label_en: en, label_mr: mr, label_hi: '', options: [[]], withBhaji: false, share: 30 });
const routine: Routine = {
  ...DEFAULT_ROUTINE,
  enabled: true,
  slots: [slot('morning', 'breakfast', '08:30', 'Breakfast', 'नाश्ता'), slot('lunch', 'lunch', '13:00', 'Lunch', 'दुपारचं जेवण'), slot('dinner', 'dinner', '19:30', 'Dinner', 'रात्रीचं जेवण')],
};
const meal = (slotId: string, date = DAY, source?: Meal['source']): Meal => ({ id: `${slotId}@${date}`, at: `${date}T08:00:00.000Z`, date, type: 'lunch', slotId, items: [], kcal: 400, protein: 10, ...(source ? { source } : {}) });
const item = (id: string, name: string, p: Partial<AbhyasItem> = {}): AbhyasItem => ({ id, name, icon: 'book-outline', kind: 'repeat', days: [0, 1, 2, 3, 4, 5, 6], times: [], order: 0, createdAt: '2026-10-01T08:00:00.000Z', ...p });
const session = (itemId: string, minutes: number, date = DAY): AbhyasSession => ({ id: `${itemId}@${date}`, itemId, date, startedAt: `${date}T06:00:00.000Z`, endedAt: `${date}T07:00:00.000Z`, minutes });
const tick = (itemId: string, date = DAY): AbhyasTick => ({ id: `${itemId}@${date}`, itemId, date, at: `${date}T09:00:00.000Z` });
const bottle = (ml: number, date = DAY): WaterLog => ({ id: `w${ml}${date}`, at: `${date}T09:00:00.000Z`, date, ml });
const walk = (minutes: number, date = DAY): ActivityLog => ({ id: `a${minutes}${date}`, date, at: `${date}T18:00:00.000Z`, activityId: 'walk', minutes, intensity: 1, kcal: 80 });

const yoga = item('yoga', 'Yoga', { targetMin: 20, order: 0 });
const reading = item('reading', 'English reading', { targetMin: 30, order: 1 });
const coding = item('coding', 'Coding', { order: 2 });

const base: ChecklistInput = {
  date: DAY,
  routine,
  menu: null,
  meals: [],
  skips: [],
  abhyas: { items: [], ticks: [], sessions: [], running: null },
  now: new Date(`${DAY}T20:30:00`),
  water: [],
  activities: [],
  waterGoalMl: 3000,
  bottleMl: 500,
  walkGoalMin: 30,
  waterWalk: true,
  lang: 'en',
  t: makeT('en'),
};

describe('dayChecklist: the day so far, as a checklist', () => {
  it('lists the meals, then the Abhyas list, then water and the walk, each marked done or not yet, as the spec shows them', () => {
    const r = dayChecklist({
      ...base,
      meals: [meal('morning'), meal('lunch')],
      abhyas: { items: [coding, reading, yoga], ticks: [], sessions: [session('yoga', 20), session('reading', 12)], running: null },
      water: [bottle(500), bottle(500), bottle(500), bottle(500)],
      activities: [walk(30)],
    });
    expect(r).toEqual({
      title: 'Dhyey · Day so far',
      body: ['✓ Breakfast · ✓ Lunch · ○ Dinner', '✓ Yoga 20 min · ○ English reading 12/30 min · ○ Coding', '○ Water, 2 bottles left · ✓ Walk 30 min'].join('\n'),
    });
  });

  it('shows a skipped slot as done, with "skipped"; a meal eaten in it wins over the skip', () => {
    const skips = [{ id: skipId(DAY, 'lunch'), date: DAY, slotId: 'lunch' }];
    expect(dayChecklist({ ...base, skips, waterWalk: false })?.body).toBe('○ Breakfast · ✓ Lunch skipped · ○ Dinner');
    expect(dayChecklist({ ...base, skips, meals: [meal('lunch')], waterWalk: false })?.body).toBe('○ Breakfast · ✓ Lunch · ○ Dinner');
  });

  it('counts a meal the app filled in from the plan as eaten, as the record does', () => {
    expect(dayChecklist({ ...base, meals: [meal('morning', DAY, 'auto')], waterWalk: false })?.body).toBe('✓ Breakfast · ○ Lunch · ○ Dinner');
  });

  it('leaves out a slot the menu plans empty, unless something was eaten there; with no menu every slot is listed', () => {
    const menu: DayMenu = {
      date: DAY,
      editedAt: '',
      meals: [
        { id: 'morning', type: 'breakfast', time: '08:30', lines: [{ foodId: 'poha', unit: 'bowl', qty: 1 }] },
        { id: 'lunch', type: 'lunch', time: '13:00', lines: [] },
        { id: 'dinner', type: 'dinner', time: '19:30', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }] },
      ],
    };
    expect(dayChecklist({ ...base, menu, waterWalk: false })?.body).toBe('○ Breakfast · ○ Dinner');
    expect(dayChecklist({ ...base, menu, meals: [meal('lunch')], waterWalk: false })?.body).toBe('○ Breakfast · ✓ Lunch · ○ Dinner');
  });

  it('writes the bottles left as the water tile does, one bottle in the singular, and the walk by the minutes still to go', () => {
    const line = (water: WaterLog[], activities: ActivityLog[]) => dayChecklist({ ...base, meals: [meal('morning'), meal('lunch'), meal('dinner')], water, activities })?.body;
    expect(line([bottle(2500)], [walk(10)])).toBe('✓ Breakfast · ✓ Lunch · ✓ Dinner\n○ Water, 1 bottle left · ○ Walk, 20 min left');
    expect(line([bottle(3000)], [walk(10)])).toBe('✓ Breakfast · ✓ Lunch · ✓ Dinner\n✓ Water · ○ Walk, 20 min left');
    expect(line([], [walk(45)])).toBe('✓ Breakfast · ✓ Lunch · ✓ Dinner\n○ Water, 6 bottles left · ✓ Walk 45 min');
  });

  it('leaves out a line with nothing on it: no Abhyas items, water and the walk off Today, a goal of 0', () => {
    expect(dayChecklist(base)?.body).toBe('○ Breakfast · ○ Lunch · ○ Dinner\n○ Water, 6 bottles left · ○ Walk, 30 min left');
    expect(dayChecklist({ ...base, waterWalk: false })?.body).toBe('○ Breakfast · ○ Lunch · ○ Dinner');
    expect(dayChecklist({ ...base, walkGoalMin: 0 })?.body).toBe('○ Breakfast · ○ Lunch · ○ Dinner\n○ Water, 6 bottles left');
    expect(dayChecklist({ ...base, waterGoalMl: 0, walkGoalMin: 0 })?.body).toBe('○ Breakfast · ○ Lunch · ○ Dinner');
    const noMeals: Routine = { ...routine, slots: [] };
    expect(dayChecklist({ ...base, routine: noMeals, abhyas: { ...base.abhyas, items: [coding] }, waterWalk: false })?.body).toBe('○ Coding');
  });

  it('sends nothing when every part is done, or when there is nothing to list', () => {
    const allDone: ChecklistInput = {
      ...base,
      meals: [meal('morning'), meal('lunch')],
      skips: [{ id: skipId(DAY, 'dinner'), date: DAY, slotId: 'dinner' }],
      abhyas: { items: [yoga, coding], ticks: [tick('coding')], sessions: [session('yoga', 25)], running: null },
      water: [bottle(3000)],
      activities: [walk(30)],
    };
    expect(dayChecklist(allDone)).toBeNull();
    // One part still to do brings the whole list back.
    expect(dayChecklist({ ...allDone, activities: [] })?.body).toBe('✓ Breakfast · ✓ Lunch · ✓ Dinner skipped\n✓ Yoga 25 min · ✓ Coding\n✓ Water · ○ Walk, 30 min left');
    expect(dayChecklist({ ...base, routine: { ...routine, slots: [] }, waterWalk: false })).toBeNull();
  });

  it('reads only the date it is for: items on that day, and that day\'s meals, minutes, ticks, water and walk', () => {
    const wednesday = item('swim', 'Swimming', { days: [3] });
    const once = item('bike', 'Fix the bike', { kind: 'once', days: [], date: '2026-10-13' });
    const r = dayChecklist({
      ...base,
      meals: [meal('morning', '2026-10-11')],
      abhyas: { items: [wednesday, once, reading, coding], ticks: [tick('coding', '2026-10-11')], sessions: [session('reading', 30, '2026-10-11')], running: null },
      water: [bottle(3000, '2026-10-11')],
      activities: [walk(30, '2026-10-11')],
    });
    expect(r?.body).toBe('○ Breakfast · ○ Lunch · ○ Dinner\n○ English reading 0/30 min · ○ Coding\n○ Water, 6 bottles left · ○ Walk, 30 min left');
  });

  it('counts a running timer when it is given one; an item done by a tick shows the minutes it got, or just its name', () => {
    const running = { itemId: 'reading', startedAt: new Date(`${DAY}T20:25:00`).toISOString() };
    const r = dayChecklist({ ...base, waterWalk: false, routine: { ...routine, slots: [] }, abhyas: { items: [yoga, reading], ticks: [tick('yoga')], sessions: [session('reading', 12)], running } });
    expect(r?.body).toBe('✓ Yoga · ○ English reading 17/30 min');
  });

  it('speaks the user\'s language: the title with ध्येय, the slot names from the pattern, the bottles left', () => {
    const r = dayChecklist({ ...base, lang: 'mr', t: makeT('mr'), meals: [meal('morning')], skips: [{ id: skipId(DAY, 'lunch'), date: DAY, slotId: 'lunch' }] });
    expect(r?.title).toBe('ध्येय · आतापर्यंतचा दिवस');
    expect(r?.body).toBe('✓ नाश्ता · ✓ दुपारचं जेवण वगळलं · ○ रात्रीचं जेवण\n○ पाणी, 6 बाटल्या बाकी · ○ चालणं, 30 मि बाकी');
    expect(dayChecklist({ ...base, lang: 'hi', t: makeT('hi'), waterWalk: false })?.title).toBe('ध्येय · अब तक का दिन');
  });
});

describe('checklistTimes: when "Day so far" comes', () => {
  it('is 20:30 by default, and on a store that has no list or something else there', () => {
    expect(DEFAULT_CHECKLIST_TIMES).toEqual(['20:30']);
    for (const odd of [undefined, null, '20:30', 7, { a: 1 }, false]) expect(checklistTimes(odd), String(odd)).toEqual(['20:30']);
  });

  it('keeps clock times only, each once, in the day\'s order, at most three', () => {
    expect(checklistTimes(['21:00', '08:15', '21:00', '25:00', 'x', 7, '9:00'])).toEqual(['08:15', '21:00']);
    expect(checklistTimes(['23:00', '20:30', '13:00', '07:00'])).toEqual(['07:00', '13:00', '20:30']);
  });

  it('a list with no clock time left in it has the default, as no list does: the switch, not an empty list, turns it off', () => {
    expect(checklistTimes([7, 'x'])).toEqual(['20:30']);
    expect(checklistTimes(['25:00', '9:00', null])).toEqual(['20:30']);
    expect(checklistTimes([])).toEqual(['20:30']);
  });

  it('adds one time at a time, the first free of 13:00, 18:00, 20:30, 09:00, and no more than three', () => {
    expect(withChecklistTime(['20:30'])).toEqual(['13:00', '20:30']);
    expect(withChecklistTime(['13:00', '20:30'])).toEqual(['13:00', '18:00', '20:30']);
    expect(withChecklistTime(['13:00', '18:00', '20:30'])).toEqual(['13:00', '18:00', '20:30']);
    expect(withChecklistTime(undefined)).toEqual(['13:00', '20:30']);
    expect(withChecklistTime(['08:00'])).toEqual(['08:00', '13:00']);
  });

  it('changes one time when what was typed is a clock time and differs, kept in the day\'s order and once each; nothing for anything else', () => {
    expect(withTimeAt(['13:00', '20:30'], 1, '10:30')).toEqual(['10:30', '13:00']);
    expect(withTimeAt(['13:00', '20:30'], 0, '21:15')).toEqual(['20:30', '21:15']);
    // The same time as another one leaves one of them.
    expect(withTimeAt(['13:00', '20:30'], 0, '20:30')).toEqual(['20:30']);
    // Half typed, not a time, unchanged, or a place that is not there: nothing to save.
    for (const text of ['1', '10:3', '7:15', '25:00', 'ab:cd', '']) expect(withTimeAt(['13:00', '20:30'], 0, text), text).toBeNull();
    expect(withTimeAt(['13:00', '20:30'], 0, '13:00')).toBeNull();
    expect(withTimeAt(['13:00', '20:30'], 2, '10:30')).toBeNull();
  });
});
