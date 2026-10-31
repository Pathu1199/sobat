import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { abhyasCard, type AbhyasRow } from '../core/abhyasView';
import type { AbhyasItem, ISODate } from '../core/types';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useNow } from '../services/useClock';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Divider } from '../ui/components';
import { IconButton } from '../ui/IconButton';
import { withUndoAt } from '../ui/listUndo';
import { C, F, lh, MICRO, S } from '../ui/theme';
import { AbhyasItemSheet } from './AbhyasItemSheet';
import { useBreath } from './tiles/motion';
import { UndoLine, useUndoable } from './tiles/UndoLine';

/**
 * The Abhyas card on Today: the user's own list for the viewed date,
 * "Abhyas · 2 of 4 done" over one row per item in their order (core/abhyasView.ts
 * decides what each row shows and offers). A row is a tick box, the name, and
 * for an item with a minutes target "12 of 30 min" and Start or Stop at the
 * right; the running item's row has a small moving dot, still when the phone
 * asks for less motion, and a done row is greyed with its tick filled. The +
 * adds a one-off for the viewed date and a tap on a name edits the item, both
 * in the item sheet; a removal from there leaves "Removed … · Undo" in the
 * row's place for five seconds. A day before ticks but starts no timer; a day
 * still to come shows what is planned, with nothing to tick yet.
 */
export function AbhyasCard({ date }: { date: ISODate }) {
  const app = useApp();
  const fb = useFeedback();
  const now = useNow();
  const t = makeT(app.state.profile.lang);
  const { rows, done, total } = abhyasCard(app.abhyas, date, app.today, now);
  // The sheet opens on fresh fields each time: a new key per opening, kept while it slides away.
  const [sheet, setSheet] = useState<{ item: AbhyasItem | null; n: number; open: boolean }>({ item: null, n: 0, open: false });
  const removed = useUndoable<{ item: AbhyasItem; index: number }>((r) => fill(t('abh_removed'), { name: r.item.name }), t('undo'));

  const openSheet = (item: AbhyasItem | null) => setSheet((s) => ({ item, n: s.n + 1, open: true }));
  const remove = (item: AbhyasItem) => {
    const index = rows.findIndex((r) => r.item.id === item.id);
    app.archiveAbhyasItem(item.id);
    removed.show({ item, index: index < 0 ? rows.length : index });
    fb.haptic('light');
  };

  // The Undo line goes where the removed row was; on a day before the removal the item stays on that day, so it goes just under it.
  const held = removed.held;
  const still = held ? rows.findIndex((r) => r.item.id === held.item.id) : -1;
  const list = withUndoAt(rows, held ? (still >= 0 ? still + 1 : held.index) : null);
  const empty = t(date === app.today ? 'abh_add_today' : 'abh_add_day');

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: total > 0 ? S.touch : undefined, marginVertical: total > 0 ? -8 : 0 }}>
        <Text accessibilityRole="header" style={[MICRO, { flex: 1, color: C.textDim }]}>
          {total > 0 ? `${t('abhyas')} · ${fill(t('abh_done_of'), { n: done, m: total })}` : t('abhyas')}
        </Text>
        {/* With nothing on the list, the line under the header is the + itself, so a screen reader meets one add button, not two. */}
        {total > 0 ? (
          <View style={{ marginRight: -11 }}>
            <IconButton name="add" label={t('abh_add')} color={C.accentText} onPress={() => openSheet(null)} />
          </View>
        ) : null}
      </View>
      {list.map((r, n) => {
        const line = n > 0 ? <Divider /> : null;
        if (r.kind === 'undo') {
          return held ? (
            <View key={`undo:${held.item.id}`} style={{ gap: 12 }}>
              {line}
              <UndoLine
                text={removed.text}
                undoLabel={removed.undoLabel}
                onUndo={() => {
                  app.restoreAbhyasItem(held.item.id);
                  fb.haptic('light');
                  removed.clear();
                }}
              />
            </View>
          ) : null;
        }
        return (
          <View key={r.item.item.id} style={{ gap: 12 }}>
            {line}
            <ItemRow
              row={r.item}
              t={t}
              onTick={() => {
                if (r.item.tick.checked) app.untickAbhyas(r.item.item.id, date);
                else {
                  app.tickAbhyas(r.item.item.id, date);
                  fb.haptic('success');
                }
              }}
              onEdit={() => openSheet(r.item.item)}
              onTimer={() => {
                if (r.item.timer === 'stop') app.stopAbhyas();
                else app.startAbhyas(r.item.item.id);
                fb.haptic('light');
              }}
            />
          </View>
        );
      })}
      {total === 0 ? (
        <Pressable
          onPress={() => openSheet(null)}
          accessibilityRole="button"
          accessibilityLabel={empty}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: S.touch, opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="add-circle-outline" size={22} color={C.accentText} />
          <Text style={{ flex: 1, color: C.textDim, fontSize: F.body, lineHeight: lh(F.body) }}>{empty}</Text>
        </Pressable>
      ) : null}
      <AbhyasItemSheet
        key={sheet.n}
        open={sheet.open}
        item={sheet.item}
        date={date}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
        onRemove={remove}
      />
    </Card>
  );
}

