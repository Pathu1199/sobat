import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { foodName } from '../core/foods';
import { newId } from '../core/id';
import {
  avoidHits,
  bhajiFor,
  DEFAULT_SPREAD,
  planItems,
  planKcal,
  slotLabel,
  slotLines,
  slotLogged,
  SPEND_CATEGORIES,
  spendStatus,
  weekdayOf,
  type AvoidHit,
  type PlanLine,
  type RoutineSlot,
  type SpendCategory,
} from '../core/routine';
import type { FoodItem, Lang } from '../core/types';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
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

/** Today's routine on the Today screen: the bhaji, the fixed meals, the avoid list and the money. */
export function RoutineCard() {
  const app = useApp();
  const router = useRouter();
  const fb = useFeedback();
  const { state, foods, today } = app;
  const routine = state.routine;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const en = makeT('en');
  const [openSlot, setOpenSlot] = useState<RoutineSlot | null>(null);
  const [spendOpen, setSpendOpen] = useState(false);

  if (!routine.enabled) return null;

  const bhaji = bhajiFor(routine, today);
  const todayMeals = state.meals.filter((m) => m.date === today);
  const hits = avoidHits(todayMeals.flatMap((m) => m.items), routine.avoid);
  const status = spendStatus(app.spentToday, routine.budgetMin, routine.budgetMax);
  const spendColor = status === 'over' ? C.red : status === 'in' ? C.green : C.cyan;
  const spendNote =
    status === 'over'
      ? fill(t('routine_budget_over'), { n: app.spentToday - routine.budgetMax })
      : status === 'in'
        ? t('routine_budget_in')
        : fill(t('routine_budget_under'), { n: routine.budgetMin - app.spentToday });

  /** Take back a routine meal logged by mistake: the newest meal of that type holding one of its foods. */
  function unlog(slot: RoutineSlot) {
    const ids = new Set([...slot.options.flat().map((l) => l.foodId), ...(slot.withBhaji ? bhaji : [])]);
    const meal = [...todayMeals].reverse().find((m) => m.type === slot.type && m.items.some((it) => !!it.foodId && ids.has(it.foodId)));
    if (!meal) return;
    app.removeMeal(meal.id);
    fb.notify(t('meal_removed'));
  }

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Micro color={C.textDim}>{`${en('routine_title')} · ${t(`wd_${weekdayOf(today)}`)}`}</Micro>
        <Row style={{ gap: 10 }}>
          <Micro>{fill(t('routine_plan_kcal'), { n: planKcal(routine, foods, today) })}</Micro>
          <Pressable onPress={() => router.push('/routine')} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('edit')}>
            <Micro color={C.accent}>{t('edit')}</Micro>
          </Pressable>
        </Row>
      </Row>

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
        {routine.slots.map((slot, i) => {
          const done = slotLogged(slot, bhaji, todayMeals);
          const lines = slotLines(routine, slot, 0, bhaji[0] ?? null);
          const kcal = planItems(lines, foods).reduce((a, x) => a + x.kcal, 0);
          return (
            <View key={slot.id}>
              {i > 0 ? <Divider /> : null}
              <Pressable
                onPress={() => setOpenSlot(slot)}
                accessibilityRole="button"
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10, opacity: pressed ? 0.7 : 1 })}>
                <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={done ? C.accent : C.borderStrong} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: done ? C.textFaint : C.text, fontSize: F.body, fontWeight: '500' }}>{slotLabel(slot, lang)}</Text>
                  <Text style={{ color: C.textFaint, fontSize: F.tiny }} numberOfLines={1}>
                    {lines.map((l) => lineLabel(l, foods, lang)).join(' + ')}
                  </Text>
                </View>
                <Text style={{ color: C.textDim, fontSize: F.small }}>{`${kcal} kcal`}</Text>
                {done ? (
                  <Pressable onPress={() => unlog(slot)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('undo')}>
                    <Micro color={C.accent}>{`${t('routine_logged')} ×`}</Micro>
                  </Pressable>
                ) : (
                  <Pill label={t('routine_log')} onPress={() => setOpenSlot(slot)} />
                )}
              </Pressable>
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
          <BiText en={en('routine_budget')} alt={lang === 'en' ? undefined : t('routine_budget')} size={F.small} color={C.textDim} weight="400" />
          <Text style={{ color: C.text, fontSize: F.small, fontWeight: '600' }}>
            {`₹${app.spentToday}`}
            <Text style={{ color: C.textFaint, fontWeight: '400' }}>{` / ₹${routine.budgetMin}–${routine.budgetMax}`}</Text>
          </Text>
        </Row>
        <Bar value={app.spentToday} max={routine.budgetMax} color={spendColor} marker={routine.budgetMin / Math.max(1, routine.budgetMax)} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Small color={spendColor}>{spendNote}</Small>
          <Micro color={C.accent}>{`+ ${t('routine_add_spend')}`}</Micro>
        </Row>
      </Pressable>

      <SlotSheet slot={openSlot} bhaji={bhaji} onClose={() => setOpenSlot(null)} />
      <SpendSheet open={spendOpen} onClose={() => setSpendOpen(false)} />
    </Card>
  );
}

