import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { lowIntake } from '../core/intake';
import { KCAL_FLOOR } from '../core/nutrition';
import { fill, makeT, numberText } from '../i18n';
import { useApp } from '../store/AppProvider';
import { useRecordOn } from '../store/useRecordOn';
import { Card, Micro, Row, Small } from '../ui/components';
import { C, F, S } from '../ui/theme';

/** Three logged days under the line: say so once, plainly, and point at the plan. Nothing otherwise. */
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
  if (!intake) return null;
  return (
    <Card rail={C.red}>
      <Row style={{ gap: 10, alignItems: 'flex-start' }}>
        <Ionicons name="warning-outline" size={20} color={C.red} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: C.text, fontSize: F.title, fontWeight: '500' }}>{t('intake_title')}</Text>
          <Small color={C.textDim}>{fill(t('intake_body'), { avg: numberText(intake.avg), days: intake.days, limit: numberText(intake.limit), target: numberText(targets.kcal) })}</Small>
        </View>
      </Row>
      {/* A finger tall on every platform: the web adds no reach around a control, so the box itself is the size. */}
      <Pressable
        onPress={() => router.push('/food?s=plan')}
        accessibilityRole="button"
        accessibilityLabel={t('intake_open_plan')}
        style={({ pressed }) => ({ minHeight: S.touch, justifyContent: 'center', alignSelf: 'flex-start', opacity: pressed ? 0.7 : 1 })}>
        <Micro color={C.accentText}>{`${t('intake_open_plan')} ›`}</Micro>
      </Pressable>
    </Card>
  );
}
