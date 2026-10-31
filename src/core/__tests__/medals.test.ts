import { describe, expect, it } from 'vitest';
import { makeT } from '../../i18n';
import { perfectWeeks } from '../perfect';
import type { AbhyasItem, AbhyasTick } from '../types';
import {
  CHALLENGE_IDS_KEEP_DAYS,
  CHALLENGE_MEDALS,
  challengeWinId,
  earnedMedals,
  medalFace,
  medalWords,
  medalInput,
  MEDALS_SEEDED,
  namesOfJobs,
  nextMedals,
  nextWin,
  shelf,
  shelfSpoken,
  shelfWords,
  STREAK_MEDALS,
  withCelebrated,
  type MedalInput,
} from '../medals';

const TODAY = '2026-10-31';
const none: MedalInput = { meals: { now: 0, best: 0 }, routine: null, lostKg: 0, totalKg: 10, weeks: [], challengesDone: 0, celebrated: [MEDALS_SEEDED] };
const ids = (input: MedalInput) => earnedMedals(input).map((m) => m.id);

describe('earnedMedals', () => {
  it('earns the streak medals at 3, 7, 21, 30, 66 and 100 days, by the best run with the shield, for the meals and for the routine', () => {
    expect(STREAK_MEDALS).toEqual([3, 7, 21, 30, 66, 100]);
    expect(ids({ ...none, meals: { now: 2, best: 8 } })).toEqual(['medal:meals:3', 'medal:meals:7']);
    expect(ids({ ...none, routine: { now: 21, best: 21 } })).toEqual(['medal:routine:3', 'medal:routine:7', 'medal:routine:21']);
    // No list: no routine medals, whatever was passed.
    expect(ids({ ...none, routine: null })).toEqual([]);
  });

  it('earns a medal for each kilo lost from the very first start, halfway and the goal; none with no loss to aim for', () => {
    expect(ids({ ...none, lostKg: 5.2 })).toEqual(['medal:kg:1', 'medal:kg:2', 'medal:kg:3', 'medal:kg:4', 'medal:kg:5', 'medal:halfway']);
    expect(ids({ ...none, lostKg: 10 })).toContain('medal:goal');
    expect(ids({ ...none, lostKg: 0.9 })).toEqual([]);
    expect(ids({ ...none, lostKg: 3, totalKg: 0 })).toEqual([]);
  });

  it('earns a medal for each perfect week of a job, and the challenge medals at 10, 30 and 100', () => {
    expect(CHALLENGE_MEDALS).toEqual([10, 30, 100]);
    const weeks = [{ itemId: 'yoga', monday: '2026-10-19', name: 'Yoga' }];
    expect(earnedMedals({ ...none, weeks, challengesDone: 31 })).toEqual([
      { id: 'medal:week:yoga:2026-10-19', track: 'week', n: 1, itemId: 'yoga', monday: '2026-10-19', name: 'Yoga' },
      { id: 'medal:challenges:10', track: 'challenges', n: 10 },
      { id: 'medal:challenges:30', track: 'challenges', n: 30 },
    ]);
  });

  it('keeps a medal once celebrated, after the run ended or the kilo came back, and counts the old badges as the medals they became', () => {
    const celebrated = [MEDALS_SEEDED, 'medal:meals:21', 'medal:kg:3', 'badge:streak_30', 'badge:kg_5', 'badge:summit'];
    expect(ids({ ...none, celebrated })).toEqual(['medal:meals:21', 'medal:meals:30', 'medal:kg:3', 'medal:kg:5', 'medal:goal']);
    // The badges retired with no medal of their own earn nothing.
    expect(ids({ ...none, celebrated: [MEDALS_SEEDED, 'badge:first_meal', 'badge:water_7', 'level:camp2', 'challenge:2026-10-25'] })).toEqual([]);
  });

  it('counts a streak, kilo or halfway badge already won as the medal it became, one by one', () => {
    expect(ids({ ...none, celebrated: [MEDALS_SEEDED, 'badge:streak_7'] })).toEqual(['medal:meals:7']);
    expect(ids({ ...none, celebrated: [MEDALS_SEEDED, 'badge:kg_1'] })).toEqual(['medal:kg:1']);
    expect(ids({ ...none, celebrated: [MEDALS_SEEDED, 'badge:halfway'] })).toEqual(['medal:halfway']);
  });

  it('never loops for ever on a kilo count that is not a number, and stops at 300 kilos', () => {
    for (const lostKg of [Number.NaN, Infinity, -Infinity]) expect(ids({ ...none, lostKg })).toEqual([]);
    expect(ids({ ...none, lostKg: Infinity, totalKg: Infinity })).toEqual([]);
    const huge = ids({ ...none, lostKg: 1e12 });
    expect(huge.filter((id) => id.startsWith('medal:kg:'))).toHaveLength(300);
    expect(huge).toContain('medal:kg:300');
    expect(huge).toContain('medal:goal');
    // A kilo medal already celebrated stays, beyond the cap too.
    expect(ids({ ...none, celebrated: [MEDALS_SEEDED, 'medal:kg:301'] })).toEqual(['medal:kg:301']);
  });

  describe('a perfect week, kept once celebrated', () => {
    const id = 'medal:week:yoga:2026-10-19';
    const kept = { ...none, celebrated: [MEDALS_SEEDED, id] };

    it('stays on the shelf after the rule no longer holds, with the job\'s name from its live job', () => {
      expect(earnedMedals({ ...kept, jobNames: { yoga: 'Yoga' } })).toEqual([{ id, track: 'week', n: 1, itemId: 'yoga', monday: '2026-10-19', name: 'Yoga' }]);
    });

    it('stays when the job gains a day it was not done on, and when the job is edited', () => {
      const created = new Date('2026-10-12T06:00:00').toISOString();
      const yoga: AbhyasItem = { id: 'yoga', name: 'Yoga', icon: 'book-outline', kind: 'repeat', days: [1, 3, 5], times: [], order: 0, createdAt: created };
      const done = ['2026-10-19', '2026-10-21', '2026-10-23'].map((date): AbhyasTick => ({ id: `yoga@${date}`, itemId: 'yoga', date, at: `${date}T07:00:00.000Z` }));
      const data = { items: [yoga], ticks: done, sessions: [] };
      const week = (items: AbhyasItem[]) => perfectWeeks({ ...data, items }, '2026-10-28').map((w) => ({ ...w, name: 'Yoga' }));
      expect(week([yoga])).toEqual([{ itemId: 'yoga', monday: '2026-10-19', name: 'Yoga' }]);
      expect(ids({ ...kept, weeks: week([yoga]) })).toEqual([id]);
      // A day added to the job: that week was not done on it, so the rule drops the week, and the medal stays.
      const longer = [{ ...yoga, days: [1, 3, 5, 6] }];
      expect(week(longer)).toEqual([]);
      expect(ids({ ...kept, weeks: week(longer) })).toEqual([id]);
      // Without having been celebrated it is gone with the rule.
      expect(ids({ ...none, weeks: week(longer) })).toEqual([]);
    });

    it('names a job removed from the list from its archived copy, in the one place of the week, and the medals sort by week', () => {
      const created = new Date('2026-10-12T06:00:00').toISOString();
      const old: AbhyasItem = { id: 'yoga', name: 'Morning yoga', icon: 'book-outline', kind: 'repeat', days: [1, 3, 5], times: [], order: 0, createdAt: created, archivedAt: new Date('2026-10-27T09:00:00').toISOString() };
      const live: AbhyasItem = { ...old, id: 'read', name: 'Reading', order: 1, archivedAt: undefined };
      const names = namesOfJobs([old, live]);
      expect(names).toEqual({ yoga: 'Morning yoga', read: 'Reading' });
      const celebrated = [MEDALS_SEEDED, 'medal:week:read:2026-10-26', id, 'medal:week:yoga:2026-10-12'];
      const out = earnedMedals({ ...none, celebrated, jobNames: names });
      expect(out.map((m) => [m.id, m.name, m.itemId, m.monday])).toEqual([
        ['medal:week:yoga:2026-10-12', 'Morning yoga', 'yoga', '2026-10-12'],
        ['medal:week:yoga:2026-10-19', 'Morning yoga', 'yoga', '2026-10-19'],
        ['medal:week:read:2026-10-26', 'Reading', 'read', '2026-10-26'],
      ]);
    });

    it('has no name for a job that is gone from the list, and the shelf and the words still work', () => {
      const out = earnedMedals(kept);
      expect(out).toEqual([{ id, track: 'week', n: 1, itemId: 'yoga', monday: '2026-10-19' }]);
      const tiles = shelf(kept);
      expect(tiles[0]).toEqual({ key: 'week:yoga', track: 'week', n: 1, earned: true, count: 1 });
      expect(medalWords(out[0], makeT('en')).title).toBe('Perfect week');
      expect(shelfWords(tiles[0], makeT('en'))).toEqual({ label: 'Perfect week', sub: null });
    });

    it('takes the name of a week still earned by the rule, whatever the lookup holds, and keeps an item id with a colon in it whole', () => {
      const weeks = [{ itemId: 'yoga', monday: '2026-10-19', name: 'Yoga' }];
      expect(earnedMedals({ ...kept, weeks, jobNames: { yoga: 'Old name' } })).toEqual([{ id, track: 'week', n: 1, itemId: 'yoga', monday: '2026-10-19', name: 'Yoga' }]);
      const odd = earnedMedals({ ...none, celebrated: [MEDALS_SEEDED, 'medal:week:a:b:2026-10-19'], jobNames: { 'a:b': 'Odd' } });
      expect(odd).toEqual([{ id: 'medal:week:a:b:2026-10-19', track: 'week', n: 1, itemId: 'a:b', monday: '2026-10-19', name: 'Odd' }]);
    });
  });
});

