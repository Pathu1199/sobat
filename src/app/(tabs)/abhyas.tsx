import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, Text, View } from 'react-native';
import { AbhyasItemRow } from '../../components/AbhyasItemRow';
import { AbhyasItemSheet } from '../../components/AbhyasItemSheet';
import { UndoLine, useUndoable } from '../../components/tiles/UndoLine';
import { itemsOn, reorder, streak, type DayStatus } from '../../core/abhyas';
import { abhyasCard, abhyasRow, comingUp, movedPlace, recentDays, repeating, weekdayRuns } from '../../core/abhyasView';
import { formatDayLabel } from '../../core/date';
import type { AbhyasItem } from '../../core/types';
import { fill, makeT } from '../../i18n';
import { useFeedback } from '../../services/feedback';
import { useNow } from '../../services/useClock';
import { useApp } from '../../store/AppProvider';
import { sayOnPhone } from '../../ui/announce';
import { Card, Divider, SectionHeader } from '../../ui/components';
import { IconButton } from '../../ui/IconButton';
import { withUndoAt } from '../../ui/listUndo';
import { C, F, lh, S } from '../../ui/theme';
import { Page } from '../../ui/TopBar';

type IconName = keyof typeof Ionicons.glyphMap;
/** The sections an item can be edited, and so removed, from: the Undo line goes back to the one it left. */
type From = 'today' | 'repeat' | 'coming';

/**
 * Abhyas: the user's own list in full. Today, with the same rows as the card
 * on Today (tick, timer, a tap on the name edits); Repeating, every repeating
 * item with its days, target and reminder times, moved up or down with
 * buttons (a screen reader, a keyboard and a mouse use them alike, as on
 * Customize); Coming up, the one-offs for later days; and the last 14 days,
 * "3 of 4 done · 85 min" each, under the streak. The + adds a repeating item,
 * and a removal leaves "Removed … · Undo" where the item was for five
 * seconds. On the bar when chosen in Customize, and always a row on Me.
 * Only the parts a running timer moves read the clock, each in its own small
 * component (Today's count, each of Today's rows, the last 14 days and the
 * streak), as Progress's Abhyas row does, so the tab is not drawn again
 * every minute.
 */
