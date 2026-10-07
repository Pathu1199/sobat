import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, Micro, Row, Small } from '../ui/components';
import { C, F } from '../ui/theme';
import { WeightSheet } from './WeightSheet';

/**
 * The first days, when every tile is a dash: three things to do, each a
 * tap away, each ticking itself off as the data arrives. Gone once a meal,
 * a glass and a weigh-in exist.
 */
export function StartHereCard() {
  const app = useApp();
  const router = useRouter();
  const { state } = app;
  const t = makeT(state.profile.lang);
  const [weighOpen, setWeighOpen] = useState(false);

  const steps = [
    { key: 'meal', done: state.meals.length > 0, icon: 'restaurant-outline' as const, go: () => router.push('/log') },
    { key: 'water', done: state.water.length > 0, icon: 'water-outline' as const, go: () => app.addWater(state.settings.glassMl) },
    { key: 'weigh', done: state.weights.length > 1, icon: 'scale-outline' as const, go: () => setWeighOpen(true) },
  ];
  if (steps.every((s) => s.done)) return null;

  return (
    <Card rail={C.accent}>
      <Micro color={C.textDim}>{t('start_here')}</Micro>
      <Small>{t('start_here_body')}</Small>
      <View style={{ gap: 4 }}>
        {steps.map((s) => (
          <Pressable key={s.key} onPress={s.done ? undefined : s.go} disabled={s.done} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, opacity: pressed ? 0.7 : 1 })}>
            <Ionicons name={s.done ? 'checkmark-circle' : s.icon} size={20} color={s.done ? C.green : C.accent} />
            <Text style={{ flex: 1, color: s.done ? C.textFaint : C.text, fontSize: F.body, textDecorationLine: s.done ? 'line-through' : 'none' }}>{t(`start_${s.key}`)}</Text>
            {!s.done ? <Ionicons name="chevron-forward" size={15} color={C.textGhost} /> : null}
          </Pressable>
        ))}
      </View>
      <Row style={{ gap: 14 }}>
        <Pressable onPress={() => router.push('/guide')}>
          <Micro color={C.accent}>{`${t('guide_title')} ›`}</Micro>
        </Pressable>
        <Pressable onPress={() => router.push('/tour?from=settings')}>
          <Micro color={C.accent}>{`${t('show_tour')} ›`}</Micro>
        </Pressable>
      </Row>
      <WeightSheet open={weighOpen} onClose={() => setWeighOpen(false)} />
    </Card>
  );
}
