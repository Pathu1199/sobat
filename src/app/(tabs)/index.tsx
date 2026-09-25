import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AIBadge } from '../../components/AIBadge';
import { BreakCard } from '../../components/BreakCard';
import { DecisionCard } from '../../components/DecisionCard';
import { TipCard } from '../../components/TipCard';
import { toISODate } from '../../core/date';
import { decide } from '../../core/decide';
import { findPatterns, scoreDay, weeklyStats } from '../../core/insights';
import { sleepFlags } from '../../core/sleep';
import { makeT } from '../../i18n';
import { useAI } from '../../services/useAI';
import { useApp } from '../../store/AppProvider';
import { Bar, Btn, Card, Divider, H1, H3, P, Ring, Row, Screen, Small } from '../../ui/components';
import { C, F } from '../../ui/theme';

export default function TodayScreen() {
  const app = useApp();
  const { ai } = useAI();
  const router = useRouter();
  const { state, budget, targets, waterToday, streakDays, today } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const hour = new Date().getHours();

  const greeting = hour < 12 ? t('good_morning') : hour < 17 ? t('good_afternoon') : t('good_evening');

  const todayMeals = state.meals.filter((m) => m.date === today);
  const workoutToday = state.workouts.find((w) => w.date === today && w.status === 'done');
  const moodToday = state.moods.filter((m) => m.date === today).slice(-1)[0];
  const sleepLast = [...state.sleep].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0];

  const lateMealDays = useMemo(() => {
    const days = new Set(state.meals.filter((m) => Number(m.at.slice(11, 13)) >= 22).map((m) => m.date));
    return days.size;
  }, [state.meals]);

  const decision = useMemo(
    () =>
      decide({
        budget,
        hour,
        waterMl: waterToday,
        waterGoalMl: state.settings.waterGoalMl,
        movedToday: !!workoutToday,
        lateMealDays,
      }),
    [budget, hour, waterToday, state.settings.waterGoalMl, workoutToday, lateMealDays],
  );

  const score = scoreDay({
    date: today,
    kcal: budget.consumed,
    kcalTarget: budget.target,
    waterMl: waterToday,
    waterGoalMl: state.settings.waterGoalMl,
    workedOut: !!workoutToday,
    workoutMinutes: workoutToday?.minutes ?? 0,
    sleepScore: sleepLast?.date === today ? sleepLast.score : undefined,
    moodScore: moodToday?.score,
    hour,
  });

  const week = weeklyStats({
    today,
    meals: state.meals,
    water: state.water,
    workouts: state.workouts,
    sleep: state.sleep,
    weights: state.weights,
    kcalTarget: targets.kcal,
    waterGoalMl: state.settings.waterGoalMl,
  });

  const patterns = useMemo(
    () => findPatterns({ meals: state.meals, sleep: state.sleep, moods: state.moods, workouts: state.workouts, kcalTarget: targets.kcal }),
    [state.meals, state.sleep, state.moods, state.workouts, targets.kcal],
  );

  const flags = sleepFlags(state.sleep);
  const over = budget.remaining < 0;
  const needsSleepCheckin = !state.sleep.some((s) => s.date === today);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Screen>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <H1>{greeting}{state.profile.name ? `, ${state.profile.name}` : ''}</H1>
            {streakDays > 0 ? <Small color={C.teal}>{streakDays} {t('streak_days')}</Small> : null}
          </View>
          <AIBadge route={ai.route} lang={lang} />
        </Row>

        {!ai.checking && ai.route === 'offline' ? <Small color={C.textFaint}>{t('ai_offline_hint')}</Small> : null}

        <Card>
          <Row style={{ justifyContent: 'space-around', alignItems: 'center' }}>
            <Ring value={budget.consumed} max={budget.target} color={over ? C.red : C.teal} size={150}>
              <Text style={{ color: C.text, fontSize: 30, fontWeight: '600' }}>{Math.abs(budget.remaining)}</Text>
              <Text style={{ color: C.textDim, fontSize: F.small }}>{over ? t('kcal_over') : t('kcal_left')}</Text>
            </Ring>
            <View style={{ gap: 12, flex: 1, maxWidth: 220 }}>
              <StatLine label={t('eaten')} value={`${budget.consumed}`} sub={`/ ${budget.target}`} />
              <View style={{ gap: 4 }}>
                <StatLine label={t('protein')} value={`${budget.proteinConsumed}`} sub={`/ ${budget.proteinTarget} g`} />
                <Bar value={budget.proteinConsumed} max={budget.proteinTarget} color={C.purple} />
              </View>
              <View style={{ gap: 4 }}>
                <StatLine label={t('water')} value={`${Math.round(waterToday / 250)}`} sub={`/ ${Math.round(state.settings.waterGoalMl / 250)} ${t('glasses')}`} />
                <Bar value={waterToday} max={state.settings.waterGoalMl} color={C.blue} />
              </View>
            </View>
          </Row>

          <Divider />
          <Row style={{ gap: 8 }}>
            <Btn small label={`+ ${t('add_food')}`} onPress={() => router.push('/log')} style={{ flex: 1 }} />
            <Btn small tone="soft" label={`+ ${t('add_photo')}`} onPress={() => router.push('/photo')} style={{ flex: 1 }} />
            <Btn small tone="soft" label={`+ ${t('add_water')}`} onPress={() => app.addWater(state.settings.glassMl)} style={{ flex: 1 }} />
          </Row>
        </Card>

        <DecisionCard decision={decision} lang={lang} />

        <TipCard />

        <BreakCard />

        {needsSleepCheckin ? (
          <Pressable onPress={() => router.push('/sleep')}>
            <Card tone={C.blue}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <H3>{t('sleep_checkin')}</H3>
                  <Small>{t('sleep_title')}</Small>
                </View>
                <Ionicons name="chevron-forward" size={20} color={C.textDim} />
              </Row>
            </Card>
          </Pressable>
        ) : sleepLast ? (
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <H3>{t('sleep_title')}</H3>
              <Small>{Math.floor(sleepLast.minutes / 60)}h {sleepLast.minutes % 60}m · {t('sleep_score')} {sleepLast.score}</Small>
            </Row>
            {flags.map((f) => (
              <Small key={f} color={f === 'apnea_screen' ? C.amber : C.textDim}>{t(`flag_${f}`)}</Small>
            ))}
          </Card>
        ) : null}

        <Card>
          <H3>{t('today_plan')}</H3>
          <Row style={{ flexWrap: 'wrap', gap: 14 }}>
            <ScorePill label={t('eaten')} value={score.eating} />
            <ScorePill label={t('burned')} value={score.movement} />
            <ScorePill label={t('water')} value={score.water} />
            <ScorePill label={t('sleep_title')} value={score.sleep} />
            <ScorePill label={t('mind_title')} value={score.mood} />
          </Row>
        </Card>

        <Card>
          <H3>{t('week_summary')}</H3>
          <Row style={{ flexWrap: 'wrap', gap: 16 }}>
            <Metric label={t('logged_days')} value={`${week.loggedDays}/7`} />
            <Metric label={t('over_days')} value={`${week.overDays}`} />
            <Metric label={t('workout_days')} value={`${week.workoutDays}`} />
            <Metric label={t('avg_kcal')} value={`${week.avgKcal}`} />
            <Metric label={t('avg_sleep')} value={week.avgSleepMinutes ? `${Math.floor(week.avgSleepMinutes / 60)}h` : '-'} />
            {week.trend ? <Metric label="kg" value={`${week.trend.current}${week.trend.change7 !== null ? ` (${week.trend.change7 > 0 ? '+' : ''}${week.trend.change7})` : ''}`} /> : null}
          </Row>
        </Card>

        {patterns.length > 0 ? (
          <Card>
            <H3>{t('patterns')}</H3>
            {patterns.slice(0, 3).map((p) => (
              <Small key={p.key}>{p.detail}</Small>
            ))}
          </Card>
        ) : null}

        {todayMeals.length > 0 ? (
          <Card>
            <H3>{t('tab_log')}</H3>
            {todayMeals.map((m) => (
              <Row key={m.id} style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <P>{m.items.map((i) => (lang === 'mr' ? i.name_mr || i.name_en : i.name_en)).join(', ') || t(m.type)}</P>
                  <Small>{t(m.type)} · {m.at.slice(11, 16)}</Small>
                </View>
                <Text style={{ color: C.text, fontWeight: '600' }}>{m.kcal}</Text>
              </Row>
            ))}
          </Card>
        ) : null}

        <Small color={C.textFaint}>{t('medical_note')}</Small>
      </Screen>
    </View>
  );
}

function StatLine({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Text style={{ color: C.textDim, fontSize: F.small }}>{label}</Text>
      <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600' }}>
        {value}
        <Text style={{ color: C.textFaint, fontWeight: '400', fontSize: F.small }}> {sub}</Text>
      </Text>
    </Row>
  );
}

function ScorePill({ label, value }: { label: string; value: number | null }) {
  // A dash means 'nothing logged yet', which should not look like a zero.
  const known = value !== null;
  const color = !known ? C.textFaint : value >= 70 ? C.teal : value >= 40 ? C.amber : C.textFaint;
  return (
    <View style={{ alignItems: 'center', gap: 6, minWidth: 56 }}>
      <Ring value={known ? value : 0} max={100} size={48} stroke={5} color={color}>
        <Text style={{ color: known ? C.text : C.textFaint, fontSize: F.tiny }}>{known ? value : '-'}</Text>
      </Ring>
      <Text style={{ color: C.textDim, fontSize: F.tiny }}>{label}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 70 }}>
      <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '600' }}>{value}</Text>
      <Text style={{ color: C.textDim, fontSize: F.tiny }}>{label}</Text>
    </View>
  );
}