describe('medalInput', () => {
  const base = {
    lifetimeStreak: { now: 4, best: 9 },
    routine: { now: 2, best: 5 },
    jobs: [{}],
    firstStartWeightKg: undefined,
    planStartKg: 90,
    currentKg: 86.04,
    goalWeightKg: 80,
    weeks: [],
    jobNames: {},
    challengesDone: 12,
    celebrated: [MEDALS_SEEDED],
  };

  it('counts the meal medals on the streak over the whole journey, not a new chapter’s', () => {
    expect(medalInput(base).meals).toEqual({ now: 4, best: 9 });
    expect(medalInput({ ...base, lifetimeStreak: { now: 1, best: 21 } }).meals).toEqual({ now: 1, best: 21 });
  });

  it('runs the kilos from the very first start when one is kept, else from the start the plan shows, to the weight shown and to the goal', () => {
    // The plan shows a chapter's start (90); the very first start was 98.7.
    expect(medalInput({ ...base, firstStartWeightKg: 98.7 })).toMatchObject({ lostKg: 12.7, totalKg: 18.7 });
    expect(medalInput(base)).toMatchObject({ lostKg: 4, totalKg: 10 });
    expect(medalInput({ ...base, firstStartWeightKg: 98.7 }).lostKg).toBeGreaterThan(medalInput(base).lostKg);
  });

  it('gives the routine medals a streak only while the list holds a job that is not removed', () => {
    expect(medalInput(base).routine).toEqual({ now: 2, best: 5 });
    expect(medalInput({ ...base, jobs: [{ archivedAt: '2026-10-20T04:00:00.000Z' }, {}] }).routine).toEqual({ now: 2, best: 5 });
    expect(medalInput({ ...base, jobs: [{ archivedAt: '2026-10-20T04:00:00.000Z' }] }).routine).toBeNull();
    expect(medalInput({ ...base, jobs: [] }).routine).toBeNull();
  });

  it('earns no routine medal by rule with every job removed, and keeps one already celebrated', () => {
    const removed = [{ archivedAt: '2026-10-20T04:00:00.000Z' }];
    const strong = { ...base, routine: { now: 30, best: 30 }, jobs: removed };
    expect(earnedMedals(medalInput(strong)).map((m) => m.track)).not.toContain('routine');
    const kept = medalInput({ ...strong, celebrated: [MEDALS_SEEDED, 'medal:routine:7'] });
    expect(earnedMedals(kept).filter((m) => m.track === 'routine').map((m) => m.id)).toEqual(['medal:routine:7']);
  });

  it('passes the weeks, the names, the challenges and the celebrated ids through as they are', () => {
    const weeks = [{ itemId: 'yoga', monday: '2026-10-19', name: 'Yoga' }];
    const out = medalInput({ ...base, weeks, jobNames: { yoga: 'Yoga' }, celebrated: null });
    expect(out).toMatchObject({ weeks, jobNames: { yoga: 'Yoga' }, challengesDone: 12, celebrated: null });
  });
});

