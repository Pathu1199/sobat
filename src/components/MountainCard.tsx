import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { badges, climbTrail, level, weeklyChallenge, xp, type GameInput } from '../core/game';
import { motivationKey, planFrom } from '../core/plan';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Bar, Card, Micro, Pill, Row, Small } from '../ui/components';
import { Mountain } from '../ui/Mountain';
import { C, F } from '../ui/theme';

/** Everything the game needs, from the store. Shared with the Journey screen. */
export function useGame() {
  const { state, targets, today } = useApp();
  return useMemo(() => {
    const plan = planFrom(state.profile, state.weights, targets, today);
    const input: GameInput = {
      today,
      meals: state.meals,
      water: state.water,
      weights: state.weights,
      sleep: state.sleep,
      steps: state.steps,
      workouts: state.workouts,
      kcalTarget: targets.kcal,
      waterGoalMl: state.settings.waterGoalMl,
      startKg: plan.startKg,
      goalKg: plan.goalKg,
      offDays: state.settings.offDays,
    };
    const total = Math.max(0, plan.startKg - plan.goalKg);
    const progress = total > 0 ? Math.min(1, Math.max(0, plan.lostKg / total)) : plan.toGoKg <= 0 ? 1 : 0;
    const camps = total > 0 ? [0.25, 0.5, 0.75].map((p) => ({ p, label: `${Math.round((plan.startKg - total * p) * 10) / 10}` })) : [];
    const points = xp(input);
    return { plan, input, progress, camps, trail: climbTrail(state.weights, plan.startKg, plan.goalKg).map((t) => t.p), points, level: level(points), badges: badges(input), challenge: weeklyChallenge(input, state.settings.weighDay) };
  }, [state.profile, state.weights, state.meals, state.water, state.sleep, state.steps, state.workouts, state.settings.waterGoalMl, state.settings.weighDay, state.settings.offDays, targets, today]);
}

/**
 * The climb, on Today: the mountain with the climber where this week's
 * weigh-in put them, the camp reached, this week's challenge, and the
 * newest badge. Tap for the whole journey.
 */
export function MountainCard() {
  const app = useApp();
  const router = useRouter();
  const t = makeT(app.state.profile.lang);
  const g = useGame();
  const earned = g.badges.filter((b) => b.earned);
  const newest = earned[earned.length - 1];

  return (
    <Pressable onPress={() => router.push('/journey')} accessibilityRole="button">
      <Card rail={C.cyan}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Micro color={C.textDim}>{t('journey_title')}</Micro>
          <Row style={{ gap: 6 }}>
            <Pill label={`⛰ ${t(`level_${g.level.key}`)}`} color={C.cardAlt} textColor={C.cyan} />
            <Ionicons name="chevron-forward" size={14} color={C.textGhost} />
          </Row>
        </Row>
        <Mountain progress={g.progress} startLabel={`${g.plan.startKg} kg`} nowLabel={`${g.plan.currentKg} kg`} goalLabel={`${g.plan.goalKg} kg`} camps={g.camps} trail={g.trail} />
        <Row style={{ gap: 18 }}>
          <Stat label={t('plan_lost')} value={`${g.plan.lostKg}`} color={C.cyan} />
          <Stat label={t('plan_to_go')} value={`${g.plan.toGoKg}`} />
          <Stat label={t('xp')} value={`${g.points}`} color={C.amber} />
          <Stat label={t('badges')} value={`${earned.length}/${g.badges.length}`} />
        </Row>
        <Small color={C.textDim}>{fill(t(motivationKey(g.plan, app.today)), { lost: g.plan.lostKg, togo: g.plan.toGoKg, days: g.plan.daysLogging })}</Small>
        <View style={{ gap: 6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Micro>{`${t('challenge_week')} · ${fill(t(`challenge_${g.challenge.key}`), { n: g.challenge.target })}`}</Micro>
            <Micro color={g.challenge.done ? C.green : C.textDim}>{g.challenge.done ? t('challenge_done') : `${g.challenge.n}/${g.challenge.target}`}</Micro>
          </Row>
          <Bar value={g.challenge.n} max={g.challenge.target} color={g.challenge.done ? C.green : C.accent} />
        </View>
        {newest ? <Micro color={C.textFaint}>{`🏅 ${t('badge_latest')}: ${t(`badge_${newest.key}`)}`}</Micro> : null}
      </Card>
    </Pressable>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ gap: 2, minWidth: 56 }}>
      <Micro>{label}</Micro>
      <Text style={{ color: color ?? C.text, fontSize: F.h2, fontWeight: '700', letterSpacing: -0.5 }}>{value}</Text>
    </View>
  );
}
