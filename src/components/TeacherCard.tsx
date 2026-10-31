import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { addDays, atMinute, mondayOf } from '../core/date';
import { dayScore, teacherWords } from '../core/teacher';
import type { ISODate } from '../core/types';
import { isOffDay } from '../core/week';
import { stripSince } from '../core/weekStrip';
import { makeT } from '../i18n';
import { useMinute } from '../services/useWorkSchedule';
import { useApp } from '../store/AppProvider';
import { Card } from '../ui/components';
import { C, F, lh, S } from '../ui/theme';

/** From this minute of the day the coach on Today is the evening teacher. */
export const EVENING_FROM = 18 * 60;

/**
 * The kind teacher's words for this evening (core/teacher.ts): today as it
 * stands at this minute, yesterday, and this week's earlier days, each a day
 * that counts (not an off day, not before the user started).
 */
export function useTeacherWords() {
  const app = useApp();
  const minute = useMinute();
  const { state, today, abhyas } = app;
  const { routine, meals, slotSkips, water, activities, settings, profile } = state;
  return useMemo(() => {
    const since = stripSince(profile, meals, today);
    const counts = (date: ISODate) => date >= since && !isOffDay(settings.offDays, date);
    const now = atMinute(today, minute);
    const score = (date: ISODate, nowMinutes: number) =>
      dayScore({ date, routine, meals, skips: slotSkips, nowMinutes, abhyas, now, water, activities: activities ?? [], waterGoalMl: settings.waterGoalMl, walkGoalMin: settings.walkGoalMin });
    const earlier: ReturnType<typeof score>[] = [];
    for (let d = mondayOf(today); d < today; d = addDays(d, 1)) if (counts(d)) earlier.push(score(d, 1440));
    const yesterday = addDays(today, -1);
    return teacherWords({ today: score(today, minute), yesterday: counts(yesterday) ? score(yesterday, 1440) : null, earlier }, makeT(profile.lang));
  }, [profile, meals, today, minute, routine, slotSkips, abhyas, water, activities, settings.offDays, settings.waterGoalMl, settings.walkGoalMin]);
}

/**
 * The coach on Today in the evening: "Your coach · this evening", what went
 * well, the best day of the week in the reward ink when today is one, and one
 * small tip for tomorrow.
 */
export function TeacherCard() {
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  const w = useTeacherWords();
  return (
    <Card still>
      <View accessible accessibilityLabel={[t('teach_title'), w.lead, w.best, w.tip].filter(Boolean).join('. ')} style={{ gap: 8 }}>
        <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>{t('teach_title')}</Text>
        <Text style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body) }}>{w.lead}</Text>
        {w.best ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: C.goldSoft, borderRadius: S.radiusXs, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Ionicons name="star" size={14} color={C.goldInk} />
            <Text style={{ flexShrink: 1, color: C.goldInk, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{w.best}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Ionicons name="arrow-forward" size={16} color={C.textDim} style={{ marginTop: 2 }} />
          <Text style={{ flex: 1, color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>{w.tip}</Text>
        </View>
      </View>
    </Card>
  );
}
