import { describe, expect, it, vi } from 'vitest';
import { ACTIVITIES, activityById } from '../../data/activities';
import { activitiesFor, burnedOn, eatBack, fatGrams, kcalBurned, WALK_ACTIVITY_ID, walkLog, weekActivity } from '../activity';
import type { ActivityLog } from '../types';

const walk = activityById('walk')!;
const run = activityById('run')!;

describe('activity', () => {
  it('burns by MET × kg × hours: a 30-minute normal walk at 95 kg is about 180 kcal', () => {
    // 3.8 MET × 95 kg × 0.5 h = 180.5
    expect(kcalBurned(walk, 1, 30, 95)).toBe(181);
    expect(kcalBurned(walk, 0, 30, 95)).toBeLessThan(kcalBurned(walk, 2, 30, 95));
    expect(fatGrams(770)).toBe(100);
  });

  it('eats back half the burn, up to a cap', () => {
    expect(eatBack(200)).toBe(100);
    expect(eatBack(2000)).toBe(400);
  });

  it('counts the week the WHO way: vigorous minutes count double', () => {
    const logs: ActivityLog[] = [
      { id: 'a', date: '2026-10-05', at: '', activityId: 'walk', minutes: 30, intensity: 1, kcal: 181 },
      { id: 'b', date: '2026-10-06', at: '', activityId: 'run', minutes: 20, intensity: 1, kcal: 295 },
      { id: 'c', date: '2026-09-30', at: '', activityId: 'walk', minutes: 60, intensity: 1, kcal: 361 },
    ];
    const w = weekActivity(logs, '2026-10-07', 0); // week starts Sunday 2026-10-04
    expect(w.rawMinutes).toBe(50);
    expect(w.minutes).toBe(70);
    expect(w.activeDays).toBe(2);
    expect(w.kcal).toBe(476);
    expect(w.byActivity[0].id).toBe('walk');
  });

  it('has a MET for every effort of every activity, and hides high-impact ones on request', () => {
    for (const a of ACTIVITIES) {
      expect(a.met).toHaveLength(3);
      expect(a.met[0]).toBeLessThanOrEqual(a.met[1]);
      expect(a.met[1]).toBeLessThanOrEqual(a.met[2]);
      expect(a.name_mr.length).toBeGreaterThan(0);
    }
    expect(activitiesFor({ lowImpactOnly: true }).every((a) => a.impact === 'low')).toBe(true);
    expect(activitiesFor({ lowImpactOnly: true }).some((a) => a.id === 'run')).toBe(false);
    expect(run.impact).toBe('high');
  });
});

describe('walkLog', () => {
  it('a walk tap is a normal-effort walk that the earned calories count the usual way', () => {
    const now = new Date('2026-10-27T18:05:00');
    const log = walkLog({ id: 'w1', date: '2026-10-27', minutes: 10, weightKg: 80, now });
    expect(log).toMatchObject({ id: 'w1', date: '2026-10-27', activityId: 'walk', minutes: 10, intensity: 1, kcal: kcalBurned(walk, 1, 10, 80) });
    expect(log.at).toBe(now.toISOString());
    expect(burnedOn([log], '2026-10-27')).toBe(log.kcal);
    expect(eatBack(burnedOn([log, { ...log, id: 'w2' }], '2026-10-27'))).toBe(eatBack(2 * log.kcal));
  });

  it('a walk added to an earlier day is placed at noon of that day', () => {
    const log = walkLog({ id: 'w1', date: '2026-10-25', minutes: 10, weightKg: 80, now: new Date('2026-10-27T18:05:00') });
    expect(log.at).toBe(new Date('2026-10-25T12:00:00').toISOString());
  });

  it('logs the walking activity, which the activity list holds', () => {
    const a = activityById(WALK_ACTIVITY_ID);
    expect(a).toBeDefined();
    expect(a!.id).toBe(WALK_ACTIVITY_ID);
    expect(a!.category).toBe('walk');
  });

  it('never logs another activity in its place: with no walking activity in the list it fails as it loads, saying so, not inside a tap', async () => {
    vi.resetModules();
    vi.doMock('../../data/activities', async (importOriginal) => {
      const real = await importOriginal<typeof import('../../data/activities')>();
      const list = real.ACTIVITIES.filter((a) => a.id !== WALK_ACTIVITY_ID);
      return { ...real, ACTIVITIES: list, activityById: (id: string) => list.find((a) => a.id === id) };
    });
    try {
      await expect(import('../activity')).rejects.toThrow(/walk/i);
    } finally {
      vi.doUnmock('../../data/activities');
      vi.resetModules();
    }
  });
});
