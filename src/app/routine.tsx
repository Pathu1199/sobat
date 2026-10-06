import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { lineLabel } from '../components/RoutineCard';
import { SlotEditor } from '../components/SlotEditor';
import { foodName, searchFoods } from '../core/foods';
import { newSlot, ruleForFood, slotLabel, toggleBhaji, updateSlot, type RoutineSlot } from '../core/routine';
import type { FoodItem, Lang } from '../core/types';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Divider, Field, ListRow, Micro, Pill, Row, Screen, SectionHeader, Small, Toggle } from '../ui/components';
import { C, F } from '../ui/theme';

/** Monday first, the way the week is planned; values are `Date.getDay()` indices. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function nameOf(id: string, foods: FoodItem[], lang: Lang): string {
  const f = foods.find((x) => x.id === id);
  return f ? foodName(f, lang) : id;
}

/** Edit the routine: weekly bhaji, the avoid list, the budget, and whether it shows at all. */
export default function RoutineScreen() {
  const app = useApp();
  const { foods } = app;
  const routine = app.state.routine;
  const lang = app.state.profile.lang;
  const t = makeT(lang);

  const [openDay, setOpenDay] = useState<number | null>(null);
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [minText, setMinText] = useState(String(routine.budgetMin));
  const [maxText, setMaxText] = useState(String(routine.budgetMax));

  // Light vegetable dishes first: these are what the week is built from.
  const bhajiChoices = useMemo(
    () =>
      foods
        .filter((f) => f.category === 'veg' && !f.tags.includes('nonveg'))
        .sort((a, b) => Number(b.tags.includes('healthy_swap')) - Number(a.tags.includes('healthy_swap')) || a.kcal_100g - b.kcal_100g),
    [foods],
  );

  const avoidedIds = new Set(routine.avoid.flatMap((r) => r.foodIds));
  const results = query.trim() ? searchFoods(foods, query, 8).filter((f) => !avoidedIds.has(f.id)) : [];

  function commitBudget(minS: string, maxS: string) {
    const min = parseInt(minS, 10);
    const max = parseInt(maxS, 10);
    // Only a sensible pair is saved; half-typed numbers just wait.
    if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max >= min && max < 100000) {
      app.setRoutine({ budgetMin: min, budgetMax: max });
    }
  }

  return (
    <Screen>
      <Card>
        <Toggle title={t('routine_enabled')} desc={t('routine_title')} on={routine.enabled} onToggle={() => app.setRoutine({ enabled: !routine.enabled })} />
        <Divider />
        <Toggle title={t('routine_walk_toggle')} desc={t('routine_walk')} on={routine.walk} onToggle={() => app.setRoutine({ walk: !routine.walk })} />
      </Card>

      <View style={{ gap: 10 }}>
        <SectionHeader title={t('routine_week')} />
        <Card>
          <Small color={C.textFaint}>{t('routine_week_hint')}</Small>
          {WEEK_ORDER.map((day, i) => {
            const list = routine.week[day] ?? [];
            const open = openDay === day;
            return (
              <View key={day}>
                {i > 0 ? <Divider /> : null}
                <Pressable
                  onPress={() => setOpenDay(open ? null : day)}
                  accessibilityRole="button"
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, opacity: pressed ? 0.7 : 1 })}>
                  <Text style={{ width: 44, color: C.textDim, fontSize: F.small, fontWeight: '600' }}>{t(`wd_${day}`)}</Text>
                  <Text style={{ flex: 1, color: list.length > 0 ? C.text : C.textGhost, fontSize: F.body }}>
                    {list.length > 0 ? list.map((id) => nameOf(id, foods, lang)).join(' / ') : t('routine_free')}
                  </Text>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={C.textGhost} />
                </Pressable>
                {open ? (
                  <Row style={{ flexWrap: 'wrap', gap: 6, paddingBottom: 10 }}>
                    {bhajiChoices.map((f) => (
                      <Pill
                        key={f.id}
                        label={foodName(f, lang)}
                        active={list.includes(f.id)}
                        onPress={() => app.setRoutine({ week: toggleBhaji(routine.week, day, f.id) })}
                      />
                    ))}
                  </Row>
                ) : null}
              </View>
            );
          })}
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title={t('routine_slots')} meta={`${routine.slots.length}`} />
        <Card>
          {routine.slots.map((s, i) => {
            const open = openSlot === s.id;
            const setSlot = (next: RoutineSlot) => app.setRoutine({ slots: updateSlot(routine.slots, s.id, next) });
            return (
              <View key={s.id}>
                {i > 0 ? <Divider /> : null}
                <ListRow
                  title={slotLabel(s, lang) || t('routine_new_meal')}
                  sub={`${t(s.type)} · ${s.options.map((o) => o.map((l) => lineLabel(l, foods, lang)).join(' + ') || '…').join(' / ')}${s.withBhaji ? ` + ${t('routine_bhaji').toLowerCase()}` : ''}`}
                  onPress={() => setOpenSlot(open ? null : s.id)}
                  trailing={<Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={C.textGhost} />}
                />
                {open ? (
                  <SlotEditor
                    slot={s}
                    onChange={setSlot}
                    onRemove={() => {
                      app.setRoutine({ slots: routine.slots.filter((x) => x.id !== s.id) });
                      setOpenSlot(null);
                    }}
                  />
                ) : null}
              </View>
            );
          })}
          <Btn
            small
            tone="soft"
            label={t('routine_add_meal')}
            onPress={() => {
              const slot = newSlot('snack', '');
              app.setRoutine({ slots: [...routine.slots, slot] });
              setOpenSlot(slot.id);
            }}
          />
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title={t('routine_avoid')} meta={`${routine.avoid.length}`} />
        <Card>
          {routine.avoid.length === 0 ? <Small color={C.textGhost}>{t('routine_no_avoid')}</Small> : null}
          {routine.avoid.map((r, i) => (
            <View key={r.id}>
              {i > 0 ? <Divider /> : null}
              <Row style={{ paddingVertical: 9, gap: 12, alignItems: 'flex-start' }}>
                <Ionicons name="ban-outline" size={16} color={C.amber} style={{ marginTop: 2 }} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ color: C.text, fontSize: F.body }}>{slotLabel(r, lang)}</Text>
                  {r.swapIds.length > 0 ? (
                    <Micro color={C.green}>{`${r.swapIds.map((id) => nameOf(id, foods, lang)).join(' / ')} ${t('routine_instead')}`}</Micro>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => app.setRoutine({ avoid: routine.avoid.filter((x) => x.id !== r.id) })}
                  hitSlop={10}
                  accessibilityLabel={t('delete')}>
                  <Ionicons name="close" size={16} color={C.textGhost} />
                </Pressable>
              </Row>
            </View>
          ))}
          <Divider />
          <Field value={query} onChangeText={setQuery} placeholder={t('routine_add_avoid')} />
          {results.map((f) => (
            <ListRow
              key={f.id}
              title={f.name_en}
              alt={lang === 'en' ? undefined : f.name_mr}
              onPress={() => {
                app.setRoutine({ avoid: [...routine.avoid, ruleForFood(f)] });
                setQuery('');
              }}
              trailing={<Ionicons name="add" size={17} color={C.amber} />}
            />
          ))}
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title={t('routine_budget_range')} />
        <Card>
          <Row style={{ gap: 12 }}>
            <Field
              label={t('time_from')}
              value={minText}
              keyboardType="numeric"
              onChangeText={(v) => {
                setMinText(v);
                commitBudget(v, maxText);
              }}
            />
            <Field
              label={t('time_to')}
              value={maxText}
              keyboardType="numeric"
              onChangeText={(v) => {
                setMaxText(v);
                commitBudget(minText, v);
              }}
            />
          </Row>
          <Small color={C.textFaint}>{t('routine_spend_hint')}</Small>
        </Card>
      </View>
    </Screen>
  );
}
