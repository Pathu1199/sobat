import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BreakCard } from '../../components/BreakCard';
import { DayReview } from '../../components/DayReview';
import { DecisionCard } from '../../components/DecisionCard';
import { TipCard } from '../../components/TipCard';
import { formatMinutes, localHHMM, localHour } from '../../core/date';
import { decide } from '../../core/decide';
import { findPatterns, scoreDay, weeklyStats } from '../../core/insights';
import { pendingCount } from '../../core/queue';
import { sleepFlags } from '../../core/sleep';
import { makeT } from '../../i18n';
import { useAI } from '../../services/useAI';
import { useApp } from '../../store/AppProvider';
import { Card, Divider, H1, ListRow, MeterRow, Micro, Ring, RingStat, Row, Screen, SectionHeader, Small, StatusChip } from '../../ui/components';
import { C, F, S, scoreColor } from '../../ui/theme';
import { useBreakpoint } from '../../ui/useBreakpoint';

export default function TodayScreen() {
  const app = useApp();
  const { ai } = useAI();
  const router = useRouter();
  const { state, budget, targets, waterToday, streakDays, today } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  // The design leads in English with the chosen language underneath.
  const en = makeT('en');
  const hour = new Date().getHours();
  const bp = useBreakpoint();
  const wide = bp === 'desktop';

  const greetKey = hour < 12 ? 'good_morning' : hour < 17 ? 'good_afternoon' : 'good_evening';
  const greeting = en(greetKey);
  const greetingAlt = lang === 'en' ? null : t(greetKey);

  const todayMeals = state.meals.filter((m) => m.date === today);
  const workoutToday = state.workouts.find((w) => w.date === today && w.status === 'done');
  const moodToday = state.moods.filter((m) => m.date === today).slice(-1)[0];
  const sleepAll = [...state.sleep].sort((a, b) => a.date.localeCompare(b.date));
  const sleepLast = sleepAll[sleepAll.length - 1];

  const lateMealDays = useMemo(
    () => new Set(state.meals.filter((m) => localHour(m.at) >= 22).map((m) => m.date)).size,
    [state.meals],
  );

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
  const online = ai.route === 'primary' || ai.route === 'fallback';
  const queued = pendingCount(state.photoQueue);

  const header = (
    <>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <H1>
            {greeting}, {state.profile.name || 'there'}
          </H1>
          {greetingAlt ? <Small color={C.textFaint}>{greetingAlt}</Small> : null}
        </View>
        <Row style={{ gap: 7 }}>
          {streakDays > 0 ? <StatusChip label={`${streakDays}d`} color={C.amber} /> : null}
          <StatusChip label={online ? t('ai_lan') : t('ai_offline')} color={online ? C.accent : C.textGhost} />
        </Row>
      </Row>

      {queued > 0 ? (
        <Small color={C.cyan}>{(queued === 1 ? t('photos_queued') : t('photos_queued_plural')).replace('{n}', String(queued))}</Small>
      ) : null}
    </>
  );

  const heroCard = (
      <Card>
        <Row style={{ gap: 20, alignItems: 'center' }}>
          <Ring value={budget.consumed} max={budget.target} size={116} stroke={7} color={over ? C.red : C.accent}>
            <Text style={{ color: C.text, fontSize: 27, fontWeight: '300', letterSpacing: -0.8 }}>{Math.abs(budget.remaining)}</Text>
            <Micro>{over ? t('kcal_over') : t('kcal_left')}</Micro>
          </Ring>

          <View style={{ flex: 1, gap: 14 }}>
            <MeterRow label={en('eaten')} alt={lang === 'en' ? undefined : t('eaten')} value={budget.consumed} total={budget.target} unit="kcal" color={C.accent} />
            <MeterRow
              label="Protein"
              alt={lang === 'en' ? undefined : t('protein')}
              value={budget.proteinConsumed}
              total={budget.proteinTarget}
              unit="g"
              color={C.violet}
            />
            <MeterRow
              label="Water"
              alt={lang === 'en' ? undefined : t('water')}
              value={waterToday}
              total={state.settings.waterGoalMl}
              unit="ml"
              color={C.cyan}
            />
            {app.stepsToday > 0 ? (
              <MeterRow label={en('steps_today')} alt={lang === 'en' ? undefined : t('steps_today')} value={app.stepsToday} total={8000} color={C.green} />
            ) : null}
          </View>
        </Row>

        <Divider />
        <Row style={{ gap: 8 }}>
          <QuickAction icon="add" label={t('add_food')} onPress={() => router.push('/log')} />
          <QuickAction icon="camera-outline" label={t('add_photo')} onPress={() => router.push('/photo')} />
          <QuickAction icon="water-outline" label={t('add_water')} onPress={() => app.addWater(state.settings.glassMl)} />
        </Row>
      </Card>
  );

  const sleepCard = (

    needsSleepCheckin ? (
        <Card>
          <ListRow
            icon={<Ionicons name="moon-outline" size={17} color={C.cyan} />}
            title={t('sleep_checkin')}
            sub={t('sleep_title')}
            onPress={() => router.push('/sleep')}
            trailing={<Ionicons name="chevron-forward" size={17} color={C.textFaint} />}
          />
        </Card>
      ) : sleepLast ? (
        <Card>
          <Pressable onPress={() => router.push('/sleep')}>
            <Row style={{ gap: 12 }}>
              <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="moon-outline" size={17} color={C.cyan} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Row style={{ gap: 8, alignItems: 'baseline' }}>
                  <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '500' }}>{formatMinutes(sleepLast.minutes)}</Text>
                  <Micro>{t('sleep_title')}</Micro>
                </Row>
                <Text style={{ color: C.textFaint, fontSize: F.tiny }}>
                  {sleepLast.bed} - {sleepLast.wake} · {sleepLast.wakeups} {t('wakeups').toLowerCase()}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: scoreColor(sleepLast.score), fontSize: F.h2, fontWeight: '500' }}>{sleepLast.score}</Text>
                <Micro>Score</Micro>
              </View>
              <Ionicons name="chevron-forward" size={17} color={C.textFaint} />
            </Row>
          </Pressable>
          {flags.map((f) => (
            <Small key={f} color={f === 'apnea_screen' ? C.amber : C.textFaint}>
              {t(`flag_${f}`)}
            </Small>
          ))}
        </Card>
      ) : null
  );

  const scoresBlock = (
      <View style={{ gap: 10 }}>
        <SectionHeader title={t('today_plan')} meta={t('daily_aggregate')} />
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <RingStat label={t('eaten')} value={score.eating} color={scoreColor(score.eating)} />
            <RingStat label={t('burned')} value={score.movement} color={scoreColor(score.movement)} />
            <RingStat label={t('water')} value={score.water} color={scoreColor(score.water)} />
            <RingStat label={t('sleep_title')} value={score.sleep} color={scoreColor(score.sleep)} />
            <RingStat label={t('mind_title')} value={score.mood} color={scoreColor(score.mood)} />
          </Row>
        </Card>
      </View>
  );

  const intakeBlock = (
      <View style={{ gap: 10 }}>
        <SectionHeader
          title={t('logged_intake')}
          meta={`${todayMeals.length} ${todayMeals.length === 1 ? t('session_one') : t('session_many')}`}
        />
        <Card>
          {todayMeals.length === 0 ? (
            <Small color={C.textGhost}>{t('nothing_logged')}</Small>
          ) : (
            todayMeals.map((m, i) => {
              const names = m.items.map((x) => x.name_en).filter(Boolean);
              const alt = lang !== 'en' ? m.items.map((x) => x.name_mr).filter(Boolean)[0] : undefined;
              return (
                <View key={m.id}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow
                    icon={<Ionicons name="restaurant-outline" size={15} color={C.textDim} />}
                    title={t(m.type)}
                    alt={names[0] ? `· ${names.slice(0, 2).join(', ')}` : alt}
                    sub={
                      m.note === 'needs_review'
                        ? t('needs_review')
                        : `${localHHMM(m.at)} · ${m.items.some((x) => x.estimated) ? t('estimated') : t('verified_record')}`
                    }
                    value={String(m.kcal)}
                    valueUnit="kcal"
                  />
                </View>
              );
            })
          )}
        </Card>
      </View>
  );

  const weekBlock = (
      <View style={{ gap: 10 }}>
        <SectionHeader title={t('week_summary')} meta={`${week.loggedDays}/7`} />
        <Card>
          <Row style={{ flexWrap: 'wrap', rowGap: 18 }}>
            <Metric label={t('avg_kcal')} value={String(week.avgKcal)} />
            <Metric label={t('over_days')} value={String(week.overDays)} />
            <Metric label={t('workout_days')} value={String(week.workoutDays)} />
            <Metric label={t('avg_sleep')} value={week.avgSleepMinutes ? formatMinutes(week.avgSleepMinutes) : '--'} />
            {week.trend ? (
              <Metric
                label="kg"
                value={`${week.trend.current}`}
                delta={week.trend.change7 !== null ? `${week.trend.change7 > 0 ? '+' : ''}${week.trend.change7}` : undefined}
                deltaGood={week.trend.change7 !== null ? week.trend.change7 <= 0 : undefined}
              />
            ) : null}
          </Row>
        </Card>
      </View>
  );

  const patternsBlock =
    patterns.length > 0 ? (
      <View style={{ gap: 10 }}>
        <SectionHeader title={t('patterns')} />
        <Card>
          {patterns.slice(0, 3).map((p) => (
            <Small key={p.key}>{p.detail}</Small>
          ))}
        </Card>
      </View>
    ) : null;

  if (wide) {
    return (
      <Screen wide>
        {header}
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
          <View style={{ flex: 1.15, gap: 14 }}>
            {heroCard}
            {weekBlock}
          </View>
          <View style={{ flex: 1, gap: 14 }}>
            <DecisionCard decision={decision} lang={lang} targets={targets} budget={budget} />
            <TipCard />
            {patternsBlock}
          </View>
          <View style={{ flex: 0.95, gap: 14 }}>
            <BreakCard />
            {sleepCard}
            {scoresBlock}
            {intakeBlock}
            <DayReview />
          </View>
        </View>
        <Small color={C.textGhost}>{t('medical_note')}</Small>
      </Screen>
    );
  }

  return (
    <Screen>
      {header}
      {heroCard}
      <DecisionCard decision={decision} lang={lang} targets={targets} budget={budget} />
      {sleepCard}
      {scoresBlock}
      <TipCard />
      <DayReview />
      <BreakCard />
      {intakeBlock}
      {weekBlock}
      {patternsBlock}
      <Small color={C.textGhost}>{t('medical_note')}</Small>
    </Screen>
  );
}

function QuickAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: C.cardAlt,
        borderWidth: S.hairline,
        borderColor: C.border,
        borderRadius: S.radiusSm,
        paddingVertical: 13,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        opacity: pressed ? 0.7 : 1,
      })}>
      <Ionicons name={icon} size={15} color={C.textDim} />
      <Text style={{ color: C.text, fontSize: F.small, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );
}

function Metric({ label, value, delta, deltaGood }: { label: string; value: string; delta?: string; deltaGood?: boolean }) {
  return (
    <View style={{ minWidth: 76, flexGrow: 1, gap: 5 }}>
      <Micro>{label}</Micro>
      <Row style={{ gap: 6, alignItems: 'baseline' }}>
        <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '400' }}>{value}</Text>
        {delta ? <Text style={{ color: deltaGood ? C.cyan : C.amber, fontSize: F.tiny }}>{delta}</Text> : null}
      </Row>
    </View>
  );
}
