import React from 'react';
import { View } from 'react-native';
import { useApp } from '../../store/AppProvider';
import { SleepTile } from './SleepTile';
import { TileRow } from './TileRow';
import { useTileAdds } from './useTileAdds';
import { WalkTile } from './WalkTile';

/** Body's pair for today: Walk (with its undo line and long-press sheet) beside Sleep. */
export function WalkSleepTiles() {
  const app = useApp();
  const adds = useTileAdds(app.today);
  return (
    <View style={{ gap: 8 }}>
      <TileRow>
        <WalkTile date={app.today} onAdded={(id, minutes) => adds.show({ kind: 'walk', id, amount: minutes, date: app.today })} onHold={() => adds.hold('walk')} />
        <SleepTile date={app.today} />
      </TileRow>
      {adds.undoLine}
      {adds.sheet}
    </View>
  );
}
