import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { addDays } from '../core/date';
import { foodName } from '../core/foods';
import { bhajiFor, setBhajiOverride, weekdayOf } from '../core/routine';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Card, Micro, Pill, Row, Small } from '../ui/components';
import { C, F } from '../ui/theme';

const EVENING_HOUR = 17;
const CHOICES = 10;

/**
 * In the evening, one question: which bhaji tomorrow? The answer sits on
 * top of the weekly plan for that one day, so the morning card already
 * knows and the shopping can happen tonight.
 */
export function TomorrowCard() {
  const app = useApp();
  const router = useRouter();
  const fb = useFeedback();
  const { state, foods, today, hour } = app;
  const routine = state.routine;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const tomorrow = addDays(today, 1);
  const chosen = bhajiFor(routine, tomorrow);
  const overridden = !!routine.overrides?.[tomorrow];

  // Light vegetable dishes, the ones the week is built from, with the usual one first.
  const choices = useMemo(() => {
    const usual = routine.week[weekdayOf(tomorrow)] ?? [];
    const pool = foods
      .filter((f) => f.category === 'veg')
      .sort((a, b) => Number(b.tags.includes('healthy_swap')) - Number(a.tags.includes('healthy_swap')) || a.kcal_100g - b.kcal_100g)
      .map((f) => f.id);
    const ordered = [...usual, ...chosen, ...pool].filter((id, i, arr) => arr.indexOf(id) === i && foods.some((f) => f.id === id));
    return ordered.slice(0, CHOICES);
  }, [foods, routine.week, tomorrow, chosen]);

  if (!routine.enabled || hour < EVENING_HOUR) return null;

  function pick(id: string) {
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id].slice(-2);
    app.setRoutine(setBhajiOverride(routine, tomorrow, next, today));
    fb.haptic('light');
  }

  const name = (id: string) => {
    const f = foods.find((x) => x.id === id);
    return f ? foodName(f, lang) : id;
  };

  return (
    <Card rail={C.violet}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ gap: 8 }}>
          <Ionicons name="moon-outline" size={15} color={C.violet} />
          <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '600' }}>{t('tomorrow_q')}</Text>
        </Row>
        <Micro>{t(`wd_${weekdayOf(tomorrow)}`)}</Micro>
      </Row>
      {chosen.length > 0 ? (
        <Small color={overridden ? C.violet : C.textDim}>{fill(t('tomorrow_set'), { b: chosen.map(name).join(lang === 'mr' ? ' किंवा ' : lang === 'hi' ? ' या ' : ' or ') })}</Small>
      ) : (
        <Small color={C.textFaint}>{t('tomorrow_hint')}</Small>
      )}
      <Row style={{ flexWrap: 'wrap', gap: 6 }}>
        {choices.map((id) => (
          <Pill key={id} label={name(id)} active={chosen.includes(id)} onPress={() => pick(id)} />
        ))}
        <Pressable onPress={() => router.push('/routine')} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, justifyContent: 'center' })}>
          <Micro color={C.accent}>{`${t('more_choices')} ›`}</Micro>
        </Pressable>
      </Row>
      <View />
    </Card>
  );
}
