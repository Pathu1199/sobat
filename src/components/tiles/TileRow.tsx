import React from 'react';
import { View } from 'react-native';
import { S } from '../../ui/theme';

/** Two tiles side by side, the same width. A row with one tile puts an empty `<View style={{ flex: 1 }} />` beside it. */
export function TileRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: S.gap }}>{children}</View>;
}
