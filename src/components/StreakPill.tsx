import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { C, F, lh, S } from '../ui/theme';
import { spokenLine } from '../ui/toastWords';

/**
 * The streak at the right of Today's header: a small soft teal pill, "5 days"
 * beside a flame, the store's own streak (the one the Streak tile climbs). It
 * opens Progress, as the tile on Today does, and says so in its name, which
 * the web reads where it reads no hint; the box round it is a finger tall on
 * every platform. Nothing while there is no streak to show.
 */
export function StreakPill() {
  const router = useRouter();
  const { state, streakDays } = useApp();
  const t = makeT(state.profile.lang);
  if (streakDays <= 0) return null;
  const days = `${streakDays} ${t(streakDays === 1 ? 'tile_unit_day' : 'tile_unit_days')}`;
  return (
    <Pressable
      onPress={() => router.push('/progress')}
      accessibilityRole="button"
      accessibilityLabel={spokenLine([`${t('tile_streak')}: ${days}`, t('tile_hint_streak')])}
      style={({ pressed }) => ({ minHeight: S.touch, minWidth: S.touch, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: C.accentSoft }}>
        <Ionicons name="flame" size={F.small} color={C.accentText} />
        <Text numberOfLines={1} style={{ color: C.accentText, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500', fontVariant: ['tabular-nums'] }}>
          {days}
        </Text>
      </View>
    </Pressable>
  );
}