describe('nextMedals', () => {
  it("gives each track's next medal with how far it is: days from the streak now, kilos to one decimal, challenges", () => {
    const input = { ...none, meals: { now: 5, best: 8 }, routine: { now: 2, best: 2 }, lostKg: 3.6, challengesDone: 4 };
    expect(nextMedals(input, earnedMedals(input))).toEqual([
      { id: 'medal:meals:21', track: 'meals', n: 21, toGo: 16 },
      { id: 'medal:routine:3', track: 'routine', n: 3, toGo: 1 },
      { id: 'medal:kg:4', track: 'kg', n: 4, toGo: 0.4 },
      { id: 'medal:halfway', track: 'halfway', n: 1, toGo: 1.4 },
      { id: 'medal:goal', track: 'goal', n: 1, toGo: 6.4 },
      { id: 'medal:challenges:10', track: 'challenges', n: 10, toGo: 6 },
    ]);
  });

  it('has none for a track done, the routine with no list, or kilos with no goal', () => {
    const input = { ...none, meals: { now: 100, best: 100 }, challengesDone: 100, totalKg: 0 };
    expect(nextMedals(input, earnedMedals(input))).toEqual([]);
  });
});

describe('shelf', () => {
  it('shows the medals earned, the kilos as the highest, perfect weeks as one per job with how many, then the next of each track', () => {
    const weeks = [
      { itemId: 'yoga', monday: '2026-10-12', name: 'Yoga' },
      { itemId: 'yoga', monday: '2026-10-19', name: 'Yoga' },
    ];
    const tiles = shelf({ ...none, meals: { now: 7, best: 7 }, lostKg: 2.3, weeks, totalKg: 4 });
    expect(tiles.map((x) => x.key)).toEqual([
      'medal:meals:3',
      'medal:meals:7',
      'medal:kg',
      'medal:halfway',
      'week:yoga',
      'next:medal:meals:21',
      'next:medal:kg:3',
      'next:medal:goal',
      'next:medal:challenges:10',
    ]);
    expect(tiles.find((x) => x.key === 'medal:kg')).toEqual({ key: 'medal:kg', track: 'kg', n: 2, earned: true });
    expect(tiles.find((x) => x.key === 'week:yoga')).toEqual({ key: 'week:yoga', track: 'week', n: 1, earned: true, name: 'Yoga', count: 2 });
  });

  it('keeps a job\'s kept and current perfect weeks as one place, grouped by the job and not by reading its id', () => {
    const weeks = [{ itemId: 'a:b', monday: '2026-10-19', name: 'Odd' }];
    const celebrated = [MEDALS_SEEDED, 'medal:week:a:b:2026-10-12'];
    const tiles = shelf({ ...none, weeks, celebrated, jobNames: { 'a:b': 'Odd' } });
    expect(tiles.filter((x) => x.track === 'week')).toEqual([{ key: 'week:a:b', track: 'week', n: 1, earned: true, name: 'Odd', count: 2 }]);
  });
});

