import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { shieldNote } from '../core/shield';
import type { ISODate } from '../core/types';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { C, F, lh, S } from '../ui/theme';

/**
 * The small gold note under a streak: "Shield ready: one rest day this week
 * won't break your streak.", or "Shield used this week." once the shield
 * covered a day of this week (core/shield.ts). `covered` is the streak's own.
 */
export function ShieldNote({ covered }: { covered: readonly ISODate[] }) {
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  const words = t(shieldNote(covered, app.today) === 'used' ? 'shield_used' : 'shield_ready');
  return (
    <View accessible accessibilityLabel={words} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.goldSoft, borderRadius: S.radiusSm, paddingHorizontal: 12, paddingVertical: 10 }}>
      <Ionicons name="shield-checkmark-outline" size={18} color={C.goldInk} />
      <Text style={{ flex: 1, color: C.goldInk, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{words}</Text>
    </View>
  );
}
