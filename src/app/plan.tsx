import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AddSheetProvider } from '../components/AddSheet';
import { DayMenu } from '../components/DayMenu';
import { FoodThumb } from '../components/FoodDetailSheet';
import { GrocerySheet } from '../components/GrocerySheet';
import { IconButton } from '../components/TopBarActions';
import { amountText, formatQty } from '../core/basket';
import { addDays, formatDayLabel, formatDayMonth, isIsoDate, mondayOf } from '../core/date';
import { dayView } from '../core/dayView';
import { foodName, unitName } from '../core/foods';
import { weekPlanView, type DayMenu as Menu } from '../core/menu';
import { KCAL_FLOOR } from '../core/nutrition';
import { balanceAvoided, defaultPlanWeek, planRowTone, planWeekRows, weekAverage, withReviewedWeek, type PlanRow, type PlanRowTone } from '../core/planWeek';
import { avoidedFoodIds, slotLabel, weekdayOf } from '../core/routine';
import { isOffDay } from '../core/week';
import { balanceDay, lineInfo, swapsFor } from '../core/weekPlan';
import { fill, makeT, numberText } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Divider, Micro, Row, Screen, Small, Toggle } from '../ui/components';
import { Sheet } from '../ui/Sheet';
import { C, F, lh, S } from '../ui/theme';

/** `/plan` is a page of its own, outside the tabs, so it brings the add sheet that the day's menu opens; inside the tabs this one is simply the nearer. */
export default function PlanScreen() {
  return (
    <AddSheetProvider>
      <PlanWeek />
    </AddSheetProvider>
  );
}

/**
 * Plan next week. The week's dates with arrows between weeks; one row per day
 * with its main dish, its total and a status, and the week's average against
 * the goal under them. A tapped day opens under the week in the same
 * plan-mode menu as Today's future days, with Balance at its foot, other
 * foods behind each food's name and the free-day switch; a day already past
 * is history here, read only, with a way to open it on Today. Every edit
 * changes that date only, through the store's editMenu actions, which refuse
 * a date before today. "Looks good, save week" only marks the week as looked
 * over: the menus are stored as they are edited.
 */