export default function AbhyasTab() {
  const app = useApp();
  const fb = useFeedback();
  const { today } = app;
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const todayItems = itemsOn(app.abhyas.items, today);
  const total = todayItems.length;
  const reps = repeating(app.abhyas.items);
  const coming = comingUp(app.abhyas.items, today);

  // The sheet opens on fresh fields each time: a new key per opening, kept while it slides away.
  const [sheet, setSheet] = useState<{ item: AbhyasItem | null; kind: AbhyasItem['kind']; from: From; n: number; open: boolean }>({ item: null, kind: 'repeat', from: 'repeat', n: 0, open: false });
  const openSheet = (item: AbhyasItem | null, kind: AbhyasItem['kind'], from: From) => setSheet((s) => ({ item, kind, from, n: s.n + 1, open: true }));
  const removed = useUndoable<{ item: AbhyasItem; from: From; index: number }>((r) => fill(t('abh_removed'), { name: r.item.name }), t('undo'));
  const held = removed.held;
  const lists: Record<From, AbhyasItem[]> = { today: todayItems, repeat: reps, coming };

  const remove = (item: AbhyasItem) => {
    const list = lists[sheet.from];
    const index = list.findIndex((i) => i.id === item.id);
    app.archiveAbhyasItem(item.id);
    removed.show({ item, from: sheet.from, index: index < 0 ? list.length : index });
    fb.haptic('light');
  };

  // Each repeating item's up and down buttons, so the focus can go back to the one pressed after the list moved under it.
  const moveButtons = useRef(new Map<string, View>());
  const [moved, setMoved] = useState<{ id: string; focus: 'up' | 'down'; line: string } | null>(null);
  // On the phone the new place is said after the focus is back, here: TalkBack drops a line said before the focus moves.
  useEffect(() => {
    if (!moved) return;
    const button = moveButtons.current.get(`${moved.id}:${moved.focus}`);
    if (Platform.OS === 'web') {
      (button as unknown as { focus?: () => void } | undefined)?.focus?.();
      return;
    }
    if (button) AccessibilityInfo.sendAccessibilityEvent(button, 'focus');
    sayOnPhone(moved.line);
  }, [moved]);

  const move = (item: AbhyasItem, by: -1 | 1) => {
    const place = movedPlace(reorder(app.abhyas.items, item.id, by), item.id, by);
    app.reorderAbhyas(item.id, by);
    fb.haptic('light');
    if (!place) return;
    const line = fill(t('cust_moved'), { card: item.name, n: place.n, m: place.m });
    setMoved({ id: item.id, focus: place.focus, line });
    if (Platform.OS === 'web') fb.announce(line);
  };
  const keepButton = (id: string, dir: 'up' | 'down') => (button: View | null) => {
    if (button) moveButtons.current.set(`${id}:${dir}`, button);
    else moveButtons.current.delete(`${id}:${dir}`);
  };

  /** A section's rows, divided, with the Undo line in the place of the item just removed from it. */
  const withUndo = <T,>(items: T[], from: From, keyOf: (x: T) => string, draw: (x: T) => React.ReactNode) =>
    withUndoAt(items, held?.from === from ? held.index : null).map((r, n) => (
      <View key={r.kind === 'undo' ? `undo:${held?.item.id}` : keyOf(r.item)} style={{ gap: 12 }}>
        {n > 0 ? <Divider /> : null}
        {r.kind === 'undo' ? (
          held ? (
            <UndoLine
              text={removed.text}
              undoLabel={removed.undoLabel}
              onUndo={() => {
                app.restoreAbhyasItem(held.item.id);
                fb.haptic('light');
                removed.clear();
              }}
            />
          ) : null
        ) : (
          draw(r.item)
        )}
      </View>
    ));

  /** "Mon–Fri · 30 min · 07:00, 20:00": the days (or the date), the target and the reminder times, as far as the item has them. */
  const facts = (item: AbhyasItem) => {
    const runs = weekdayRuns(item.days);
    const when =
      item.kind === 'once' && item.date
        ? formatDayLabel(item.date, lang)
        : runs === 'every'
          ? t('abh_every_day')
          : runs.map(([a, b]) => (a === b ? t(`wd_${a}`) : `${t(`wd_${a}`)}–${t(`wd_${b}`)}`)).join(', ');
    const target = item.targetMin ? fill(t('abh_min'), { n: item.targetMin }) : null;
    const times = item.times.length > 0 ? item.times.join(', ') : null;
    return {
      line: [when, target, times].filter(Boolean).join(' · '),
      label: [fill(t('abh_edit_item'), { name: item.name }), when, target, times ? `${t('abh_remind_at')} ${times}` : null].filter(Boolean).join(', '),
    };
  };

  return (
    <Page
      title={t('abhyas')}
      right={
        <View style={{ marginRight: -11 }}>
          <IconButton name="add" label={t('abh_add')} color={C.accentText} onPress={() => openSheet(null, 'repeat', 'repeat')} />
        </View>
      }>
      <View style={{ gap: 10 }}>
        <TodayHeader />
        <Card>
          {withUndo(
            todayItems,
            'today',
            (i) => i.id,
            (item) => <TodayRow item={item} onEdit={() => openSheet(item, 'once', 'today')} />,
          )}
          {total === 0 ? (
            <View style={{ gap: 12 }}>
              {held?.from === 'today' ? <Divider /> : null}
              <Pressable
                onPress={() => openSheet(null, 'once', 'today')}
                accessibilityRole="button"
                accessibilityLabel={t('abh_add_today')}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: S.touch, opacity: pressed ? 0.7 : 1 })}>
                <Ionicons name="add-circle-outline" size={22} color={C.accentText} />
                <Text style={{ flex: 1, color: C.textDim, fontSize: F.body, lineHeight: lh(F.body) }}>{t('abh_add_today')}</Text>
              </Pressable>
            </View>
          ) : null}
        </Card>
      </View>

      {reps.length > 0 || held?.from === 'repeat' ? (
        <View style={{ gap: 10 }}>
          <SectionHeader title={t('abh_repeating')} />
          <Card>
            {withUndo(
              reps,
              'repeat',
              (i) => i.id,
              (item) => {
                const i = reps.indexOf(item);
                return (
                  <ItemLine item={item} {...facts(item)} onPress={() => openSheet(item, 'repeat', 'repeat')}>
                    {/* Moving needs two; a lone item has nowhere to go. */}
                    {reps.length > 1 ? (
                      <>
                        <IconButton ref={keepButton(item.id, 'up')} name="chevron-up" label={fill(t('cust_move_up'), { card: item.name })} onPress={() => move(item, -1)} disabled={i === 0} />
                        <IconButton
                          ref={keepButton(item.id, 'down')}
                          name="chevron-down"
                          label={fill(t('cust_move_down'), { card: item.name })}
                          onPress={() => move(item, 1)}
                          disabled={i === reps.length - 1}
                        />
                      </>
                    ) : null}
                  </ItemLine>
                );
              },
            )}
          </Card>
        </View>
      ) : null}

      {coming.length > 0 || held?.from === 'coming' ? (
        <View style={{ gap: 10 }}>
          <SectionHeader title={t('abh_coming_up')} />
          <Card>
            {withUndo(
              coming,
              'coming',
              (i) => i.id,
              (item) => <ItemLine item={item} {...facts(item)} onPress={() => openSheet(item, 'once', 'coming')} />,
            )}
          </Card>
        </View>
      ) : null}

      <LastDays />

      <AbhyasItemSheet
        key={sheet.n}
        open={sheet.open}
        item={sheet.item}
        date={today}
        newKind={sheet.kind}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
        onRemove={remove}
      />
    </Page>
  );
}

