import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { defaultPortion, foodName, portionLabel, searchFoods, unitName } from '../core/foods';
import { allowance, pattern, slotShare } from '../core/pattern';
import { addLine, removeLine, renameSlot, setLineQty, slotLabel, slotTime, updateSlot, type RoutineSlot } from '../core/routine';
import type { FoodItem, Lang, MealType } from '../core/types';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Btn, Divider, Field, ListRow, Micro, Pill, Row, Small, Toggle } from '../ui/components';
import { IconButton } from '../ui/IconButton';
import { QtyStepper } from '../ui/QtyStepper';
import { C, F } from '../ui/theme';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];
const QTYS = [0.5, 1, 1.5, 2, 3];

/**
 * One meal of the routine, opened for editing: its name, which meal of the
 * day it is, whether the day's bhaji goes in, and the foods in each option.
 * Without `onRemove` the remove button is there but disabled: the last meal
 * of the pattern stays, because a menu is a list of slots.
 */
export function SlotEditor({ slot, onChange, onRemove }: { slot: RoutineSlot; onChange: (s: RoutineSlot) => void; onRemove?: () => void }) {
  const app = useApp();
  const { foods } = app;
  const lang: Lang = app.state.profile.lang;
  const t = makeT(lang);
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [time, setTime] = useState(slotTime(slot));

  // What this share means in calories today, with this edit already in the pattern.
  const share = slotShare(slot);
  const kcalToday = (() => {
    const p = pattern({ ...app.state.routine, slots: updateSlot(app.state.routine.slots, slot.id, slot) }).find((x) => x.id === slot.id);
    return p ? allowance(app.targets.kcal, p) : 0;
  })();
  const setShare = (next: number) => onChange({ ...slot, share: Math.max(0, Math.min(60, next)) });

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

      <View style={{ gap: 6 }}>
        <Micro>{t('pattern_share')}</Micro>
        <Row style={{ gap: 10, flexWrap: 'wrap' }}>
          <QtyStepper
            value={String(share)}
            onMinus={() => setShare(share - 5)}
            onPlus={() => setShare(share + 5)}
            minusDisabled={share <= 0}
            minusLabel={t('pattern_share_less')}
            plusLabel={t('pattern_share_more')}
          />
          <Small color={C.textDim}>{fill(t('pattern_share_kcal'), { kcal: kcalToday })}</Small>
        </Row>
        <Micro color={C.textFaint}>{t('pattern_share_hint')}</Micro>
      </View>

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
          {option.length === 0 ? <Small color={C.textFaint}>{t('routine_empty_option')}</Small> : null}
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
                  <IconButton name="close" label={fill(t('meal_line_remove'), { name: food ? foodName(food, lang) : line.foodId })} onPress={() => onChange(removeLine(slot, oi, line.foodId))} />
                </Row>
                <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                  {QTYS.map((q) => (
                    <Pill key={q} label={`${q}x`} active={line.qty === q} onPress={() => onChange(setLineQty(slot, oi, line.foodId, q))} />
                  ))}
                  {food && food.portions.length > 1
                    ? food.portions.map((p) => (
                        <Pill
                          key={p.unit}
                          label={unitName(p.unit, lang)}
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
                <ListRow key={f.id} title={f.name_en} alt={lang === 'en' ? undefined : foodName(f, lang)} onPress={() => add(f)} trailing={<Ionicons name="add" size={17} color={C.accent} />} />
              ))}
            </View>
          ) : (
            <Btn
              small
              tone="ghost"
              icon={<Ionicons name="add" size={16} color={C.text} />}
              label={t('routine_add_food')}
              onPress={() => {
                setAddingTo(oi);
                setQuery('');
              }}
              style={{ alignSelf: 'flex-start' }}
            />
          )}
        </View>
      ))}

      <Row style={{ gap: 8 }}>
        <Btn small tone="soft" label={t('routine_add_alt')} onPress={() => onChange({ ...slot, options: [...slot.options, []] })} style={{ flex: 1 }} />
        <Btn small tone="danger" label={t('routine_remove_meal')} onPress={() => onRemove?.()} disabled={!onRemove} style={{ flex: 1 }} />
      </Row>
      <Divider />
    </View>
  );
}
