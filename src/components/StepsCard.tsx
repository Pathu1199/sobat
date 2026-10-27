import React from 'react';
import type { ISODate } from '../core/types';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, MeterRow } from '../ui/components';
import { C } from '../ui/theme';

/** A day's steps against a daily goal. */
const STEP_GOAL = 8000;

/**
 * Steps on the day shown, an optional card on Today. Counted by the phone, so
 * a day with no count (the web, a phone that was not allowed to count, a day
 * before counting began, a day still to come) shows nothing, not a 0.
 */
export function StepsCard({ date }: { date: ISODate }) {
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  const record = state.steps.find((s) => s.date === date);
  if (!record) return null;
  return (
    <Card>
      <MeterRow label={t('steps_today')} value={record.count} total={STEP_GOAL} color={C.green} />
    </Card>
  );
}
