import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { TopBarActions } from '../../components/TopBarActions';
import { WeeklyReport } from '../../components/WeeklyReport';
import { WeekGrid } from '../../components/WeekGrid';
import { breakStats } from '../../core/breaks';
import { formatDayLabel, formatMinutes } from '../../core/date';
import { changePct, isImprovement, summarize, type Metric, type Period } from '../../core/growth';
import { breakStreak, findPatterns, weeklyStats } from '../../core/insights';
import { hourlyProfile, longestStretchMinutes, minutesOn } from '../../core/usage';
import { fill, makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { BarChart, ConsistencyStrip, HourStrip, LineChart } from '../../ui/charts';
import { Bar, Card, Divider, Micro, Row, SectionHeader, Segmented, Small } from '../../ui/components';
import { Page } from '../../ui/TopBar';
import { Cols } from '../../ui/tiles';
import { C, F, S } from '../../ui/theme';
import { useBreakpoint } from '../../ui/useBreakpoint';

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
  const wide = useBreakpoint() === 'desktop';
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

  const week = useMemo(
    () =>
      weeklyStats({
        today: app.today,
        meals: app.state.meals,
        water: app.state.water,
        workouts: app.state.workouts,
        sleep: app.state.sleep,
        weights: app.state.weights,
        kcalTarget: app.targets.kcal,
        waterGoalMl: app.state.settings.waterGoalMl,
      }),
    [app.today, app.state.meals, app.state.water, app.state.workouts, app.state.sleep, app.state.weights, app.targets.kcal, app.state.settings.waterGoalMl],
  );

  const patterns = useMemo(
    () => findPatterns({ meals: app.state.meals, sleep: app.state.sleep, moods: app.state.moods, workouts: app.state.workouts, kcalTarget: app.targets.kcal }),
    [app.state.meals, app.state.sleep, app.state.moods, app.state.workouts, app.targets.kcal],
  );

  const periodBreaks = useMemo(
    () => breakStats(app.state.breaks.filter((b) => summary.dates.includes(b.date))),
    [app.state.breaks, summary.dates],
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

  const label = (m: Metric) => t(METRIC_LABEL[m.key] ?? m.key);
  // Weekday letters for a week; day-of-month every fifth day for a month.
  const barLabels = summary.kcalSeries.map((d, i) =>
    summary.kcalSeries.length <= 7 ? WEEKDAY[(new Date(d.date + 'T12:00:00').getDay() + 6) % 7] : i % 5 === 0 ? d.date.slice(8) : '',
  );
  const dayLabel = (d: string) => formatDayLabel(d, lang);

  const periodSwitch = (
    <Segmented
      value={period}
      onChange={setPeriod}
      options={[
        { key: 'today', label: t('period_today') },
        { key: 'week', label: t('period_week') },
        { key: 'month', label: t('period_month') },
      ]}
    />
  );

  const headline = (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Micro>{`${t('weight_change')} · ${t(`period_${period}`)}`}</Micro>
        <Micro color={weightMetric.value <= 0 ? C.cyan : C.amber}>{weightMetric.value <= 0 ? t('on_track_short') : t('watch_short')}</Micro>
      </Row>
      <Row style={{ alignItems: 'flex-end', gap: 8 }}>
        <Text style={{ color: C.text, fontSize: 42, fontWeight: '200', letterSpacing: -1.5 }}>
          {weightMetric.value > 0 ? '+' : ''}
          {weightMetric.value.toFixed(1)}
        </Text>
        <Text style={{ color: C.textDim, fontSize: F.h2, marginBottom: 8 }}>{t('unit_kg')}</Text>
      </Row>
      <View style={{ gap: 7 }}>
        <Bar value={progressed} max={totalToLose} color={C.accent} height={5} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Micro>{`${app.state.profile.weightKg} ${t('unit_kg')} ${t('now')}`}</Micro>
          <Micro>{`${toGoal} ${t('unit_kg')} ${t('to_goal')}`}</Micro>
        </Row>
      </View>
    </Card>
  );

  const consistency = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={`${t('consistency')} · ${t(`period_${period}`)}`} meta={`${summary.consistency.filter((c) => c.onTarget).length}/${summary.consistency.length}`} />
      <Card>
        <ConsistencyStrip data={summary.consistency} labels={period === 'week' ? WEEKDAY : undefined} />
      </Card>
    </View>
  );

  const tiles = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {summary.metrics
        .filter((m) => m.key !== 'weight_change')
        .map((m) => (
          <MetricTile key={m.key} metric={m} label={label(m)} lang={lang} wide={wide} />
        ))}
    </View>
  );

  const weightChart = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={t('weight_trend')} meta={lang === 'en' ? undefined : t('weight_trend')} />
      <Card>
        {summary.weightSeries.length >= 2 ? (
          <LineChart data={summary.weightSeries} goal={app.state.profile.goalWeightKg} format={(v) => `${v.toFixed(1)} ${t('unit_kg')}`} dateLabel={dayLabel} />
        ) : (
          <Small color={C.textGhost}>{t('log_more_days')}</Small>
        )}
      </Card>
    </View>
  );

  const kcalChart = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={t('calories_vs_target')} meta={`${app.targets.kcal} kcal`} />
      <Card>
        <BarChart data={summary.kcalSeries} target={app.targets.kcal} format={(v) => `${v} kcal`} labels={barLabels} />
      </Card>
    </View>
  );

  const sleepChart = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={t('sleep_hours')} meta="7h 30m" />
      <Card>
        <BarChart data={summary.sleepSeries} target={450} color={C.violet} format={(v) => formatMinutes(v)} labels={barLabels} />
      </Card>
    </View>
  );

  const screenCard = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={t('screen_time')} meta={formatMinutes(screenToday)} />
      <Card>
        <HourStrip hours={hourlyProfile(app.state.usage, app.today)} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Micro>00</Micro>
          <Micro>12</Micro>
          <Micro>23</Micro>
        </Row>
        <Divider />
        <Row style={{ justifyContent: 'space-between' }}>
          <Micro>{t('longest_sitting')}</Micro>
          <Text style={{ color: sitting >= 120 ? C.amber : C.text, fontSize: F.small, fontWeight: '600' }}>{formatMinutes(sitting)}</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Micro>{t('break_compliance')}</Micro>
          <Text style={{ color: C.text, fontSize: F.small, fontWeight: '600' }}>
            {breaksTaken}
            <Text style={{ color: C.textFaint, fontWeight: '500' }}> / {breaksToday.length}</Text>
          </Text>
        </Row>
      </Card>
    </View>
  );

  const eyeCare = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={t('brk_eye_care')} meta={`${periodBreaks.eyeCareScore}%`} />
      <Card>
        <Row style={{ flexWrap: 'wrap', rowGap: 16 }}>
          {(['micro', 'long', 'posture', 'blink'] as const).map((k) => {
            const s = periodBreaks.byKind[k];
            return (
              <View key={k} style={{ minWidth: 92, flexGrow: 1, gap: 5 }}>
                <Micro>{t(`brk_${k}`)}</Micro>
                <Row style={{ gap: 5, alignItems: 'baseline' }}>
                  <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '700' }}>{s.taken}</Text>
                  <Text style={{ color: C.textFaint, fontSize: F.tiny }}>{`/ ${s.offered} ${t('brk_offered')}`}</Text>
                </Row>
              </View>
            );
          })}
        </Row>
        <Divider />
        <Row style={{ justifyContent: 'space-between' }}>
          <Micro>{t('brk_streak')}</Micro>
          <Text style={{ color: C.cyan, fontSize: F.small, fontWeight: '600' }}>{breakStreak(app.state.breaks, summary.dates)}</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Micro>{t('longest_sitting')}</Micro>
          <Text style={{ color: sitting >= 120 ? C.amber : C.text, fontSize: F.small, fontWeight: '600' }}>{formatMinutes(sitting)}</Text>
        </Row>
      </Card>
    </View>
  );

  const weekCard = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={t('week_summary')} meta={`${week.loggedDays}/7`} />
      <Card>
        <Row style={{ flexWrap: 'wrap', rowGap: 18 }}>
          <Stat label={t('avg_kcal')} value={String(week.avgKcal)} />
          <Stat label={t('over_days')} value={String(week.overDays)} />
          <Stat label={t('workout_days')} value={String(week.workoutDays)} />
          <Stat label={t('avg_sleep')} value={week.avgSleepMinutes ? formatMinutes(week.avgSleepMinutes) : '--'} />
          {week.trend ? (
            <Stat
              label={t('unit_kg')}
              value={`${week.trend.current}`}
              delta={week.trend.change7 !== null ? `${week.trend.change7 > 0 ? '+' : ''}${week.trend.change7}` : undefined}
              deltaGood={week.trend.change7 !== null ? week.trend.change7 <= 0 : undefined}
            />
          ) : null}
        </Row>
      </Card>
    </View>
  );

  const patternsCard = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={t('patterns')} />
      <Card>
        {patterns.length === 0 ? (
          <Small color={C.textGhost}>{t('no_patterns')}</Small>
        ) : (
          patterns.slice(0, 4).map((p) => <Small key={p.key}>{fill(t(`pattern_${p.key}`), p.params)}</Small>)
        )}
      </Card>
    </View>
  );

  const empty = !hasAnything ? (
    <Card>
      <Small>{t('log_more_days')}</Small>
    </Card>
  ) : null;
  const weekGrid = <WeekGrid />;

  if (wide) {
    return (
      <Page title={t('growth')} alt={lang === 'en' ? undefined : t('growth')} right={<TopBarActions />} wide>
        <View style={{ maxWidth: 420 }}>{periodSwitch}</View>
        {empty}
        {weekGrid}
        <Cols weights={[1.2, 1]}>
          {headline}
          {consistency}
        </Cols>
        {tiles}
        <Cols weights={[1, 1]}>
          {weightChart}
          {kcalChart}
        </Cols>
        <Cols weights={[1, 1, 1]}>
          {sleepChart}
          {screenCard}
          {eyeCare}
        </Cols>
        <Cols weights={[1, 1]}>
          {weekCard}
          {patternsCard}
        </Cols>
        {period !== 'today' ? <WeeklyReport summary={summary} /> : null}
      </Page>
    );
  }

  return (
    <Page title={t('growth')} alt={lang === 'en' ? undefined : t('growth')} right={<TopBarActions />}>
      {periodSwitch}
      {empty}
      {weekGrid}
      {headline}
      {tiles}
      {consistency}
      {period !== 'today' ? <WeeklyReport summary={summary} /> : null}
      {weightChart}
      {kcalChart}
      {sleepChart}
      {screenCard}
      {eyeCare}
      {weekCard}
      {patternsCard}
    </Page>
  );
}

