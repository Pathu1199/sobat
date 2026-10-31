import { describe, expect, it } from 'vitest';
import { makeT } from '../../i18n';
import {
  CHALLENGE_IDS_KEEP_DAYS,
  CHALLENGE_MEDALS,
  challengeWinId,
  earnedMedals,
  medalFace,
  medalWords,
  MEDALS_SEEDED,
  nextMedals,
  nextWin,
  shelf,
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
      { id: 'medal:week:yoga:2026-10-19', track: 'week', n: 1, name: 'Yoga' },
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
});

describe('the words', () => {
  const t = makeT('en');

  it('names a medal and says what it took', () => {
    expect(medalWords({ track: 'routine', n: 21 }, t)).toEqual({ title: '21 days of your routine in a row', line: 'Showing up, day after day. This is how a routine becomes who you are.' });
    expect(medalWords({ track: 'week', n: 1, name: 'Yoga' }, t).title).toBe('Perfect week: Yoga');
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

  it('then celebrates each medal once, smallest first, then the day’s challenge, and waits while something is open', () => {
    const celebrated = [MEDALS_SEEDED, 'medal:meals:3'];
    expect(nextWin({ medals, challengeDone: true, today: TODAY, celebrated }).next).toEqual({ id: 'medal:meals:7', kind: 'medal', medal: medals[1] });
    expect(nextWin({ medals, challengeDone: true, today: TODAY, celebrated: [...celebrated, 'medal:meals:7'] }).next).toEqual({ id: 'challenge:day:2026-10-31', kind: 'challenge', date: TODAY });
    expect(nextWin({ medals, challengeDone: true, today: TODAY, celebrated: [...celebrated, 'medal:meals:7', 'challenge:day:2026-10-31'] }).next).toBeNull();
    expect(nextWin({ medals, challengeDone: true, today: TODAY, celebrated, waiting: true })).toEqual({ seed: null, next: null });
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