describe('the words', () => {
  const t = makeT('en');

  it('names a medal and says what it took', () => {
    expect(medalWords({ track: 'routine', n: 21 }, t)).toEqual({ title: '21 days of your routine in a row', line: 'Showing up, day after day. This is how a routine becomes who you are.' });
    expect(medalWords({ track: 'week', n: 1, name: 'Yoga' }, t).title).toBe('Perfect week: Yoga');
    expect(medalWords({ track: 'week', n: 1 }, t).title).toBe('Perfect week');
    expect(medalWords({ track: 'week', n: 1, name: 'योग' }, makeT('hi')).title).toBe('शानदार हफ़्ता: योग');
    expect(medalWords({ track: 'week', n: 1 }, makeT('hi')).title).toBe('शानदार हफ़्ता');
    expect(medalWords({ track: 'week', n: 1 }, makeT('mr')).title).toBe('परिपूर्ण आठवडा');
    expect(medalWords({ track: 'goal', n: 1 }, t).title).toBe('Goal reached');
    expect(medalWords({ track: 'challenges', n: 10 }, makeT('mr')).title).toBe('10 आव्हानं पूर्ण');
  });

  it('labels a shelf place, with its track and how far one still to earn is', () => {
    expect(shelfWords({ key: 'k', track: 'meals', n: 7, earned: true }, t)).toEqual({ label: '7 days', sub: 'Meals' });
    expect(shelfWords({ key: 'k', track: 'routine', n: 30, earned: false, toGo: 9 }, t)).toEqual({ label: '30 days', sub: 'Routine · 9 to go' });
    expect(shelfWords({ key: 'k', track: 'halfway', n: 1, earned: false, toGo: 1.4 }, t)).toEqual({ label: 'Halfway to your goal', sub: '1.4 kg to go' });
    expect(shelfWords({ key: 'k', track: 'week', n: 1, earned: true, name: 'Yoga', count: 3 }, t)).toEqual({ label: 'Perfect week: Yoga', sub: '×3' });
    expect(shelfWords({ key: 'k', track: 'kg', n: 4, earned: true }, makeT('hi'))).toEqual({ label: '4 किलो कम', sub: null });
  });

  it('says a shelf place to a screen reader with commas and whether it is earned or not yet, in every language', () => {
    expect(shelfSpoken({ key: 'k', track: 'meals', n: 7, earned: true }, t)).toBe('7 days, Meals, earned');
    expect(shelfSpoken({ key: 'k', track: 'routine', n: 30, earned: false, toGo: 9 }, t)).toBe('30 days, Routine, 9 to go, not yet');
    expect(shelfSpoken({ key: 'k', track: 'halfway', n: 1, earned: false, toGo: 1.4 }, t)).toBe('Halfway to your goal, 1.4 kg to go, not yet');
    expect(shelfSpoken({ key: 'k', track: 'week', n: 1, earned: true, name: 'Yoga', count: 3 }, t)).toBe('Perfect week: Yoga, ×3, earned');
    expect(shelfSpoken({ key: 'k', track: 'kg', n: 4, earned: true }, makeT('hi'))).toBe('4 किलो कम, मिला');
    expect(shelfSpoken({ key: 'k', track: 'kg', n: 5, earned: false, toGo: 1 }, makeT('mr'))).toBe('5 किलो कमी, अजून 1 किलो, अजून नाही');
    // No dot between the parts: the dot on screen is not a word.
    for (const lang of ['en', 'mr', 'hi'] as const) expect(shelfSpoken({ key: 'k', track: 'routine', n: 30, earned: false, toGo: 9 }, makeT(lang))).not.toContain('·');
  });

  it('puts a number, ½, ★ or ✓ on the face', () => {
    expect([medalFace('meals', 21), medalFace('halfway', 1), medalFace('goal', 1), medalFace('week', 1), medalFace('kg', 3)]).toEqual(['21', '½', '★', '✓', '3']);
  });
});

