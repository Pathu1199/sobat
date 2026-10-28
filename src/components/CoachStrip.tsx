import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Advice } from '../core/coach';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useMinute } from '../services/useWorkSchedule';
import { useApp } from '../store/AppProvider';
import { Card, Micro, Row } from '../ui/components';
import { C, F, lh, S } from '../ui/theme';
import { addedText } from '../ui/tileWords';
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

/**
 * Turns an advice's action into the screen or sheet that does it. The water
 * advice adds one bottle to today and says so, "Added 500 ml water", with an
 * Undo that takes exactly that bottle away: a tap never logs silently.
 */
export function useAdviceAction() {
  const app = useApp();
  const fb = useFeedback();
  const router = useRouter();
  const t = makeT(app.state.profile.lang);
  function addBottle() {
    const ml = app.state.settings.bottleMl;
    const id = app.addWater(ml);
    fb.haptic('light');
    fb.notify(addedText({ kind: 'water', id, amount: ml, date: app.today }, t), { label: t('undo'), onPress: () => app.removeWater(id) });
  }
  return (a: Advice, open?: { suggest?: () => void; weigh?: () => void }) => {
    if (a.action === 'log') router.push('/log');
    else if (a.action === 'plan') (open?.suggest ?? (() => router.push('/log')))();
    else if (a.action === 'water') addBottle();
    else if (a.action === 'walk') router.push('/body');
    else if (a.action === 'sleep') router.push('/body?s=sleep');
    else if (a.action === 'weigh') (open?.weigh ?? (() => router.push('/progress')))();
  };
}

export function adviceText(a: Advice, t: (k: string) => string): string {
  const params = { ...a.params, meal: typeof a.params.meal === 'string' ? t(a.params.meal).toLowerCase() : '' };
  return fill(t(a.words ?? a.key), params);
}

/** What a tap on the advice does, for a screen reader, where its words do not say it: the water advice adds one bottle. */
export function adviceHint(a: Advice, t: (k: string) => string, bottleMl: number): string | undefined {
  return a.action === 'water' ? fill(t('coach_water_hint'), { ml: bottleMl }) : undefined;
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
      {show.map((a) => {
        const row = { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: S.touch } as const;
        const text = adviceText(a, t);
        const body = (
          <>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={ICON[a.kind]} size={18} color={tone(a)} />
            </View>
            <Text style={{ flex: 1, color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{text}</Text>
          </>
        );
        // Advice with nothing to do is plain words, as on CoachLine, not a button that is off.
        if (a.action === 'none') {
          return (
            <View key={a.key} style={row} accessible accessibilityRole="text" accessibilityLabel={text}>
              {body}
            </View>
          );
        }
        return (
          <Pressable
            key={a.key}
            onPress={() => act(a, { suggest: onSuggest, weigh: onWeigh })}
            accessibilityRole="button"
            accessibilityHint={adviceHint(a, t, state.settings.bottleMl)}
            style={({ pressed }) => [row, { opacity: pressed ? 0.7 : 1 }]}>
            {body}
            <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
          </Pressable>
        );
      })}
    </Card>
  );
}
