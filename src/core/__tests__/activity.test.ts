import { describe, expect, it } from 'vitest';
import { ACTIVITIES, activityById } from '../../data/activities';
import { activitiesFor, eatBack, fatGrams, kcalBurned, weekActivity } from '../activity';
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
