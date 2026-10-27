import React from 'react';
import type { ISODate } from '../core/types';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, MeterRow } from '../ui/components';
import { C } from '../ui/theme';

/** A day's steps against a daily goal. */
const STEP_GOAL = 8000;

/** Steps on the day shown, an optional card on Today. Counted by the phone; a day still to come has none, so it shows nothing. */
export function StepsCard({ date }: { date: ISODate }) {
  const { state, today } = useApp();
  const t = makeT(state.profile.lang);
  if (date > today) return null;
  const steps = state.steps.find((s) => s.date === date)?.count ?? 0;
  return (
    <Card>
      <MeterRow label={t('steps_today')} value={steps} total={STEP_GOAL} color={C.green} />
    </Card>
  );
}
