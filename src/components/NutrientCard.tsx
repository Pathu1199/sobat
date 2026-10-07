import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { NUTRIENT_TAGS, nutrientSourcesEaten } from '../core/nutrients';
import { sumTotals } from '../core/nutrition';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, MeterRow, Micro, Row } from '../ui/components';
import { C, F } from '../ui/theme';

/**
 * Today's nutrition beyond calories: protein, carbs and fat in grams against
 * sensible targets, and which of the nutrients a vegetarian has to watch
 * (iron, calcium, B12, fibre) have a good source eaten today. Exact where the
 * data is exact, honest where it is not: sources are named, not milligrams.
 */
export function NutrientCard() {
  const app = useApp();
  const router = useRouter();
  const { state, targets, today, foods } = app;
  const t = makeT(state.profile.lang);
  const meals = useMemo(() => state.meals.filter((m) => m.date === today), [state.meals, today]);
  const totals = useMemo(() => sumTotals(meals.flatMap((m) => m.items)), [meals]);
  const sources = useMemo(() => nutrientSourcesEaten(meals, foods), [meals, foods]);

  // Fat at most 30% of the day's calories; carbs are what is left after protein and fat.
  const fatTarget = Math.round((targets.kcal * 0.3) / 9);
  const carbTarget = Math.max(0, Math.round((targets.kcal - targets.proteinG * 4 - fatTarget * 9) / 4));

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Micro color={C.textDim}>{t('nutrition_today')}</Micro>
        <Pressable onPress={() => router.push('/foods?n=protein')} hitSlop={8}>
          <Micro color={C.accent}>{`${t('find_sources')} ›`}</Micro>
        </Pressable>
      </Row>
      <MeterRow label={t('protein')} value={Math.round(totals.protein)} total={targets.proteinG} unit="g" color={C.violet} />
      <MeterRow label={t('carbs')} value={Math.round(totals.carbs)} total={carbTarget} unit="g" color={C.accent} />
      <MeterRow label={t('fat')} value={Math.round(totals.fat)} total={fatTarget} unit="g" color={totals.fat > fatTarget ? C.amber : C.cyan} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
        {NUTRIENT_TAGS.filter((n) => n !== 'protein').map((n) => {
          const had = sources[n];
          return (
            <Pressable key={n} onPress={() => router.push(`/foods?n=${n}`)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: had.length ? C.cardAlt : 'transparent', borderWidth: 1, borderColor: had.length ? C.border : C.borderStrong }}>
                <Text style={{ color: had.length ? C.green : C.textFaint, fontSize: F.tiny }}>{had.length ? '✓' : '–'}</Text>
                <Text style={{ color: had.length ? C.text : C.textFaint, fontSize: F.tiny, fontWeight: '500' }}>{t(`nut_${n}`)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Micro color={C.textGhost}>{t('nutrition_note')}</Micro>
    </Card>
  );
}
