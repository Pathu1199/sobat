import { describe, expect, it } from 'vitest';
import { DEFAULT_BREAK_SETTINGS } from '../breaks';
import { daysBetween } from '../date';
import type { DayMenu } from '../menu';
import { skipId } from '../menu';
import type { DayRecord, DayRecordState } from '../record';
import {
  DAILY_IDS,
  dailyReminders,
  daysAway,
  lastLogDate,
  missedDays,
  plannedReminders,
  promptOutcome,
  reportMonday,
  reportText,
  tapRoute,
  weekReport,
  type ReminderInput,
} from '../reminders';
import { DEFAULT_ROUTINE, type Routine, type RoutineSlot } from '../routine';
import { shownWeight } from '../tileText';
import type { Meal } from '../types';
import { makeT } from '../../i18n';

const slot = (id: string, type: RoutineSlot['type'], time: string, share: number): RoutineSlot => ({ id, type, time, label_en: id, label_mr: '', label_hi: '', options: [[]], withBhaji: false, share });
const routine: Routine = { ...DEFAULT_ROUTINE, enabled: true, slots: [slot('morning', 'breakfast', '08:30', 25), slot('lunch', 'lunch', '13:00', 40), slot('dinner', 'dinner', '19:30', 35)] };
const meal = (date: string): Meal => ({ id: date, at: `${date}T13:00:00.000Z`, date, type: 'lunch', items: [], kcal: 400, protein: 10 });
const WORDS: Record<string, string> = {
  prompt_title: '{slot} · {kcal} kcal',
  rem_report_full: '{n} of {m} full',
  rem_report_avg: 'average {avg}, goal {goal}',
  rem_report_weight: 'weight {kg} kg in {weeks} weeks',
};
const t = (k: string) => WORDS[k] ?? k;
const plannedKcal: Record<string, number> = {};
for (const d of ['2026-10-12', '2026-10-13', '2026-10-14']) Object.assign(plannedKcal, { [`${d}:morning`]: 300, [`${d}:lunch`]: 600, [`${d}:dinner`]: 500 });
// 2026-10-12 is a Monday.
const base: ReminderInput = {
  today: '2026-10-12',
  nowMinutes: 10 * 60,
  routine,
  mealPrompt: true,
  awayLines: true,
  doneSlotIds: [],
  plannedKcal,
  lastLogDate: '2026-10-12',
  offDays: [],
  quietStartHour: 22,
  quietEndHour: 7,
  lang: 'en',
  t,
  fillYesterday: false,
  records: {},
  planWeek: false,
  reviewedWeeks: [],
  report: null,
};
const quiet: ReminderInput = { ...base, mealPrompt: false, awayLines: false };

