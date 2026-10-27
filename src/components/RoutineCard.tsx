import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { foodName, searchFoods } from '../core/foods';
import { newId } from '../core/id';
import { KCAL_FLOOR } from '../core/nutrition';
import { slotStates, type SlotState } from '../core/pattern';
import {
  avoidHits,
  bhajiFor,
  DEFAULT_SPREAD,
  planItems,
  skipKey,
  slotLabel,
  slotLines,
  slotTime,
  SPEND_CATEGORIES,
  spendStatus,
  weekdayOf,
  type AvoidHit,
  type PlanLine,
  type RoutineSlot,
  type SpendCategory,
} from '../core/routine';
import type { FoodItem, Lang, MealItem } from '../core/types';
import { dayStatus, dayTotals, mealTotals } from '../core/weekPlan';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useMinute } from '../services/useWorkSchedule';
import { useApp } from '../store/AppProvider';
import { Bar, BiText, Btn, Card, Divider, Field, Micro, Pill, Row, Small } from '../ui/components';
import { Sheet } from '../ui/Sheet';
import { Checklist } from '../ui/tiles';
import { C, F } from '../ui/theme';

const SPREADS = [1, 7, 30];

/** "Chapati × 2" in the chosen language. */
export function lineLabel(line: PlanLine, foods: FoodItem[], lang: Lang): string {
  const food = foods.find((f) => f.id === line.foodId);
  const name = food ? foodName(food, lang) : line.foodId;
  return line.qty === 1 ? name : `${name} × ${line.qty}`;
}

/** A logged line's name in the chosen language: the database name where there is one, else its own. */
function itemName(it: Pick<MealItem, 'foodId' | 'name_en' | 'name_mr'>, foods: FoodItem[], lang: Lang): string {
  const f = it.foodId ? foods.find((x) => x.id === it.foodId) : undefined;
  return f ? foodName(f, lang) : lang === 'en' ? it.name_en : it.name_mr || it.name_en;
}

function foodLabel(id: string, foods: FoodItem[], lang: Lang): string {
  const food = foods.find((f) => f.id === id);
  return food ? foodName(food, lang) : id;
}

/** The swap line under an avoided food: "Next time try Almonds or Walnuts." */
export function swapText(hit: AvoidHit, foods: FoodItem[], lang: Lang): string {
  const t = makeT(lang);
  // The database name in the chosen language where there is one; a photo line keeps its own.
  const head = fill(t('routine_avoid_hit'), { food: hit.foodId && foods.some((f) => f.id === hit.foodId) ? foodLabel(hit.foodId, foods, lang) : hit.name });
  if (hit.rule.swapIds.length === 0) return head;
  const or = lang === 'mr' ? ' किंवा ' : lang === 'hi' ? ' या ' : ' or ';
  return `${head} ${fill(t('routine_try'), { swap: hit.rule.swapIds.map((id) => foodLabel(id, foods, lang)).join(or) })}`;
}

/**
 * Today's eating pattern: one row per slot with what is planned, what was
 * eaten against what it may have, and the difference. A slot not yet eaten
 * logs as planned in one tap or opens the log screen for something else.
 * The bhaji, the walk, the avoid list and the money stay where they were.
 */
