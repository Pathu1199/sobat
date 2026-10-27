import React from 'react';
import { View } from 'react-native';
import type { ISODate } from '../../core/types';
import { useApp } from '../../store/AppProvider';
import { TileRow } from './TileRow';
import { useTileAdds } from './useTileAdds';
import { WalkTile } from './WalkTile';
import { WaterTile } from './WaterTile';

/**
 * Today's pair: Water and Walk side by side, "Added … · Undo" under them for
 * five seconds, and a long press for the sheet. Nothing for a date after
 * today: nothing is drunk or walked in the future, so no tile offers a tap.
 */
export function WaterWalkTiles({ date }: { date: ISODate }) {
  const app = useApp();
  const adds = useTileAdds(date);
  if (date > app.today) return null;
  return (
    <View style={{ gap: 8 }}>
      <TileRow>
        <WaterTile date={date} onAdded={(id, ml) => adds.show({ kind: 'water', id, amount: ml, date })} onHold={() => adds.hold('water')} />
        <WalkTile date={date} onAdded={(id, minutes) => adds.show({ kind: 'walk', id, amount: minutes, date })} onHold={() => adds.hold('walk')} />
      </TileRow>
      {adds.undoLine}
      {adds.sheet}
    </View>
  );
}
