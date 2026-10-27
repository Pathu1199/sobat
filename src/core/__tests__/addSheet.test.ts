import { describe, expect, it } from 'vitest';
import { addRows } from '../addSheet';
import type { BasketLine } from '../basket';

const line = (foodId: string): BasketLine => ({ foodId, unit: 'katori', gramsPerUnit: 150, count: 1 });
const base = { mode: 'log' as const, query: '', results: [] as string[], basket: [] as BasketLine[], planned: true, yesterday: true, saved: ['s1'], recents: ['poha', 'chapati'] };
const kinds = (rows: ReturnType<typeof addRows>) =>
  rows.map((r) => (r.kind === 'food' || r.kind === 'basket' ? `${r.kind}:${r.foodId}` : r.kind === 'head' ? `head:${r.titleKey}` : r.kind));

describe('addRows', () => {
  it('with nothing typed: eat as planned, the same as yesterday, saved meals, recent foods, then photo and barcode', () => {
    expect(kinds(addRows(base))).toEqual(['planned', 'yesterday', 'head:me_saved', 'saved', 'head:recent', 'food:poha', 'food:chapati', 'tools']);
  });

  it('puts the meal being built first, and a recent food already in it is not listed twice', () => {
    expect(kinds(addRows({ ...base, basket: [line('poha')] }))).toEqual(['head:add_this_meal', 'basket:poha', 'planned', 'yesterday', 'head:me_saved', 'saved', 'head:recent', 'food:chapati', 'tools']);
  });

  it('with a search typed: the matches only, or one line saying nothing was found', () => {
    expect(kinds(addRows({ ...base, query: 'po', results: ['poha', 'pohe'] }))).toEqual(['food:poha', 'food:pohe']);
    expect(kinds(addRows({ ...base, query: 'zzz' }))).toEqual(['empty']);
  });

  it('changing a menu offers no eating as planned, no yesterday, no photo or barcode', () => {
    expect(kinds(addRows({ ...base, mode: 'plan' }))).toEqual(['head:me_saved', 'saved', 'head:recent', 'food:poha', 'food:chapati']);
  });
});
