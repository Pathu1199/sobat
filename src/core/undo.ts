import type { UndoStep } from './addSheet';
import type { ISODate, Meal } from './types';

/** The store actions an Undo goes through. */
export type UndoStore = {
  removeMeal: (id: string) => void;
  addMeal: (m: Meal) => void;
  skipSlot: (date: ISODate, slotId: string) => void;
  unskipSlot: (date: ISODate, slotId: string) => void;
};

/**
 * Every step of an Undo, in order, each through its store action: a meal
 * taken away or put back (addMeal lifts the skip that taking one away may have
 * marked), a slot skipped or not. The one way the menu, the add sheet and a
 * meal's sheet undo, so none of them drops a kind of step.
 */
export function runUndo(store: UndoStore, steps: UndoStep[]): void {
  for (const step of steps) {
    if (step.kind === 'remove') store.removeMeal(step.id);
    else if (step.kind === 'add') store.addMeal(step.meal);
    else if (step.kind === 'skip') store.skipSlot(step.date, step.slotId);
    else store.unskipSlot(step.date, step.slotId);
  }
}
