import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';
import type { CardWords } from '../core/puzzleScreen';
import { C } from '../ui/theme';

/**
 * The puzzle's small icon tile, the one size and the colours of each state (quiet when closed, the accent when open, the reward colours
 * when solved) wherever Today's puzzle shows: the Routine tab's card in all three states and the puzzle's own screen when it is closed.
 */
export function PuzzleTile({ tone }: { tone: CardWords['tone'] }) {
  const solved = tone === 'solved';
  const open = tone === 'open';
  return (
    <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: solved ? C.goldSoft : open ? C.accentDim : C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="extension-puzzle-outline" size={18} color={solved ? C.goldInk : open ? C.accentText : C.textDim} />
    </View>
  );
}