export function RoutineCard() {
  const app = useApp();
  const router = useRouter();
  const fb = useFeedback();
  const { state, foods, today, targets } = app;
  const routine = state.routine;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const [openSlot, setOpenSlot] = useState<SlotState | null>(null);
  const [spendOpen, setSpendOpen] = useState(false);
  const minute = useMinute();

  const bhaji = bhajiFor(routine, today);
  const todayMeals = useMemo(() => state.meals.filter((m) => m.date === today), [state.meals, today]);
  const planDay = state.weekPlan?.days[weekdayOf(today)];
  const planned = useMemo(() => (planDay ? Object.fromEntries(planDay.meals.map((m) => [m.id, mealTotals(m, foods).kcal])) : undefined), [planDay, foods]);
  const states = useMemo(
    () => slotStates({ routine, target: targets.kcal, meals: todayMeals, nowMinutes: minute, skipped: app.actionsDoneToday, planned }),
    [routine, targets.kcal, todayMeals, minute, app.actionsDoneToday, planned],
  );

  if (!routine.enabled) return null;

  const hits = avoidHits(todayMeals.flatMap((m) => m.items), routine.avoid);
  const status = spendStatus(app.spentToday, routine.budgetMin, routine.budgetMax);
  const spendColor = status === 'over' ? C.red : status === 'in' ? C.green : C.cyan;
  const spendNote =
    status === 'over'
      ? fill(t('routine_budget_over'), { n: app.spentToday - routine.budgetMax })
      : status === 'in'
        ? t('routine_budget_in')
        : fill(t('routine_budget_under'), { n: routine.budgetMin - app.spentToday });
  const planTotal = planDay ? dayTotals(planDay, foods) : null;
  const planStatus = planTotal ? dayStatus(planTotal.kcal, targets.kcal, KCAL_FLOOR[state.profile.sex]) : null;

  /** The lines a slot is planned to hold today: the week plan's when it has them, else the slot's own default with the day's bhaji. */
  function plannedLines(s: SlotState): PlanLine[] {
    const fromPlan = planDay?.meals.find((m) => m.id === s.slot.id)?.lines ?? [];
    return fromPlan.length > 0 ? fromPlan : slotLines(routine, s.slot.slot, 0, bhaji[0] ?? null);
  }

  /** Take back the newest meal logged against a slot. */
  function unlog(s: SlotState) {
    const meal = s.meals[s.meals.length - 1];
    if (!meal) return;
    app.removeMeal(meal.id);
    fb.notify(t('meal_removed'), { label: t('undo'), onPress: () => app.addMeal(meal) });
  }

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Micro color={C.textDim}>{`${t('pattern_title')} · ${t(`wd_${weekdayOf(today)}`)}`}</Micro>
        <Pressable onPress={() => router.push('/food?s=routine')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('edit')}>
          <Ionicons name="create-outline" size={18} color={C.textFaint} />
        </Pressable>
      </Row>

      {planTotal ? (
        <Pressable onPress={() => router.push('/food?s=plan')} accessibilityRole="button" style={{ gap: 2 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Micro color={C.textDim}>{t('plan_today')}</Micro>
            <Text style={{ color: C.text, fontSize: F.body, fontWeight: '700' }}>
              {planTotal.kcal}
              <Text style={{ color: C.textFaint, fontSize: F.tiny, fontWeight: '500' }}>{` / ${targets.kcal} kcal`}</Text>
            </Text>
          </Row>
          {planStatus === 'low' ? <Small color={C.red}>{fill(t('plan_status_low_short'), { gap: targets.kcal - planTotal.kcal })}</Small> : null}
        </Pressable>
      ) : null}

      <View style={{ gap: 4 }}>
        <Micro>{t('routine_bhaji')}</Micro>
        {bhaji.length > 0 ? (
          <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '600' }}>
            {bhaji.map((id) => foodLabel(id, foods, lang)).join(lang === 'mr' ? ' किंवा ' : lang === 'hi' ? ' या ' : ' or ')}
          </Text>
        ) : (
          <Small>{t('routine_free_day')}</Small>
        )}
      </View>

      {routine.walk ? (
        <Checklist
          color={C.green}
          items={[{ key: 'routine_walk', label: t('routine_walk'), done: app.actionsDoneToday.includes('routine_walk') }]}
          onToggle={app.toggleAction}
        />
      ) : null}

      <View>
        {states.map((s, i) => {
          const slot = s.slot.slot;
          const lines = plannedLines(s);
          const plannedKcal = s.planned > 0 ? s.planned : planItems(lines, foods).reduce((a, x) => a + x.kcal, 0);
          const done = s.status === 'done';
          const skipped = s.status === 'skipped';
          const quiet = done || skipped;
          const diff = done && plannedKcal > 0 ? s.eaten - plannedKcal : null;
          const tone = done ? C.accent : s.status === 'now' ? C.amber : s.status === 'missed' ? C.red : C.borderStrong;
          return (
            <View key={slot.id}>
              {i > 0 ? <Divider /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 }}>
                <Ionicons name={done ? 'checkmark-circle' : skipped ? 'remove-circle-outline' : s.status === 'now' ? 'time' : 'ellipse-outline'} size={20} color={tone} />
                <Pressable onPress={() => (quiet ? undefined : lines.length === 0 ? router.push({ pathname: '/log', params: { slot: slot.id } }) : setOpenSlot(s))} disabled={quiet} accessibilityRole="button" style={({ pressed }) => ({ flex: 1, gap: 2, opacity: pressed && !quiet ? 0.7 : 1 })}>
                  <Row style={{ gap: 8 }}>
                    <Text style={{ color: quiet ? C.textFaint : C.text, fontSize: F.body, fontWeight: '500', textDecorationLine: skipped ? 'line-through' : 'none' }}>{slotLabel(slot, lang)}</Text>
                    <Micro color={s.status === 'now' ? C.amber : s.status === 'missed' ? C.red : C.textFaint}>{s.status === 'missed' ? t('slot_missed') : s.status === 'now' ? t('slot_now') : slotTime(slot)}</Micro>
                  </Row>
                  <Text style={{ color: C.textFaint, fontSize: F.tiny }} numberOfLines={1}>
                    {done ? s.meals.flatMap((m) => m.items.map((it) => itemName(it, foods, lang))).join(', ') : lines.length === 0 ? t('pattern_log_other') : lines.map((l) => lineLabel(l, foods, lang)).join(' + ')}
                  </Text>
                </Pressable>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  {done ? (
                    <>
                      <Text style={{ color: s.left < 0 ? C.amber : C.text, fontSize: F.small, fontWeight: '600' }}>
                        {s.eaten}
                        <Text style={{ color: C.textFaint, fontWeight: '500' }}>{` / ${s.allowance}`}</Text>
                      </Text>
                      {diff !== null ? <Micro color={diff > 0 ? C.amber : C.textFaint}>{`${diff > 0 ? '+' : ''}${diff} ${t('pattern_vs_plan')}`}</Micro> : null}
                    </>
                  ) : (
                    <Text style={{ color: C.textDim, fontSize: F.small }}>{fill(t('pattern_planned'), { kcal: plannedKcal })}</Text>
                  )}
                </View>
                {done ? (
                  <Pressable onPress={() => unlog(s)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('meal_removed')}>
                    <Micro color={C.accent}>{`${t('routine_logged')} ×`}</Micro>
                  </Pressable>
                ) : skipped ? (
                  <Pressable onPress={() => app.toggleAction(skipKey(slot))} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('undo')}>
                    <Micro color={C.textFaint}>{`${t('slot_skipped')} ×`}</Micro>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => (lines.length === 0 ? router.push({ pathname: '/log', params: { slot: slot.id } }) : setOpenSlot(s))} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${t('pattern_log_planned')} · ${slotLabel(slot, lang)}`}>
                    <Ionicons name="add-circle" size={28} color={C.accent} />
                  </Pressable>
                )}
              </View>
              {!quiet ? (
                <Row style={{ gap: 14, paddingLeft: 31, paddingBottom: 6 }}>
                  <Pressable onPress={() => router.push({ pathname: '/log', params: { slot: slot.id } })} accessibilityRole="button" accessibilityLabel={`${t('pattern_log_other')} · ${slotLabel(slot, lang)}`} hitSlop={10} style={{ paddingVertical: 6 }}>
                    <Micro color={C.accent}>{`${t('pattern_log_other')} ›`}</Micro>
                  </Pressable>
                  {s.status === 'missed' ? (
                    <Pressable onPress={() => app.toggleAction(skipKey(slot))} hitSlop={6} accessibilityRole="button">
                      <Micro color={C.textFaint}>{t('slot_skip')}</Micro>
                    </Pressable>
                  ) : null}
                </Row>
              ) : null}
            </View>
          );
        })}
      </View>

      {hits.length > 0 ? (
        <View style={{ gap: 6 }}>
          {hits.map((h) => (
            <Row key={h.rule.id} style={{ gap: 8, alignItems: 'flex-start' }}>
              <Ionicons name="swap-horizontal" size={14} color={C.amber} style={{ marginTop: 2 }} />
              <Text style={{ color: C.amber, fontSize: F.small, lineHeight: 18, flex: 1 }}>{swapText(h, foods, lang)}</Text>
            </Row>
          ))}
        </View>
      ) : null}

      <Divider />
      <Pressable onPress={() => setSpendOpen(true)} accessibilityRole="button" style={({ pressed }) => ({ gap: 7, opacity: pressed ? 0.7 : 1 })}>
        <Row style={{ justifyContent: 'space-between' }}>
          <BiText en={t('routine_budget')} alt={lang === 'en' ? undefined : t('routine_budget')} size={F.small} color={C.textDim} weight="400" />
          <Text style={{ color: C.text, fontSize: F.small, fontWeight: '600' }}>
            {`₹${app.spentToday}`}
            <Text style={{ color: C.textFaint, fontWeight: '500' }}>{` / ₹${routine.budgetMin}–${routine.budgetMax}`}</Text>
          </Text>
        </Row>
        <Bar value={app.spentToday} max={routine.budgetMax} color={spendColor} marker={routine.budgetMin / Math.max(1, routine.budgetMax)} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Small color={spendColor}>{spendNote}</Small>
          <Micro color={C.accent}>{`+ ${t('routine_add_spend')}`}</Micro>
        </Row>
      </Pressable>

      <SlotSheet state={openSlot} planLines={openSlot ? (planDay?.meals.find((m) => m.id === openSlot.slot.id)?.lines ?? []) : []} bhaji={bhaji} onClose={() => setOpenSlot(null)} />
      <SpendSheet open={spendOpen} onClose={() => setSpendOpen(false)} />
    </Card>
  );
}

/**
 * Log a slot as planned. With a week plan the lines are the plan's for today
 * and there is nothing to pick; without one, pick the option and the bhaji.
 */
function SlotSheet({ state: s, planLines, bhaji, onClose }: { state: SlotState | null; planLines: PlanLine[]; bhaji: string[]; onClose: () => void }) {
  const app = useApp();
  const fb = useFeedback();
  const { foods, state } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const [option, setOption] = useState(0);
  const [bhajiIdx, setBhajiIdx] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  // Ate a different bhaji than planned: pick any vegetable dish instead.
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherQuery, setOtherQuery] = useState('');
  const [otherId, setOtherId] = useState<string | null>(null);

  // A different slot starts from its defaults again.
  const slotId = s?.slot.id ?? null;
  if (slotId !== openId) {
    setOpenId(slotId);
    setOption(0);
    setBhajiIdx(0);
    setOtherOpen(false);
    setOtherQuery('');
    setOtherId(null);
  }

  if (!s) return null;
  const current: RoutineSlot = s.slot.slot;
  const fromPlan = planLines.length > 0;
  const chosenBhaji = otherId ?? bhaji[bhajiIdx] ?? null;
  const lines = fromPlan ? planLines : slotLines(state.routine, current, option, chosenBhaji);
  const otherResults = otherOpen && otherQuery.trim() ? searchFoods(foods, otherQuery, 6).filter((f) => f.category === 'veg' || f.category === 'dal') : [];
  const items = planItems(lines, foods);
  const kcal = items.reduce((a, i) => a + i.kcal, 0);
  const protein = Math.round(items.reduce((a, i) => a + i.protein, 0));

  function log() {
    if (items.length === 0) return;
    const now = new Date();
    app.addMeal({ id: newId(), at: now.toISOString(), date: app.today, type: current.type, items, kcal, protein, slotId: current.id });
    fb.haptic('success');
    fb.notify(fill(t('toast_meal_saved'), { kcal }));
    onClose();
  }

  return (
    <Sheet open title={slotLabel(current, lang)} onClose={onClose}>
      {!fromPlan && current.withBhaji ? (
        <View style={{ gap: 8 }}>
          <Micro>{t('routine_bhaji')}</Micro>
          <Row style={{ flexWrap: 'wrap', gap: 6 }}>
            {bhaji.map((id, i) => (
              <Pill key={id} label={foodLabel(id, foods, lang)} active={otherId === null && bhajiIdx === i} onPress={() => { setBhajiIdx(i); setOtherId(null); setOtherOpen(false); }} />
            ))}
            {otherId ? <Pill label={foodLabel(otherId, foods, lang)} active onPress={() => setOtherOpen(true)} /> : null}
            <Pill label={`${t('other_bhaji')}…`} active={otherOpen && !otherId} onPress={() => setOtherOpen((o) => !o)} />
          </Row>
          {otherOpen ? (
            <View style={{ gap: 4 }}>
              <Field value={otherQuery} onChangeText={setOtherQuery} placeholder={t('search_food')} autoFocus />
              {otherResults.map((f) => (
                <Pressable key={f.id} onPress={() => { setOtherId(f.id); setOtherOpen(false); setOtherQuery(''); }} style={({ pressed }) => ({ paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}>
                  <BiText en={f.name_en} alt={lang === 'en' ? undefined : f.name_mr} size={F.body} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {!fromPlan && current.options.length > 1 ? (
        <View style={{ gap: 8 }}>
          <Micro>{t('routine_pick')}</Micro>
          <Row style={{ flexWrap: 'wrap', gap: 6 }}>
            {current.options.map((o, i) => (
              <Pill key={i} label={o.map((l) => lineLabel(l, foods, lang)).join(' + ')} active={option === i} onPress={() => setOption(i)} />
            ))}
          </Row>
        </View>
      ) : null}
      <View>
        {items.map((it, i) => (
          <View key={`${it.foodId}-${i}`}>
            {i > 0 ? <Divider /> : null}
            <Row style={{ justifyContent: 'space-between', paddingVertical: 9 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <BiText en={it.name_en} alt={lang === 'en' ? undefined : it.name_mr} size={F.body} />
                <Micro>{`${it.grams} g · ${Math.round(it.protein)} g ${t('protein').toLowerCase()}`}</Micro>
              </View>
              <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600' }}>
                {it.kcal}
                <Text style={{ color: C.textFaint, fontSize: F.tiny, fontWeight: '500' }}> kcal</Text>
              </Text>
            </Row>
          </View>
        ))}
      </View>
      <Divider />
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '500' }}>{kcal}</Text>
          <Micro>{`kcal · ${protein} g ${t('protein').toLowerCase()} · ${t(current.type)}`}</Micro>
        </View>
        <Btn label={t('pattern_log_planned')} onPress={log} disabled={items.length === 0} style={{ minWidth: 120 }} />
      </Row>
    </Sheet>
  );
}

/** Note what was spent, and how many days it should count for. */
function SpendSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const fb = useFeedback();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const [category, setCategory] = useState<SpendCategory>('veg');
  const [spread, setSpread] = useState(DEFAULT_SPREAD.veg);
  const [amount, setAmount] = useState('');

  const rupees = parseFloat(amount);
  const valid = Number.isFinite(rupees) && rupees > 0 && rupees < 100000;
  const todays = app.state.spend.filter((s) => s.date === app.today);

  function pick(c: SpendCategory) {
    setCategory(c);
    setSpread(DEFAULT_SPREAD[c]);
  }

  function save() {
    if (!valid) return;
    app.addSpend({ category, rupees: Math.round(rupees), spreadDays: spread });
    setAmount('');
    fb.haptic('light');
    fb.notify(`₹${Math.round(rupees)} · ${t(`spend_${category}`)}`);
  }

  return (
    <Sheet open={open} title={t('routine_add_spend')} onClose={onClose}>
      <Row style={{ flexWrap: 'wrap', gap: 6 }}>
        {SPEND_CATEGORIES.map((c) => (
          <Pill key={c} label={t(`spend_${c}`)} active={category === c} onPress={() => pick(c)} />
        ))}
      </Row>
      <Field label={t('routine_amount')} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="50" />
      <Micro>{t('routine_spread')}</Micro>
      <Row style={{ gap: 6 }}>
        {SPREADS.map((d) => (
          <Pill key={d} label={t(`spread_${d}`)} active={spread === d} onPress={() => setSpread(d)} />
        ))}
      </Row>
      {valid && spread > 1 ? <Small>{`≈ ₹${Math.round(rupees / spread)} / ${t('spread_1').toLowerCase()}`}</Small> : null}
      <Btn label={t('save')} onPress={save} disabled={!valid} />
      <Small color={C.textFaint}>{t('routine_spend_hint')}</Small>
      <Divider />
      <Micro>{t('routine_spent_today')}</Micro>
      {todays.length === 0 ? (
        <Small color={C.textFaint}>{t('routine_none_today')}</Small>
      ) : (
        todays.map((s) => (
          <Row key={s.id} style={{ justifyContent: 'space-between' }}>
            <Small>{`${t(`spend_${s.category}`)}${s.spreadDays > 1 ? ` · ${t(`spread_${s.spreadDays}`)}` : ''}`}</Small>
            <Row style={{ gap: 12 }}>
              <Text style={{ color: C.text, fontSize: F.small, fontWeight: '600' }}>{`₹${s.rupees}`}</Text>
              <Pressable onPress={() => app.removeSpend(s.id)} hitSlop={8} accessibilityLabel={t('delete')}>
                <Ionicons name="close" size={16} color={C.textFaint} />
              </Pressable>
            </Row>
          </Row>
        ))
      )}
    </Sheet>
  );
}
