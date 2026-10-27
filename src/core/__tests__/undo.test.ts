import { describe, expect, it } from 'vitest';
import type { UndoStep } from '../addSheet';
import type { Meal } from '../types';
import { runUndo } from '../undo';

const meal: Meal = { id: 'm1', at: '2026-10-27T08:00:00.000Z', date: '2026-10-27', type: 'breakfast', slotId: 'breakfast', items: [], kcal: 300, protein: 10 };

describe('runUndo', () => {
  it('sends every step to its store action, in order, so no Undo drops one', () => {
    const calls: string[] = [];
    const store = {
      removeMeal: (id: string) => calls.push(`remove ${id}`),
      addMeal: (m: Meal) => calls.push(`add ${m.id}`),
      skipSlot: (date: string, slotId: string) => calls.push(`skip ${date} ${slotId}`),
      unskipSlot: (date: string, slotId: string) => calls.push(`unskip ${date} ${slotId}`),
    };
    const steps: UndoStep[] = [
      { kind: 'remove', id: 'x' },
      { kind: 'add', meal },
      { kind: 'skip', date: '2026-10-27', slotId: 'lunch' },
      { kind: 'unskip', date: '2026-10-27', slotId: 'breakfast' },
    ];
    runUndo(store, steps);
    expect(calls).toEqual(['remove x', 'add m1', 'skip 2026-10-27 lunch', 'unskip 2026-10-27 breakfast']);
  });
});
