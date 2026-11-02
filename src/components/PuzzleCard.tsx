import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { cardWords } from '../core/puzzleScreen';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { usePuzzleToday } from '../store/usePuzzleToday';
import { Btn, Card } from '../ui/components';
import { C, F, lh, S } from '../ui/theme';

/**
 * Today's puzzle on the Routine tab, under Today's list: one card. Closed, a quiet puzzle icon with when it opens ("Opens when today's
 * Routine is done · 2 of 4"; nothing is locked or owed). Open, "Today's puzzle is open" with its level and about how long, and Play; a tap
 * anywhere on the row opens it too. Solved, "Solved in 1:23" with a gold check and that a new puzzle comes tomorrow, and a tap shows the
 * board. Its words are `cardWords`'s, the same the puzzle's own screen says when it is closed.
 */
export function PuzzleCard() {
  const app = useApp();
  const today = usePuzzleToday();
  const t = makeT(app.state.profile.lang);
  const words = cardWords(today, t);
  const open = () => router.push('/puzzle');

  const tile = (
    <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: words.tone === 'solved' ? C.goldSoft : words.tone === 'open' ? C.accentDim : C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="extension-puzzle-outline" size={18} color={words.tone === 'solved' ? C.goldInk : words.tone === 'open' ? C.accentText : C.textDim} />
    </View>
  );
  const texts = (
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <Text style={{ color: words.tone === 'closed' ? C.textDim : C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{words.title}</Text>
      <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>{words.line}</Text>
    </View>
  );

  if (words.tone === 'closed') {
    return (
      <Card>
        <View accessible accessibilityRole="text" accessibilityLabel={`${words.title}. ${words.line}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {tile}
          {texts}
        </View>
      </Card>
    );
  }
  if (words.tone === 'solved') {
    return (
      <Card>
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={`${words.title}. ${words.line}`}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: S.touch, opacity: pressed ? 0.7 : 1 })}>
          {tile}
          {texts}
          <Ionicons name="checkmark-circle" size={24} color={C.goldInk} />
        </Pressable>
      </Card>
    );
  }
  // Open: the row opens the puzzle and so does Play, a button of its own beside it (a button cannot sit inside a button), so a screen reader meets Play once.
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable accessible={false} onPress={open} style={({ pressed }) => ({ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.7 : 1 })}>
          {tile}
          {texts}
        </Pressable>
        <Btn small label={t('zip_play')} onPress={open} />
      </View>
    </Card>
  );
}
