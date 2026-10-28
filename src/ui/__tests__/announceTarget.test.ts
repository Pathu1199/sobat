import { describe, expect, it } from 'vitest';
import { PAGE_REGION, sheetClosed, sheetOpened, speaker } from '../announceTarget';

describe('which region says a toast on the web: the page\'s, or the top-most open sheet\'s', () => {
  it('is the page\'s while no sheet is open', () => {
    expect(speaker([])).toBe(PAGE_REGION);
  });

  it('is the sheet opened last, and the one under it again once that one closes', () => {
    const one = sheetOpened([], 'add');
    const two = sheetOpened(one, 'food');
    expect(speaker(two)).toBe('food');
    expect(speaker(sheetClosed(two, 'food'))).toBe('add');
    expect(speaker(sheetClosed(sheetClosed(two, 'food'), 'add'))).toBe(PAGE_REGION);
  });

  it('keeps one place for a sheet opened twice, on top, and leaves the others when an unknown one closes', () => {
    expect(sheetOpened(['add', 'food'], 'add')).toEqual(['food', 'add']);
    expect(sheetClosed(['add'], 'weight')).toEqual(['add']);
  });
});
