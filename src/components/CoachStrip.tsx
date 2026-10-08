import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Advice } from '../core/coach';
import { fill, makeT } from '../i18n';
import { useMinute } from '../services/useWorkSchedule';
import { useApp } from '../store/AppProvider';
import { Card, Micro, Row } from '../ui/components';
import { C, F } from '../ui/theme';
import { useCoach } from './useCoach';

const ICON: Record<Advice['kind'], keyof typeof Ionicons.glyphMap> = {
  food: 'restaurant-outline',
  stop: 'hand-left-outline',
  water: 'water-outline',
  move: 'walk-outline',
  sleep: 'moon-outline',
  weigh: 'scale-outline',
  win: 'sparkles-outline',
  log: 'create-outline',
};

function tone(a: Advice): string {
  if (a.kind === 'win') return C.green;
  if (a.kind === 'stop') return C.amber;
  return a.urgency === 'now' ? C.accent : C.textDim;
}

/** Turns an advice's action into the screen or sheet that does it. */
export function useAdviceAction() {
  const app = useApp();
  const router = useRouter();
  return (a: Advice, open?: { suggest?: () => void; weigh?: () => void }) => {
    if (a.action === 'log') router.push('/log');
    else if (a.action === 'plan') (open?.suggest ?? (() => router.push('/log')))();
    else if (a.action === 'water') app.addWater(app.state.settings.glassMl);
    else if (a.action === 'walk') router.push('/fit');
    else if (a.action === 'sleep') router.push('/sleep');
    else if (a.action === 'weigh') (open?.weigh ?? (() => router.push('/journey')))();
  };
}

export function adviceText(a: Advice, t: (k: string) => string): string {
  const params = { ...a.params, meal: typeof a.params.meal === 'string' ? t(a.params.meal).toLowerCase() : '' };
  return fill(t(a.key), params);
}

/**
 * The coach, always on Today: the one or two things that matter right now,
 * each with the tap that does it. Says nothing when there is nothing to say.
 */
export function CoachStrip({ onSuggest, onWeigh, max = 2 }: { onSuggest?: () => void; onWeigh?: () => void; max?: number }) {
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  const minute = useMinute();
  const advice = useCoach(minute);
  const act = useAdviceAction();
  const show = advice.slice(0, max);
  if (show.length === 0) return null;
  return (
    <Card rail={tone(show[0])}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Micro color={C.textDim}>{t('coach_says')}</Micro>
        {advice.length > max ? <Micro color={C.textFaint}>{fill(t('coach_more'), { n: advice.length - max })}</Micro> : null}
      </Row>
      {show.map((a) => (
        <Pressable
          key={a.key}
          onPress={() => act(a, { suggest: onSuggest, weigh: onWeigh })}
          disabled={a.action === 'none'}
          accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.7 : 1 })}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={ICON[a.kind]} size={18} color={tone(a)} />
          </View>
          <Text style={{ flex: 1, color: C.text, fontSize: F.body, lineHeight: 22, fontWeight: a.urgency === 'now' ? '600' : '500' }}>{adviceText(a, t)}</Text>
          {a.action !== 'none' ? <Ionicons name="chevron-forward" size={16} color={C.textGhost} /> : null}
        </Pressable>
      ))}
    </Card>
  );
}
