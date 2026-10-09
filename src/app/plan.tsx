import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { FoodDetailSheet, FoodThumb } from '../components/FoodDetailSheet';
import { foodName, searchFoods } from '../core/foods';
import { newId } from '../core/id';
import { KCAL_FLOOR } from '../core/nutrition';
import { avoidedFoodIds, planItems, type PlanLine, weekdayOf } from '../core/routine';
import type { FoodItem } from '../core/types';
import {
  addLine,
  balanceDay,
  buildWeekPlan,
  copyToWeekdays,
  dayStatus,
  dayTotals,
  lineInfo,
  mealTotals,
  setDay,
  setLine,
  swapsFor,
  type PlanMeal,
  type WeekPlan,
} from '../core/weekPlan';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Bar, Btn, Card, Field, Micro, Row, Screen, Small } from '../ui/components';
import { Sheet } from '../ui/Sheet';
import { C, F, S } from '../ui/theme';

/** Monday first, the way a working week is read. Values are Date.getDay() indexes. */
const ORDER = [1, 2, 3, 4, 5, 6, 0];

const MEAL_KEY: Record<string, string> = { breakfast: 'breakfast', mid: 'plan_meal_mid', lunch: 'lunch', tea: 'plan_meal_tea', evening: 'plan_meal_evening', dinner: 'dinner', night: 'plan_meal_night' };

function qtyText(q: number): string {
  const whole = Math.floor(q);
  const half = q - whole >= 0.5;
  if (whole === 0 && half) return '½';
  return half ? `${whole}½` : String(whole);
}

/**
 * The week's diet, written down in advance and edited line by line. Every
 * change shows the day against the target at once, and a day that comes out
 * too low says so plainly and offers to fix it.
 */
