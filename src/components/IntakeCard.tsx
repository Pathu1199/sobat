import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { lowIntake } from '../core/intake';
import { KCAL_FLOOR } from '../core/nutrition';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, Micro, Row, Small } from '../ui/components';
import { C, F } from '../ui/theme';

/** Three logged days under the line: say so once, plainly, and point at the plan. */
export function IntakeCard() {
  const app = useApp();
  const router = useRouter();
  const { state, today, targets } = app;
  const t = makeT(state.profile.lang);
  const intake = useMemo(
    () => lowIntake({ meals: state.meals, today, target: targets.kcal, floor: KCAL_FLOOR[state.profile.sex], offDays: state.settings.offDays ?? [] }),
    [state.meals, today, targets.kcal, state.profile.sex, state.settings.offDays],
  );
  if (!intake) return null;
  return (
    <Card rail={C.red}>
      <Row style={{ gap: 10, alignItems: 'flex-start' }}>
        <Ionicons name="warning-outline" size={20} color={C.red} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '700' }}>{t('intake_title')}</Text>
          <Small color={C.textDim}>{fill(t('intake_body'), { avg: intake.avg, days: intake.days, limit: intake.limit, target: targets.kcal })}</Small>
        </View>
      </Row>
      <Pressable onPress={() => router.push('/food?s=plan')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('intake_open_plan')}>
        <Micro color={C.accent}>{`${t('intake_open_plan')} ›`}</Micro>
      </Pressable>
    </Card>
  );
}
