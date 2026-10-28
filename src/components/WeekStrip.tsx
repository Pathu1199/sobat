import React, { useMemo } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import { formatDayMonth } from '../core/date';
import type { Lang } from '../core/types';
import { stripDayLabel, swipeStep, type StripDay } from '../core/weekStrip';
import { makeT } from '../i18n';
import { STRIP_CHOSEN, STRIP_CORE, STRIP_DAY_HEIGHT, STRIP_DOT_SIZE, STRIP_RING, stripDot } from '../ui/stripGeometry';
import { C, F, lh, S } from '../ui/theme';
import { IconButton } from './TopBarActions';

/**
 * Monday to Sunday of the week being looked at, a dot under each day from
 * the record. Tapping a day shows it; the arrows above, or a sideways swipe,
 * move a week. The arrows sit in their own row, so each day keeps a full
 * seventh of the width; on a phone too narrow for seven fingers side by side
 * (320 points) the days grow no wider than that seventh, so the row never
 * runs over, and each stays a finger and more tall (ui/stripGeometry.ts). A
 * day's words stay on one line at every text size: the weekday's short name,
 * the date, and the dot; what the dot means, and "today" for today, are in
 * the day's name for a screen reader (core/weekStrip.ts `stripDayLabel`).
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
  if (days.length === 0) return null;
  return (
    <View style={{ gap: 4 }} {...pan.panHandlers}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconButton name="chevron-back" label={t('strip_prev_week')} onPress={() => onWeek(-1)} />
        <Text numberOfLines={1} style={{ flex: 1, textAlign: 'center', color: C.textDim, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>
          {`${formatDayMonth(days[0].date, lang)} – ${formatDayMonth(days[days.length - 1].date, lang)}`}
        </Text>
        <IconButton name="chevron-forward" label={t('strip_next_week')} onPress={() => onWeek(1)} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        {days.map((d) => (
          <Pressable
            key={d.date}
            onPress={() => onSelect(d.date)}
            accessibilityRole="button"
            aria-selected={d.selected}
            accessibilityLabel={stripDayLabel(d, lang)}
            style={({ pressed }) => ({
              flex: 1,
              minWidth: 0,
              minHeight: STRIP_DAY_HEIGHT,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              borderRadius: S.radiusSm,
              borderWidth: 1,
              borderColor: d.selected ? C[STRIP_CHOSEN] : 'transparent',
              backgroundColor: d.selected ? C.accentDim : 'transparent',
              opacity: pressed ? 0.7 : 1,
            })}>
            {/* textFaint is too faint on the chosen day's tint, so the chosen day's weekday is textDim. */}
            <Text numberOfLines={1} style={{ color: d.isToday ? C.accentText : d.selected ? C.textDim : C.textFaint, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>
              {t(`wd_${d.weekday}`)}
            </Text>
            <Text numberOfLines={1} style={{ color: d.selected || d.isToday ? C.accentText : C.text, fontSize: F.body, lineHeight: lh(F.body, true), fontWeight: '500', fontVariant: ['tabular-nums'] }}>
              {d.day}
            </Text>
            <StripDot mark={d.mark} light={d.light} />
          </Pressable>
        ))}
      </View>
    </View>
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
