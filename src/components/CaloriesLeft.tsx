import React from 'react';
import { Text, View } from 'react-native';
import { burnedOn, eatBack } from '../core/activity';
import type { DayMode, DayView } from '../core/dayView';
import { caloriesLeft } from '../core/todayLayout';
import { isOffDay } from '../core/week';
import { fill, makeT, numberText } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Bar } from '../ui/components';
import { C, F, lh } from '../ui/theme';

/**
 * The one number the day is about, on the page and centred: calories left
 * (core/todayLayout.ts decides what it says), its label under it, a bar of
 * what is eaten against the goal, and one quiet line. Today it is the live
 * budget (a walk earns some back), with "Planned X · Goal Y"; a past day is
 * the goal and what its walks earned, less what was eaten, with "Eaten X of
 * Y"; a future day is what the plan leaves. The app's own suggestion
 * (`suggested`, which Today works out once from the day's menu) is named
 * "Suggested" and never shown in red, and nothing is red on a free day or
 * before the user started; a day before the start shows only what was eaten,
 * with no bar. Protein against its target ends the line, which wraps instead
 * of running into the edge.
 */
export function CaloriesLeft({ mode, view, suggested }: { mode: DayMode; view: DayView; suggested: boolean }) {
  const { state, budget, targets } = useApp();
  const t = makeT(state.profile.lang);
  const offDay = isOffDay(state.settings.offDays, view.date);
  const dayEarned = eatBack(burnedOn(state.activities ?? [], view.date));
  const w = caloriesLeft({ mode, targets, view, budget, suggested, offDay, dayEarned });
  // Latin digits and a comma for thousands on every device, as the rest of the app writes numbers, whatever the phone's language.
  const n = numberText;
  const label = w.label ? t(w.label) : null;
  const earned = w.earned > 0 ? ` · +${n(w.earned)} ${t('earned_short')}` : '';
  const protein = fill(t('today_protein'), { p: w.protein.g, target: w.protein.target });
  const line = `${fill(t(w.line.key), { planned: n(w.line.kcal), eaten: n(w.line.kcal), goal: n(w.line.goal) })}${earned} · ${protein}`;
  return (
    <View style={{ alignItems: 'center', gap: 4 }} accessible accessibilityLabel={`${label ? `${n(w.kcal)} ${label}. ` : ''}${line}`}>
      {label ? (
        <>
          <Text style={{ color: w.alarm ? C.red : C.text, fontSize: F.number, lineHeight: lh(F.number, true), fontWeight: '500', fontVariant: ['tabular-nums'] }}>{n(w.kcal)}</Text>
          <Text style={{ color: w.alarm ? C.red : C.textDim, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{label}</Text>
          {/* On the page, not in a card, so the empty part of the bar takes a deeper grey than a card's. */}
          <View style={{ alignSelf: 'stretch', marginVertical: 6 }}>
            <Bar value={w.bar.used} max={w.bar.of} height={5} color={w.alarm ? C.red : C.accent} track={C.cardHigh} />
          </View>
        </>
      ) : null}
      <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small), textAlign: 'center' }}>{line}</Text>
    </View>
  );
}
