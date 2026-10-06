import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { defaultPortion, foodName, portionLabel, searchFoods } from '../core/foods';
import { addLine, removeLine, renameSlot, setLineQty, slotLabel, slotTime, type RoutineSlot } from '../core/routine';
import type { FoodItem, Lang, MealType } from '../core/types';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Btn, Divider, Field, ListRow, Micro, Pill, Row, Small, Toggle } from '../ui/components';
import { C, F } from '../ui/theme';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];
const QTYS = [0.5, 1, 1.5, 2, 3];

/**
 * One meal of the routine, opened for editing: its name, which meal of the
 * day it is, whether the day's bhaji goes in, and the foods in each option.
 */
export function SlotEditor({ slot, onChange, onRemove }: { slot: RoutineSlot; onChange: (s: RoutineSlot) => void; onRemove: () => void }) {
  const app = useApp();
  const { foods } = app;
  const lang: Lang = app.state.profile.lang;
  const t = makeT(lang);
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [time, setTime] = useState(slotTime(slot));

  const results = addingTo !== null && query.trim() ? searchFoods(foods, query, 6) : [];

  function add(food: FoodItem) {
    if (addingTo === null) return;
    const p = defaultPortion(food);
    onChange(addLine(slot, addingTo, { foodId: food.id, unit: p?.unit ?? 'serving', qty: 1 }));
    setQuery('');
  }

  return (
    <View style={{ gap: 12, paddingBottom: 6 }}>
      <Row style={{ gap: 10 }}>
        <Field label={t('routine_meal_name')} value={slotLabel(slot, lang)} onChangeText={(v) => onChange(renameSlot(slot, lang, v))} />
        <View style={{ width: 96 }}>
          <Field
            label={t('sched_at')}
            value={time}
            placeholder="13:00"
            onChangeText={(v) => {
              setTime(v);
              if (/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) onChange({ ...slot, time: v });
            }}
          />
        </View>
      </Row>

      <Micro>{t('routine_meal_type')}</Micro>
      <Row style={{ flexWrap: 'wrap', gap: 6 }}>
        {MEAL_TYPES.map((m) => (
          <Pill key={m} label={t(m)} active={slot.type === m} onPress={() => onChange({ ...slot, type: m })} />
        ))}
      </Row>

      <Toggle title={t('routine_with_bhaji')} desc={t('routine_bhaji')} on={slot.withBhaji} onToggle={() => onChange({ ...slot, withBhaji: !slot.withBhaji })} />

      {slot.options.map((option, oi) => (
        <View key={oi} style={{ gap: 6, backgroundColor: C.cardAlt, borderRadius: 12, padding: 12 }}>
          {slot.options.length > 1 ? <Micro>{fill(t('routine_option'), { n: oi + 1 })}</Micro> : null}
          {option.length === 0 ? <Small color={C.textGhost}>{t('routine_empty_option')}</Small> : null}
          {option.map((line) => {
            const food = foods.find((f) => f.id === line.foodId);
            const portion = food?.portions.find((p) => p.unit === line.unit) ?? (food ? defaultPortion(food) : undefined);
            return (
              <View key={line.foodId} style={{ gap: 6 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: F.body }}>{food ? foodName(food, lang) : line.foodId}</Text>
                    {portion ? <Micro>{portionLabel(portion, lang)}</Micro> : null}
                  </View>
                  <Pressable onPress={() => onChange(removeLine(slot, oi, line.foodId))} hitSlop={8} accessibilityLabel={t('delete')}>
                    <Ionicons name="close" size={16} color={C.textGhost} />
                  </Pressable>
                </Row>
                <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                  {QTYS.map((q) => (
                    <Pill key={q} label={`${q}x`} active={line.qty === q} onPress={() => onChange(setLineQty(slot, oi, line.foodId, q))} />
                  ))}
                  {food && food.portions.length > 1
                    ? food.portions.map((p) => (
                        <Pill
                          key={p.unit}
                          label={p.unit}
                          active={line.unit === p.unit}
                          onPress={() => onChange({ ...slot, options: slot.options.map((o, i) => (i === oi ? o.map((l) => (l.foodId === line.foodId ? { ...l, unit: p.unit } : l)) : o)) })}
                        />
                      ))
                    : null}
                </Row>
              </View>
            );
          })}
          {addingTo === oi ? (
            <View style={{ gap: 4 }}>
              <Field value={query} onChangeText={setQuery} placeholder={t('search_food')} autoFocus />
              {results.map((f) => (
                <ListRow key={f.id} title={f.name_en} alt={lang === 'en' ? undefined : f.name_mr} onPress={() => add(f)} trailing={<Ionicons name="add" size={17} color={C.accent} />} />
              ))}
            </View>
          ) : (
            <Pressable onPress={() => { setAddingTo(oi); setQuery(''); }} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, paddingVertical: 4 })}>
              <Micro color={C.accent}>{`+ ${t('routine_add_food')}`}</Micro>
            </Pressable>
          )}
        </View>
      ))}

      <Row style={{ gap: 8 }}>
        <Btn small tone="soft" label={t('routine_add_alt')} onPress={() => onChange({ ...slot, options: [...slot.options, []] })} style={{ flex: 1 }} />
        <Btn small tone="danger" label={t('routine_remove_meal')} onPress={onRemove} style={{ flex: 1 }} />
      </Row>
      <Divider />
    </View>
  );
}