function PlanWeek() {
  const app = useApp();
  const fb = useFeedback();
  const router = useRouter();
  const { state, targets, today } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  // Every planned line is shown and counted with any food it names; Balance and the foods offered instead stay within the person's diet.
  const foods = app.planFoods;
  const floor = KCAL_FLOOR[state.profile.sex];
  const avoided = useMemo(() => avoidedFoodIds(state.routine), [state.routine]);
  const { date } = useLocalSearchParams<{ date?: string }>();
  const linked = isIsoDate(date) ? date : null;

  // A link with a date opens its week and that day; otherwise this week from Monday to Friday, next week at the weekend.
  const [monday, setMonday] = useState(() => (linked ? mondayOf(linked) : defaultPlanWeek(today)));
  const [open, setOpen] = useState<string | null>(linked);
  const [swap, setSwap] = useState<{ slotId: string; idx: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [grocery, setGrocery] = useState(false);

  const week = app.weekMenus(monday);
  const offDays = state.settings.offDays ?? [];
  // The app's own suggestion is named as one only from today on (planWeekRows asks nothing of a day already past).
  const rows = planWeekRows({ week, today, target: targets.kcal, floor, offDays, foods, suggested: (d) => app.isSuggestedMenu(d) });
  const average = weekAverage(rows, targets.kcal);
  const reviewed = (state.settings.reviewedWeeks ?? []).includes(monday);
  // A week wholly past holds nothing left to plan, so it is not marked as looked over either.
  const plannable = rows.some((r) => !r.past);
  const day = open ? (week.find((d) => d.date === open) ?? null) : null;
  const dayRow = day ? (rows.find((r) => r.date === day.date) ?? null) : null;
  const view = day ? dayView({ date: day.date, today, menu: day, meals: [], skippedIds: [], currentId: null, foods, lang, planOnly: true, offDay: isOffDay(offDays, day.date) }) : null;

  const weekRange = `${formatDayMonth(week[0].date, lang)} – ${formatDayMonth(week[6].date, lang)}`;
  const strong = { color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' } as const;
  const small = { color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) } as const;
  const slotName = (id: string, type: string) => {
    const s = state.routine.slots.find((x) => x.id === id);
    return (s && slotLabel(s, lang)) || t(type);
  };
  const statusWord = (r: PlanRow) => t(`planweek_${r.status}`);
  const TONE: Record<PlanRowTone, string> = { red: C.red, amber: C.amber, accent: C.accentText, dim: C.textDim };

  function moveWeek(by: -1 | 1) {
    setMonday((m) => addDays(m, 7 * by));
    setOpen(null);
    setNote(null);
  }

  function saveWeek() {
    const next = withReviewedWeek(state.settings.reviewedWeeks, monday);
    // The same list back means nothing changed: nothing is written, so nothing says it was saved.
    if (next === state.settings.reviewedWeeks) return;
    app.setSettings({ reviewedWeeks: next });
    fb.haptic('success');
    fb.notify(t('planweek_saved'));
  }

  function balance(d: Menu) {
    // Counted with the same foods as the totals on screen; a food outside the diet is never added or made bigger.
    const r = balanceDay({ meals: d.meals }, foods, targets.kcal, balanceAvoided(avoided, foods, app.foods), floor);
    if (!r.changes.length) {
      // Nothing changed, so nothing is written and nothing buzzes as if it were.
      setNote(t('plan_nothing_to_change'));
      return;
    }
    app.editMenuDay(d, r.day.meals);
    setNote(r.changes.map((c) => fill(t(c.key), { meal: t(String(c.params.meal)).toLowerCase() })).join(' · '));
    fb.haptic('success');
  }

  function toggleOff(d: string) {
    // Free days are weekdays in the settings: the same weekday is free every week, as the switch says.
    const wd = weekdayOf(d);
    app.setSettings({ offDays: offDays.includes(wd) ? offDays.filter((x) => x !== wd) : [...offDays, wd].sort((a, b) => a - b) });
  }

  const swapMeal = day && swap ? day.meals.find((m) => m.id === swap.slotId) : undefined;
  const swapLine = swapMeal && swap ? swapMeal.lines[swap.idx] : undefined;
  const swapInfo = swapLine ? lineInfo(swapLine, foods, lang) : null;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconButton name="chevron-back" label={t('strip_prev_week')} onPress={() => moveWeek(-1)} />
        <Text numberOfLines={1} style={[strong, { flex: 1, textAlign: 'center' }]}>
          {weekRange}
        </Text>
        <IconButton name="chevron-forward" label={t('strip_next_week')} onPress={() => moveWeek(1)} />
      </View>

      <Card>
        <View>
          {rows.map((r, i) => {
            const planned = r.status !== 'off' && r.status !== 'empty';
            const dish = planned && r.mainFoodId ? foods.find((f) => f.id === r.mainFoodId) : undefined;
            const tone = TONE[planRowTone(r)];
            const selected = r.date === open;
            const dayLabel = formatDayLabel(r.date, lang);
            return (
              <View key={r.date}>
                {i > 0 ? <Divider /> : null}
                <Pressable
                  onPress={() => {
                    setOpen(selected ? null : r.date);
                    setNote(null);
                  }}
                  accessibilityRole="button"
                  aria-expanded={selected}
                  accessibilityLabel={
                    dish
                      ? fill(t('planweek_row_a11y'), { day: dayLabel, dish: foodName(dish, lang), kcal: numberText(r.kcal), status: statusWord(r) })
                      : fill(t('planweek_row_none_a11y'), { day: dayLabel, status: statusWord(r) })
                  }
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    minHeight: 56,
                    paddingHorizontal: 6,
                    borderRadius: S.radiusSm,
                    backgroundColor: selected ? C.accentDim : 'transparent',
                    opacity: pressed ? 0.7 : 1,
                  })}>
                  <View style={{ width: 52 }}>
                    <Text numberOfLines={1} style={{ color: r.date === today ? C.accentText : C.textDim, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>
                      {t(`wd_${r.weekday}`)}
                    </Text>
                    <Text style={strong}>{String(Number(r.date.slice(8)))}</Text>
                  </View>
                  {dish ? <FoodThumb food={dish} lang={lang} size={32} /> : r.status === 'off' ? <Ionicons name="leaf-outline" size={20} color={C.textDim} /> : null}
                  <Text numberOfLines={1} style={{ flex: 1, color: dish ? C.text : C.textDim, fontSize: F.body, lineHeight: lh(F.body) }}>
                    {dish ? foodName(dish, lang) : statusWord(r)}
                  </Text>
                  {dish ? (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[small, { color: C.text, fontWeight: '500' }]}>{`${numberText(r.kcal)} kcal`}</Text>
                      <Row style={{ gap: 4 }}>
                        {r.status === 'on' ? <Ionicons name="checkmark-circle" size={F.small} color={C.accentText} /> : null}
                        <Text style={[small, { color: tone }]}>{statusWord(r)}</Text>
                      </Row>
                    </View>
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </View>
        {average ? (
          <Small color={Math.abs(average.diff) <= targets.kcal * 0.05 ? C.textDim : C.amber}>{fill(t('planweek_average'), { avg: numberText(average.avg), goal: numberText(targets.kcal) })}</Small>
        ) : null}
      </Card>

      {day && dayRow && view ? (
        dayRow.past ? (
          // A day already past: what it planned, read only. What was eaten that day is filled in on Today.
          <Card>
            <Text style={strong}>{formatDayLabel(day.date, lang)}</Text>
            {view.rows.map((r) => (
              <View key={r.slotId} style={{ gap: 2 }}>
                <Text style={strong}>{`${slotName(r.slotId, r.type)} · ${r.plannedKcal} kcal`}</Text>
                <Text style={small}>{r.lines.map((l) => `${l.name}, ${amountText(l.qty, l.measure)}`).join(' · ') || t('menu_nothing_planned')}</Text>
              </View>
            ))}
            <Text style={small}>{t('planweek_past_note')}</Text>
            <Btn small tone="soft" label={t('planweek_open_today')} onPress={() => router.navigate({ pathname: '/', params: { date: day.date } })} />
          </Card>
        ) : (
          <View style={{ gap: S.gap }}>
            <Card>
              <Text style={strong}>{formatDayLabel(day.date, lang)}</Text>
              <Toggle title={t('plan_free_toggle')} desc={t('plan_free_desc')} on={dayRow.off} onToggle={() => toggleOff(day.date)} />
            </Card>
            {/* A free day hides its menu, unless what it plans is under the safe minimum: then the menu shows, to put right. */}
            {dayRow.status === 'off' ? null : (
              <>
                <DayMenu date={day.date} view={view} menu={day} onOpenMeal={() => {}} onLinePress={(row, l) => setSwap({ slotId: row.slotId, idx: l.idx })} onBalance={() => balance(day)} />
                {note ? <Small color={C.textDim}>{note}</Small> : null}
              </>
            )}
          </View>
        )
      ) : null}

      <View style={{ gap: 8 }}>
        {!plannable ? null : reviewed ? (
          <Row style={{ gap: 6, minHeight: S.touch, justifyContent: 'center' }}>
            <Ionicons name="checkmark-circle" size={18} color={C.accentText} />
            <Text style={[strong, { color: C.accentText }]}>{t('planweek_reviewed')}</Text>
          </Row>
        ) : (
          <Btn label={t('planweek_save')} onPress={saveWeek} />
        )}
        <Pressable
          onPress={() => setGrocery(true)}
          accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, borderRadius: S.radius, backgroundColor: C.card, borderWidth: S.hairline, borderColor: C.border, opacity: pressed ? 0.8 : 1 })}>
          <Ionicons name="basket-outline" size={22} color={C.accentText} />
          <View style={{ flex: 1 }}>
            <Text style={strong}>{t('grocery_title')}</Text>
            <Text style={small}>{monday === mondayOf(today) ? t('grocery_sub') : fill(t('grocery_sub_week'), { week: weekRange })}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.textFaint} />
        </Pressable>
        <Pressable onPress={() => router.push('/food?s=routine')} accessibilityRole="button" accessibilityLabel={t('plan_follows_pattern')} style={{ minHeight: S.touch, justifyContent: 'center', alignSelf: 'flex-start' }}>
          <Micro color={C.accentText}>{`${t('plan_follows_pattern')} ›`}</Micro>
        </Pressable>
      </View>

      <GrocerySheet open={grocery} onClose={() => setGrocery(false)} plan={weekPlanView(week)} monday={monday} />

      {/* Another food of the same kind in this one's place, or this one taken out. */}
      <Sheet open={!!swapInfo} title={swapInfo ? fill(t('plan_swap_title'), { food: foodName(swapInfo.food, lang) }) : ''} onClose={() => setSwap(null)}>
        {swapInfo && swap && swapLine && day ? (
          <View style={{ gap: 6 }}>
            <Small color={C.textDim}>{fill(t('plan_swap_now'), { qty: formatQty(swapLine.qty), unit: `${unitName(swapInfo.unit, lang)} · ${swapInfo.grams} g`, kcal: swapInfo.kcal })}</Small>
            {swapsFor(swapLine, app.foods, avoided).map((s) => {
              const f = foods.find((x) => x.id === s.line.foodId);
              const info = lineInfo(s.line, foods, lang);
              if (!f || !info) return null;
              return (
                <Pressable
                  key={s.line.foodId}
                  onPress={() => {
                    app.editMenuLine(day, swap.slotId, swap.idx, s.line);
                    setSwap(null);
                    fb.haptic('light');
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: S.touch, opacity: pressed ? 0.7 : 1 })}>
                  <FoodThumb food={f} lang={lang} size={32} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={strong}>
                      {foodName(f, lang)}
                    </Text>
                    <Text numberOfLines={1} style={small}>{`${formatQty(s.line.qty)} ${unitName(info.unit, lang)} · ${info.grams} g`}</Text>
                  </View>
                  <Text style={[small, { color: C.text, fontWeight: '500' }]}>{s.kcal}</Text>
                  <Text style={[small, { color: s.diff > 0 ? C.amber : s.diff < 0 ? C.green : C.textDim, width: 44, textAlign: 'right' }]}>
                    {s.diff === 0 ? '±0' : s.diff > 0 ? `+${s.diff}` : `${s.diff}`}
                  </Text>
                </Pressable>
              );
            })}
            <Btn
              small
              tone="danger"
              label={t('plan_remove')}
              onPress={() => {
                app.editMenuLine(day, swap.slotId, swap.idx, null);
                setSwap(null);
              }}
            />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
