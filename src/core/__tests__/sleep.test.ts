import { describe, expect, it } from 'vitest';
import { bedtimeRegularity, buildSleepLog, sleepDebt, sleepFlags, sleepScore } from '../sleep';
import { minutesBetween } from '../date';

describe('minutesBetween', () => {
  it('handles an overnight wrap', () => {
    expect(minutesBetween('23:00', '07:00')).toBe(480);
    expect(minutesBetween('22:30', '06:15')).toBe(465);
    expect(minutesBetween('01:00', '09:00')).toBe(480);
  });
});

describe('sleepScore', () => {
  it('rewards a solid night', () => {
    expect(sleepScore({ bed: '23:00', wake: '07:00', quality: 5, wakeups: 0, energy: 5 })).toBe(100);
  });

  it('punishes a short broken night', () => {
    const s = sleepScore({ bed: '01:30', wake: '06:00', quality: 2, wakeups: 3, energy: 1 });
    expect(s).toBeLessThan(40);
  });

  it('stays inside 0 to 100', () => {
    const s = sleepScore({ bed: '04:00', wake: '05:00', quality: 1, wakeups: 9, energy: 1 });
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe('buildSleepLog', () => {
  it('derives minutes and score', () => {
    const l = buildSleepLog('2026-09-25', { bed: '23:00', wake: '06:30', quality: 4, wakeups: 1, energy: 4 });
    expect(l.minutes).toBe(450);
    expect(l.score).toBeGreaterThan(60);
  });
});

describe('sleepDebt', () => {
  it('adds up the shortfall', () => {
    const logs = ['2026-09-20', '2026-09-21', '2026-09-22'].map((d) =>
      buildSleepLog(d, { bed: '00:30', wake: '06:30', quality: 3, wakeups: 0, energy: 3 }),
    );
    expect(sleepDebt(logs)).toBe(3 * (360 - 450));
  });
});

describe('bedtimeRegularity', () => {
  it('is near zero for a fixed bedtime', () => {
    const logs = ['2026-09-20', '2026-09-21', '2026-09-22'].map((d) =>
      buildSleepLog(d, { bed: '23:00', wake: '07:00', quality: 3, wakeups: 0, energy: 3 }),
    );
    expect(bedtimeRegularity(logs)).toBe(0);
  });

  it('treats 23:30 and 00:30 as one hour apart, not 23', () => {
    const logs = [
      buildSleepLog('2026-09-20', { bed: '23:30', wake: '07:00', quality: 3, wakeups: 0, energy: 3 }),
      buildSleepLog('2026-09-21', { bed: '00:30', wake: '07:00', quality: 3, wakeups: 0, energy: 3 }),
    ];
    expect(bedtimeRegularity(logs)).toBe(30);
  });
});

describe('sleepFlags', () => {
  it('flags chronically short sleep', () => {
    const logs = Array.from({ length: 7 }, (_, i) =>
      buildSleepLog(`2026-09-1${i}`, { bed: '01:00', wake: '06:00', quality: 3, wakeups: 0, energy: 3 }),
    );
    expect(sleepFlags(logs)).toContain('short_sleep');
  });

  it('suggests a sleep-apnea screen when long nights still leave you tired', () => {
    const logs = Array.from({ length: 7 }, (_, i) =>
      buildSleepLog(`2026-09-1${i}`, { bed: '22:30', wake: '07:00', quality: 2, wakeups: 2, energy: 1 }),
    );
    expect(sleepFlags(logs)).toContain('apnea_screen');
  });

  it('stays quiet for healthy sleep', () => {
    const logs = Array.from({ length: 7 }, (_, i) =>
      buildSleepLog(`2026-09-1${i}`, { bed: '23:00', wake: '07:00', quality: 4, wakeups: 0, energy: 4 }),
    );
    expect(sleepFlags(logs)).toHaveLength(0);
  });
});
