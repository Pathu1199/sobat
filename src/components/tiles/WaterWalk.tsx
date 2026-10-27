import React, { useState } from 'react';
import { View } from 'react-native';
import type { ISODate } from '../../core/types';
import { makeT } from '../../i18n';
import { useFeedback } from '../../services/feedback';
import { useApp } from '../../store/AppProvider';
import { TileRow } from './TileRow';
import { TileSheet } from './TileSheet';
import { addedText, UndoLine, useAddedLine } from './UndoLine';
import { WalkTile } from './WalkTile';
import { WaterTile } from './WaterTile';

/**
 * Today's pair: Water and Walk side by side, "Added … · Undo" under them for
 * five seconds, and a long press for the sheet. Nothing for a date after
 * today: nothing is drunk or walked in the future, so no tile offers a tap.
 */
export function WaterWalkTiles({ date }: { date: ISODate }) {
  const app = useApp();
  const fb = useFeedback();
  const t = makeT(app.state.profile.lang);
  const [sheet, setSheet] = useState<'water' | 'walk' | null>(null);
  const { added, show, clear } = useAddedLine();

  function undo() {
    if (!added) return;
    if (added.kind === 'water') app.removeWater(added.id);
    else app.removeActivity(added.id);
    fb.haptic('light');
    clear();
  }

  if (date > app.today) return null;
  return (
    <View style={{ gap: 8 }}>
      <TileRow>
        <WaterTile date={date} onAdded={(id, ml) => show({ kind: 'water', id, amount: ml })} onHold={() => setSheet('water')} />
        <WalkTile date={date} onAdded={(id, minutes) => show({ kind: 'walk', id, amount: minutes })} onHold={() => setSheet('walk')} />
      </TileRow>
      {added ? <UndoLine text={addedText(added, t)} undoLabel={t('undo')} onUndo={undo} /> : null}
      <TileSheet kind={sheet} date={date} onClose={() => setSheet(null)} onAdded={show} />
    </View>
  );
}
