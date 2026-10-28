import React, { useState } from 'react';
import type { ISODate } from '../../core/types';
import { makeT } from '../../i18n';
import { useFeedback } from '../../services/feedback';
import { useApp } from '../../store/AppProvider';
import { addedOn, type Added } from '../../ui/tileWords';
import { TileSheet } from './TileSheet';
import { addedText, UndoLine, useAddedLine } from './UndoLine';

/**
 * What every pair of tiles that adds water or a walk shares: the line
 * "Added … · Undo" for five seconds after a tap, shown only while the day it
 * went to is the day shown, an Undo that takes exactly that record away with
 * a light tap, and the long-press sheet for the day shown. The tiles call `show` when they add and `hold` on a long press; the
 * pair puts `undoLine` under its row and `sheet` after it.
 */
export function useTileAdds(date: ISODate): {
  show: (a: Added) => void;
  hold: (kind: 'water' | 'walk') => void;
  undoLine: React.ReactNode;
  sheet: React.ReactNode;
} {
  const app = useApp();
  const fb = useFeedback();
  const t = makeT(app.state.profile.lang);
  const [sheet, setSheet] = useState<'water' | 'walk' | null>(null);
  const { added: last, show, clear } = useAddedLine((a) => addedText(a, t), t('undo'));
  const added = addedOn(last, date);

  function undo() {
    if (!added) return;
    if (added.kind === 'water') app.removeWater(added.id);
    else app.removeActivity(added.id);
    fb.haptic('light');
    clear();
  }

  return {
    show,
    hold: setSheet,
    // Keyed by the record, so a second add of the same amount is said again.
    undoLine: added ? <UndoLine key={added.id} text={addedText(added, t)} undoLabel={t('undo')} onUndo={undo} /> : null,
    sheet: <TileSheet kind={sheet} date={date} onClose={() => setSheet(null)} onAdded={show} />,
  };
}
