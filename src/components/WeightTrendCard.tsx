import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { formatDayMonthYear } from '../core/date';
import { weightTrend } from '../core/insights';
import { planFrom } from '../core/plan';
import { weightIsStale } from '../core/progress';
import { oneDecimal, shortDecimal, signedKg } from '../core/tileText';
import { weightPoints } from '../core/tiles';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, Micro, Small } from '../ui/components';
import { C, F, lh } from '../ui/theme';
import { toPath } from '../ui/tileGeometry';

const SPARK_W = 100;
const SPARK_H = 32;
/** Room above and below the line, so its stroke is never cut. */
const INSET = 3;
/** The weigh-ins the line shows. */
const SPARK_COUNT = 12;

/**
 * The weight trend: the weight smoothed over a week of the calendar, its
 * change over three weeks, the last twelve weigh-ins as a line, and the goal
 * with the date it comes at the target pace, year included. A latest weigh-in
 * more than thirty days old says when it was instead of a change.
 */
export function WeightTrendCard() {
  const { state, targets, today } = useApp();
  const lang = state.profile.lang;
  const t = makeT(lang);
  const trend = useMemo(() => weightTrend(state.weights, today), [state.weights, today]);
  const plan = useMemo(() => planFrom(state.profile, state.weights, targets, today), [state.profile, state.weights, targets, today]);
  const line = useMemo(
    () => (state.weights.length >= 2 ? toPath(weightPoints(state.weights, SPARK_W, SPARK_H - 2 * INSET, SPARK_COUNT).map((p) => ({ x: p.x, y: p.y + INSET }))) : ''),
    [state.weights],
  );
  const kg = t('unit_kg');
  const goal = shortDecimal(plan.goalKg);
  const goalWords =
    plan.toGoKg <= 0
      ? t('progress_goal_reached')
      : plan.etaAtTarget
        ? fill(t('progress_goal_by'), { goal, date: formatDayMonthYear(plan.etaAtTarget, lang) })
        : fill(t('progress_goal'), { goal });
  const stale = trend ? weightIsStale(trend.asOf, today) : false;
  const change = trend && !stale ? trend.change21 : null;
  const changeWords = !trend
    ? ''
    : stale
      ? fill(t('progress_last_weighin'), { date: formatDayMonthYear(trend.asOf, lang) })
      : change !== null
        ? fill(t('progress_change_3w'), { kg: signedKg(change) })
        : t('progress_change_none');

  return (
    <Card>
      <Micro color={C.textDim}>{t('progress_trend')}</Micro>
      {trend ? (
        <>
          <Text style={{ color: C.text, fontSize: F.number, lineHeight: lh(F.number, true), fontWeight: '400', fontVariant: ['tabular-nums'] }}>
            {oneDecimal(trend.current)}
            <Text style={{ color: C.textDim, fontSize: F.title, fontWeight: '400' }}>{` ${kg}`}</Text>
          </Text>
          <Small color={change !== null && change < 0 ? C.green : C.textDim}>{changeWords}</Small>
          {line ? (
            // The numbers are in the words; the line only shows their shape, so a screen reader passes it by.
            <View style={{ height: 48 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Svg width="100%" height="100%" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none">
                <Path d={line} stroke={C.accent} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </Svg>
            </View>
          ) : null}
        </>
      ) : (
        <Small color={C.textDim}>{t('progress_no_weight')}</Small>
      )}
      <Small color={C.textDim}>{goalWords}</Small>
    </Card>
  );
}
