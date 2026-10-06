import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text } from 'react-native';
import { addDays } from '../core/date';
import { wasHeavy } from '../core/review';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, Micro, Row, Small } from '../ui/components';
import { Checklist } from '../ui/tiles';
import { C, F } from '../ui/theme';

const STEPS = ['no_skip', 'protein_first', 'walk_30', 'water_extra', 'dinner_early', 'no_scale'];

/**
 * The morning after a heavy day. Not a telling-off: six small things that
 * put the day back on track, ticked off like any other list. Gone by the
 * time the day's own food is half logged.
 */
export function RecoveryCard() {
  const app = useApp();
  const { state, targets, today, budget } = app;
  const t = makeT(state.profile.lang);
  const yesterday = addDays(today, -1);
  if (!wasHeavy(state.meals, yesterday, targets.kcal)) return null;
  if (budget.consumed > targets.kcal * 0.5) return null;

  const items = STEPS.map((s) => ({ key: `recover_${s}`, label: t(`rec_${s}`), done: app.actionsDoneToday.includes(`recover_${s}`) }));
  const done = items.filter((i) => i.done).length;

  return (
    <Card rail={done === items.length ? C.green : C.amber}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ gap: 8 }}>
          <Ionicons name="leaf-outline" size={16} color={C.amber} />
          <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '600' }}>{t('rec_title')}</Text>
        </Row>
        <Micro>{`${done} / ${items.length}`}</Micro>
      </Row>
      <Small>{t('rec_body')}</Small>
      <Checklist color={C.amber} items={items} onToggle={app.toggleAction} />
    </Card>
  );
}
