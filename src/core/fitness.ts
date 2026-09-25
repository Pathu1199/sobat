import type { Exercise, SleepLog, WorkoutLog } from './types';

export type Readiness = { score: number; level: 'green' | 'yellow' | 'red'; reasons: string[] };

/**
 * How hard today should be. Built from sleep, how the last session felt,
 * and mood. A bad night makes the plan easier instead of louder.
 */
export function readiness(input: {
  lastSleep?: SleepLog;
  lastWorkout?: WorkoutLog;
  moodScore?: number;
  soreness?: number;
}): Readiness {
  let score = 70;
  const reasons: string[] = [];

  if (input.lastSleep) {
    if (input.lastSleep.minutes < 360) {
      score -= 25;
      reasons.push('short_sleep');
    } else if (input.lastSleep.minutes >= 420) {
      score += 10;
      reasons.push('good_sleep');
    }
    if (input.lastSleep.energy <= 2) {
      score -= 10;
      reasons.push('low_energy');
    }
  }

  if (input.lastWorkout?.pain) {
    score -= 25;
    reasons.push('pain_reported');
  }
  if (input.lastWorkout?.felt && input.lastWorkout.felt >= 4) {
    score -= 10;
    reasons.push('hard_last_session');
  }
  if (input.moodScore !== undefined && input.moodScore <= 2) {
    score -= 10;
    reasons.push('low_mood');
  }
  if (input.soreness !== undefined && input.soreness >= 4) {
    score -= 15;
    reasons.push('sore');
  }

  score = Math.max(0, Math.min(100, score));
  const level = score >= 70 ? 'green' : score >= 45 ? 'yellow' : 'red';
  return { score, level, reasons };
}

/** Week 1 is walking. Strength only arrives once walking is a habit. */
export function phaseForWeek(week: number): { phase: 1 | 2 | 3; walkMinutes: number; strengthDays: number } {
  if (week <= 4) return { phase: 1, walkMinutes: Math.min(10 + (week - 1) * 5, 25), strengthDays: week >= 3 ? 1 : 0 };
  if (week <= 12) return { phase: 2, walkMinutes: 30, strengthDays: 2 };
  return { phase: 3, walkMinutes: 35, strengthDays: 3 };
}

export function weeksSince(startDate: string, today: string): number {
  const a = new Date(startDate + 'T12:00:00').getTime();
  const b = new Date(today + 'T12:00:00').getTime();
  return Math.max(1, Math.floor((b - a) / (7 * 86400000)) + 1);
}

export type Session = {
  level: Readiness['level'];
  title: string;
  totalMinutes: number;
  exercises: Exercise[];
  note: string;
};

/**
 * Pick today's session. Red days become mobility and breathing, never nothing,
 * so the streak survives a bad day.
 */
export function buildSession(all: Exercise[], week: number, r: Readiness): Session {
  const { phase, walkMinutes } = phaseForWeek(week);
  const maxLevel = phase;
  const pool = all.filter((e) => e.level <= maxLevel);

  const pick = (cat: Exercise['category'], n: number) => pool.filter((e) => e.category === cat).slice(0, n);

  if (r.level === 'red') {
    const list = [...pick('breathing', 1), ...pick('mobility', 3), ...pick('stretch', 2)];
    return {
      level: 'red',
      title: 'easy_reset',
      totalMinutes: 10,
      exercises: list,
      note: 'recover_note',
    };
  }

  const walk = pool.filter((e) => e.category === 'walk');
  const walkPick = walk.find((e) => (e.default_seconds ?? 0) / 60 >= (r.level === 'yellow' ? walkMinutes / 2 : walkMinutes)) ?? walk[0];

  if (r.level === 'yellow') {
    const list = [...pick('mobility', 2), ...(walkPick ? [walkPick] : []), ...pick('stretch', 2)];
    return { level: 'yellow', title: 'light_day', totalMinutes: Math.round(walkMinutes / 2) + 10, exercises: list, note: 'easy_note' };
  }

  const strength = pool.filter((e) => e.category === 'strength').slice(0, phase === 1 ? 3 : 5);
  const list = [...pick('mobility', 2), ...(walkPick ? [walkPick] : []), ...strength, ...pick('stretch', 2)];
  return { level: 'green', title: 'full_day', totalMinutes: walkMinutes + 15, exercises: list, note: 'green_note' };
}

/** Three misses in a row means the plan is too hard, not the person too lazy. */
export function shouldEasePlan(recent: WorkoutLog[]): boolean {
  const last3 = recent.slice(-3);
  return last3.length === 3 && last3.every((w) => w.status === 'skipped');
}
