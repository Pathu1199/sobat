import { describe, expect, it, vi } from 'vitest';
import { formatDayLabel, localDate, localHHMM, localHour, loggedAt, mondayOf, msToNextMinute, weekDates } from '../date';

// vitest.config.mts pins TZ to Asia/Kolkata (UTC+5:30).
describe('local time from ISO strings', () => {
  const breakfast = '2026-09-26T03:10:00.000Z'; // 08:40 IST
  const lateDinner = '2026-09-26T17:00:00.000Z'; // 22:30 IST
  const afterMidnight = '2026-09-26T19:30:00.000Z'; // 01:00 IST on the 27th

  it('formats the clock in local time, not UTC', () => {
    expect(localHHMM(breakfast)).toBe('08:40');
    expect(localHHMM(lateDinner)).toBe('22:30');
  });

  it('gives the local hour so a 22:30 dinner counts as late', () => {
    expect(localHour(lateDinner)).toBe(22);
    expect(localHour(breakfast)).toBe(8);
  });

  it('gives the local calendar date across midnight', () => {
    expect(localDate(afterMidnight)).toBe('2026-09-27');
    expect(localDate(breakfast)).toBe('2026-09-26');
  });

  it('accepts zone-less strings as local time', () => {
    expect(localHHMM('2026-09-21T13:00')).toBe('13:00');
    expect(localHour('2026-09-21T13:00')).toBe(13);
  });

  it('labels a day without crashing in any language', () => {
    for (const lang of ['en', 'mr', 'hi'] as const) {
      const label = formatDayLabel('2026-09-26', lang);
      expect(label.length).toBeGreaterThan(3);
      expect(label).not.toBe('2026-09-26');
    }
  });

  it('falls back to English for an unknown language and to the ISO date for bad input', () => {
    expect(formatDayLabel('2026-09-26', 'xx' as never)).toBe(formatDayLabel('2026-09-26', 'en'));
    expect(formatDayLabel('not-a-date', 'en')).toBe('not-a-date');
  });

  it('returns the ISO date when the platform cannot format', () => {
    const spy = vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(() => {
      throw new Error('no Intl');
    });
    try {
      expect(formatDayLabel('2026-09-26', 'en')).toBe('2026-09-26');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('msToNextMinute', () => {
  it('counts the rest of the current minute', () => {
    expect(msToNextMinute(new Date(2026, 8, 26, 10, 30, 0, 0))).toBe(60000);
    expect(msToNextMinute(new Date(2026, 8, 26, 10, 30, 20, 0))).toBe(40000);
    expect(msToNextMinute(new Date(2026, 8, 26, 10, 30, 59, 999))).toBe(1);
  });

  it('never returns zero, so a timer built on it cannot spin', () => {
    for (let s = 0; s < 60; s++) {
      for (const ms of [0, 1, 500, 999]) {
        const v = msToNextMinute(new Date(2026, 8, 26, 10, 30, s, ms));
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThanOrEqual(60000);
      }
    }
  });

  it('lands exactly on the next minute, including across an hour and a day', () => {
    for (const start of [
      new Date(2026, 8, 26, 10, 30, 12, 345),
      new Date(2026, 8, 26, 10, 59, 12, 345),
      new Date(2026, 8, 26, 23, 59, 12, 345),
    ]) {
      const landed = new Date(start.getTime() + msToNextMinute(start));
      expect(landed.getSeconds()).toBe(0);
      expect(landed.getMilliseconds()).toBe(0);
      expect(landed.getMinutes()).toBe((start.getMinutes() + 1) % 60);
    }
  });
});

describe('weeks', () => {
  it('finds the Monday of any date; weeks run Monday to Sunday', () => {
    expect(mondayOf('2026-10-26')).toBe('2026-10-26');
    expect(mondayOf('2026-10-27')).toBe('2026-10-26');
    expect(mondayOf('2026-11-01')).toBe('2026-10-26');
    expect(mondayOf('2026-11-02')).toBe('2026-11-02');
  });

  it('finds a Monday in the year before: 1 January 2026 is a Thursday of the week from 29 December 2025', () => {
    expect(mondayOf('2026-01-01')).toBe('2025-12-29');
    expect(weekDates(mondayOf('2026-01-01'))).toEqual(['2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04']);
  });

  it('lists the seven dates from Monday', () => {
    expect(weekDates('2026-10-26')).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  });
});

describe('loggedAt', () => {
  it('logs something added for today now, and something added to an earlier day at its noon', () => {
    const now = new Date('2026-10-27T18:05:00');
    expect(loggedAt('2026-10-27', now)).toBe(now);
    expect(loggedAt('2026-10-25', now)?.toISOString()).toBe(new Date('2026-10-25T12:00:00').toISOString());
  });

  it('logs nothing for a date after today, even a minute before midnight', () => {
    expect(loggedAt('2026-10-28', new Date('2026-10-27T23:59:00'))).toBeNull();
    expect(loggedAt('2026-10-28', new Date('2026-10-28T00:01:00'))).not.toBeNull();
  });
});
