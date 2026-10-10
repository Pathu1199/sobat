import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { foodName } from '../core/foods';
import { groceryList, groceryWeekKey } from '../core/grocery';
import type { WeekPlan } from '../core/weekPlan';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Micro, Pill, Row, Small } from '../ui/components';
import { Sheet } from '../ui/Sheet';
import { C, F, S } from '../ui/theme';
import { FoodThumb } from './FoodDetailSheet';

/**
 * The week's plan as a shopping list: grouped like the market, with buying
 * amounts, ticked off as things come home. Ticks belong to the week, so the
 * list is clean again on the next one.
 */
export function GrocerySheet({ open, onClose, plan }: { open: boolean; onClose: () => void; plan: WeekPlan }) {
  const app = useApp();
  const { state, foods, today } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const [scope, setScope] = useState<'week' | 'half'>('week');
  // Half a week: today and the next three days, for someone who shops twice.
  const dayIdxs = useMemo(() => {
    if (scope === 'week') return [0, 1, 2, 3, 4, 5, 6];
    const d = new Date(today + 'T12:00:00').getDay();
    return [0, 1, 2, 3].map((i) => (d + i) % 7);
  }, [scope, today]);
  const groups = useMemo(() => groceryList(plan, foods, dayIdxs), [plan, foods, dayIdxs]);
  const week = groceryWeekKey(today, 0);
  const ticked = state.groceryTicks?.week === week ? state.groceryTicks.ids : [];
  const total = groups.reduce((n, g) => n + g.lines.length, 0);
  const done = groups.reduce((n, g) => n + g.lines.filter((l) => ticked.includes(l.foodId)).length, 0);

  const unitLabel = (u: string, amount: string) => (u === 'piece' ? `${amount} ${t('unit_piece')}` : `${amount} ${u}`);

  return (
    <Sheet open={open} title={t('grocery_title')} onClose={onClose}>
      <View style={{ gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row style={{ gap: 6 }}>
            <Pill label={t('grocery_week')} active={scope === 'week'} onPress={() => setScope('week')} />
            <Pill label={t('grocery_half')} active={scope === 'half'} onPress={() => setScope('half')} />
          </Row>
          <Micro color={done === total && total > 0 ? C.green : C.textDim}>{fill(t('grocery_done'), { done, total })}</Micro>
        </Row>
        <Small color={C.textFaint}>{t('grocery_note')}</Small>
        <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ gap: 14, paddingBottom: 12 }}>
          {groups.map((g) => (
            <View key={g.key} style={{ gap: 4 }}>
              <Micro>{t(`cat_${g.key}`)}</Micro>
              {g.lines.map((l) => {
                const on = ticked.includes(l.foodId);
                return (
                  <Pressable
                    key={l.foodId}
                    onPress={() => app.toggleGrocery(week, l.foodId)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 4, opacity: pressed ? 0.7 : on ? 0.55 : 1 })}>
                    <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: on ? C.accent : C.borderStrong, backgroundColor: on ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {on ? <Ionicons name="checkmark" size={16} color={C.white} /> : null}
                    </View>
                    <FoodThumb food={l.food} size={34} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600', textDecorationLine: on ? 'line-through' : 'none' }}>{foodName(l.food, lang)}</Text>
                      <Text style={{ color: C.textFaint, fontSize: F.tiny }}>{fill(t('grocery_times'), { n: l.times })}</Text>
                    </View>
                    <Text style={{ color: on ? C.textFaint : C.text, fontSize: F.body, fontWeight: '700', minWidth: 64, textAlign: 'right' }}>{unitLabel(l.unit, l.amount)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
          {total === 0 ? <Small color={C.textGhost}>{t('grocery_empty')}</Small> : null}
        </ScrollView>
        <View style={{ height: S.hairline }} />
      </View>
    </Sheet>
  );
}
