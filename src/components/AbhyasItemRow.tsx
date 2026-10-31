import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { AbhyasRow } from '../core/abhyasView';
import type { ISODate } from '../core/types';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Btn } from '../ui/components';
import { C, F, lh, S } from '../ui/theme';
import { useBreath } from './tiles/motion';

/**
 * One Abhyas item on a date, the same on the card on Today and on the Abhyas
 * tab: the tick box, the name (a tap edits it) with "12 of 30 min" under it,
 * and Start or Stop at the right (core/abhyasView.ts `abhyasCard` decides
 * which). The tick and the timer change the store here; the edit is the
 * caller's, which owns the item sheet. Every control is a finger wide and
 * tall, and says its state to a screen reader on the phone and the web alike.
 */
export function AbhyasItemRow({ row, date, onEdit }: { row: AbhyasRow; date: ISODate; onEdit: () => void }) {
  const app = useApp();
  const fb = useFeedback();
  const t = makeT(app.state.profile.lang);
  const { item, tick, minutes, running, timer } = row;
  const minutesText = minutes ? fill(t('abh_min_of'), { n: minutes.n, m: minutes.of }) : null;
  const off = tick.off ? t(tick.off === 'future' ? 'abh_tick_later' : 'abh_tick_timer') : null;
  const ink = row.done ? C.textFaint : C.text;

  const onTick = () => {
    if (tick.checked) app.untickAbhyas(item.id, date);
    else {
      app.tickAbhyas(item.id, date);
      fb.haptic('success');
    }
  };
  const onTimer = () => {
    if (timer === 'stop') app.stopAbhyas();
    else app.startAbhyas(item.id);
    fb.haptic('light');
  };

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
