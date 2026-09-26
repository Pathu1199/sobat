import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatMinutes } from '../../core/date';
import { changePct, isImprovement, summarize, type Metric, type Period } from '../../core/growth';
import { hourlyProfile, longestStretchMinutes, minutesOn } from '../../core/usage';
import { WeeklyReport } from '../../components/WeeklyReport';
import { makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { BarChart, ConsistencyStrip, HourStrip, LineChart } from '../../ui/charts';
import { Card, Divider, Empty, H2, H3, Row, Screen, Small } from '../../ui/components';
import { C, F } from '../../ui/theme';

const PERIODS: Period[] = ['today', 'week', 'month'];

const METRIC_LABEL: Record<string, string> = {
  avg_kcal: 'avg_kcal_m',
  on_target: 'on_target',
  logged_days: 'logged_days_m',
  workout_days: 'workout_days_m',
  move_minutes: 'move_minutes',
  avg_sleep: 'avg_sleep_m',
  avg_water: 'avg_water',
  avg_mood: 'avg_mood',
  screen_time: 'screen_time',
  weight_change: 'weight_change',
};

export default function GrowthScreen() {
  const app = useApp();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const [period, setPeriod] = useState<Period>('week');

  const summary = useMemo(
    () =>
      summarize(period, app.today, {
        meals: app.state.meals,
        water: app.state.water,
        weights: app.state.weights,
        sleep: app.state.sleep,
        moods: app.state.moods,
        workouts: app.state.workouts,
        usage: app.state.usage,
        kcalTarget: app.targets.kcal,
        waterGoalMl: app.state.settings.waterGoalMl,
      }),
    [period, app.today, app.state, app.targets.kcal],
  );

  const weightMetric = summary.metrics.find((m) => m.key === 'weight_change')!;
  const hasAnything = summary.metrics.some((m) => m.value !== 0);
  const screenToday = minutesOn(app.state.usage, app.today);
  const sitting = longestStretchMinutes(app.state.usage, app.today);
  const breaksToday = app.state.breaks.filter((b) => b.date === app.today);
  const breaksTaken = breaksToday.filter((b) => b.action === 'taken').length;

  return (
    <Screen>
      <Row style={{ gap: 6, backgroundColor: C.card, padding: 4, borderRadius: 999, borderWidth: 1, borderColor: C.border }}>
        {PERIODS.map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 999,
              backgroundColor: period === p ? C.teal : 'transparent',
              alignItems: 'center',
            }}>
            <Text style={{ color: period === p ? C.white : C.textDim, fontSize: F.small, fontWeight: '600' }}>{t(`period_${p}`)}</Text>
          </Pressable>
        ))}
      </Row>

      {!hasAnything ? (
        <Card>
          <H3>{t('no_data_yet')}</H3>
          <Small>{t('log_more_days')}</Small>
        </Card>
      ) : null}

      <Card>
        <Small>{t('weight_change')}</Small>
        <Row style={{ alignItems: 'flex-end', gap: 10 }}>
          <Text style={{ color: C.text, fontSize: 46, fontWeight: '200', letterSpacing: -1 }}>
            {weightMetric.value > 0 ? '+' : ''}
            {weightMetric.value.toFixed(1)}
          </Text>
          <Text style={{ color: C.textDim, fontSize: F.h3, marginBottom: 10 }}>kg</Text>
          <View style={{ flex: 1 }} />
          <TrendChip metric={weightMetric} lang={lang} />
        </Row>
        {summary.weightSeries.length >= 2 ? (
          <LineChart data={summary.weightSeries} goal={app.state.profile.goalWeightKg} format={(v) => `${v.toFixed(1)} kg`} />
        ) : (
          // One weigh-in cannot make a line, and an empty chart box reads as broken.
          <Small color={C.textFaint}>{t('log_more_days')}</Small>
        )}
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {summary.metrics
          .filter((m) => m.key !== 'weight_change')
          .map((m) => (
            <MetricTile key={m.key} metric={m} label={t(METRIC_LABEL[m.key] ?? m.key)} lang={lang} />
          ))}
      </View>

      {period !== 'today' ? <WeeklyReport summary={summary} /> : null}

      <Card>
        <H3>{t('calories_vs_target')}</H3>
        <BarChart data={summary.kcalSeries} target={app.targets.kcal} format={(v) => `${v} kcal`} />
      </Card>

      <Card>
        <H3>{t('consistency')}</H3>
        <ConsistencyStrip data={summary.consistency} />
        <Small>
          {summary.consistency.filter((c) => c.onTarget).length} / {summary.consistency.length} {t('on_target').toLowerCase()}
        </Small>
      </Card>

      <Card>
        <H3>{t('sleep_hours')}</H3>
        <BarChart data={summary.sleepSeries} target={450} color={C.blue} format={(v) => formatMinutes(v)} />
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <H3>{t('screen_time')}</H3>
          <Small>{formatMinutes(screenToday)}</Small>
        </Row>
        <HourStrip hours={hourlyProfile(app.state.usage, app.today)} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Small>0:00</Small>
          <Small>12:00</Small>
          <Small>23:00</Small>
        </Row>
        <Divider />
        <Row style={{ justifyContent: 'space-between' }}>
          <Small>{t('longest_sitting')}</Small>
          <Small color={sitting >= 120 ? C.amber : C.textDim}>{formatMinutes(sitting)}</Small>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Small>{t('break_compliance')}</Small>
          <Small color={C.textDim}>
            {breaksTaken} / {breaksToday.length}
          </Small>
        </Row>
        <BarChart data={summary.screenSeries} color={C.purple} format={(v) => formatMinutes(v)} height={80} />
      </Card>
    </Screen>
  );
}

function MetricTile({ metric, label, lang }: { metric: Metric; label: string; lang: any }) {
  const value =
    metric.unit === 'min' && metric.value >= 60
      ? formatMinutes(metric.value)
      : metric.decimals
        ? metric.value.toFixed(metric.decimals)
        : String(metric.value);
  const unit = metric.unit === 'min' && metric.value >= 60 ? '' : metric.unit;

  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: '46%',
        backgroundColor: C.card,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 14,
        padding: 14,
        gap: 6,
      }}>
      <Text style={{ color: C.textDim, fontSize: F.tiny }}>{label}</Text>
      <Row style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={{ color: C.text, fontSize: 24, fontWeight: '300' }}>{value}</Text>
        {unit ? <Text style={{ color: C.textFaint, fontSize: F.tiny, marginBottom: 4 }}>{unit}</Text> : null}
      </Row>
      <TrendChip metric={metric} lang={lang} />
    </View>
  );
}

/** Colours the arrow by whether the change is good, not by its direction. */
function TrendChip({ metric, lang }: { metric: Metric; lang: any }) {
  const t = makeT(lang);
  const pct = changePct(metric);
  const good = isImprovement(metric);
  if (pct === null || good === null) return <Text style={{ color: C.textFaint, fontSize: F.tiny }}>{t('vs_previous')} -</Text>;
  const color = good ? C.teal : C.amber;
  return (
    <Row style={{ gap: 4 }}>
      <Text style={{ color, fontSize: F.tiny }}>
        {pct > 0 ? '↑' : '↓'} {Math.abs(pct)}%
      </Text>
      <Text style={{ color: C.textFaint, fontSize: F.tiny }}>{t('vs_previous')}</Text>
    </Row>
  );
}