describe('plannedReminders: the meal-time prompt', () => {
  it('prompts every planned slot at its own time, titled with what is planned, today and the next two days only', () => {
    const r = plannedReminders(base).filter((x) => x.id.startsWith('slot:'));
    // Monday at 10:00: lunch and dinner today, then all three on Tuesday and Wednesday.
    expect(r).toHaveLength(2 + 3 + 3);
    expect(r[0]).toMatchObject({
      id: 'slot:lunch:2026-10-12',
      date: '2026-10-12',
      time: '13:00',
      title: 'lunch · 600 kcal',
      body: 'prompt_body',
      category: 'meal',
      data: { kind: 'slot', date: '2026-10-12', slotId: 'lunch' },
    });
    expect(r[1]).toMatchObject({ id: 'slot:dinner:2026-10-12', time: '19:30' });
    expect(r[2]).toMatchObject({ id: 'slot:morning:2026-10-13', time: '08:30' });
    expect(r.some((x) => x.date > '2026-10-14')).toBe(false);
  });

  it('a slot planned empty gets no prompt; one whose plan is not known gets the plain question, without the button', () => {
    const empty = plannedReminders({ ...base, plannedKcal: { ...plannedKcal, '2026-10-12:dinner': 0 } }).filter((x) => x.date === '2026-10-12');
    expect(empty.map((x) => x.id)).toEqual(['slot:lunch:2026-10-12']);
    const plain = plannedReminders({ ...base, plannedKcal: {} })[0];
    expect(plain).toMatchObject({ id: 'slot:lunch:2026-10-12', title: 'lunch?', body: 'slot_prompt' });
    expect(plain.category).toBeUndefined();
  });

  it('writes a big plan with its thousands', () => {
    const r = plannedReminders({ ...base, plannedKcal: { ...plannedKcal, '2026-10-12:lunch': 1240 } });
    expect(r[0].title).toBe('lunch · 1,240 kcal');
  });

  it('leaves out today\'s slots already done and those whose moment has passed', () => {
    const r = plannedReminders({ ...base, nowMinutes: 14 * 60, doneSlotIds: ['dinner'] }).filter((x) => x.date === '2026-10-12');
    expect(r).toEqual([]);
  });

  it('keeps today\'s prompt in the list through its own minute, so a reconcile in that minute never cancels it', () => {
    const at = (nowMinutes: number) => plannedReminders({ ...base, nowMinutes }).filter((x) => x.date === '2026-10-12').map((x) => x.id);
    expect(at(13 * 60)).toEqual(['slot:lunch:2026-10-12', 'slot:dinner:2026-10-12']);
    expect(at(13 * 60 + 1)).toEqual(['slot:dinner:2026-10-12']);
  });

  it('leaves out a slot skipped ahead on a later day', () => {
    const skips = [{ id: skipId('2026-10-13', 'lunch'), date: '2026-10-13', slotId: 'lunch' }];
    const r = plannedReminders({ ...base, skips }).filter((x) => x.id.startsWith('slot:'));
    expect(r.map((x) => x.id)).not.toContain('slot:lunch:2026-10-13');
    expect(r).toHaveLength(2 + 2 + 3);
  });

  it('skips off days and quiet hours, and says nothing when the meal-time prompt is off', () => {
    const r = plannedReminders({ ...base, offDays: [2], lastLogDate: null });
    expect(r.some((x) => x.date === '2026-10-13')).toBe(false);
    const late: Routine = { ...routine, slots: [slot('night', 'snack', '22:00', 10)] };
    expect(plannedReminders({ ...base, routine: late, lastLogDate: null })).toEqual([]);
    expect(plannedReminders({ ...base, mealPrompt: false, lastLogDate: null })).toEqual([]);
  });
});

describe('plannedReminders: the switches and the first day', () => {
  const slots = (x: ReturnType<typeof plannedReminders>) => x.filter((r) => r.id.startsWith('slot:'));
  const away = (x: ReturnType<typeof plannedReminders>) => x.filter((r) => r.id.startsWith('away:'));

  it('with the meal-time prompt off there is no slot prompt, and the away lines still come while they are on', () => {
    const r = plannedReminders({ ...base, mealPrompt: false });
    expect(slots(r)).toEqual([]);
    expect(away(r).map((x) => x.date)).toEqual(['2026-10-14', '2026-10-15', '2026-10-16']);
  });

  it('with the away lines off and the meal-time prompt on there are slot prompts and no away lines', () => {
    const r = plannedReminders({ ...base, awayLines: false });
    expect(slots(r)).toHaveLength(2 + 3 + 3);
    expect(away(r)).toEqual([]);
  });

  it('no slot prompt on the day the person finished setup; they start the next day', () => {
    const r = slots(plannedReminders({ ...base, onboardedOn: '2026-10-12' }));
    expect(r.some((x) => x.date === '2026-10-12')).toBe(false);
    expect(r.filter((x) => x.date === '2026-10-13').map((x) => x.id)).toEqual(['slot:morning:2026-10-13', 'slot:lunch:2026-10-13', 'slot:dinner:2026-10-13']);
    expect(r).toHaveLength(3 + 3);
    // A setup day long past changes nothing.
    expect(slots(plannedReminders({ ...base, onboardedOn: '2026-09-01' }))).toHaveLength(2 + 3 + 3);
  });
});

