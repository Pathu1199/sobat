import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatMonthYear } from '../core/date';
import { monthMarks, monthSteps, shiftMonth } from '../core/progress';
import { stripDayLabel, stripSince } from '../core/weekStrip';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { useRecordOn } from '../store/useRecordOn';
import { Card } from '../ui/components';
import { STRIP_CHOSEN, STRIP_MARGIN } from '../ui/stripGeometry';
import { C, F, lh, S } from '../ui/theme';
import { IconButton } from './TopBarActions';
import { StripDot } from './WeekStrip';

/** Monday first, as the week strip; values are Date.getDay(). */
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
/** A day's touch box: a finger and more tall, as on a 320 point phone a seventh of the row is a little narrower than a finger. */
const DAY_HEIGHT = 48;

/**
 * The record as a month: under each day the same dot as on Today's week
 * strip (core/progress.ts `monthMarks`), lighter while meals the app filled
 * in are not confirmed, nothing before the person started. The arrows step a
 * month, from the month the person started up to this one; tapping a day
 * opens it on Today. The rows reach over the card's padding as the strip
 * does (ui/stripGeometry.ts), so a day is a finger wide on a 360 and a 375
 * point phone.
 */
export function RecordCalendar() {
  const app = useApp();
  const router = useRouter();
  const { state, today } = app;
  const recordOn = useRecordOn();
  const lang = state.profile.lang;
  const t = makeT(lang);
  const [month, setMonth] = useState(today.slice(0, 7));
  const since = stripSince(state.profile.onboardedOn, state.meals, today);
  const steps = monthSteps(month, today, since);
  const weeks = useMemo(() => monthMarks(month, recordOn, today, since), [month, recordOn, today, since]);

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconButton name="chevron-back" label={t('progress_prev_month')} onPress={() => setMonth((m) => shiftMonth(m, -1))} disabled={!steps.prev} />
        <Text accessibilityRole="header" style={{ flex: 1, textAlign: 'center', color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>
          {formatMonthYear(`${month}-01`, lang)}
        </Text>
        <IconButton name="chevron-forward" label={t('progress_next_month')} onPress={() => setMonth((m) => shiftMonth(m, 1))} disabled={!steps.next} />
      </View>
      <View style={{ marginHorizontal: STRIP_MARGIN, gap: 2 }}>
        <View style={{ flexDirection: 'row' }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {WEEKDAYS.map((wd) => (
            <Text key={wd} numberOfLines={1} style={{ flex: 1, textAlign: 'center', color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>
              {t(`wd_${wd}`)}
            </Text>
          ))}
        </View>
        {weeks.map((week, i) => (
          <View key={`${month}-${i}`} style={{ flexDirection: 'row' }}>
            {week.map((d, j) =>
              d ? (
                <Pressable
                  key={d.date}
                  onPress={() => router.navigate({ pathname: '/', params: { date: d.date } })}
                  accessibilityRole="button"
                  accessibilityLabel={stripDayLabel({ ...d, isToday: d.date === today }, lang)}
                  accessibilityHint={t('progress_day_hint')}
                  style={({ pressed }) => ({
                    flex: 1,
                    minWidth: 0,
                    minHeight: DAY_HEIGHT,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    borderRadius: S.radiusSm,
                    borderWidth: 1,
                    borderColor: d.date === today ? C[STRIP_CHOSEN] : 'transparent',
                    opacity: pressed ? 0.6 : 1,
                  })}>
                  <Text numberOfLines={1} style={{ color: d.date === today ? C.accentText : C.text, fontSize: F.small, lineHeight: lh(F.small, true), fontWeight: '500', fontVariant: ['tabular-nums'] }}>
                    {Number(d.date.slice(8))}
                  </Text>
                  <StripDot mark={d.mark} light={d.light} />
                </Pressable>
              ) : (
                <View key={`blank-${j}`} style={{ flex: 1 }} />
              ),
            )}
          </View>
        ))}
      </View>
    </Card>
  );
}
