import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, Text, View } from 'react-native';
import type { Lang } from '../core/types';
import { stripDayLabel, swipeStep, WHEEL_IDLE, wheelStep, type StripDay, type WheelRun } from '../core/weekStrip';
import { makeT } from '../i18n';
import { chosenProps } from '../ui/chosen';
import { STRIP_CHOSEN, STRIP_CORE, STRIP_DAY_HEIGHT, STRIP_DOT_GAP, STRIP_DOT_SIZE, STRIP_PILL_PAD, STRIP_RING, STRIP_TODAY, stripDot } from '../ui/stripGeometry';
import { C, F, lh, S } from '../ui/theme';

/**
 * Monday to Sunday of the week being looked at, on the page, a dot under each
 * day from the record. Tapping a day shows it; a sideways swipe moves a week:
 * a finger, a mouse drag, or a trackpad's two-finger swipe on the web. Today
 * is a soft teal pill, and a chosen day other than today has an outline (the
 * strip always holds the chosen day, so with no outline the pill is the
 * chosen one). For a screen reader or a keyboard, Previous week and Next week
 * wait out of sight at either end until they have the focus. Each day keeps a
 * full seventh of the width; on a phone too narrow for seven fingers side by
 * side (320 points) the days grow no wider than that seventh, so the row never
 * runs over, and each stays a finger and more tall (ui/stripGeometry.ts). A
 * day's words stay on one line at every text size: the weekday's short name,
 * the date, and the dot; what the dot means, and "today" for today, are in the
 * day's name for a screen reader (core/weekStrip.ts `stripDayLabel`).
 */
export function WeekStrip({ days, lang, onSelect, onWeek }: { days: StripDay[]; lang: Lang; onSelect: (date: string) => void; onWeek: (by: -1 | 1) => void }) {
  const t = makeT(lang);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > 2 * Math.abs(g.dy),
        onPanResponderRelease: (_e, g) => {
          const by = swipeStep(g.dx, g.dy);
          if (by !== 0) onWeek(by);
        },
      }),
    [onWeek],
  );
  // On the web a trackpad's two-finger swipe comes as wheel events, not a drag. The run outlives a week's move, so the glide
  // after a swipe never moves a second week.
  const strip = useRef<View>(null);
  const run = useRef<WheelRun>(WHEEL_IDLE);
  const shown = days.length > 0;
  useEffect(() => {
    const node = Platform.OS === 'web' ? (strip.current as unknown as HTMLElement | null) : null;
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      // A wheel that counts in lines (Firefox) is about 16 points a line.
      const unit = e.deltaMode === 1 ? 16 : 1;
      const dx = e.deltaX * unit;
      const dy = e.deltaY * unit;
      if (Math.abs(dx) <= Math.abs(dy)) return;
      // Sideways is the strip's, not the browser's: no page scrolled sideways, no swipe back a page.
      e.preventDefault();
      const next = wheelStep(run.current, dx, dy, e.timeStamp);
      run.current = next.run;
      if (next.step !== 0) onWeek(next.step);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [onWeek, shown]);
  if (!shown) return null;
  return (
    <View ref={strip} style={{ flexDirection: 'row' }} {...pan.panHandlers}>
      <WeekJump by={-1} label={t('strip_prev_week')} onWeek={onWeek} />
      {days.map((d) => {
        const words = d.isToday ? C[STRIP_TODAY.words] : null;
        return (
          <Pressable
            key={d.date}
            onPress={() => onSelect(d.date)}
            accessibilityRole="button"
            {...chosenProps(d.selected)}
            accessibilityLabel={stripDayLabel(d, lang)}
            style={({ pressed }) => ({
              flex: 1,
              minWidth: 0,
              minHeight: STRIP_DAY_HEIGHT,
              alignItems: 'center',
              justifyContent: 'center',
              gap: STRIP_DOT_GAP,
              opacity: pressed ? 0.7 : 1,
            })}>
            <View
              style={{
                alignSelf: 'stretch',
                marginHorizontal: 3,
                alignItems: 'center',
                paddingVertical: STRIP_PILL_PAD,
                borderRadius: 999,
                borderWidth: S.hairline,
                borderColor: d.selected && !d.isToday ? C[STRIP_CHOSEN] : 'transparent',
                backgroundColor: d.isToday ? C[STRIP_TODAY.fill] : 'transparent',
              }}>
              {/* Not selectable, so a mouse drag across the strip moves a week instead of selecting its words. */}
              <Text selectable={false} numberOfLines={1} style={{ color: words ?? C.textFaint, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '400' }}>
                {t(`wd_${d.weekday}`)}
              </Text>
              <Text selectable={false} numberOfLines={1} style={{ color: words ?? C.text, fontSize: F.body, lineHeight: lh(F.body, true), fontWeight: '500', fontVariant: ['tabular-nums'] }}>
                {d.day}
              </Text>
            </View>
            <StripDot mark={d.mark} light={d.light} />
          </Pressable>
        );
      })}
      <WeekJump by={1} label={t('strip_next_week')} onWeek={onWeek} />
    </View>
  );
}

/**
 * Previous week or Next week where a swipe is not to hand, for a screen reader
 * and a keyboard: a point in size, out of sight, until it has the focus, when
 * it shows as a round button over the strip's end. A screen reader finds it
 * before Monday and after Sunday either way.
 */
function WeekJump({ by, label, onWeek }: { by: -1 | 1; label: string; onWeek: (by: -1 | 1) => void }) {
  const [focused, setFocused] = useState(false);
  const side = by < 0 ? { left: 0 } : { right: 0 };
  return (
    <Pressable
      onPress={() => onWeek(by)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        { position: 'absolute', zIndex: 1, ...side },
        focused
          ? { top: (STRIP_DAY_HEIGHT - S.touch) / 2, width: S.touch, height: S.touch, borderRadius: S.touch / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card, ...S.shadow }
          : { top: 0, width: 1, height: 1, overflow: 'hidden' },
      ]}>
      {focused ? <Ionicons name={by < 0 ? 'chevron-back' : 'chevron-forward'} size={22} color={C.textDim} /> : null}
    </Pressable>
  );
}

/**
 * Teal for full, amber for missing, a ring for planned and today, grey for a day of meals all skipped; nothing for an off day, a
 * past day that planned nothing and ate nothing, or a day before the start. A day still holding meals filled in from the plan is a ring with a dot in its middle, in the same
 * colour: told apart by its shape, so it keeps 3:1 where the strip is drawn (ui/stripGeometry.ts `stripDot`). Progress's calendar
 * draws the same dot.
 */
export function StripDot({ mark, light }: { mark: StripDay['mark']; light: boolean }) {
  const dot = stripDot(mark, light);
  const size = { width: STRIP_DOT_SIZE, height: STRIP_DOT_SIZE };
  if (dot.kind === 'none') return <View style={size} />;
  const color = C[dot.color];
  return (
    <View
      style={{
        ...size,
        borderRadius: STRIP_DOT_SIZE / 2,
        backgroundColor: dot.kind === 'dot' ? color : 'transparent',
        borderWidth: dot.kind === 'dot' ? 0 : STRIP_RING,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {dot.kind === 'ringDot' ? <View style={{ width: STRIP_CORE, height: STRIP_CORE, borderRadius: STRIP_CORE / 2, backgroundColor: color }} /> : null}
    </View>
  );
}
