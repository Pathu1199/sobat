import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { teacherOn } from '../core/teacher';
import { makeT } from '../i18n';
import { useMinute } from '../services/useWorkSchedule';
import { useApp } from '../store/AppProvider';
import { C, F, lh, S } from '../ui/theme';
import { adviceHint, adviceText, useAdviceAction } from './CoachStrip';
import { TeacherCard } from './TeacherCard';
import { useCoach } from './useCoach';

/**
 * The coach in one sentence: the one thing that matters now, and the tap that does it. Advice with nothing to do is plain words,
 * not a button. A tap on the water advice adds a bottle and says so, with Undo. Nothing when there is nothing to say. From six in
 * the evening the coach is the kind teacher instead: what went well today and one small tip for tomorrow (`TeacherCard`); a free day stays quiet.
 */
export function CoachLine() {
  const minute = useMinute();
  const { state, today } = useApp();
  return teacherOn(minute, today, state.settings.offDays) ? <TeacherCard /> : <AdviceLine minute={minute} />;
}

/** The advice of this minute, in one sentence. */
function AdviceLine({ minute }: { minute: number }) {
  const { state } = useApp();
  const t = makeT(state.profile.lang);
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
    <Pressable
      onPress={() => act(advice)}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityHint={adviceHint(advice, t, state.settings.bottleMl)}
      style={({ pressed }) => [row, { opacity: pressed ? 0.7 : 1 }]}>
      {icon}
      {words}
      <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
    </Pressable>
  );
}