function MetricTile({ metric, label, lang, wide }: { metric: Metric; label: string; lang: 'en' | 'mr' | 'hi'; wide: boolean }) {
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
        flexBasis: wide ? '18%' : '46%',
        backgroundColor: C.card,
        borderWidth: S.hairline,
        borderColor: C.border,
        borderRadius: S.radius,
        padding: 16,
        gap: 9,
      }}>
      <Micro>{label}</Micro>
      <Row style={{ alignItems: 'baseline', gap: 4 }}>
        <Text style={{ color: C.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.5 }}>{value}</Text>
        {unit ? <Text style={{ color: C.textFaint, fontSize: F.tiny }}>{unit}</Text> : null}
      </Row>
      <View style={{ alignSelf: 'flex-start', backgroundColor: C.cardAlt, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: S.hairline, borderColor: C.border }}>
        <Text style={{ color: deltaColor, fontSize: F.micro, fontWeight: '500' }}>{pct === null ? t('vs_previous') : `${pct > 0 ? '+' : ''}${pct}% ${t('vs_previous')}`}</Text>
      </View>
    </View>
  );
}

function Stat({ label, value, delta, deltaGood }: { label: string; value: string; delta?: string; deltaGood?: boolean }) {
  return (
    <View style={{ minWidth: 76, flexGrow: 1, gap: 5 }}>
      <Micro>{label}</Micro>
      <Row style={{ gap: 6, alignItems: 'baseline' }}>
        <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '500' }}>{value}</Text>
        {delta ? <Text style={{ color: deltaGood ? C.cyan : C.amber, fontSize: F.tiny }}>{delta}</Text> : null}
      </Row>
    </View>
  );
}
