import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { weekdayOf } from '../core/routine';
import type { ISODate, Lang } from '../core/types';
import { makeT } from '../i18n';
import { C, F, MICRO } from './theme';

const CELL = 48;

/** A row of days to pick from. Today sits at the right; a dot marks days with something logged. */
export function DateStrip({
  dates,
  selected,
  onSelect,
  marked,
  lang,
  today,
}: {
  dates: ISODate[];
  selected: ISODate;
  onSelect: (d: ISODate) => void;
  marked: Set<ISODate>;
  lang: Lang;
  today: ISODate;
}) {
  const t = makeT(lang);
  const scroller = useRef<ScrollView>(null);

  // Open with the selected day in the middle.
  useEffect(() => {
    const idx = dates.indexOf(selected);
    if (idx >= 0) scroller.current?.scrollTo({ x: Math.max(0, (idx - 3) * (CELL + 6)), animated: false });
  }, [dates, selected]);

  return (
    <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
      {dates.map((d) => {
        const on = d === selected;
        const isToday = d === today;
        // Tomorrow has not happened yet; it is shown for bearings, not for logging.
        const future = d > today;
        return (
          <Pressable
            key={d}
            onPress={future ? undefined : () => onSelect(d)}
            disabled={future}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled: future }}
            style={({ pressed }) => ({
              width: CELL,
              paddingVertical: 8,
              borderRadius: 12,
              alignItems: 'center',
              gap: 3,
              backgroundColor: on ? C.accent : C.card,
              borderWidth: 1,
              borderColor: on ? C.accent : isToday ? C.borderStrong : C.border,
              opacity: future ? 0.35 : pressed ? 0.7 : 1,
            })}>
            <Text style={[MICRO, { color: on ? C.white : C.textFaint }]}>{t(`wd_${weekdayOf(d)}`)}</Text>
            <Text style={{ color: on ? C.white : C.text, fontSize: F.h3, fontWeight: '600' }}>{Number(d.slice(8, 10))}</Text>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: marked.has(d) ? (on ? C.white : C.cyan) : 'transparent' }} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
