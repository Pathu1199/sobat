import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { WeeklyReport } from '../../components/WeeklyReport';
import { formatMinutes } from '../../core/date';
import { changePct, isImprovement, summarize, type Metric, type Period } from '../../core/growth';
import { hourlyProfile, longestStretchMinutes, minutesOn } from '../../core/usage';
import { makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { BarChart, ConsistencyStrip, HourStrip, LineChart } from '../../ui/charts';
import { Bar, Card, Divider, H1, Micro, Row, Screen, SectionHeader, Segmented, Small } from '../../ui/components';
import { C, F, S } from '../../ui/theme';

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

const WEEKDAY = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function GrowthScreen() {
  const app = useApp();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const en = makeT('en');
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

  const toGoal = Math.max(0, Math.round((app.state.profile.weightKg - app.state.profile.goalWeightKg) * 10) / 10);
  const startWeight = app.state.weights[0]?.kg ?? app.state.profile.weightKg;
  const totalToLose = Math.max(1, startWeight - app.state.profile.goalWeightKg);
  const progressed = Math.max(0, startWeight - app.state.profile.weightKg);

  const key = (m: Metric) => t(METRIC_LABEL[m.key] ?? m.key);

  return (
    <Screen>
      <Segmented
        value={period}
        onChange={setPeriod}
        options={[
          { key: 'today', label: en('period_today') },
          { key: 'week', label: en('period_week') },
          { key: 'month', label: en('period_month') },
        ]}
      />

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Micro>{`${en('weight_change')} · ${en(`period_${period}`)}`}</Micro>
          <Micro color={weightMetric.value <= 0 ? C.cyan : C.amber}>{weightMetric.value <= 0 ? en('on_track_short') : en('watch_short')}</Micro>
        </Row>
        <Row style={{ alignItems: 'flex-end', gap: 8 }}>
          <Text style={{ color: C.text, fontSize: 42, fontWeight: '200', letterSpacing: -1.5 }}>
            {weightMetric.value > 0 ? '+' : ''}
            {weightMetric.value.toFixed(1)}
          </Text>
          <Text style={{ color: C.textDim, fontSize: F.h2, marginBottom: 8 }}>kg</Text>
        </Row>

        <View style={{ gap: 7 }}>
          <Bar value={progressed} max={totalToLose} color={C.accent} height={5} />
          <Row style={{ justifyContent: 'space-between' }}>
            <Micro>{`${app.state.profile.weightKg} kg ${en('now')}`}</Micro>
            <Micro>{`${toGoal} kg ${en('to_goal')}`}</Micro>
          </Row>
        </View>
      </Card>

      {!hasAnything ? (
        <Card>
          <Small>{t('log_more_days')}</Small>
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {summary.metrics
          .filter((m) => m.key !== 'weight_change')
          .map((m) => (
            <MetricTile key={m.key} metric={m} label={key(m)} lang={lang} />
          ))}
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader
          title={`${en('consistency')} · ${en(`period_${period}`)}`}
          meta={`${summary.consistency.filter((c) => c.onTarget).length}/${summary.consistency.length}`}
        />
        <Card>
          <ConsistencyStrip data={summary.consistency} labels={period === 'week' ? WEEKDAY : undefined} />
        </Card>
      </View>

      {period !== 'today' ? <WeeklyReport summary={summary} /> : null}

      <View style={{ gap: 10 }}>
        <SectionHeader title={en('weight_trend')} meta={lang === 'en' ? undefined : t('weight_trend')} />
        <Card>
          {summary.weightSeries.length >= 2 ? (
            <LineChart data={summary.weightSeries} goal={app.state.profile.goalWeightKg} format={(v) => `${v.toFixed(1)} kg`} />
          ) : (
            <Small color={C.textGhost}>{t('log_more_days')}</Small>
          )}
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title={en('calories_vs_target')} meta={`${app.targets.kcal} kcal`} />
        <Card>
          <BarChart data={summary.kcalSeries} target={app.targets.kcal} format={(v) => `${v} kcal`} />
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title={en('sleep_hours')} meta="7h 30m" />
        <Card>
          <BarChart data={summary.sleepSeries} target={450} color={C.violet} format={(v) => formatMinutes(v)} />
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title={en('screen_time')} meta={formatMinutes(screenToday)} />
        <Card>
          <HourStrip hours={hourlyProfile(app.state.usage, app.today)} />
          <Row style={{ justifyContent: 'space-between' }}>
            <Micro>00</Micro>
            <Micro>12</Micro>
            <Micro>23</Micro>
          </Row>
          <Divider />
          <Row style={{ justifyContent: 'space-between' }}>
            <Micro>{en('longest_sitting')}</Micro>
            <Text style={{ color: sitting >= 120 ? C.amber : C.text, fontSize: F.small, fontWeight: '600' }}>{formatMinutes(sitting)}</Text>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Micro>{en('break_compliance')}</Micro>
            <Text style={{ color: C.text, fontSize: F.small, fontWeight: '600' }}>
              {breaksTaken}
              <Text style={{ color: C.textFaint, fontWeight: '400' }}> / {breaksToday.length}</Text>
            </Text>
          </Row>
        </Card>
      </View>
    </Screen>
  );
}

function MetricTile({ metric, label, lang }: { metric: Metric; label: string; lang: any }) {
  const t = makeT(lang);
  const isTime = metric.unit === 'min' && metric.value >= 60;
  const value = isTime ? formatMinutes(metric.value) : metric.decimals ? metric.value.toFixed(metric.decimals) : String(metric.value);
  const unit = isTime ? '' : metric.unit;

  const pct = changePct(metric);
  const good = isImprovement(metric);
  const deltaColor = good === null ? C.textGhost : good ? C.cyan : C.amber;

  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: '46%',
        backgroundColor: C.card,
        borderWidth: S.hairline,
        borderColor: C.border,
        borderRadius: S.radius,
        padding: 16,
        gap: 9,
      }}>
      <Micro>{label}</Micro>
      <Row style={{ alignItems: 'baseline', gap: 4 }}>
        <Text style={{ color: C.text, fontSize: 24, fontWeight: '300', letterSpacing: -0.5 }}>{value}</Text>
        {unit ? <Text style={{ color: C.textFaint, fontSize: F.tiny }}>{unit}</Text> : null}
      </Row>
      <View
        style={{
          alignSelf: 'flex-start',
          backgroundColor: C.cardAlt,
          borderRadius: 999,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderWidth: S.hairline,
          borderColor: C.border,
        }}>
        <Text style={{ color: deltaColor, fontSize: F.micro, fontWeight: '500' }}>
          {pct === null ? t('vs_previous') : `${pct > 0 ? '+' : ''}${pct}% ${t('vs_previous')}`}
        </Text>
      </View>
    </View>
  );
}
