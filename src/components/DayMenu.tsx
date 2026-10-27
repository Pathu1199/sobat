import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { slotBefore, undoSteps } from '../core/addSheet';
import { amountText, stepFoodLine } from '../core/basket';
import { draftKey, fillUndoSteps, offersDayConfirm, planNote, recordTone, rowLines, rowOffers, stepDraft, type DayView, type MenuRow, type RowLine } from '../core/dayView';
import { itemName } from '../core/foods';
import type { DayMenu as Menu } from '../core/menu';
import { KCAL_FLOOR } from '../core/nutrition';
import { slotLabel, type PlanLine } from '../core/routine';
import type { ISODate, Meal } from '../core/types';
import { runUndo } from '../core/undo';
import { isOffDay } from '../core/week';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Bar, Btn, Card, Divider, Row, SectionHeader } from '../ui/components';
import { QtyStepper } from '../ui/QtyStepper';
import { C, F, lh, S } from '../ui/theme';
import { useAddSheet } from './AddSheet';

/** A chip that is a finger tall on every platform: the box itself is 44, the pill sits in its middle. */
function Chip({ label, a11y, onPress }: { label: string; a11y?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y ?? label} style={{ minHeight: S.touch, justifyContent: 'center', alignSelf: 'flex-start' }}>
      {({ pressed }) => (
        <View style={{ paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999, borderWidth: S.hairline, borderColor: C.border, backgroundColor: C.cardAlt, opacity: pressed ? 0.8 : 1 }}>
          <Text style={{ color: C.text, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * The day's menu, one row per slot (core/dayView.ts decides each row's state
 * and what it offers). Today: eaten slots ticked on one line, the slot whose
 * turn it is open with Ate as planned and Change, later slots one line. A
 * past day says how many meals are missing with "2 of 3 meals", and fills
 * each open slot as planned, with something else, or as skipped, with − / +
 * on each planned food; those change a draft of what was eaten, which Ate
 * this logs, never that day's menu (its record of what was planned). An
 * empty day fills from the plan in one tap, with Undo. A future day is the
 * plan itself and logs nothing: − / + and Change edit that date's menu, and
 * the total against the goal updates at once. On the plan screen a planned
 * food's name also opens other foods to put in its place, and Balance sits
 * at the foot of the menu; elsewhere a day planned too low links to the plan
 * screen at its date.
 * Meals the app filled in carry a "from plan" chip until they are confirmed,
 * one by one or with "Day looks right" (a past day, or today from 21:00). A
 * free day and a day before the person started are not judged. Every log
 * from here has an Undo that puts the slot back as it was, its skip too.
 */
export function DayMenu({
  date,
  view,
  menu,
  onOpenMeal,
  onLinePress,
  onBalance,
}: {
  date: ISODate;
  view: DayView;
  menu: Menu;
  onOpenMeal: (m: Meal) => void;
  /** Plan mode on the plan screen: a tap on a planned food's name, to pick another food in its place. */
  onLinePress?: (row: MenuRow, line: RowLine) => void;
  /** Plan mode on the plan screen: Balance, at the foot of the menu. Without it, a day too low links to the plan screen at its date. */
  onBalance?: () => void;
}) {
  const app = useApp();
  const fb = useFeedback();
  const router = useRouter();
  const addSheet = useAddSheet();
  const { state, targets, hour } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const small = { color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) } as const;
  const strong = { color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' } as const;

  const title = (row: MenuRow) => {
    const s = state.routine.slots.find((x) => x.id === row.slotId);
    return (s && slotLabel(s, lang)) || t(row.type);
  };
  const plannedLines = (row: MenuRow) => menu.meals.find((m) => m.id === row.slotId)?.lines ?? [];
  // A past day's − / + work on a draft of what was eaten, one per date and slot, held here until Ate this logs it.
  const [drafts, setDrafts] = useState<Record<string, PlanLine[]>>({});
  const past = view.mode === 'past';
  const draftOf = (row: MenuRow): PlanLine[] | undefined => (past ? drafts[draftKey(date, row.slotId)] : undefined);
  /** The lines a row shows and Ate this logs: a past day's draft once − / + touched it, else the planned ones. */
  const shownLines = (row: MenuRow): RowLine[] => {
    const draft = draftOf(row);
    return draft ? rowLines(draft, app.planFoods, lang) : row.lines;
  };
  const kcalOf = (lines: RowLine[]) => lines.reduce((a, l) => a + l.kcal, 0);

  function stepLine(row: MenuRow, l: RowLine, by: 1 | -1) {
    if (past) {
      // A past day: only the draft changes, never what that day planned.
      const key = draftKey(date, row.slotId);
      setDrafts((d) => ({ ...d, [key]: stepDraft(d[key] ?? plannedLines(row), l.idx, l.foodId, by) }));
    } else {
      // Today and later: that date's menu, the step worked out from the line as the store holds it, so quick taps all count,
      // and only while it is still the food tapped.
      app.editMenuLine(menu, row.slotId, l.idx, stepFoodLine(l.foodId, by));
    }
    fb.haptic('light');
  }

  // Ate as planned (today's slot) and Ate this (an open slot): logged from the plan, or from a past day's draft, with calories
  // from the database, never on a date after today (the store refuses, and says so with null: then nothing is said). Undo puts
  // the slot back exactly as it was.
  function atePlanned(row: MenuRow) {
    const before = slotBefore(state, date, row.slotId);
    const lines = draftOf(row);
    const id = app.addMealFromPlan(date, row.slotId, 'plan', lines);
    if (id === null) return;
    fb.haptic('success');
    fb.notify(fill(t('toast_meal_saved'), { kcal: kcalOf(shownLines(row)) }), {
      label: t('undo'),
      onPress: () => runUndo(app, undoSteps({ id, date, slotId: row.slotId, ...before })),
    });
  }

  function fillDay() {
    const steps = fillUndoSteps(view);
    app.fillDayFromPlan(date);
    fb.haptic('success');
    fb.notify(t('menu_day_filled'), { label: t('undo'), onPress: () => runUndo(app, steps) });
  }

  const head = (row: MenuRow, right?: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
      <Text style={[strong, { flex: 1 }]}>
        {title(row)}
        <Text style={{ color: C.textFaint, fontSize: F.small, fontWeight: '400' }}>{`  ${row.time}`}</Text>
      </Text>
      {right ? <Text style={[small, { fontWeight: '500' }]}>{right}</Text> : null}
    </View>
  );

  const stepperLine = (row: MenuRow, l: RowLine) => {
    const words = (
      <>
        <Text numberOfLines={2} style={strong}>
          {l.name}
        </Text>
        <Text numberOfLines={1} style={small}>{`${amountText(l.qty, l.measure)} · ${l.kcal} kcal`}</Text>
      </>
    );
    return (
      <View key={l.idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {/* On the plan screen a planned food's name opens other foods to put in its place; the box is a finger tall on every platform. */}
        {onLinePress && row.state === 'plan' ? (
          <Pressable
            onPress={() => onLinePress(row, l)}
            accessibilityRole="button"
            accessibilityLabel={fill(t('planweek_instead_a11y'), { food: l.name })}
            style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: S.touch, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}>
            <View style={{ flex: 1, minWidth: 0 }}>{words}</View>
            <Ionicons name="chevron-forward" size={F.small} color={C.textFaint} />
          </Pressable>
        ) : (
          <View style={{ flex: 1, minWidth: 0 }}>{words}</View>
        )}
        <QtyStepper value={l.qtyText} onMinus={() => stepLine(row, l, -1)} onPlus={() => stepLine(row, l, 1)} minusLabel={fill(t('qty_less'), { food: l.name })} plusLabel={fill(t('qty_more'), { food: l.name })} />
      </View>
    );
  };

  /** The row's buttons, as core/dayView.ts `rowOffers` gives them. */
  function offers(row: MenuRow) {
    const slot = title(row);
    const btn = (o: ReturnType<typeof rowOffers>[number]) => {
      if (o === 'planned') return <Btn key={o} small label={t('menu_ate_planned')} accessibilityLabel={fill(t('menu_ate_this_a11y'), { slot })} onPress={() => atePlanned(row)} style={{ flexGrow: 1 }} />;
      if (o === 'ate_this') return <Btn key={o} small label={t('menu_ate_this')} accessibilityLabel={fill(t('menu_ate_this_a11y'), { slot })} onPress={() => atePlanned(row)} style={{ flexGrow: 1 }} />;
      if (o === 'change')
        return (
          <Btn
            key={o}
            small
            tone="soft"
            label={t('menu_change')}
            accessibilityLabel={fill(t('menu_change_a11y'), { slot })}
            onPress={() => addSheet.open({ date, slotId: row.slotId, lines: plannedLines(row), mode: row.state === 'plan' ? 'plan' : 'log' })}
            // On the current row's tint a soft button has no edge of its own: the teal of words draws one (4.5:1 on that tint).
            style={row.state === 'current' ? { flexGrow: 1, borderColor: C.accentText } : { flexGrow: 1 }}
          />
        );
      if (o === 'add')
        return (
          <Btn
            key={o}
            small
            tone="soft"
            label={row.state === 'plan' ? t('menu_add_plan') : t('add_food')}
            accessibilityLabel={fill(t('menu_add_a11y'), { slot })}
            onPress={() => addSheet.open(row.state === 'plan' ? { date, slotId: row.slotId, mode: 'plan' } : { date, slotId: row.slotId })}
            style={{ flexGrow: 1 }}
          />
        );
      if (o === 'ate_other')
        return <Btn key={o} small tone="soft" label={t('menu_ate_other')} accessibilityLabel={fill(t('menu_ate_other_a11y'), { slot })} onPress={() => addSheet.open({ date, slotId: row.slotId })} style={{ flexGrow: 1 }} />;
      return (
        <Btn
          key={o}
          small
          tone="ghost"
          label={t('menu_skipped')}
          accessibilityLabel={fill(t('menu_skip_a11y'), { slot })}
          onPress={() => {
            // Quietly: skipping is an honest record, never praised.
            app.skipSlot(date, row.slotId);
            fb.haptic('light');
          }}
          style={{ flexGrow: 1 }}
        />
      );
    };
    const list = rowOffers({ ...row, lines: shownLines(row) });
    return list.length > 0 ? <Row style={{ gap: 6, flexWrap: 'wrap' }}>{list.map(btn)}</Row> : null;
  }

  function renderRow(row: MenuRow) {
    if (row.state === 'done') {
      const names = (m: Meal) => m.items.map((it) => itemName(it, app.planFoods, lang)).join(', ');
      return (
        <View style={{ paddingVertical: 4 }}>
          {row.meals.map((m, i) => (
            <Pressable
              key={m.id}
              onPress={() => onOpenMeal(m)}
              accessibilityRole="button"
              accessibilityLabel={fill(t('menu_done_a11y'), { slot: title(row), foods: names(m), kcal: m.kcal })}
              accessibilityHint={t('menu_open_meal')}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: S.touch, opacity: pressed ? 0.7 : 1 })}>
              {i === 0 ? <Ionicons name="checkmark-circle" size={20} color={C.accentText} /> : <View style={{ width: 20 }} />}
              <View style={{ flex: 1, minWidth: 0 }}>
                {i === 0 ? (
                  <Text numberOfLines={1} style={strong}>
                    {title(row)}
                  </Text>
                ) : null}
                {names(m) ? (
                  <Text numberOfLines={1} style={small}>
                    {names(m)}
                  </Text>
                ) : null}
              </View>
              <Text style={[small, { fontWeight: '500' }]}>{`${m.kcal} kcal`}</Text>
            </Pressable>
          ))}
          {row.autoIds.length > 0 ? (
            <Chip
              label={t('menu_from_plan')}
              a11y={fill(t('menu_confirm_a11y'), { slot: title(row) })}
              onPress={() => {
                row.autoIds.forEach((id) => app.confirmMeal(id));
                fb.haptic('light');
              }}
            />
          ) : null}
        </View>
      );
    }
    if (row.state === 'skipped') {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: S.touch }}>
          <Ionicons name="remove-circle-outline" size={20} color={C.textFaint} />
          <Text style={[small, { flex: 1, fontSize: F.body, lineHeight: lh(F.body) }]}>{`${title(row)} · ${t('slot_skipped')}`}</Text>
          <Pressable
            onPress={() => app.unskipSlot(date, row.slotId)}
            accessibilityRole="button"
            accessibilityLabel={fill(t('menu_unskip_a11y'), { slot: title(row) })}
            style={({ pressed }) => ({ minHeight: S.touch, minWidth: S.touch, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: pressed ? C.accentSoft : 'transparent' })}>
            <Text style={{ color: C.accentText, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{t('undo')}</Text>
          </Pressable>
        </View>
      );
    }
    if (row.state === 'current') {
      return (
        <View style={{ gap: 8, padding: 12, marginVertical: 4, borderRadius: S.radiusSm, borderWidth: 1, borderColor: C.accent, backgroundColor: C.accentDim }}>
          {head(row, row.lines.length > 0 ? `${row.plannedKcal} kcal` : undefined)}
          {row.lines.length > 0 ? (
            row.lines.map((l) => (
              <View key={l.idx}>
                <Text style={strong}>{l.name}</Text>
                <Text style={small}>{`${amountText(l.qty, l.measure)} · ${l.kcal} kcal`}</Text>
              </View>
            ))
          ) : (
            <Text style={small}>{t('menu_nothing_planned')}</Text>
          )}
          {offers(row)}
        </View>
      );
    }
    if (row.state === 'later') {
      return <View style={{ paddingVertical: 10 }}>{head(row, row.lines.length > 0 ? fill(t('menu_planned_kcal'), { kcal: row.plannedKcal }) : t('menu_nothing_planned'))}</View>;
    }
    // Open (a past day, or a slot today passed with nothing in it) and plan (a future day): each planned food with − / +,
    // so Ate this logs the amounts shown. Today and later they edit that date's menu; on a past day they change only the draft,
    // and a draft with every food taken out reads 0 kcal, not "nothing planned".
    const lines = shownLines(row);
    return (
      <View style={{ gap: 8, paddingVertical: 8 }}>
        {head(row, lines.length > 0 || draftOf(row) ? `${kcalOf(lines)} kcal` : t('menu_nothing_planned'))}
        {lines.map((l) => stepperLine(row, l))}
        {offers(row)}
      </View>
    );
  }

  const floor = KCAL_FLOOR[state.profile.sex];
  const note = view.mode === 'future' ? planNote({ kcal: view.plannedKcal, target: targets.kcal, floor, suggested: app.isSuggestedMenu(menu), hasPlan: view.required > 0 }) : null;
  // The plan screen gives Balance at the foot of the menu; elsewhere a day too low links to the plan screen, opened on that date.
  const openPlan = onBalance ? null : <Chip label={t('menu_open_plan')} onPress={() => router.push({ pathname: '/plan', params: { date } })} />;

  return (
    <Card>
      <SectionHeader title={t('menu_title')} meta={view.mode === 'future' ? fill(t('menu_planned_of'), { kcal: view.plannedKcal, goal: targets.kcal }) : undefined} />
      {isOffDay(state.settings.offDays, date) ? <Text style={small}>{t('menu_day_off')}</Text> : null}
      {view.missing > 0 ? (
        <Text style={{ color: C.amber, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{fill(t(view.missing === 1 ? 'menu_missing_one' : 'menu_missing'), { n: view.missing })}</Text>
      ) : null}
      {view.mode === 'past' && view.judged && view.required > 0 ? (
        <View style={{ gap: 6 }}>
          {/* A day of meals all skipped with nothing eaten is complete but quiet, never the teal of a full day. */}
          <Bar value={view.settled} max={view.required} color={{ full: C.accent, skipped: C.textFaint, missing: C.amber }[recordTone(view)]} />
          <Text style={small}>{fill(t(view.required === 1 ? 'menu_record_one' : 'menu_record'), { n: view.settled, of: view.required })}</Text>
        </View>
      ) : null}
      {note === 'suggested' || note === 'suggested_low' ? (
        <View style={{ gap: 4 }}>
          <Text style={small}>{fill(t('plan_suggested'), { kcal: view.plannedKcal })}</Text>
          {note === 'suggested_low' ? <Text style={{ color: C.amber, fontSize: F.small, lineHeight: lh(F.small) }}>{fill(t('plan_suggested_floor'), { floor })}</Text> : null}
          {note === 'suggested_low' ? openPlan : null}
        </View>
      ) : null}
      {note === 'low' ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: C.red, fontSize: F.small, lineHeight: lh(F.small) }}>{t('menu_plan_low')}</Text>
          {openPlan}
        </View>
      ) : null}
      {view.rows.map((row, i) => (
        <View key={row.slotId}>
          {i > 0 ? <Divider /> : null}
          {renderRow(row)}
        </View>
      ))}
      {/* Soft, as "Looks good, save week" is the plan screen's one primary action. */}
      {onBalance && view.mode === 'future' && view.required > 0 ? <Btn tone="soft" label={t('plan_balance')} onPress={onBalance} /> : null}
      {view.canFill ? <Btn tone="soft" label={t('menu_fill_day')} onPress={fillDay} /> : null}
      {offersDayConfirm(view, hour) ? (
        <Btn
          tone="soft"
          label={t('menu_day_right')}
          onPress={() => {
            app.confirmDay(date);
            fb.haptic('success');
            fb.notify(t('menu_day_confirmed'));
          }}
        />
      ) : null}
    </Card>
  );
}
