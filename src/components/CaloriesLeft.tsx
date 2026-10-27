import React from 'react';
import { Text, View } from 'react-native';
import { burnedOn, eatBack } from '../core/activity';
import type { DayMode, DayView } from '../core/dayView';
import { caloriesLeft } from '../core/todayLayout';
import { isOffDay } from '../core/week';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Micro } from '../ui/components';
import { C, F, lh } from '../ui/theme';

/**
 * The one number the day is about: calories left (core/todayLayout.ts
 * decides what it says). Today it is the live budget (a walk earns some
 * back), with "Planned X · Goal Y"; a past day is the goal and what its walks
 * earned, less what was eaten, with "Eaten X of Y"; a future day is what the
 * plan leaves. The app's own suggestion (`suggested`, which Today works out
 * once from the day's menu) is named "Suggested" and never shown in red, and
 * nothing is red on a free day or before the person started; a day before
 * the start shows only what was eaten. Protein against its target goes under
 * it, on its own line so it wraps instead of running into the edge.
 */
export function CaloriesLeft({ mode, view, suggested }: { mode: DayMode; view: DayView; suggested: boolean }) {
  const { state, budget, targets } = useApp();
  const t = makeT(state.profile.lang);
  const offDay = isOffDay(state.settings.offDays, view.date);
  const dayEarned = eatBack(burnedOn(state.activities ?? [], view.date));
  const w = caloriesLeft({ mode, targets, view, budget, suggested, offDay, dayEarned });
  const n = (x: number) => x.toLocaleString();
  const label = w.label ? t(w.label) : null;
  const earned = w.earned > 0 ? ` · +${n(w.earned)} ${t('earned_short')}` : '';
  const line = `${fill(t(w.line.key), { planned: n(w.line.kcal), eaten: n(w.line.kcal), goal: n(w.line.goal) })}${earned}`;
  const protein = fill(t('today_protein'), { p: w.protein.g, target: w.protein.target });
  return (
    <View style={{ gap: 2 }} accessible accessibilityLabel={`${label ? `${n(w.kcal)} ${label}. ` : ''}${line}. ${protein}`}>
      {label ? (
        <>
          <Micro color={w.alarm ? C.red : C.textDim}>{label}</Micro>
          <Text style={{ color: w.alarm ? C.red : C.text, fontSize: F.number, lineHeight: lh(F.number, true), fontWeight: '500', fontVariant: ['tabular-nums'] }}>{n(w.kcal)}</Text>
        </>
      ) : null}
      <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>{line}</Text>
      <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>{protein}</Text>
    </View>
  );
}