export default function PlanScreen() {
  const app = useApp();
  const fb = useFeedback();
  const { state, foods, targets, today } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const avoided = useMemo(() => avoidedFoodIds({ ...state.routine, enabled: true }), [state.routine]);
  const floor = KCAL_FLOOR[state.profile.sex];

  // First open: write the week from the routine, so edits have something to keep.
  const plan: WeekPlan = useMemo(() => state.weekPlan ?? buildWeekPlan(state.routine, foods), [state.weekPlan, state.routine, foods]);
  useEffect(() => {
    if (!state.weekPlan) app.setWeekPlan(plan);
    // Only the missing plan triggers this; once saved it is the person's to edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.weekPlan]);

  const [dayIdx, setDayIdx] = useState(() => weekdayOf(today));
  const [swap, setSwap] = useState<{ mealId: string; lineIdx: number } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<FoodItem | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const day = plan.days[dayIdx];
  const totals = dayTotals(day, foods);
  const status = dayStatus(totals.kcal, targets.kcal, floor);
  const isToday = dayIdx === weekdayOf(today);
  const todayMeals = state.meals.filter((m) => m.date === today);

  function save(next: WeekPlan) {
    app.setWeekPlan(next);
  }
  function changeQty(mealId: string, i: number, line: PlanLine, by: number) {
    const step = line.unit === 'piece' || line.unit === 'medium' || line.unit === 'slice' ? 1 : 0.5;
    save(setLine(plan, dayIdx, mealId, i, { ...line, qty: Math.max(0, Math.round((line.qty + by * step) * 2) / 2) }));
  }
  function cycleUnit(mealId: string, i: number, line: PlanLine) {
    const food = foods.find((f) => f.id === line.foodId);
    if (!food || food.portions.length < 2) return;
    const at = food.portions.findIndex((p) => p.unit === line.unit);
    const nextUnit = food.portions[(at + 1) % food.portions.length].unit;
    save(setLine(plan, dayIdx, mealId, i, { ...line, unit: nextUnit }));
  }
  function balance() {
    const r = balanceDay(day, foods, targets.kcal, avoided, floor);
    save(setDay(plan, dayIdx, r.day));
    setNote(r.changes.length ? r.changes.map((c) => fill(t(c.key), { meal: t(MEAL_KEY[String(c.params.meal)] ?? String(c.params.meal)).toLowerCase() })).join(' · ') : t('plan_nothing_to_change'));
    fb.haptic('success');
  }
  function rebuild() {
    const fresh = buildWeekPlan(state.routine, foods);
    save(setDay(plan, dayIdx, fresh.days[dayIdx]));
    setNote(t('plan_rebuilt'));
  }
  function copyWeekdays() {
    save(copyToWeekdays(plan, dayIdx));
    fb.notify(t('plan_copied'));
  }
  function logMeal(meal: PlanMeal) {
    const items = planItems(meal.lines, foods);
    if (!items.length) return;
    const [h, m] = meal.time.split(':').map(Number);
    const at = new Date();
    if (Number.isFinite(h)) at.setHours(h, Number.isFinite(m) ? m : 0, 0, 0);
    const kcal = items.reduce((a, i) => a + i.kcal, 0);
    app.addMeal({ id: newId(), at: at.toISOString(), date: today, type: meal.type, items, kcal, protein: Math.round(items.reduce((a, i) => a + i.protein, 0)) });
    fb.haptic('success');
    fb.notify(fill(t('toast_meal_saved'), { kcal }));
  }
  const logged = (meal: PlanMeal) => {
    const ids = new Set(meal.lines.map((l) => l.foodId));
    return todayMeals.some((m) => m.type === meal.type && m.items.some((it) => it.foodId && ids.has(it.foodId)));
  };

  const unitName = (u: string) => (t(`unit_${u}`) === `unit_${u}` ? u : t(`unit_${u}`));
  const statusColor = status === 'low' ? C.red : status === 'under' ? C.amber : status === 'over' ? C.amber : C.green;
  const gap = Math.abs(targets.kcal - totals.kcal);
  const swapLine = swap ? day.meals.find((m) => m.id === swap.mealId)?.lines[swap.lineIdx] : undefined;
  const swapInfo = swapLine ? lineInfo(swapLine, foods, lang) : null;
  const results = useMemo(() => (adding ? searchFoods(foods, query, 20).filter((f) => !avoided.has(f.id)) : []), [adding, foods, query, avoided]);

  return (
    <Screen>
      {/* Days, Monday first, each with its total so a low day stands out before it is opened. */}
      <Row style={{ gap: 4 }}>
        {ORDER.map((d) => {
          const k = dayTotals(plan.days[d], foods).kcal;
          const st = dayStatus(k, targets.kcal, floor);
          const active = d === dayIdx;
          return (
            <Pressable
              key={d}
              onPress={() => {
                setDayIdx(d);
                setNote(null);
              }}
              accessibilityRole="button"
              style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: S.radiusSm, backgroundColor: active ? C.accent : C.card, borderWidth: S.hairline, borderColor: d === weekdayOf(today) ? C.accent : C.border }}>
              <Text style={{ color: active ? C.white : C.text, fontSize: F.small, fontWeight: '700' }}>{t(`wd_${d}`)}</Text>
              <Text style={{ color: active ? C.white : st === 'low' ? C.red : st === 'on' ? C.green : C.textFaint, fontSize: F.micro, fontWeight: '600' }}>{k}</Text>
            </Pressable>
          );
        })}
      </Row>

      <Card rail={statusColor}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View style={{ gap: 2 }}>
            <Micro>{isToday ? t('plan_today') : t(`wd_${dayIdx}`)}</Micro>
            <Text style={{ color: C.text, fontSize: F.h1, fontWeight: '700' }}>
              {totals.kcal}
              <Text style={{ color: C.textFaint, fontSize: F.small, fontWeight: '500' }}>{` / ${targets.kcal} kcal`}</Text>
            </Text>
          </View>
          <Small color={totals.protein < targets.proteinG * 0.7 ? C.amber : C.textDim}>{fill(t('plan_protein'), { p: totals.protein, target: targets.proteinG })}</Small>
        </Row>
        <Bar value={totals.kcal} max={targets.kcal} color={statusColor} />
        <Text style={{ color: statusColor, fontSize: F.body, fontWeight: '600', lineHeight: 22 }}>{fill(t(status === 'low' && totals.kcal >= targets.kcal * 0.85 ? 'plan_status_floor' : `plan_status_${status}`), { gap, floor })}</Text>
        {note ? <Small color={C.textDim}>{note}</Small> : null}
        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          <Btn small tone={status === 'on' ? 'soft' : 'primary'} label={t('plan_balance')} icon={<Ionicons name="scale-outline" size={14} color={status === 'on' ? C.text : C.white} />} onPress={balance} style={{ flexGrow: 1 }} />
          {dayIdx >= 1 && dayIdx <= 5 ? <Btn small tone="soft" label={t('plan_copy_weekdays')} icon={<Ionicons name="copy-outline" size={14} color={C.text} />} onPress={copyWeekdays} style={{ flexGrow: 1 }} /> : null}
          <Btn small tone="ghost" label={t('plan_rebuild')} icon={<Ionicons name="refresh" size={14} color={C.text} />} onPress={rebuild} style={{ flexGrow: 1 }} />
        </Row>
      </Card>

      {day.meals.map((meal) => {
        const mt = mealTotals(meal, foods);
        const done = isToday && logged(meal);
        return (
          <Card key={meal.id} rail={done ? C.green : undefined}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '700' }}>{`${t(MEAL_KEY[meal.id] ?? meal.type)} · ${meal.time}`}</Text>
              <Micro>{`${mt.kcal} kcal · ${mt.protein} g`}</Micro>
            </Row>
            {meal.lines.map((line, i) => {
              const info = lineInfo(line, foods, lang);
              if (!info) return null;
              return (
                <View key={`${line.foodId}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 }}>
                  <Pressable onPress={() => setSwap({ mealId: meal.id, lineIdx: i })} accessibilityRole="button" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <FoodThumb food={info.food} size={34} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600' }} numberOfLines={1}>
                        {foodName(info.food, lang)}
                      </Text>
                      <Text style={{ color: C.textFaint, fontSize: F.tiny }}>{`${info.kcal} kcal · ${t('plan_tap_to_change')}`}</Text>
                    </View>
                  </Pressable>
                  <Row style={{ gap: 4 }}>
                    <Pressable onPress={() => changeQty(meal.id, i, line, -1)} hitSlop={6} accessibilityLabel="−" style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="remove" size={16} color={C.text} />
                    </Pressable>
                    <Pressable onPress={() => cycleUnit(meal.id, i, line)} style={{ minWidth: 64, alignItems: 'center' }}>
                      <Text style={{ color: C.text, fontSize: F.small, fontWeight: '700' }}>{qtyText(line.qty)}</Text>
                      <Text style={{ color: C.accent, fontSize: F.micro }} numberOfLines={1}>{`${unitName(info.unit)} · ${info.grams} g`}</Text>
                    </Pressable>
                    <Pressable onPress={() => changeQty(meal.id, i, line, 1)} hitSlop={6} accessibilityLabel="+" style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="add" size={16} color={C.text} />
                    </Pressable>
                  </Row>
                </View>
              );
            })}
            <Row style={{ gap: 8 }}>
              <Btn small tone="ghost" label={t('plan_add_food')} icon={<Ionicons name="add" size={14} color={C.text} />} onPress={() => { setAdding(meal.id); setQuery(''); }} style={{ flex: 1 }} />
              {isToday ? (
                done ? (
                  <Row style={{ flex: 1, justifyContent: 'center', gap: 6 }}>
                    <Ionicons name="checkmark-circle" size={16} color={C.green} />
                    <Small color={C.green}>{t('plan_logged')}</Small>
                  </Row>
                ) : (
                  <Btn small tone="soft" label={t('plan_log_meal')} icon={<Ionicons name="checkmark" size={14} color={C.text} />} onPress={() => logMeal(meal)} style={{ flex: 1 }} />
                )
              ) : null}
            </Row>
          </Card>
        );
      })}
      <Small color={C.textFaint}>{t('plan_footer')}</Small>

      {/* Swap one line for another of the same kind, or remove it. */}
      <Sheet open={!!swapInfo} title={swapInfo ? fill(t('plan_swap_title'), { food: foodName(swapInfo.food, lang) }) : ''} onClose={() => setSwap(null)}>
        {swapInfo && swap && swapLine ? (
          <View style={{ gap: 6 }}>
            <Small color={C.textDim}>{fill(t('plan_swap_now'), { qty: qtyText(swapLine.qty), unit: `${unitName(swapInfo.unit)} · ${swapInfo.grams} g`, kcal: swapInfo.kcal })}</Small>
            {swapsFor(swapLine, foods, avoided).map((s) => {
              const f = foods.find((x) => x.id === s.line.foodId)!;
              const info = lineInfo(s.line, foods, lang)!;
              return (
                <Pressable
                  key={s.line.foodId}
                  onPress={() => {
                    save(setLine(plan, dayIdx, swap.mealId, swap.lineIdx, s.line));
                    setSwap(null);
                    fb.haptic('light');
                  }}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, opacity: pressed ? 0.7 : 1 })}>
                  <FoodThumb food={f} size={32} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600' }} numberOfLines={1}>{foodName(f, lang)}</Text>
                    <Text style={{ color: C.textFaint, fontSize: F.tiny }}>{`${qtyText(s.line.qty)} ${unitName(info.unit)} · ${info.grams} g`}</Text>
                  </View>
                  <Text style={{ color: C.text, fontSize: F.small, fontWeight: '700' }}>{s.kcal}</Text>
                  <Text style={{ color: s.diff > 0 ? C.amber : s.diff < 0 ? C.green : C.textFaint, fontSize: F.tiny, width: 44, textAlign: 'right' }}>{s.diff === 0 ? '±0' : s.diff > 0 ? `+${s.diff}` : `${s.diff}`}</Text>
                </Pressable>
              );
            })}
            <Btn small tone="danger" label={t('plan_remove')} icon={<Ionicons name="trash-outline" size={14} color={C.red} />} onPress={() => { save(setLine(plan, dayIdx, swap.mealId, swap.lineIdx, null)); setSwap(null); }} />
          </View>
        ) : null}
      </Sheet>

      {/* Add any food: search, then the detail sheet asks how much. */}
      <Sheet open={!!adding && !picked} title={t('plan_add_food')} onClose={() => setAdding(null)}>
        <Field value={query} onChangeText={setQuery} placeholder={t('plan_search')} autoFocus />
        {results.map((f) => (
          <Pressable key={f.id} onPress={() => setPicked(f)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}>
            <FoodThumb food={f} size={30} />
            <Text style={{ flex: 1, color: C.text, fontSize: F.body }} numberOfLines={1}>{foodName(f, lang)}</Text>
            <Ionicons name="chevron-forward" size={15} color={C.textGhost} />
          </Pressable>
        ))}
      </Sheet>
      <FoodDetailSheet
        food={picked}
        onClose={() => setPicked(null)}
        onAdd={(c) => {
          if (adding) save(addLine(plan, dayIdx, adding, { foodId: c.food.id, unit: c.unit, qty: c.count }));
          setPicked(null);
          setAdding(null);
          fb.haptic('light');
        }}
      />
    </Screen>
  );
}
