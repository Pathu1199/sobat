import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { NUTRIENT_TAGS, nutrientSourcesEaten } from '../core/nutrients';
import { sumTotals } from '../core/nutrition';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, MeterRow, Micro, Row } from '../ui/components';
import { C, F, lh, S } from '../ui/theme';

/**
 * Today's nutrition beyond calories: protein, carbs and fat in grams against
 * sensible targets, and which of the nutrients a vegetarian has to watch
 * (iron, calcium, B12, fibre) have a good source eaten today. Exact where the
 * data is exact, honest where it is not: sources are named, not milligrams.
 * Progress opens it in a sheet (`bare`, no card of its own, the sheet's title
 * naming it), and `onNavigate` closes that sheet before a link opens the
 * foods. Every link is a finger tall on every platform.
 */
export function NutrientCard({ bare, onNavigate }: { bare?: boolean; onNavigate?: () => void } = {}) {
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
  const open = (n: string) => {
    onNavigate?.();
    router.push(`/foods?n=${n}`);
  };

  const body = (
    <>
      <Row style={{ justifyContent: bare ? 'flex-end' : 'space-between' }}>
        {bare ? null : <Micro color={C.textDim}>{t('nutrition_today')}</Micro>}
        <Pressable onPress={() => open('protein')} accessibilityRole="button" style={({ pressed }) => ({ minHeight: S.touch, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
          <Micro color={C.accentText}>{`${t('find_sources')} ›`}</Micro>
        </Pressable>
      </Row>
      <MeterRow label={t('protein')} value={Math.round(totals.protein)} total={targets.proteinG} unit="g" color={C.violet} />
      <MeterRow label={t('carbs')} value={Math.round(totals.carbs)} total={carbTarget} unit="g" color={C.accent} />
      <MeterRow label={t('fat')} value={Math.round(totals.fat)} total={fatTarget} unit="g" color={totals.fat > fatTarget ? C.amber : C.cyan} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
        {NUTRIENT_TAGS.filter((n) => n !== 'protein').map((n) => {
          const had = sources[n];
          const name = t(`nut_${n}`);
          return (
            <Pressable
              key={n}
              onPress={() => open(n)}
              accessibilityRole="button"
              accessibilityLabel={fill(t(had.length ? 'nut_had_a11y' : 'nut_none_a11y'), { name })}
              style={({ pressed }) => ({ minHeight: S.touch, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: S.radiusXs, backgroundColor: had.length ? C.cardAlt : 'transparent', borderWidth: 1, borderColor: had.length ? C.border : C.borderStrong }}>
                <Text style={{ color: had.length ? C.green : C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>{had.length ? '✓' : '–'}</Text>
                <Text style={{ color: had.length ? C.text : C.textDim, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{name}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Micro color={C.textFaint}>{t('nutrition_note')}</Micro>
    </>
  );
  return bare ? <View style={{ gap: 10 }}>{body}</View> : <Card>{body}</Card>;
}