describe('plannedReminders: absence', () => {
  const away = (x: ReturnType<typeof plannedReminders>) => x.filter((r) => r.id.startsWith('away:'));
  it('with a log today, says something on the second, third and fourth quiet day, then stops', () => {
    const r = away(plannedReminders({ ...base, mealPrompt: false }));
    expect(r.map((x) => [x.date, x.time, x.title])).toEqual([
      ['2026-10-14', '09:00', 'away_2_title'],
      ['2026-10-15', '09:00', 'away_3_title'],
      ['2026-10-16', '09:00', 'away_4_title'],
    ]);
    expect(r[0].body).toBe('away_2_body');
    expect(r[0].data).toEqual({ kind: 'away', date: '2026-10-14' });
  });

  it('counts from the last log when today has none, and never nags someone who has never logged', () => {
    const r = away(plannedReminders({ ...base, mealPrompt: false, lastLogDate: '2026-10-11' }));
    expect(r.map((x) => x.date)).toEqual(['2026-10-13', '2026-10-14', '2026-10-15']);
    expect(away(plannedReminders({ ...base, lastLogDate: null }))).toEqual([]);
    expect(away(plannedReminders({ ...base, lastLogDate: '2026-10-01' }))).toEqual([]);
  });

  it('does not count an off day as a day away: last log Saturday, Sunday off, the lines start Tuesday', () => {
    // 2026-10-10 is a Saturday; counted days after it are Monday (1), Tuesday (2), Wednesday (3), Thursday (4).
    const r = away(plannedReminders({ ...base, mealPrompt: false, lastLogDate: '2026-10-10', offDays: [0] }));
    expect(r.map((x) => [x.date, x.title])).toEqual([
      ['2026-10-13', 'away_2_title'],
      ['2026-10-14', 'away_3_title'],
      ['2026-10-15', 'away_4_title'],
    ]);
    expect(r.some((x) => x.date === '2026-10-12')).toBe(false);
  });

  it('planned on a Saturday with a log and Sunday off, says nothing on Monday', () => {
    const r = away(plannedReminders({ ...base, today: '2026-10-10', mealPrompt: false, lastLogDate: '2026-10-10', offDays: [0] }));
    expect(r.map((x) => [x.date, x.title])).toEqual([
      ['2026-10-13', 'away_2_title'],
      ['2026-10-14', 'away_3_title'],
      ['2026-10-15', 'away_4_title'],
    ]);
  });

  it('waits for quiet hours to end before the morning line', () => {
    const r = away(plannedReminders({ ...base, mealPrompt: false, quietEndHour: 10 }));
    expect(r[0].time).toBe('10:00');
  });
});

