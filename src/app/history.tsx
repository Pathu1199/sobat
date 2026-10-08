import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { addDays, formatDayLabel, lastNDates } from '../core/date';
import { sumTotals } from '../core/nutrition';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Bar, Card, Micro, Row, Screen, Segmented, Small } from '../ui/components';
import { C, F } from '../ui/theme';

type Span = 14 | 30 | 90;

/**
 * Every day's calories, newest first: what was eaten against the target,
 * with protein, water and the meal count. Tap a day to add to or fix it.
 */
export default function History() {
  const app = useApp();
  const router = useRouter();
  const { state, today, targets } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const [span, setSpan] = useState<Span>(30);

  const days = useMemo(() => {
    return lastNDates(span, today)
      .reverse()
      .map((date) => {
        const meals = state.meals.filter((m) => m.date === date);
        const totals = sumTotals(meals.flatMap((m) => m.items));
        // Older meals may carry only a total; trust the larger of the two.
        const kcal = Math.max(totals.kcal, meals.reduce((a, m) => a + m.kcal, 0));
        const protein = Math.max(Math.round(totals.protein), meals.reduce((a, m) => a + (m.protein ?? 0), 0));
        const water = state.water.filter((w) => w.date === date).reduce((a, w) => a + w.ml, 0);
        return { date, meals: meals.length, kcal, protein, water };
      });
  }, [span, today, state.meals, state.water]);

  const logged = days.filter((d) => d.meals > 0);
  const avg = logged.length ? Math.round(logged.reduce((a, d) => a + d.kcal, 0) / logged.length) : 0;
  const onTarget = logged.filter((d) => d.kcal <= targets.kcal).length;

  return (
    <Screen>
      <Segmented value={String(span)} onChange={(v) => setSpan(Number(v) as Span)} options={[{ key: '14', label: fill(t('n_days'), { n: 14 }) }, { key: '30', label: fill(t('n_days'), { n: 30 }) }, { key: '90', label: fill(t('n_days'), { n: 90 }) }]} />
      <Card>
        <Row style={{ gap: 18, flexWrap: 'wrap' }}>
          <Stat label={t('history_logged')} value={`${logged.length}/${days.length}`} />
          <Stat label={t('history_avg')} value={`${avg}`} unit="kcal" color={avg > targets.kcal ? C.amber : C.cyan} />
          <Stat label={t('history_on_target')} value={`${onTarget}/${logged.length}`} color={C.green} />
        </Row>
        <Micro color={C.textFaint}>{fill(t('history_target_line'), { kcal: targets.kcal })}</Micro>
      </Card>
      {days.map((d) => {
        const over = d.kcal > targets.kcal;
        const label = d.date === today ? t('tab_today') : d.date === addDays(today, -1) ? t('yesterday') : formatDayLabel(d.date, lang);
        return (
          <Pressable key={d.date} onPress={() => router.push({ pathname: '/log', params: { date: d.date } })} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
            <Card rail={d.meals === 0 ? undefined : over ? C.amber : C.green}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ color: d.meals === 0 ? C.textFaint : C.text, fontSize: F.body, fontWeight: '600' }}>{label}</Text>
                {d.meals === 0 ? (
                  <Row style={{ gap: 6 }}>
                    <Micro color={C.accent}>{t('history_add')}</Micro>
                    <Ionicons name="add-circle-outline" size={15} color={C.accent} />
                  </Row>
                ) : (
                  <Text style={{ color: over ? C.amber : C.text, fontSize: F.h3, fontWeight: '600' }}>
                    {d.kcal}
                    <Text style={{ color: C.textFaint, fontSize: F.small, fontWeight: '400' }}>{` / ${targets.kcal} kcal`}</Text>
                  </Text>
                )}
              </Row>
              {d.meals > 0 ? (
                <>
                  <Bar value={d.kcal} max={targets.kcal} color={over ? C.amber : C.accent} />
                  <Row style={{ gap: 14 }}>
                    <Small color={C.textDim}>{`${d.meals} ${d.meals === 1 ? t('session_one') : t('session_many')}`}</Small>
                    <Small color={C.textDim}>{`${d.protein} g ${t('protein').toLowerCase()}`}</Small>
                    {d.water > 0 ? <Small color={C.textDim}>{`${(d.water / 1000).toFixed(1)} L ${t('water').toLowerCase()}`}</Small> : null}
                  </Row>
                </>
              ) : null}
            </Card>
          </Pressable>
        );
      })}
      <View style={{ height: 8 }} />
    </Screen>
  );
}

function Stat({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <View style={{ gap: 2, minWidth: 72 }}>
      <Micro>{label}</Micro>
      <Text style={{ color: color ?? C.text, fontSize: F.h2, fontWeight: '300', letterSpacing: -0.5 }}>
        {value}
        {unit ? <Text style={{ color: C.textFaint, fontSize: F.small, fontWeight: '400' }}> {unit}</Text> : null}
      </Text>
    </View>
  );
}
