import { describe, expect, it, vi } from 'vitest';
import { newId } from '../id';

describe('newId', () => {
  it('never repeats, even inside one millisecond', () => {
    const spy = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    try {
      const ids = Array.from({ length: 500 }, () => newId());
      expect(new Set(ids).size).toBe(ids.length);
    } finally {
      spy.mockRestore();
    }
  });

  it('sorts by the moment it was made', () => {
    const spy = vi.spyOn(Date, 'now');
    try {
      spy.mockReturnValue(1_700_000_000_000);
      const earlier = newId();
      spy.mockReturnValue(1_700_000_060_000);
      const later = newId();
      expect(earlier < later).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});
