import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Text } from 'react-native';
import { weighInDue } from '../core/plan';
import { makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Field, Micro, Row, Small } from '../ui/components';
import { C, F } from '../ui/theme';

/** On the weigh day, and again two days later if it was missed: one box, one button. */
export function WeighInCard() {
  const app = useApp();
  const fb = useFeedback();
  const { state, today } = app;
  const t = makeT(state.profile.lang);
  const [kg, setKg] = useState('');
  const dismissed = app.actionsDoneToday.includes('weigh_later');

  if (dismissed || !weighInDue(state.weights, today, state.settings.weighDay)) return null;
  const value = parseFloat(kg);
  const valid = Number.isFinite(value) && value >= 25 && value <= 350;

  function save() {
    if (!valid) return;
    app.addWeight({ date: today, kg: value });
    fb.haptic('success');
    fb.notify(`${value} ${t('unit_kg')}`);
  }

  return (
    <Card rail={C.cyan}>
      <Row style={{ gap: 8 }}>
        <Ionicons name="scale-outline" size={16} color={C.cyan} />
        <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '600' }}>{t('weigh_q')}</Text>
      </Row>
      <Small>{t('weigh_hint')}</Small>
      <Row style={{ gap: 10 }}>
        <Field value={kg} onChangeText={setKg} keyboardType="numeric" placeholder={`${state.profile.weightKg}`} />
        <Btn label={t('save')} onPress={save} disabled={!valid} />
      </Row>
      <Row style={{ justifyContent: 'flex-end' }}>
        <Btn small tone="ghost" label={t('weigh_later')} onPress={() => app.toggleAction('weigh_later')} />
      </Row>
      <Micro color={C.textGhost}>{t('weigh_rule')}</Micro>
    </Card>
  );
}