describe('plannedReminders: fill in yesterday', () => {
  const on: ReminderInput = { ...quiet, nowMinutes: 8 * 60, fillYesterday: true };

  it('at nine when yesterday is partly or not at all filled in, and tomorrow too while today is not complete', () => {
    const r = plannedReminders({ ...on, records: { '2026-10-11': 'partial', '2026-10-12': 'empty' } });
    expect(r.map((x) => [x.id, x.time, x.data])).toEqual([
      ['fill:2026-10-12', '09:00', { kind: 'fill', date: '2026-10-11' }],
      ['fill:2026-10-13', '09:00', { kind: 'fill', date: '2026-10-12' }],
    ]);
    expect(r[0]).toMatchObject({ title: 'rem_fill_title', body: 'rem_fill_body' });
    // Through nine o'clock's own minute, like the meal-time prompt.
    expect(plannedReminders({ ...on, nowMinutes: 9 * 60, records: { '2026-10-11': 'partial', '2026-10-12': 'full' } }).map((x) => x.id)).toEqual(['fill:2026-10-12']);
  });

  it('says nothing for a complete, free or unknown yesterday, once nine has passed, for the setup day or before, or with the switch off', () => {
    const partly: Record<string, DayRecordState> = { '2026-10-11': 'partial', '2026-10-12': 'partial' };
    expect(plannedReminders({ ...on, records: { '2026-10-11': 'full', '2026-10-12': 'full' } })).toEqual([]);
    expect(plannedReminders({ ...on, records: { '2026-10-11': 'off', '2026-10-12': 'full' } })).toEqual([]);
    expect(plannedReminders({ ...on, records: {} })).toEqual([]);
    expect(plannedReminders({ ...on, nowMinutes: 9 * 60 + 1, records: { '2026-10-11': 'partial', '2026-10-12': 'full' } })).toEqual([]);
    expect(plannedReminders({ ...on, onboardedOn: '2026-10-12', records: partly })).toEqual([]);
    expect(plannedReminders({ ...on, fillYesterday: false, records: partly })).toEqual([]);
  });

  it('waits for quiet hours to end', () => {
    const r = plannedReminders({ ...on, nowMinutes: 0, quietEndHour: 10, records: { '2026-10-11': 'partial', '2026-10-12': 'full' } });
    expect(r.map((x) => x.time)).toEqual(['10:00']);
  });
});

describe('plannedReminders: plan next week and the weekly report', () => {
  it('plan next week on Sunday at six, off day or not, opening next week; not for a week already saved', () => {
    expect(plannedReminders({ ...quiet, planWeek: true, offDays: [0] })).toEqual([
      { id: 'planweek:2026-10-18', date: '2026-10-18', time: '18:00', title: 'rem_planweek_title', body: 'rem_planweek_body', data: { kind: 'planweek', date: '2026-10-19' } },
    ]);
    expect(plannedReminders({ ...quiet, planWeek: true, reviewedWeeks: ['2026-10-19'] })).toEqual([]);
    expect(plannedReminders({ ...quiet, planWeek: false })).toEqual([]);
  });

  it('the report on the Monday it was worked out for, at nine', () => {
    expect(plannedReminders({ ...quiet, today: '2026-10-13', report: { monday: '2026-10-19', text: '5 of 7 full' } })).toEqual([
      { id: 'report:2026-10-19', date: '2026-10-19', time: '09:00', title: 'rem_report_title', body: '5 of 7 full', data: { kind: 'report', date: '2026-10-19' } },
    ]);
  });
});

