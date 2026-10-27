import { useRouter } from 'expo-router';
import React, { createContext, useContext, useDeferredValue, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  addRows,
  addsIntoMeal,
  alreadySaved,
  menuSave,
  offersPlanned,
  plannedSummary,
  repeatItems,
  sheetMode,
  slotBefore,
  slotLine,
  startLines,
  startSlot,
  switchDraft,
  undoSteps,
  yesterdayIn,
  type AddRow,
} from '../core/addSheet';
import { addLine, basketFromItems, basketFromLines, basketMeal, basketTotals, itemsMeal, lineOf, linesFromBasket, putLine, setCount, setGrams, slotPreview, stepCount, type BasketLine } from '../core/basket';
import { addDays } from '../core/date';
import { findFoods, itemName, recentFoodIds } from '../core/foods';
import { newId } from '../core/id';
import { mealFromLines, skippedOn } from '../core/menu';
import { slotStates } from '../core/pattern';
import { slotLabel, type PlanLine } from '../core/routine';
import type { FoodItem, ISODate, Meal, SavedMeal } from '../core/types';
import { lineInfo, type PlanMeal } from '../core/weekPlan';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useMinute } from '../services/useClock';
import { useApp } from '../store/AppProvider';
import { Btn, Empty, Field, Micro } from '../ui/components';
import { sheetBottomPad } from '../ui/sheetPad';
import { C, F, lh, S } from '../ui/theme';
import { useBreakpoint } from '../ui/useBreakpoint';
import { useKeyboardUp } from '../ui/useKeyboardUp';
import { FoodRow, OneTapRow, PlannedCard, SaveAsOffer, ToolsRow } from './AddSheetRows';
import { CustomFoodForm } from './CustomFoodForm';
import { FoodDetailSheet } from './FoodDetailSheet';
import { IconButton } from './TopBarActions';

/**
 * What the add sheet is opened for: a date and a slot, the foods to start
 * with ("Change" puts a meal's planned foods in), and whether saving logs a
 * meal or changes that date's menu.
 */
export type AddRequest = { date: ISODate; slotId?: string; lines?: PlanLine[]; mode?: 'log' | 'plan' };

type AddSheetApi = { open: (r: AddRequest) => void };
const AddCtx = createContext<AddSheetApi | null>(null);

/** Opens the add sheet from anywhere under the tabs: the ➕, the sidebar, Today's menu, the old /log address. */
export function useAddSheet(): AddSheetApi {
  const c = useContext(AddCtx);
  if (!c) throw new Error('useAddSheet must be used inside AddSheetProvider');
  return c;
}

/** Holds the one add sheet. Each opening starts it fresh. */
export function AddSheetProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<(AddRequest & { n: number }) | null>(null);
  const api = useMemo<AddSheetApi>(() => ({ open: (r) => setRequest((p) => ({ ...r, n: (p?.n ?? 0) + 1 })) }), []);
  return (
    <AddCtx.Provider value={api}>
      {children}
      {request ? <AddSheet key={request.n} request={request} onClose={() => setRequest(null)} /> : null}
    </AddCtx.Provider>
  );
}

