import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text } from 'react-native';
import { intakeNote, lowIntake } from '../core/intake';
import { KCAL_FLOOR } from '../core/nutrition';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { useRecordOn } from '../store/useRecordOn';
import { AMBER_NOTE, C, F, lh, S } from '../ui/theme';
import { spokenLine } from '../ui/toastWords';

/**
 * Three logged days under the line: one amber note says so, once, plainly
 * (core/intake.ts `intakeNote`), and the whole note opens the plan; a screen
 * reader hears the note and then "Open the plan", in its name, since the web
 * reads no hint. Nothing otherwise. Amber, never red: eating too little is a
 * thing to fix, not an alarm.
 */
export function IntakeCard() {
  const app = useApp();
  const router = useRouter();
  const { state, today, targets } = app;
  const t = makeT(state.profile.lang);
  // The day's record lets a day completed with skips count: one meal and the rest skipped is too little, not half written down.
  const recordOn = useRecordOn();
  const intake = useMemo(
    () => lowIntake({ meals: state.meals, today, target: targets.kcal, floor: KCAL_FLOOR[state.profile.sex], offDays: state.settings.offDays ?? [], recordOn }),
    [state.meals, today, targets.kcal, state.profile.sex, state.settings.offDays, recordOn],
  );
  const text = intakeNote(intake, state.profile.lang);
  if (!text) return null;
  const words = { color: C[AMBER_NOTE.words], fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' } as const;
  return (
    // A finger tall on every platform: the web adds no reach around a control, so the box itself is the size.
    <Pressable
      onPress={() => router.push('/food?s=plan')}
      accessibilityRole="button"
      accessibilityLabel={spokenLine([text, t('intake_open_plan')])}
      style={({ pressed }) => ({
        minHeight: S.touch,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: S.radiusSm,
        backgroundColor: C[AMBER_NOTE.fill],
        opacity: pressed ? 0.8 : 1,
      })}>
      <Text style={words}>△</Text>
      <Text style={[words, { flex: 1 }]}>{text}</Text>
    </Pressable>
  );
}