describe('weekReport: the week before a Monday, by the rules Progress uses', () => {
  const monday = '2026-10-19';
  // Monday 12th to Sunday 18th; the 15th is complete with every meal skipped.
  const states: [string, DayRecordState, boolean][] = [
    ['2026-10-12', 'full', false],
    ['2026-10-13', 'full', false],
    ['2026-10-14', 'partial', false],
    ['2026-10-15', 'full', true],
    ['2026-10-16', 'empty', false],
    ['2026-10-17', 'full', false],
    ['2026-10-18', 'off', false],
  ];
  const byDate = new Map(states.map(([date, state, nothingEaten]): [string, DayRecord] => [date, { state, fromPlan: false, nothingEaten }]));
  const recordOn = (date: string): DayRecord => byDate.get(date) ?? { state: 'empty', fromPlan: false, nothingEaten: true };
  const meals = [
    { date: '2026-10-12', kcal: 1800 },
    { date: '2026-10-13', kcal: 1600 },
    { date: '2026-10-13', kcal: 400 },
    { date: '2026-10-14', kcal: 1000 },
    { date: '2026-10-15', kcal: 30 },
    { date: '2026-10-17', kcal: 1700 },
    { date: '2026-10-19', kcal: 900 },
  ];
  const weights = [
    { date: '2026-09-20', kg: 80 },
    { date: '2026-09-27', kg: 79.6 },
    { date: '2026-10-04', kg: 79.3 },
    { date: '2026-10-11', kg: 79 },
    { date: '2026-10-18', kg: 78.6 },
  ];
  const input = { monday, today: '2026-10-18', since: '2026-10-01', recordOn, meals, weights, goal: 1850 };

  it('counts the full days of the days that can be full, averages the complete days, and gives the weight and its change as Progress shows them', () => {
    const r = weekReport(input);
    // Full: the 12th, 13th and 17th; the 15th is complete but nothing was eaten; the free 18th cannot be full.
    // Average over the complete days 12th, 13th, 15th and 17th: (1800 + 2000 + 30 + 1700) / 4.
    expect(r).toEqual({ full: { n: 3, of: 6 }, avgKcal: 1383, goal: 1850, weight: { kg: -1, weeks: 3 } });
    expect(r!.weight).toEqual(shownWeight(weights, '2026-10-18')!.change);
  });

  it('says the week in one line', () => {
    expect(reportText(weekReport(input)!, t)).toBe('3 of 6 full · average 1,383, goal 1,850 · weight −1.0 kg in 3 weeks');
  });

  it('leaves out what it cannot say: no complete day, no change to show, no day that could be full', () => {
    const none = weekReport({ ...input, recordOn: () => ({ state: 'partial', fromPlan: false, nothingEaten: false }), weights: [{ date: '2026-10-18', kg: 78.6 }] });
    expect(none).toEqual({ full: { n: 0, of: 7 }, avgKcal: null, goal: 1850, weight: null });
    expect(reportText(none!, t)).toBe('0 of 7 full');
    // Days before the start cannot be full: a week before it says no count.
    const early = weekReport({ ...input, since: '2026-10-19' });
    expect(early!.full).toEqual({ n: 0, of: 0 });
    expect(reportText(early!, t)).toBe('weight −1.0 kg in 3 weeks');
    // A weigh-in more than thirty days old shows no change, as on Progress.
    expect(weekReport({ ...input, today: '2026-12-01' })!.weight).toBeNull();
  });

  it('has its words in English, Marathi and Hindi, the numbers in the digits the app writes', () => {
    const keys = ['prompt_title', 'prompt_body', 'rem_fill_title', 'rem_fill_body', 'rem_planweek_title', 'rem_planweek_body', 'rem_report_title', 'rem_report_full', 'rem_report_avg', 'rem_report_weight'];
    for (const lang of ['en', 'mr', 'hi'] as const) {
      const words = makeT(lang);
      for (const k of keys) expect(words(k), `${lang} ${k}`).not.toBe(k);
      const line = reportText(weekReport(input)!, words);
      expect(line, lang).toMatch(/3/);
      expect(line, lang).toMatch(/1,383/);
      expect(line, lang).toMatch(/−1\.0/);
      expect(line, lang).not.toMatch(/[\u0966-\u096F{}]/);
    }
  });

  it('says nothing for a week with no meal and no weigh-in', () => {
    expect(weekReport({ ...input, meals: [{ date: '2026-10-19', kcal: 900 }], weights: weights.filter((w) => w.date < '2026-10-12') })).toBeNull();
  });

  it('goes out on the coming Monday: today until nine has passed', () => {
    expect(reportMonday('2026-10-19', 8 * 60)).toBe('2026-10-19');
    expect(reportMonday('2026-10-19', 9 * 60)).toBe('2026-10-19');
    expect(reportMonday('2026-10-19', 10 * 60)).toBe('2026-10-26');
    expect(reportMonday('2026-10-19', 10 * 60, 11 * 60)).toBe('2026-10-19');
    expect(reportMonday('2026-10-21', 0)).toBe('2026-10-26');
    expect(reportMonday('2026-10-25', 0)).toBe('2026-10-26');
  });
});