/**
 * One item: the tick box, the name (a tap edits it) with "12 of 30 min" under
 * it, and Start or Stop at the right. Every control is a finger wide and
 * tall, and says its state to a screen reader on the phone and the web alike.
 */
function ItemRow({ row, t, onTick, onEdit, onTimer }: { row: AbhyasRow; t: (key: string) => string; onTick: () => void; onEdit: () => void; onTimer: () => void }) {
  const { item, tick, minutes, running, timer } = row;
  const minutesText = minutes ? fill(t('abh_min_of'), { n: minutes.n, m: minutes.of }) : null;
  const off = tick.off ? t(tick.off === 'future' ? 'abh_tick_later' : 'abh_tick_timer') : null;
  const ink = row.done ? C.textFaint : C.text;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: S.touch }}>
      <Pressable
        onPress={tick.off ? undefined : onTick}
        disabled={!!tick.off}
        accessibilityRole="checkbox"
        aria-checked={tick.checked}
        aria-disabled={!!tick.off}
        accessibilityLabel={off ? `${item.name}, ${off}` : item.name}
        style={({ pressed }) => ({ width: S.touch, height: S.touch, marginLeft: -10, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 8,
            borderWidth: 1.5,
            borderColor: tick.checked ? C.accent : C.textFaint,
            backgroundColor: tick.checked ? C.accent : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: tick.off === 'future' ? 0.45 : 1,
          }}>
          {tick.checked ? <Ionicons name="checkmark" size={16} color={C.onAccent} /> : null}
        </View>
      </Pressable>
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={[fill(t('abh_edit_item'), { name: item.name }), minutesText].filter(Boolean).join(', ')}
        style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: S.touch, justifyContent: 'center', paddingVertical: 4, opacity: pressed ? 0.7 : 1 })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={16} color={row.done ? C.textFaint : C.textDim} />
          <Text numberOfLines={2} style={{ flexShrink: 1, color: ink, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>
            {item.name}
          </Text>
          {running ? <RunningDot /> : null}
        </View>
        {minutesText ? <Text style={{ color: row.done ? C.textFaint : C.textDim, fontSize: F.small, lineHeight: lh(F.small), marginLeft: 24 }}>{minutesText}</Text> : null}
      </Pressable>
      {timer ? (
        <Btn
          small
          tone={timer === 'start' ? 'primary' : 'ghost'}
          label={t(timer)}
          accessibilityLabel={fill(t(timer === 'start' ? 'abh_start_item' : 'abh_stop_item'), { name: item.name })}
          onPress={onTimer}
          style={{ minWidth: 72 }}
        />
      ) : null}
    </View>
  );
}

/** How long the running dot takes to fade and come back, each way. */
const DOT_HALF_MS = 900;

/** The small dot beside a running item: it fades and comes back while the timer runs, and stays still and full when the phone asks for less motion (`useBreath`). */
function RunningDot() {
  const breath = useBreath(true, DOT_HALF_MS);
  const fade = useAnimatedStyle(() => ({ opacity: 1 - 0.65 * breath.get() }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent }, fade]} />;
}