/** Today's header with "2 of 4 done": a running timer that reaches its target moves the count. */
function TodayHeader() {
  const app = useApp();
  const now = useNow();
  const t = makeT(app.state.profile.lang);
  const { done, total } = abhyasCard(app.abhyas, app.today, app.today, now);
  return <SectionHeader title={t('tab_today')} meta={total > 0 ? fill(t('abh_done_of'), { n: done, m: total }) : undefined} />;
}

/** One of Today's rows, as on the card on Today: a running timer's minutes move here, and nowhere else on the tab. */
function TodayRow({ item, onEdit }: { item: AbhyasItem; onEdit: () => void }) {
  const app = useApp();
  const now = useNow();
  return <AbhyasItemRow row={abhyasRow(app.abhyas, item, app.today, app.today, now)} date={app.today} onEdit={onEdit} />;
}

/** The last 14 days under the streak, "3 of 4 done · 85 min" each; nothing before the first item. */
function LastDays() {
  const app = useApp();
  const now = useNow();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const days = recentDays(app.abhyas, app.today, now);
  const run = streak(app.abhyas, app.today, now);
  if (days.length === 0) return null;

  const dayText = (d: DayStatus) => {
    const parts = [d.total > 0 ? fill(t('abh_done_of'), { n: d.done, m: d.total }) : null, d.minutes > 0 ? fill(t('abh_min'), { n: d.minutes }) : null].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : t('abh_none');
  };

  return (
    <View style={{ gap: 10 }}>
      <SectionHeader title={t('abh_last_14')} />
      <Card>
        {run > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="flame-outline" size={18} color={C.accentText} />
            <Text style={{ flex: 1, color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{run === 1 ? t('abh_in_row_one') : fill(t('abh_in_row'), { n: run })}</Text>
          </View>
        ) : null}
        <View>
          {days.map((d) => {
            const date = formatDayLabel(d.date, lang);
            const text = dayText(d);
            const full = d.total > 0 && d.done === d.total;
            return (
              <View key={d.date} accessible accessibilityLabel={`${date}, ${text}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 }}>
                <View style={{ width: 18, alignItems: 'center' }}>{full ? <Ionicons name="checkmark-circle" size={16} color={C.accentText} /> : null}</View>
                <Text numberOfLines={1} style={{ flex: 1, color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>
                  {date}
                </Text>
                <Text style={{ color: d.total > 0 ? C.text : C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>{text}</Text>
              </View>
            );
          })}
        </View>
      </Card>
    </View>
  );
}

/**
 * An item in Repeating or Coming up: its icon, its name, and its days (or
 * date), target and times on one quiet line; a tap edits it. `children` are
 * buttons at the right, outside the row's own button.
 */
function ItemLine({ item, line, label, onPress, children }: { item: AbhyasItem; line: string; label: string; onPress: () => void; children?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: S.touch, paddingVertical: 4, opacity: pressed ? 0.7 : 1 })}>
        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={item.icon as IconName} size={18} color={C.textDim} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text numberOfLines={2} style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>
            {item.name}
          </Text>
          <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>{line}</Text>
        </View>
      </Pressable>
      {children}
    </View>
  );
}
