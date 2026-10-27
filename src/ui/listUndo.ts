/** A row of a list that can show an Undo line: one of the items with its own index, or the Undo line. */
export type WithUndo<T> = { kind: 'item'; item: T; index: number } | { kind: 'undo' };

/**
 * A list with the Undo line in the place of the row just deleted, so the
 * Undo is where the tap was, not at the top of a long sheet. `at` is the
 * deleted row's index (past the end puts it last); null while nothing can be
 * undone. Pure, so it is tested without a screen.
 */
export function withUndoAt<T>(items: readonly T[], at: number | null): WithUndo<T>[] {
  const rows: WithUndo<T>[] = items.map((item, index) => ({ kind: 'item', item, index }));
  if (at === null) return rows;
  rows.splice(Math.min(Math.max(0, at), items.length), 0, { kind: 'undo' });
  return rows;
}
