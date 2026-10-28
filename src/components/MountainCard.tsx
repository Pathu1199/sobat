import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { gameView } from '../core/game';
import { motivationKey } from '../core/plan';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Bar, Card, Micro, Pill, Row, Small } from '../ui/components';
import { Mountain } from '../ui/Mountain';
import { C, F } from '../ui/theme';

/**
 * Everything the game needs, from the store (`gameView`). Shared with the
 * Journey screen and Progress. Lost, To go and the climb are the chapter's, at
 * the weight Progress shows; points and badges are the whole journey's, the
 * streak badges and the points counting the streak over the whole journey.
 */
export function useGame() {
  const { state, targets, today, streakDays, bestStreakDays, lifetimeStreakDays, lifetimeBestStreakDays } = useApp();
  return useMemo(
    () =>
      gameView({
        state: {
          profile: state.profile,
          weights: state.weights,
          meals: state.meals,
          water: state.water,
          sleep: state.sleep,
          steps: state.steps,
          workouts: state.workouts,
          celebrated: state.celebrated,
          settings: { waterGoalMl: state.settings.waterGoalMl, weighDay: state.settings.weighDay, offDays: state.settings.offDays },
        },
        targets,
        today,
        streakDays,
        bestStreakDays,
        lifetime: { streakDays: lifetimeStreakDays, bestStreakDays: lifetimeBestStreakDays },
      }),
    [state.profile, state.weights, state.meals, state.water, state.sleep, state.steps, state.workouts, state.settings.waterGoalMl, state.settings.weighDay, state.settings.offDays, state.celebrated, streakDays, bestStreakDays, lifetimeStreakDays, lifetimeBestStreakDays, targets, today],
  );
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
    <Pressable onPress={() => router.push('/progress')} accessibilityRole="button">
      <Card rail={C.cyan}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Micro color={C.textDim}>{t('journey_title')}</Micro>
          <Row style={{ gap: 6 }}>
            <Pill label={`⛰ ${t(`level_${g.level.key}`)}`} color={C.cardAlt} textColor={C.cyan} />
            <Ionicons name="chevron-forward" size={14} color={C.textFaint} />
          </Row>
        </Row>
        <Mountain progress={g.progress} startLabel={`${g.plan.startKg} ${t('unit_kg')}`} nowLabel={`${g.plan.currentKg} ${t('unit_kg')}`} goalLabel={`${g.plan.goalKg} ${t('unit_kg')}`} camps={g.camps} trail={g.trail} />
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
      <Text style={{ color: color ?? C.text, fontSize: F.title, fontWeight: '500' }}>{value}</Text>
    </View>
  );
}
