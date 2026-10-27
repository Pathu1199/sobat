import React from 'react';
import { Text, View } from 'react-native';
import type { DayMode, DayView } from '../core/dayView';
import { caloriesLeft } from '../core/todayLayout';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Micro } from '../ui/components';
import { C, F, lh } from '../ui/theme';

/**
 * The one number the day is about: calories left (core/todayLayout.ts
 * decides what it says). Today it is the live budget (a walk earns some
 * back), with "Planned X · Goal Y"; a past day is the goal less what was
 * eaten, with "Eaten X of Y"; a future day is what the plan leaves. The app's
 * own suggestion is named "Suggested" and never shown in red. Protein against
 * its target goes under it, on its own line so it wraps instead of running
 * into the edge.
 */
export function CaloriesLeft({ mode, view }: { mode: DayMode; view: DayView }) {
  const app = useApp();
  const { state, budget, targets } = app;
  const t = makeT(state.profile.lang);
  // A past day reads what was eaten, so only today and a future day ask whether the menu is the app's suggestion.
  const suggested = mode !== 'past' && app.isSuggestedMenu(app.menuOn(view.date));
  const w = caloriesLeft({ mode, targets, view, budget, suggested });
  const n = (x: number) => x.toLocaleString();
  const label = t(w.label);
  const earned = w.earned > 0 ? ` · +${n(w.earned)} ${t('earned_short')}` : '';
  const line = `${fill(t(w.line.key), { planned: n(w.line.kcal), eaten: n(w.line.kcal), goal: n(w.line.goal) })}${earned}`;
  const protein = fill(t('today_protein'), { p: w.protein.g, target: w.protein.target });
  return (
    <View style={{ gap: 2 }} accessible accessibilityLabel={`${n(w.kcal)} ${label}. ${line}. ${protein}`}>
      <Micro color={w.alarm ? C.red : C.textDim}>{label}</Micro>
      <Text style={{ color: w.alarm ? C.red : C.text, fontSize: F.number, lineHeight: lh(F.number, true), fontWeight: '500', fontVariant: ['tabular-nums'] }}>{n(w.kcal)}</Text>
      <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>{line}</Text>
      <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>{protein}</Text>
    </View>
  );
}
