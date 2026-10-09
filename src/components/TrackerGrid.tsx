import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { WaterSheet } from './WaterSheet';
import { WeightSheet } from './WeightSheet';
import { addDays, formatMinutes } from '../core/date';
import { fill, makeT } from '../i18n';
import { useBreakMonitor } from '../services/useBreakMonitor';
import { useApp } from '../store/AppProvider';
import { Tile } from '../ui/tiles';
import { C, scoreColor } from '../ui/theme';

/**
 * The day at a glance, six tiles: water, sleep, steps, breaks, meals, weight.
 * Each is the number that matters and one quiet line, and each opens where
 * the thing is done. Water logs a glass on the spot.
 */
export function TrackerGrid() {
  const app = useApp();
  const router = useRouter();
  const monitor = useBreakMonitor();
  const { state, today, waterToday, stepsToday } = app;
  const t = makeT(state.profile.lang);
  const [weightOpen, setWeightOpen] = useState(false);
  const [waterOpen, setWaterOpen] = useState(false);

  const glass = state.settings.glassMl;
  const glasses = Math.round(waterToday / glass);
  const glassGoal = Math.round(state.settings.waterGoalMl / glass);
  const sleep = [...state.sleep].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0];
  const sleepFresh = !!sleep && (sleep.date === today || sleep.date === addDays(today, -1));
  const meals = state.meals.filter((m) => m.date === today).length;
  const lastWeight = [...state.weights].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0];
  const daysSinceWeigh = lastWeight ? Math.round((new Date(today + 'T12:00:00').getTime() - new Date(lastWeight.date + 'T12:00:00').getTime()) / 86400000) : null;
  // Empty tiles say what to do next rather than what is missing.
  const mealHint = app.hour < 11 ? t('empty_log_breakfast') : app.hour < 17 ? t('empty_log_lunch') : t('empty_log_dinner');
  const weighHint = fill(t('empty_weigh_on'), { day: t(`wd_${state.settings.weighDay}`) });

  const tiles = [
    <Tile
      key="water"
      label={t('water')}
      icon="water"
      tint={C.cyan}
      value={`${glasses}/${glassGoal}`}
      sub={`${(waterToday / 1000).toFixed(1)} L · ${t('tap_to_log')}`}
      color={glasses >= glassGoal ? C.green : C.cyan}
      onPress={() => setWaterOpen(true)}
    />,
    <Tile key="sleep" icon="moon" tint={C.violet} label={t('sleep_title')} value={sleepFresh ? formatMinutes(sleep.minutes) : '—'} sub={sleepFresh ? `${t('score')} ${sleep.score}` : t('empty_sleep')} color={sleepFresh ? scoreColor(sleep.score) : C.textDim} onPress={() => router.push('/sleep')} />,
    <Tile key="steps" icon="footsteps" tint={C.green} label={t('steps')} value={stepsToday > 0 ? stepsToday.toLocaleString() : '—'} sub={stepsToday > 0 ? `/ 8,000` : t('steps_phone_only')} color={stepsToday >= 8000 ? C.green : C.text} onPress={() => router.push('/fit')} />,
    <Tile
      key="breaks"
      label={t('brk_eye_care')}
      icon="eye"
      tint={C.accent}
      value={monitor.enabled ? String(monitor.takenToday) : '—'}
      sub={monitor.enabled && Number.isFinite(monitor.secondsLeft) ? `${t('next_break')} ${Math.max(0, Math.ceil(monitor.secondsLeft / 60))}m` : t('break_off')}
      color={monitor.enabled ? C.accent : C.textDim}
      onPress={() => router.push('/settings')}
    />,
    <Tile key="meals" icon="restaurant" tint={C.amber} label={t('tile_meals')} value={String(meals)} sub={meals === 0 ? mealHint : t('tap_to_log')} color={meals > 0 ? C.text : C.textDim} onPress={() => router.push('/log')} />,
    <Tile
      key="weight"
      label={t('add_weight')}
      icon="scale"
      tint={C.pink}
      value={lastWeight ? `${lastWeight.kg}` : '—'}
      sub={lastWeight && daysSinceWeigh !== null ? (daysSinceWeigh === 0 ? t('today_short') : `${daysSinceWeigh} ${t('days_ago')}`) : weighHint}
      color={daysSinceWeigh !== null && daysSinceWeigh > 9 ? C.amber : C.text}
      onPress={() => setWeightOpen(true)}
    />,
  ];

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {tiles.map((tile) => (
        <View key={tile.key as string} style={{ flexBasis: '31%', flexGrow: 1 }}>
          {React.cloneElement(tile, { width: undefined })}
        </View>
      ))}
      <WeightSheet open={weightOpen} onClose={() => setWeightOpen(false)} />
      <WaterSheet open={waterOpen} onClose={() => setWaterOpen(false)} />
    </View>
  );
}