describe('a tap on a notification', () => {
  const menu: DayMenu = {
    date: '2026-10-12',
    editedAt: '',
    meals: [
      { id: 'lunch', type: 'lunch', time: '13:00', lines: [{ foodId: 'chapati', unit: 'piece', qty: 2 }] },
      { id: 'dinner', type: 'dinner', time: '19:30', lines: [] },
    ],
  };
  const lunch = (source?: Meal['source']): Meal => ({ id: 'm1', at: new Date('2026-10-12T13:10:00').toISOString(), date: '2026-10-12', type: 'lunch', slotId: 'lunch', items: [], kcal: 300, protein: 10, source });

  it('"Ate as planned" logs the planned meal while the slot is open, and confirms the one the app filled in', () => {
    expect(promptOutcome({ menu, meals: [], skips: [], slotId: 'lunch' })).toEqual({ kind: 'log' });
    expect(promptOutcome({ menu, meals: [lunch('auto')], skips: [], slotId: 'lunch' })).toEqual({ kind: 'confirm', mealId: 'm1' });
  });

  it('does nothing for a slot eaten, skipped, or with nothing planned', () => {
    expect(promptOutcome({ menu, meals: [lunch('manual')], skips: [], slotId: 'lunch' })).toEqual({ kind: 'none' });
    expect(promptOutcome({ menu, meals: [], skips: [{ id: skipId('2026-10-12', 'lunch'), date: '2026-10-12', slotId: 'lunch' }], slotId: 'lunch' })).toEqual({ kind: 'none' });
    expect(promptOutcome({ menu, meals: [], skips: [], slotId: 'dinner' })).toEqual({ kind: 'none' });
    expect(promptOutcome({ menu, meals: [], skips: [], slotId: 'nope' })).toEqual({ kind: 'none' });
  });

  it('opens the day it is about, next week\'s plan, or Progress', () => {
    expect(tapRoute({ kind: 'slot', date: '2026-10-12', slotId: 'lunch' }, '2026-10-12')).toBe('/');
    expect(tapRoute({ kind: 'slot', date: '2026-10-13', slotId: 'lunch' }, '2026-10-12')).toBe('/?date=2026-10-13');
    expect(tapRoute({ kind: 'fill', date: '2026-10-11' }, '2026-10-12')).toBe('/?date=2026-10-11');
    expect(tapRoute({ kind: 'planweek', date: '2026-10-19' }, '2026-10-12')).toBe('/plan?date=2026-10-19');
    expect(tapRoute({ kind: 'report', date: '2026-10-19' }, '2026-10-19')).toBe('/progress');
    expect(tapRoute({ kind: 'away', date: 'soon' }, '2026-10-12')).toBe('/');
    expect(tapRoute({ kind: 'fill', date: '2026-02-30' }, '2026-10-12')).toBe('/');
    expect(tapRoute({ kind: 'planweek', date: 7 }, '2026-10-12')).toBe('/plan');
    expect(tapRoute({}, '2026-10-12')).toBe('/');
  });
});

describe('days away', () => {
  it('counts days between dates and since the last log', () => {
    expect(daysBetween('2026-10-01', '2026-10-04')).toBe(3);
    expect(lastLogDate([meal('2026-10-03'), meal('2026-10-01')], '2026-10-12')).toBe('2026-10-03');
    expect(lastLogDate([meal('2026-10-20')], '2026-10-12')).toBeNull();
    expect(daysAway([meal('2026-10-09')], '2026-10-12')).toBe(3);
    expect(daysAway([meal('2026-10-12')], '2026-10-12')).toBe(0);
    expect(daysAway([], '2026-10-12')).toBe(0);
  });

  it('leaves off days out of the count, so an off Sunday is not a day away on Monday', () => {
    expect(missedDays('2026-10-10', '2026-10-12', [0])).toBe(1);
    expect(missedDays('2026-10-10', '2026-10-12', [])).toBe(2);
    expect(missedDays('2026-10-12', '2026-10-12', [])).toBe(0);
    expect(daysAway([meal('2026-10-10')], '2026-10-12', [0])).toBe(1);
    expect(daysAway([meal('2026-10-10')], '2026-10-12', [])).toBe(2);
  });
});

