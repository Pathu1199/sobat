import { describe, expect, it, vi } from 'vitest';
import { formatDayLabel, localDate, localHHMM, localHour } from '../date';

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
