import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { formatMinutes } from '../core/date';
import { weekdayOf } from '../core/routine';
import { weekSummary, type WeekDay } from '../core/week';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, Divider, Micro, Row, Small } from '../ui/components';
import { C, F, MICRO } from '../ui/theme';

function bandColor(b: WeekDay['kcalBand']): string {
  return b === 'none' ? C.border : b === 'heavy' ? C.red : b === 'over' ? C.amber : C.green;
}

/**
 * The seven days as columns: did each day eat on target, drink enough,
 * sleep, move, weigh. One row per thing, one glance per week. This is the
 * picture behind "is the plan working".
 */
export function WeekGrid() {
  const { state, targets, today } = useApp();
  const t = makeT(state.profile.lang);
  const s = useMemo(
    () => weekSummary({ today, meals: state.meals, water: state.water, sleep: state.sleep, steps: state.steps, weights: state.weights, kcalTarget: targets.kcal, waterGoalMl: state.settings.waterGoalMl }),
    [today, state.meals, state.water, state.sleep, state.steps, state.weights, targets.kcal, state.settings.waterGoalMl],
  );
  const maxKcal = Math.max(targets.kcal * 1.3, ...s.days.map((d) => d.kcal));

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Micro color={C.textDim}>{t('week_view')}</Micro>
        <Micro>{fill(t('week_logged'), { n: s.loggedDays })}</Micro>
      </Row>

      {/* Calories: a bar per day against the target line. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 92, marginTop: 4 }}>
        {s.days.map((d) => {
          const h = Math.max(3, Math.round((d.kcal / maxKcal) * 76));
          const isToday = d.date === today;
          return (
            <View key={d.date} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View style={{ width: '100%', height: 76, justifyContent: 'flex-end' }}>
                <View style={{ position: 'absolute', left: 0, right: 0, bottom: Math.round((targets.kcal / maxKcal) * 76), height: 1, backgroundColor: C.borderStrong }} />
                <View style={{ height: h, borderRadius: 6, backgroundColor: bandColor(d.kcalBand), opacity: d.logged ? 1 : 0.5 }} />
              </View>
              <Text style={[MICRO, { color: isToday ? C.accent : C.textFaint }]}>{t(`wd_${weekdayOf(d.date)}`)}</Text>
            </View>
          );
        })}
      </View>
      <Small color={C.textFaint}>{fill(t('week_kcal_line'), { on: s.onTargetDays, heavy: s.heavyDays, avg: s.avgKcal, target: targets.kcal })}</Small>

      <Divider />
      <RowOfDots label={t('water')} days={s.days} value={(d) => (d.waterMl > 0 ? `${Math.round(d.waterMl / 250)}` : '·')} ok={(d) => d.waterGoal} />
      <RowOfDots label={t('sleep_title')} days={s.days} value={(d) => (d.sleepMinutes !== null ? `${Math.round(d.sleepMinutes / 30) / 2}h` : '·')} ok={(d) => (d.sleepMinutes ?? 0) >= 420} />
      <RowOfDots label={t('steps')} days={s.days} value={(d) => (d.steps > 0 ? `${Math.round(d.steps / 1000)}k` : '·')} ok={(d) => d.steps >= 7000} />
      <RowOfDots label={t('add_weight')} days={s.days} value={(d) => (d.weightKg !== null ? `${d.weightKg}` : '·')} ok={(d) => d.weightKg !== null} />

      <Divider />
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Stat label={t('water_goal')} value={`${s.waterGoalDays}/7`} />
        <Stat label={t('avg_sleep_m')} value={s.avgSleepMinutes !== null ? formatMinutes(s.avgSleepMinutes) : '—'} />
        <Stat label={t('weight_change')} value={s.weightChange !== null ? `${s.weightChange > 0 ? '+' : ''}${s.weightChange} ${t('unit_kg')}` : '—'} color={s.weightChange !== null && s.weightChange < 0 ? C.green : undefined} />
      </Row>
    </Card>
  );
}

function RowOfDots({ label, days, value, ok }: { label: string; days: WeekDay[]; value: (d: WeekDay) => string; ok: (d: WeekDay) => boolean }) {
  return (
    <Row style={{ gap: 6 }}>
      <Text style={[MICRO, { color: C.textFaint, width: 54 }]} numberOfLines={1}>
        {label}
      </Text>
      {days.map((d) => {
        const v = value(d);
        const empty = v === '·';
        return (
          <View key={d.date} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: empty ? C.textGhost : ok(d) ? C.green : C.textDim, fontSize: F.tiny, fontWeight: ok(d) && !empty ? '600' : '400' }}>{v}</Text>
          </View>
        );
      })}
    </Row>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Micro>{label}</Micro>
      <Text style={{ color: color ?? C.text, fontSize: F.h3, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}