describe('dailyReminders', () => {
  const day = { active: true, sleepCheckin: true, water: true, dayReview: true, quietStartHour: 22, quietEndHour: 7, mantra: 'Steady.', breaks: DEFAULT_BREAK_SETTINGS, nowMs: 0, t };
  const longs = (x: ReturnType<typeof dailyReminders>) => x.filter((r) => r.id.startsWith('sobat-long-break'));
  const at = (r: { hour: number; minute: number }) => `${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')}`;
  const ids = (x: ReturnType<typeof dailyReminders>) => x.filter((r) => !r.id.startsWith('sobat-long-break')).map((r) => `${r.id} ${at(r)}`);

  it('a device that is signed out or reset keeps no daily reminders at all', () => {
    expect(dailyReminders({ ...day, active: false })).toEqual([]);
  });

  it('the long-break reminder never falls in quiet hours: hourly from the end of the night to the start of the next', () => {
    const r = longs(dailyReminders(day));
    expect(r.map(at)).toEqual(['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00']);
    expect(r[0]).toMatchObject({ title: 'brk_long', body: 'brk_long_hint' });
    expect(new Set(r.map((x) => x.id)).size).toBe(r.length);
  });

  it('the app\'s own quiet hours hold it back too', () => {
    const r = longs(dailyReminders({ ...day, quietStartHour: 20, quietEndHour: 9 }));
    expect(r.map(at)[0]).toBe('09:00');
    expect(r.every((x) => x.hour >= 9 && x.hour < 20)).toBe(true);
  });

  it('none while breaks are off, paused, or kept to a work schedule a daily reminder cannot follow', () => {
    expect(longs(dailyReminders({ ...day, breaks: { ...DEFAULT_BREAK_SETTINGS, enabled: false } }))).toEqual([]);
    expect(longs(dailyReminders({ ...day, breaks: { ...DEFAULT_BREAK_SETTINGS, long: { ...DEFAULT_BREAK_SETTINGS.long, enabled: false } } }))).toEqual([]);
    expect(longs(dailyReminders({ ...day, nowMs: 1000, breaks: { ...DEFAULT_BREAK_SETTINGS, pausedUntilMs: 5000 } }))).toEqual([]);
    expect(longs(dailyReminders({ ...day, breaks: { ...DEFAULT_BREAK_SETTINGS, schedule: { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 18 } } }))).toEqual([]);
  });

  it('keeps the fixed day, each reminder with its own switch: check-in, the day\'s line, water and the recap', () => {
    expect(ids(dailyReminders(day))).toEqual(['sobat-sleep-checkin 07:30', 'sobat-mantra 08:00', 'sobat-water 15:00', 'sobat-day-review 21:30']);
    expect(ids(dailyReminders({ ...day, mantra: '' }))).toEqual(['sobat-sleep-checkin 07:30', 'sobat-water 15:00', 'sobat-day-review 21:30']);
    expect(ids(dailyReminders({ ...day, sleepCheckin: false, water: false, dayReview: false }))).toEqual(['sobat-mantra 08:00']);
    expect(ids(dailyReminders({ ...day, sleepCheckin: false, water: true, dayReview: false, mantra: '' }))).toEqual(['sobat-water 15:00']);
  });

  it('never holds the old dinner reminder: the pattern is always on and its dinner slot asks; the id stays known so a device that holds it cancels it', () => {
    for (const quietStartHour of [20, 22, 23]) expect(dailyReminders({ ...day, quietStartHour }).some((r) => r.id === DAILY_IDS.dinner)).toBe(false);
    expect(Object.values(DAILY_IDS)).toContain('sobat-dinner');
  });
});