/** Pick an option (and a bhaji, on a two-bhaji day), see the numbers, log it. */
function SlotSheet({ slot, bhaji, onClose }: { slot: RoutineSlot | null; bhaji: string[]; onClose: () => void }) {
  const app = useApp();
  const fb = useFeedback();
  const { foods, state } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const [option, setOption] = useState(0);
  const [bhajiIdx, setBhajiIdx] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  // A different slot starts from its defaults again.
  const slotId = slot?.id ?? null;
  if (slotId !== openId) {
    setOpenId(slotId);
    setOption(0);
    setBhajiIdx(0);
  }

  if (!slot) return null;
  const current = slot;
  const lines = slotLines(state.routine, current, option, bhaji[bhajiIdx] ?? null);
  const items = planItems(lines, foods);
  const kcal = items.reduce((a, i) => a + i.kcal, 0);
  const protein = Math.round(items.reduce((a, i) => a + i.protein, 0));

  function log() {
    if (items.length === 0) return;
    const now = new Date();
    app.addMeal({ id: newId(), at: now.toISOString(), date: app.today, type: current.type, items, kcal, protein });
    fb.haptic('success');
    fb.notify(fill(t('toast_meal_saved'), { kcal }));
    onClose();
  }

  return (
    <Sheet open title={slotLabel(current, lang)} onClose={onClose}>
      {current.withBhaji && bhaji.length > 1 ? (
        <View style={{ gap: 8 }}>
          <Micro>{t('routine_bhaji')}</Micro>
          <Row style={{ flexWrap: 'wrap', gap: 6 }}>
            {bhaji.map((id, i) => (
              <Pill key={id} label={foodLabel(id, foods, lang)} active={bhajiIdx === i} onPress={() => setBhajiIdx(i)} />
            ))}
          </Row>
        </View>
      ) : null}
      {current.options.length > 1 ? (
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
                <Text style={{ color: C.textFaint, fontSize: F.tiny, fontWeight: '400' }}> kcal</Text>
              </Text>
            </Row>
          </View>
        ))}
      </View>
      <Divider />
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '400' }}>{kcal}</Text>
          <Micro>{`kcal · ${protein} g ${t('protein').toLowerCase()} · ${t(current.type)}`}</Micro>
        </View>
        <Btn label={t('routine_log')} onPress={log} disabled={items.length === 0} style={{ minWidth: 120 }} />
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
        <Small color={C.textGhost}>{t('routine_none_today')}</Small>
      ) : (
        todays.map((s) => (
          <Row key={s.id} style={{ justifyContent: 'space-between' }}>
            <Small>{`${t(`spend_${s.category}`)}${s.spreadDays > 1 ? ` · ${t(`spread_${s.spreadDays}`)}` : ''}`}</Small>
            <Row style={{ gap: 12 }}>
              <Text style={{ color: C.text, fontSize: F.small, fontWeight: '600' }}>{`₹${s.rupees}`}</Text>
              <Pressable onPress={() => app.removeSpend(s.id)} hitSlop={8} accessibilityLabel={t('delete')}>
                <Ionicons name="close" size={16} color={C.textGhost} />
              </Pressable>
            </Row>
          </Row>
        ))
      )}
    </Sheet>
  );
}
