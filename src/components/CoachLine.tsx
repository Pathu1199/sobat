import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text } from 'react-native';
import { makeT } from '../i18n';
import { useMinute } from '../services/useWorkSchedule';
import { useApp } from '../store/AppProvider';
import { C, F, lh, S } from '../ui/theme';
import { adviceText, useAdviceAction } from './CoachStrip';
import { useCoach } from './useCoach';

/** The coach in one sentence: the one thing that matters now, and the tap that does it. Nothing when there is nothing to say. */
export function CoachLine() {
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  const minute = useMinute();
  const advice = useCoach(minute)[0];
  const act = useAdviceAction();
  if (!advice) return null;
  const acts = advice.action !== 'none';
  const text = adviceText(advice, t);
  return (
    <Pressable
      onPress={acts ? () => act(advice) : undefined}
      disabled={!acts}
      accessibilityRole={acts ? 'button' : 'text'}
      accessibilityLabel={text}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: S.touch, paddingHorizontal: 4, opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name="chatbubble-ellipses-outline" size={18} color={C.accentText} />
      <Text style={{ flex: 1, color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '400' }}>{text}</Text>
      {acts ? <Ionicons name="chevron-forward" size={16} color={C.textFaint} /> : null}
    </Pressable>
  );
}
