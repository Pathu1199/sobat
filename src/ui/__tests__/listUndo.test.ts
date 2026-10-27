import { describe, expect, it } from 'vitest';
import { withUndoAt } from '../listUndo';

const shown = (rows: ReturnType<typeof withUndoAt<string>>) => rows.map((r) => (r.kind === 'undo' ? 'undo' : `${r.item}@${r.index}`));

describe('withUndoAt: the Undo line in the place of the row just deleted', () => {
  it('lists the rows as they are while nothing can be undone', () => {
    expect(shown(withUndoAt(['a', 'b'], null))).toEqual(['a@0', 'b@1']);
  });

  it('puts the Undo line where the deleted row was, keeping each row its own index', () => {
    expect(shown(withUndoAt(['a', 'c'], 1))).toEqual(['a@0', 'undo', 'c@1']);
    expect(shown(withUndoAt(['b', 'c'], 0))).toEqual(['undo', 'b@0', 'c@1']);
  });

  it('puts it after the last row when the last was deleted, and alone when the list is now empty', () => {
    expect(shown(withUndoAt(['a', 'b'], 2))).toEqual(['a@0', 'b@1', 'undo']);
    expect(shown(withUndoAt(['a'], 7))).toEqual(['a@0', 'undo']);
    expect(shown(withUndoAt([], 0))).toEqual(['undo']);
  });
});