/** A slot chip: the whole 44 pt box is the button on every platform, the chip drawn inside it; the chosen one is announced as selected. */
function SlotChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} aria-selected={active} style={{ minHeight: S.touch, justifyContent: 'center' }}>
      {({ pressed }) => (
        <View
          style={{
            paddingVertical: 7,
            paddingHorizontal: 13,
            borderRadius: 999,
            borderWidth: S.hairline,
            borderColor: active ? C.accent : C.border,
            backgroundColor: active ? C.accent : C.card,
            opacity: pressed ? 0.8 : 1,
          }}>
          <Text style={{ color: active ? C.onAccent : C.text, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * The ➕ sheet: anything eaten that is not ticked off the menu, for the date
 * and slot being looked at. Search sits at the top so its matches stay above
 * the keyboard; under it any food with a − / + and a grams box, and a bar
 * with "N items · X kcal" and Save. Every meal goes through the store's
 * addMeal (or addMealFromPlan) with calories from the database. The fast ways
 * in log in one tap with Undo: the slot as planned, the same slot yesterday, a
 * saved meal; while foods are being chosen the last two add into the meal
 * instead. After a meal of two or more foods that is not one of the saved
 * meals already, the sheet offers to save it under a name. Opened in plan
 * mode, or on a date after today (nothing is logged into the future), Save
 * changes that date's menu instead, and a saved meal goes into it.
 */
function AddSheet({ request, onClose }: { request: AddRequest; onClose: () => void }) {
  const app = useApp();
  const fb = useFeedback();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardUp = useKeyboardUp();
  const wide = useBreakpoint() !== 'mobile';
  const minute = useMinute();
  const { state, today, targets } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const date = request.date;
  const mode = sheetMode(date, today, request.mode);
  const isToday = date === today;
  const foods = app.planFoods;

  const [query, setQuery] = useState('');
  // Typing stays quick: the search runs on the deferred text.
  const deferred = useDeferredValue(query);
  const results = useMemo(() => findFoods(app.foods, deferred), [app.foods, deferred]);
  const [detail, setDetail] = useState<FoodItem | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  // After a logged meal of two or more foods: its lines, offered as a saved meal, and the words saying it was logged.
  const [offer, setOffer] = useState<{ lines: PlanLine[]; logged: string } | null>(null);

  // The slot: the one asked for; else, today, the one whose turn it is; else the day's first still open.
  const { menuOn } = app;
  const menu = useMemo(() => menuOn(date), [menuOn, date]);
  const dayMeals = state.meals.filter((m) => m.date === date);
  const states = slotStates({ routine: state.routine, target: targets.kcal, meals: dayMeals, nowMinutes: isToday ? minute : 1440, skippedSlots: skippedOn(state.slotSkips, date) });
  const [slotId, setSlotId] = useState(() => startSlot({ asked: request.slotId, ids: menu.meals.map((m) => m.id), isToday, states, minute }));
  const slot: PlanMeal | undefined = menu.meals.find((m) => m.id === slotId) ?? menu.meals[0];
  // The foods handed over; else, changing a menu, the slot's planned foods, so Save never drops them.
  const [basket, setBasket] = useState<BasketLine[]>(() => basketFromLines(startLines({ lines: request.lines, mode, planned: slot?.lines ?? [] }), foods));
  // Changing a menu: the meals of the other slots worked on, as they were left, so moving between slots drops nothing.
  const [drafts, setDrafts] = useState<Record<string, BasketLine[]>>({});
  const slotName = (m: Pick<PlanMeal, 'id' | 'type'>) => {
    const s = state.routine.slots.find((x) => x.id === m.id);
    return (s && slotLabel(s, lang)) || t(m.type);
  };

  const totals = basketTotals(basket, foods);
  // What saving does to the slot and the day. A slot holding only the meal filled in from the plan gets that meal
  // replaced (the store drops it when a real meal lands there), so its calories are not counted against the basket.
  const st = slot ? states.find((s) => s.slot.id === slot.id) : undefined;
  const autoKcal = st ? st.meals.filter((m) => m.source === 'auto').reduce((a, m) => a + m.kcal, 0) : 0;
  const dayLeft = isToday ? app.budget.remaining : targets.kcal - dayMeals.reduce((a, m) => a + m.kcal, 0);
  const line =
    mode === 'log' && st && slot
      ? slotLine({ preview: slotPreview({ allowance: st.allowance, eaten: st.eaten, autoKcal, basketKcal: totals.kcal, dayLeft }), autoKcal, slot: slotName(slot), isToday })
      : null;
  const lineText = line ? line.parts.map((p) => fill(t(p.key), p.params)).join(' · ') : '';
  const lineColor = line?.tone === 'over' ? C.red : line?.tone === 'warn' ? C.amber : C.textDim;

  const recents = useMemo(() => recentFoodIds(state.meals, addDays(today, -30), 8), [state.meals, today]);
  // The fast ways in. Eat as planned only on today or an earlier date (the store logs nothing into the future), while the slot
  // holds nothing but the meal filled in from the plan; the same slot yesterday; and saved meals, which go into the meal in plan mode.
  const slotMeals = st?.meals ?? (slot ? dayMeals.filter((m) => m.slotId === slot.id) : []);
  const planned = !!slot && offersPlanned({ mode, date, today, lines: slot.lines, foods, slotMeals });
  const yesterdayItems = slot ? repeatItems(yesterdayIn(state.meals, date, slot), foods) : [];
  const saved = state.savedMeals;
  const rows = addRows({ mode, query: deferred, results: results.map((f) => f.id), basket, planned, yesterday: yesterdayItems.length > 0, saved: saved.map((s) => s.id), recents });
  const linesKcal = (lines: PlanLine[]) => lines.reduce((a, l) => a + (lineInfo(l, foods)?.kcal ?? 0), 0);
  // The same as yesterday and a saved meal add into the meal while foods are being chosen (and always while changing a menu).
  const into = addsIntoMeal(mode, basket);
  const editing = detail ? (basket.find((b) => b.foodId === detail.id) ?? null) : null;

  function pickSlot(id: string) {
    if (id === slot?.id) return;
    setSlotId(id);
    // Changing a menu edits the chosen slot's own foods; the slot left keeps its changes until Save writes them all.
    if (mode === 'plan') {
      const next = switchDraft({ drafts, from: slot?.id, basket, to: id, planned: menu.meals.find((m) => m.id === id)?.lines ?? [], foods });
      setDrafts(next.drafts);
      setBasket(next.basket);
    }
  }

  function addFood(food: FoodItem) {
    fb.haptic('light');
    setBasket((b) => addLine(b, lineOf(food)));
  }

  function step(foodId: string, by: 1 | -1) {
    setBasket((b) => {
      const l = b.find((x) => x.foodId === foodId);
      return l ? setCount(b, foodId, stepCount(l.count, l.unit, by)) : b;
    });
  }

  /**
   * After a one-tap log in a slot: the toast with Undo, and the sheet closes. The slot as it was is taken at the tap, so
   * the Undo (undoSteps, through the store) takes the meal away, puts back the meal filled in from the plan that it
   * replaced, and leaves the slot skipped or not exactly as it was.
   */
  function logWithUndo(slotId: string, kcal: number, log: () => string | null) {
    const before = slotBefore(state, date, slotId);
    const id = log();
    // Refused by the store (nothing logged): nothing is said, and the sheet stays as it was.
    if (id === null) return;
    fb.haptic('success');
    fb.notify(fill(t('toast_meal_saved'), { kcal }), {
      label: t('undo'),
      onPress: () => {
        for (const step of undoSteps({ id, date, slotId, ...before })) {
          if (step.kind === 'remove') app.removeMeal(step.id);
          else if (step.kind === 'add') app.addMeal(step.meal);
          else if (step.kind === 'skip') app.skipSlot(step.date, step.slotId);
          else app.unskipSlot(step.date, step.slotId);
        }
      },
    });
    onClose();
  }

  function atePlanned() {
    if (!slot || !planned) return;
    logWithUndo(slot.id, linesKcal(slot.lines), () => app.addMealFromPlan(date, slot.id));
  }

  // A meal built here, logged in one tap: the same as yesterday or a saved meal.
  function logMeal(meal: Meal, slotId: string) {
    logWithUndo(slotId, meal.kcal, () => {
      app.addMeal(meal);
      return meal.id;
    });
  }

  function repeatYesterday() {
    if (!slot) return;
    if (into) {
      fb.haptic('light');
      setBasket((b) => basketFromItems(b, yesterdayItems, foods));
      return;
    }
    // A copy typed by hand, each food's calories from the database at yesterday's grams.
    const meal = itemsMeal({ id: newId(), date, slot, items: yesterdayItems, now: new Date() });
    if (meal) logMeal(meal, slot.id);
  }

  function logSaved(s: SavedMeal) {
    if (!slot) return;
    if (into) {
      fb.haptic('light');
      setBasket((b) => basketFromLines(s.lines, foods).reduce((acc, l) => addLine(acc, l), b));
      return;
    }
    // Logged from its lines the way eating as planned is, with calories from the database.
    const meal = mealFromLines({ id: newId(), date, slot, lines: s.lines, foods, source: 'manual', now: new Date() });
    if (meal) logMeal(meal, slot.id);
  }

  function changePlanned() {
    if (!slot) return;
    fb.haptic('light');
    // The planned foods go into the meal to adjust, each in place of the same food's line; foods already added stay.
    setBasket((b) => basketFromLines(slot.lines, foods).reduce((acc, l) => putLine(acc, l), b));
  }

  function save() {
    if (!slot) return;
    if (mode === 'plan') {
      // Every slot changed here is written at once; with nothing changed nothing is written, and nothing says it was saved.
      const meals = menuSave(menu.meals, { ...drafts, [slot.id]: basket }, foods);
      if (meals) {
        app.editMenuDay(menu, meals);
        fb.haptic('success');
        fb.notify(t('add_menu_saved'));
      }
      onClose();
      return;
    }
    // Calories from the database at the grams in the basket. A basket that weighs nothing saves nothing.
    const meal = basketMeal({ id: newId(), date, slot, basket, foods, now: new Date() });
    if (!meal) return;
    app.addMeal(meal);
    fb.haptic('success');
    const words = fill(t('toast_meal_saved'), { kcal: meal.kcal });
    // A meal of two or more foods may be one the person eats often: offer to keep it for one-tap logging, unless it is one
    // of their saved meals already. The sheet itself says it was logged, as the toast would sit behind it.
    const lines = linesFromBasket(basket, foods);
    if (lines.length >= 2 && !alreadySaved(lines, state.savedMeals)) {
      setOffer({ lines, logged: words });
      return;
    }
    fb.notify(words);
    onClose();
  }

  function renderRow({ item }: { item: AddRow }) {
    switch (item.kind) {
      case 'head':
        return (
          <View style={{ paddingTop: 14, paddingBottom: 2 }}>
            <Micro>{t(item.titleKey)}</Micro>
          </View>
        );
      case 'basket':
      case 'food': {
        const food = foods.find((f) => f.id === item.foodId);
        if (!food) return null;
        return (
          <FoodRow
            food={food}
            line={basket.find((b) => b.foodId === food.id)}
            lang={lang}
            onAdd={() => addFood(food)}
            onStep={(by) => step(food.id, by)}
            onGrams={(g) => setBasket((b) => setGrams(b, food.id, g))}
            onOpen={() => setDetail(food)}
          />
        );
      }
      case 'tools':
        // Photo and barcode open their own screens, which log for today.
        return (
          <ToolsRow
            lang={lang}
            onPhoto={() => {
              onClose();
              router.push('/photo');
            }}
            onBarcode={() => {
              onClose();
              router.push('/scan');
            }}
            onCustom={() => setCustomOpen(true)}
          />
        );
      case 'empty':
        return (
          <View style={{ gap: 10 }}>
            <Empty text={t('no_results')} />
            <Btn small tone="soft" label={fill(t('add_as_custom'), { q: query.trim() })} onPress={() => setCustomOpen(true)} />
          </View>
        );
      case 'planned':
        return slot ? (
          <PlannedCard
            title={fill(t('add_eat_planned'), { slot: slotName(slot) })}
            summary={plannedSummary(slot.lines, foods, lang)}
            kcal={linesKcal(slot.lines)}
            lang={lang}
            onAte={atePlanned}
            onChange={changePlanned}
          />
        ) : null;
      case 'yesterday': {
        if (!slot) return null;
        const title = fill(t('add_same_yesterday'), { slot: slotName(slot) });
        return (
          <OneTapRow
            icon="refresh"
            title={title}
            sub={`${yesterdayItems.map((it) => itemName(it, foods, lang)).join(', ')} · ${yesterdayItems.reduce((a, it) => a + it.kcal, 0)} kcal`}
            label={into ? fill(t('add_food_named'), { food: title }) : title}
            onPress={repeatYesterday}
          />
        );
      }
      case 'saved': {
        const s = saved.find((x) => x.id === item.savedId);
        if (!s) return null;
        return (
          <OneTapRow
            icon="bookmark-outline"
            title={s.name}
            sub={fill(t(s.lines.length === 1 ? 'add_bar_one' : 'add_bar'), { n: s.lines.length, kcal: linesKcal(s.lines) })}
            label={fill(into ? t('add_food_named') : t('add_log_saved'), { food: s.name, name: s.name })}
            onPress={() => logSaved(s)}
          />
        );
      }
      default:
        return null;
    }
  }

  return (
    <Modal visible transparent animationType={wide ? 'fade' : 'slide'} onRequestClose={onClose}>
      {/* Moves up above the keyboard on a phone, so the bar with Save and a grams box near it stay in sight; a browser moves its own page. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'web' ? undefined : 'padding'}
        style={{ flex: 1, backgroundColor: C.scrim, justifyContent: wide ? 'center' : 'flex-end', alignItems: 'center' }}>
        {/* The dimmed page behind closes the sheet on a tap; screen readers close it with their escape gesture or Back. */}
        <Pressable onPress={onClose} accessible={false} style={StyleSheet.absoluteFill} />
        <View
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          style={{
            width: '100%',
            maxWidth: wide ? 560 : undefined,
            height: wide ? '86%' : '92%',
            backgroundColor: C.card,
            borderWidth: S.hairline,
            borderColor: C.borderStrong,
            borderTopLeftRadius: S.radius + 4,
            borderTopRightRadius: S.radius + 4,
            borderBottomLeftRadius: wide ? S.radius + 4 : 0,
            borderBottomRightRadius: wide ? S.radius + 4 : 0,
            paddingBottom: sheetBottomPad({ wide, keyboardUp, inset: insets.bottom }),
            overflow: 'hidden',
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: S.padLg, paddingRight: 8, paddingTop: 8 }}>
            <Text accessibilityRole="header" style={{ flex: 1, color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500' }}>
              {mode === 'plan' ? t('add_plan_title') : t('add_food')}
            </Text>
            <IconButton name="close" label={t('close')} onPress={onClose} />
          </View>
          {offer ? (
            <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
              <SaveAsOffer
                lang={lang}
                logged={offer.logged}
                onSave={(name) => {
                  app.addSavedMeal(name, offer.lines);
                  fb.haptic('success');
                  fb.notify(t('add_saved_meal'));
                  onClose();
                }}
                onSkip={onClose}
              />
            </ScrollView>
          ) : (
            <>
              <View style={{ gap: 4, paddingBottom: 8 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingHorizontal: S.padLg }}>
                  {menu.meals.map((m) => (
                    <SlotChip key={m.id} label={`${slotName(m)} ${m.time}`} active={slot?.id === m.id} onPress={() => pickSlot(m.id)} />
                  ))}
                </ScrollView>
                {lineText ? <Text style={{ color: lineColor, fontSize: F.small, lineHeight: lh(F.small), paddingHorizontal: S.padLg }}>{lineText}</Text> : null}
                <View style={{ flexDirection: 'row', paddingHorizontal: S.padLg, paddingTop: 4 }}>
                  <Field value={query} onChangeText={setQuery} placeholder={t('search_food')} accessibilityLabel={t('search_food')} />
                </View>
              </View>
              <FlatList
                data={rows}
                keyExtractor={(r) => r.key}
                renderItem={renderRow}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: S.padLg, paddingBottom: S.padLg }}
                ListFooterComponent={
                  customOpen ? (
                    <CustomFoodForm
                      initialName={query}
                      onSaved={(f) => {
                        setCustomOpen(false);
                        addFood(f);
                        setQuery('');
                      }}
                      onCancel={() => setCustomOpen(false)}
                    />
                  ) : null
                }
              />
              {basket.length > 0 || mode === 'plan' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: S.padLg, paddingVertical: 12, borderTopWidth: S.hairline, borderTopColor: C.border, backgroundColor: C.bgAlt }}>
                  <Text style={{ flex: 1, color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>
                    {fill(t(totals.items === 1 ? 'add_bar_one' : 'add_bar'), { n: totals.items, kcal: totals.kcal })}
                  </Text>
                  <Btn label={mode === 'plan' ? t('add_save_menu') : t('save')} onPress={save} disabled={!slot} style={{ minWidth: 120 }} />
                </View>
              ) : null}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
      <FoodDetailSheet
        food={detail}
        initial={editing ? { unit: editing.unit, gramsPerUnit: editing.gramsPerUnit, count: editing.count } : null}
        onAdd={(c) => {
          fb.haptic('light');
          // From a food already in the meal, the sheet's Done sets its line; from a new one it adds a line.
          setBasket((b) => putLine(b, { foodId: c.food.id, unit: c.unit, gramsPerUnit: c.gramsPerUnit, count: c.count }));
          setDetail(null);
          setQuery('');
        }}
        onClose={() => setDetail(null)}
      />
    </Modal>
  );
}