describe('nextWin', () => {
  const medals = earnedMedals({ ...none, meals: { now: 7, best: 7 } });

  it('the first time, or coming from the badges, marks everything already earned seen and celebrates nothing', () => {
    expect(nextWin({ medals, challengeDone: true, today: TODAY, celebrated: null })).toEqual({ seed: [MEDALS_SEEDED, 'medal:meals:3', 'medal:meals:7', challengeWinId(TODAY)], next: null });
    expect(nextWin({ medals, challengeDone: false, today: TODAY, celebrated: ['badge:first_meal', 'level:camp1'] }).seed).toEqual([MEDALS_SEEDED, 'medal:meals:3', 'medal:meals:7']);
  });

  it('seeds the first run even while the add sheet or an Undo is open: marking says nothing, so only the celebrating waits', () => {
    const waiting = nextWin({ medals, challengeDone: true, today: TODAY, celebrated: null, waiting: true });
    expect(waiting).toEqual({ seed: [MEDALS_SEEDED, 'medal:meals:3', 'medal:meals:7', challengeWinId(TODAY)], next: null });
    expect(nextWin({ medals, challengeDone: true, today: TODAY, celebrated: null }).seed).toEqual(waiting.seed);
  });

  it('then celebrates each medal once, smallest first, then the day’s challenge, and waits while something is open', () => {
    const celebrated = [MEDALS_SEEDED, 'medal:meals:3'];
    expect(nextWin({ medals, challengeDone: true, today: TODAY, celebrated }).next).toEqual({ id: 'medal:meals:7', kind: 'medal', medal: medals[1] });
    expect(nextWin({ medals, challengeDone: true, today: TODAY, celebrated: [...celebrated, 'medal:meals:7'] }).next).toEqual({ id: 'challenge:day:2026-10-31', kind: 'challenge', date: TODAY });
    expect(nextWin({ medals, challengeDone: true, today: TODAY, celebrated: [...celebrated, 'medal:meals:7', 'challenge:day:2026-10-31'] }).next).toBeNull();
    expect(nextWin({ medals, challengeDone: true, today: TODAY, celebrated, waiting: true })).toEqual({ seed: null, next: null });
  });

  describe('a perfect week that turns up late', () => {
    const MONDAY = '2026-10-26';
    const seeded = [MEDALS_SEEDED];
    const weeksOf = (mondays: string[]) => mondays.map((monday) => ({ itemId: 'yoga', monday, name: 'Yoga' }));
    const weekId = (monday: string) => `medal:week:yoga:${monday}`;

    it('is marked seen and never celebrated when its week ended more than seven days ago, however many come at once', () => {
      const old = ['2026-09-07', '2026-09-14', '2026-10-05', '2026-10-12'];
      const weekMedals = earnedMedals({ ...none, weeks: weeksOf(old) });
      const first = nextWin({ medals: weekMedals, challengeDone: false, today: MONDAY, celebrated: seeded });
      expect(first.next).toBeNull();
      expect(first.seed).toEqual(old.map(weekId));
      // Marked, nothing is left to say or to mark.
      expect(nextWin({ medals: weekMedals, challengeDone: false, today: MONDAY, celebrated: [...seeded, ...first.seed!] })).toEqual({ seed: null, next: null });
      // It is marked even while something else is open on screen: marking says nothing.
      expect(nextWin({ medals: weekMedals, challengeDone: false, today: MONDAY, celebrated: seeded, waiting: true })).toEqual({ seed: old.map(weekId), next: null });
    });

    it('is celebrated once when its week ended yesterday, or seven days ago exactly, and the old ones beside it are only marked', () => {
      const weekMedals = earnedMedals({ ...none, weeks: weeksOf(['2026-09-07', '2026-10-19']) });
      const first = nextWin({ medals: weekMedals, challengeDone: false, today: MONDAY, celebrated: seeded });
      expect(first.seed).toEqual([weekId('2026-09-07')]);
      expect(first.next).toEqual({ id: weekId('2026-10-19'), kind: 'medal', medal: weekMedals[1] });
      const after = [...seeded, ...first.seed!, weekId('2026-10-19')];
      expect(nextWin({ medals: weekMedals, challengeDone: false, today: MONDAY, celebrated: after })).toEqual({ seed: null, next: null });
      // The week of the 12th ended on Sunday the 18th: seven days before the 25th, still celebrated; the day after it is not.
      const twelfth = earnedMedals({ ...none, weeks: weeksOf(['2026-10-12']) });
      expect(nextWin({ medals: twelfth, challengeDone: false, today: '2026-10-25', celebrated: seeded })).toEqual({ seed: null, next: { id: weekId('2026-10-12'), kind: 'medal', medal: twelfth[0] } });
      expect(nextWin({ medals: twelfth, challengeDone: false, today: '2026-10-26', celebrated: seeded })).toEqual({ seed: [weekId('2026-10-12')], next: null });
    });

    it('does not mark a week already celebrated again, and leaves the first run to the one seed', () => {
      const old = earnedMedals({ ...none, weeks: weeksOf(['2026-09-07']) });
      expect(nextWin({ medals: old, challengeDone: false, today: MONDAY, celebrated: [...seeded, weekId('2026-09-07')] })).toEqual({ seed: null, next: null });
      expect(nextWin({ medals: old, challengeDone: false, today: MONDAY, celebrated: null })).toEqual({ seed: [MEDALS_SEEDED, weekId('2026-09-07')], next: null });
    });
  });
});

describe('withCelebrated', () => {
  it('adds the ids once each and drops the days’ challenges older than a fortnight, keeping everything else', () => {
    expect(CHALLENGE_IDS_KEEP_DAYS).toBe(14);
    const before = [MEDALS_SEEDED, 'badge:streak_7', 'challenge:2026-09-06', 'challenge:day:2026-10-16', 'challenge:day:2026-10-17'];
    expect(withCelebrated(before, ['medal:meals:3', 'badge:streak_7'], TODAY)).toEqual([MEDALS_SEEDED, 'badge:streak_7', 'challenge:2026-09-06', 'challenge:day:2026-10-17', 'medal:meals:3']);
    expect(withCelebrated(null, ['x'], TODAY)).toEqual(['x']);
  });
});
