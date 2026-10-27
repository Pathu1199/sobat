import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { makeT } from '../i18n';
import { useMinute } from '../services/useWorkSchedule';
import { useApp } from '../store/AppProvider';
import { C, F, lh, S } from '../ui/theme';
import { adviceText, useAdviceAction } from './CoachStrip';
import { useCoach } from './useCoach';

/**
 * The coach in one sentence: the one thing that matters now, and the tap that does it. Advice with nothing to do is plain words,
 * not a button. Nothing when there is nothing to say.
 */
export function CoachLine() {
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  const minute = useMinute();
  const advice = useCoach(minute)[0];
  const act = useAdviceAction();
  if (!advice) return null;
  const text = adviceText(advice, t);
  const row = { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: S.touch, paddingHorizontal: 4 } as const;
  const icon = <Ionicons name="chatbubble-ellipses-outline" size={18} color={C.accentText} />;
  const words = <Text style={{ flex: 1, color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '400' }}>{text}</Text>;
  if (advice.action === 'none') {
    return (
      <View style={row} accessible accessibilityRole="text" accessibilityLabel={text}>
        {icon}
        {words}
      </View>
    );
  }
  return (
    <Pressable onPress={() => act(advice)} accessibilityRole="button" accessibilityLabel={text} style={({ pressed }) => [row, { opacity: pressed ? 0.7 : 1 }]}>
      {icon}
      {words}
      <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
    </Pressable>
  );
}
