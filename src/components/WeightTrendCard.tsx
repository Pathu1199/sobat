import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { shownPlan } from '../core/plan';
import { formatDayMonthYear } from '../core/date';
import { oneDecimal, shortDecimal, shownWeight, signedKg } from '../core/tileText';
import { weightPoints } from '../core/tiles';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, Micro, Row, Small } from '../ui/components';
import { C, F, lh } from '../ui/theme';
import { toPath } from '../ui/tileGeometry';
import { WeightSheet } from './WeightSheet';

const SPARK_W = 100;
const SPARK_H = 32;
/** Room above and below the line, so its stroke is never cut. */
const INSET = 3;
/** The weigh-ins the line shows. */
const SPARK_COUNT = 12;

/**
 * Progress's one weight card: the weight smoothed over a week of the
 * calendar and its change over three weeks or more, in the weeks it really
 * spans (the same weight and change as Today's Weight tile, `shownWeight`),
 * the last twelve weigh-ins as a line, and the goal with the date it comes at
 * the target pace, year included. A latest weigh-in more than thirty days old
 * says when it was instead of a change. A tap opens the weight entry, as the
 * Weight tile's does; a screen reader hears the card's words as one button.
 */
export function WeightTrendCard() {
  const { state, targets, today } = useApp();
  const lang = state.profile.lang;
  const t = makeT(lang);
  const [open, setOpen] = useState(false);
  const trend = useMemo(() => shownWeight(state.weights, today), [state.weights, today]);
  const plan = useMemo(() => shownPlan(state.profile, state.weights, targets, today), [state.profile, state.weights, targets, today]);
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
  const change = trend?.change ?? null;
  const changeWords = !trend
    ? ''
    : trend.stale
      ? fill(t('progress_last_weighin'), { date: formatDayMonthYear(trend.asOf, lang) })
      : change
        ? fill(t('progress_change'), { kg: signedKg(change.kg), weeks: change.weeks })
        : t('progress_change_none');

  const kgWords = trend ? `${oneDecimal(trend.kg)} ${kg}` : t('progress_no_weight');
  const label = [`${t('progress_trend')}: ${kgWords}`, changeWords, goalWords].filter(Boolean).join('. ');

  // The entry is a modal beside the card, not inside it, so it never adds to the card's own spacing.
  return (
    <>
      <Card>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={t('tile_hint_weight')}
          style={({ pressed }) => ({ gap: 12, opacity: pressed ? 0.85 : 1 })}>
          <Row style={{ justifyContent: 'space-between', gap: 8 }}>
            <Micro color={C.textDim}>{t('progress_trend')}</Micro>
            <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
          </Row>
          {trend ? (
            <>
              <Text style={{ color: C.text, fontSize: F.number, lineHeight: lh(F.number, true), fontWeight: '400', fontVariant: ['tabular-nums'] }}>
                {oneDecimal(trend.kg)}
                <Text style={{ color: C.textDim, fontSize: F.title, fontWeight: '400' }}>{` ${kg}`}</Text>
              </Text>
              <Small color={change && change.kg < 0 ? C.green : C.textDim}>{changeWords}</Small>
              {line ? (
                // The numbers are in the words; the line only shows their shape, so a screen reader passes it by, on the web too.
                <View style={{ height: 48 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
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
        </Pressable>
      </Card>
      <WeightSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
