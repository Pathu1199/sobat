import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { addDays, atMinute } from '../core/date';
import { dayScore, teacherWords, weekScores } from '../core/teacher';
import type { ISODate } from '../core/types';
import { isOffDay } from '../core/week';
import { stripSince } from '../core/weekStrip';
import { makeT } from '../i18n';
import { useMinute } from '../services/useWorkSchedule';
import { useApp } from '../store/AppProvider';
import { Card } from '../ui/components';
import { C, F, lh, S } from '../ui/theme';
import { spokenLine } from '../ui/toastWords';

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
  // The days before today are read once, not every minute: they are over, so only the logs can change them.
  const past = useMemo(() => {
    const since = stripSince(profile, meals, today);
    const over = atMinute(today, 0);
    const score = (date: ISODate, nowMinutes: number, now: Date) =>
      dayScore({ date, routine, meals, skips: slotSkips, nowMinutes, abhyas, now, water, activities: activities ?? [], waterGoalMl: settings.waterGoalMl, walkGoalMin: settings.walkGoalMin });
    const yesterday = addDays(today, -1);
    return {
      score,
      earlier: weekScores({ today, since, offDays: settings.offDays, score: (date) => score(date, 1440, over) }),
      yesterday: yesterday >= since && !isOffDay(settings.offDays, yesterday) ? score(yesterday, 1440, over) : null,
    };
  }, [profile, meals, today, routine, slotSkips, abhyas, water, activities, settings.offDays, settings.waterGoalMl, settings.walkGoalMin]);
  // Today as it stands at this minute, with the days before as they were.
  return useMemo(
    () => teacherWords({ today: past.score(today, minute, atMinute(today, minute)), yesterday: past.yesterday, earlier: past.earlier }, makeT(profile.lang)),
    [past, today, minute, profile.lang],
  );
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
      <View accessible accessibilityRole="text" accessibilityLabel={spokenLine([t('teach_title'), w.lead, w.best, w.tip])} style={{ gap: 8 }}>
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
