import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { formatMinutes } from '../core/date';
import { readiness } from '../core/fitness';
import { expectedWaterByHour } from '../core/nudge';
import { makeT } from '../i18n';
import { useBreakMonitor } from '../services/useBreakMonitor';
import { useApp } from '../store/AppProvider';
import { Tile } from '../ui/tiles';
import { C, readinessColor, scoreColor } from '../ui/theme';

/** Energy, sleep, next break, mood, water pace. One glance, five taps. */
export function NowStrip({ wide }: { wide?: boolean }) {
  const app = useApp();
  const router = useRouter();
  const monitor = useBreakMonitor();
  const { state, today, waterToday, hour } = app;
  const t = makeT(state.profile.lang);

  const sleepLast = useMemo(() => [...state.sleep].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0], [state.sleep]);
  const sleepToday = state.sleep.some((s) => s.date === today);
  const lastWorkout = useMemo(() => [...state.workouts].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0], [state.workouts]);
  const moodToday = state.moods.filter((m) => m.date === today).slice(-1)[0];
  const r = readiness({ lastSleep: sleepLast, lastWorkout, moodScore: moodToday?.score });

  const glass = Math.max(1, state.settings.glassMl);
  const expected = expectedWaterByHour(hour, state.settings.waterGoalMl);
  const diffGlasses = Math.round((waterToday - expected) / glass);
  const waterSub = diffGlasses === 0 ? t('on_pace') : diffGlasses < 0 ? t('behind_glasses').replace('{n}', String(-diffGlasses)) : t('ahead_glasses').replace('{n}', String(diffGlasses));
  const glasses = Math.round(waterToday / glass);
  const glassGoal = Math.round(state.settings.waterGoalMl / glass);

  const tiles = [
    <Tile key="energy" label={t('energy')} value={String(r.score)} sub={t(`reason_${r.reasons[0] ?? 'good_sleep'}`)} color={readinessColor(r.level)} onPress={() => router.push('/body')} />,
    <Tile
      key="sleep"
      label={t('sleep_title')}
      value={sleepToday && sleepLast ? formatMinutes(sleepLast.minutes) : t('check_in')}
      sub={sleepToday && sleepLast ? `${t('score')} ${sleepLast.score}` : undefined}
      color={sleepToday && sleepLast ? scoreColor(sleepLast.score) : C.cyan}
      onPress={() => router.push('/body?s=sleep')}
    />,
    <Tile
      key="break"
      label={t('next_break')}
      value={monitor.enabled ? `${Math.ceil(monitor.secondsLeft / 60)}m` : '--'}
      sub={monitor.enabled ? `${monitor.takenToday} ${t('break_compliance')}` : t('break_off')}
      color={monitor.enabled && monitor.secondsLeft <= 120 ? C.amber : C.text}
      onPress={() => router.push('/settings')}
    />,
    <Tile
      key="mood"
      label={t('mind_title')}
      value={moodToday ? `${moodToday.score}/5` : t('log_mood')}
      sub={moodToday?.note}
      color={moodToday ? scoreColor(((moodToday.score - 1) / 4) * 100) : C.violet}
      onPress={() => router.push('/body?s=mind')}
    />,
    <Tile key="water" label={t('water')} value={`${glasses}/${glassGoal}`} sub={waterSub} color={diffGlasses < 0 ? C.amber : C.cyan} onPress={() => router.push('/log')} />,
  ];

  if (wide) {
    return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{tiles}</View>;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }} style={{ marginHorizontal: -2 }}>
      {tiles}
    </ScrollView>
  );
}
