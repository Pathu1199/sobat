import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { newChapter } from '../core/chapter';
import { formatDayMonthYear } from '../core/date';
import { oneDecimal, shownWeight } from '../core/tileText';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Btn, Small } from '../ui/components';
import { Sheet } from '../ui/Sheet';
import { C, F, lh } from '../ui/theme';

/**
 * Me → "Start a new chapter", in plain words: the climb starts again today
 * from the weight Progress shows, Lost counts from there, the weekly challenge
 * and the streak start fresh, and nothing is deleted. A weigh-in more than
 * thirty days old is named, so the person can weigh in first.
 */
export function ChapterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const fb = useFeedback();
  const { state, today } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const next = useMemo(() => newChapter(state.profile, state.weights, today), [state.profile, state.weights, today]);
  const shown = useMemo(() => shownWeight(state.weights, today), [state.weights, today]);
  return (
    <Sheet open={open} title={t('chapter_title')} onClose={onClose}>
      <View style={{ gap: 12 }}>
        <Text style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '400' }}>{fill(t('chapter_body'), { kg: oneDecimal(next.startWeightKg) })}</Text>
        {shown?.stale ? <Small color={C.amber}>{fill(t('chapter_stale'), { date: formatDayMonthYear(shown.asOf, lang) })}</Small> : null}
        <Btn
          label={t('chapter_confirm')}
          onPress={() => {
            app.setProfile(next);
            fb.haptic('success');
            onClose();
            fb.notify(t('chapter_started'));
          }}
        />
        <Btn tone="ghost" label={t('cancel')} onPress={onClose} />
      </View>
    </Sheet>
  );
}
