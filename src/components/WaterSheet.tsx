import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { localHHMM } from '../core/date';
import { makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Bar, Divider, Micro, Row, Small } from '../ui/components';
import { Sheet } from '../ui/Sheet';
import { C, F } from '../ui/theme';

/** Amounts people actually drink in, so "how much did I have" has an honest answer. */
const AMOUNTS: { key: string; ml: number; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'sip', ml: 30, icon: 'water-outline' },
  { key: 'half_glass', ml: 125, icon: 'water-outline' },
  { key: 'glass', ml: 250, icon: 'water' },
  { key: 'bottle', ml: 500, icon: 'flask-outline' },
  { key: 'big_bottle', ml: 1000, icon: 'flask' },
];

export function WaterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const fb = useFeedback();
  const { state, waterToday, today } = app;
  const t = makeT(state.profile.lang);
  const goal = state.settings.waterGoalMl;
  const todays = state.water.filter((w) => w.date === today).slice(-6).reverse();

  function add(ml: number) {
    app.addWater(ml);
    fb.haptic('light');
  }

  return (
    <Sheet open={open} title={t('water')} onClose={onClose}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Text style={{ color: waterToday >= goal ? C.green : C.text, fontSize: F.display - 8, fontWeight: '300', letterSpacing: -1 }}>
          {(waterToday / 1000).toFixed(2)}
          <Text style={{ color: C.textFaint, fontSize: F.small, fontWeight: '400', letterSpacing: 0 }}>{` / ${goal / 1000} L`}</Text>
        </Text>
        <Micro>{`${Math.round(waterToday / state.settings.glassMl)} ${t('glasses')}`}</Micro>
      </Row>
      <Bar value={waterToday} max={goal} color={waterToday >= goal ? C.green : C.cyan} height={8} />
      <Micro>{t('water_add')}</Micro>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {AMOUNTS.map((a) => (
          <Pressable
            key={a.key}
            onPress={() => add(a.ml)}
            accessibilityRole="button"
            style={({ pressed }) => ({ flexBasis: '31%', flexGrow: 1, backgroundColor: C.cardAlt, borderRadius: 12, paddingVertical: 12, alignItems: 'center', gap: 4, opacity: pressed ? 0.7 : 1 })}>
            <Ionicons name={a.icon} size={20} color={C.cyan} />
            <Text style={{ color: C.text, fontSize: F.small, fontWeight: '600' }}>{t(`water_${a.key}`)}</Text>
            <Micro>{a.ml >= 1000 ? `${a.ml / 1000} L` : `${a.ml} ml`}</Micro>
          </Pressable>
        ))}
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <Small color={C.textFaint}>{t('water_why')}</Small>
        <Pressable onPress={() => app.undoWater()} disabled={waterToday === 0} hitSlop={8}>
          <Micro color={waterToday === 0 ? C.textGhost : C.accent}>{t('undo')}</Micro>
        </Pressable>
      </Row>
      {todays.length > 0 ? (
        <>
          <Divider />
          <Micro>{t('today_short')}</Micro>
          {todays.map((w) => (
            <Row key={w.id} style={{ justifyContent: 'space-between' }}>
              <Small>{localHHMM(w.at)}</Small>
              <Small color={C.textDim}>{`${w.ml} ml`}</Small>
            </Row>
          ))}
        </>
      ) : null}
    </Sheet>
  );
}
