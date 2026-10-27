import React, { useState } from 'react';
import { View } from 'react-native';
import { makeT } from '../../i18n';
import { useFeedback } from '../../services/feedback';
import { useApp } from '../../store/AppProvider';
import { SleepTile } from './SleepTile';
import { TileRow } from './TileRow';
import { TileSheet } from './TileSheet';
import { addedText, UndoLine, useAddedLine } from './UndoLine';
import { WalkTile } from './WalkTile';

/** Body's pair for today: Walk (with its undo line and long-press sheet) beside Sleep. */
export function WalkSleepTiles() {
  const app = useApp();
  const fb = useFeedback();
  const t = makeT(app.state.profile.lang);
  const [sheet, setSheet] = useState<'walk' | null>(null);
  const { added, show, clear } = useAddedLine();
  return (
    <View style={{ gap: 8 }}>
      <TileRow>
        <WalkTile date={app.today} onAdded={(id, minutes) => show({ kind: 'walk', id, amount: minutes })} onHold={() => setSheet('walk')} />
        <SleepTile date={app.today} />
      </TileRow>
      {added ? (
        <UndoLine
          text={addedText(added, t)}
          undoLabel={t('undo')}
          onUndo={() => {
            app.removeActivity(added.id);
            fb.haptic('light');
            clear();
          }}
        />
      ) : null}
      <TileSheet kind={sheet} date={app.today} onClose={() => setSheet(null)} onAdded={show} />
    </View>
  );
}
