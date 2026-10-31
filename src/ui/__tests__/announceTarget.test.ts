import { describe, expect, it } from 'vitest';
import { anySheetOpen, CLOSING_MAX_MS, PAGE_REGION, sheetClosed, sheetClosing, sheetOpened, speaker } from '../announceTarget';

const NOW = 1_000_000;

describe('which region says a toast on the web: the page\'s, or the top-most open sheet\'s', () => {
  it('is the page\'s while no sheet is open', () => {
    expect(speaker([], NOW)).toBe(PAGE_REGION);
  });

  it('is the sheet opened last, and the one under it again once that one has gone', () => {
    const one = sheetOpened([], 'add');
    const two = sheetOpened(one, 'food');
    expect(speaker(two, NOW)).toBe('food');
    expect(speaker(sheetClosed(two, 'food'), NOW)).toBe('add');
    expect(speaker(sheetClosed(sheetClosed(two, 'food'), 'add'), NOW)).toBe(PAGE_REGION);
  });

  it('keeps one place for a sheet opened twice, on top, and leaves the others when an unknown one closes', () => {
    expect(speaker(sheetOpened(sheetOpened(sheetOpened([], 'add'), 'food'), 'add'), NOW)).toBe('add');
    expect(speaker(sheetClosed(sheetOpened([], 'add'), 'weight'), NOW)).toBe('add');
    expect(speaker(sheetClosing(sheetOpened([], 'add'), 'weight', NOW), NOW)).toBe('add');
  });
});

describe('a sheet that is closing: its dialog stays on the page while it slides out', () => {
  it('holds the line while it is the top-most, so neither the page nor a sheet under it speaks yet', () => {
    expect(speaker(sheetClosing(sheetOpened([], 'add'), 'add', NOW), NOW)).toBeNull();
    const two = sheetOpened(sheetOpened([], 'add'), 'food');
    expect(speaker(sheetClosing(two, 'food', NOW), NOW)).toBeNull();
  });

  it('lets the page speak once it has gone, and the sheet under it when one is still open', () => {
    const closing = sheetClosing(sheetOpened([], 'add'), 'add', NOW);
    expect(speaker(sheetClosed(closing, 'add'), NOW)).toBe(PAGE_REGION);
    const two = sheetClosing(sheetOpened(sheetOpened([], 'add'), 'food'), 'food', NOW);
    expect(speaker(sheetClosed(two, 'food'), NOW)).toBe('add');
  });

  it('holds the line no longer than CLOSING_MAX_MS, in case the browser never says the dialog has gone', () => {
    const closing = sheetClosing(sheetOpened([], 'add'), 'add', NOW);
    expect(speaker(closing, NOW + CLOSING_MAX_MS - 1)).toBeNull();
    expect(speaker(closing, NOW + CLOSING_MAX_MS)).toBe(PAGE_REGION);
  });

  it('does not hold the line of an open sheet above it', () => {
    const lower = sheetClosing(sheetOpened([], 'add'), 'add', NOW);
    expect(speaker(sheetOpened(lower, 'food'), NOW)).toBe('food');
  });

  it('is open again, and speaks, when it is opened again before it has gone', () => {
    const closing = sheetClosing(sheetOpened([], 'add'), 'add', NOW);
    expect(speaker(sheetOpened(closing, 'add'), NOW)).toBe('add');
  });
});

describe('whether any sheet is open, so a celebration waits for it', () => {
  it('is no while none is on the page, yes while one is open, and yes while a lower one is open under a closing one', () => {
    expect(anySheetOpen([])).toBe(false);
    expect(anySheetOpen(sheetOpened([], 'weight'))).toBe(true);
    const both = sheetClosing(sheetOpened(sheetOpened([], 'add'), 'food'), 'food', NOW);
    expect(anySheetOpen(both)).toBe(true);
  });

  it('is no for a sheet only sliding out, and no once it has gone, so the win comes as the sheet leaves', () => {
    const closing = sheetClosing(sheetOpened([], 'add'), 'add', NOW);
    expect(anySheetOpen(closing)).toBe(false);
    expect(anySheetOpen(sheetClosed(closing, 'add'))).toBe(false);
  });

  it('is yes again when a sheet closing is opened again', () => {
    expect(anySheetOpen(sheetOpened(sheetClosing(sheetOpened([], 'add'), 'add', NOW), 'add'))).toBe(true);
  });
});
