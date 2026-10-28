import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { dayReviewPrompt, factsFrom, systemPrompt } from '../ai/prompts';
import { KCAL_FLOOR } from '../core/nutrition';
import { dayReviewLines, dayReviewWritten, type DayFacts } from '../core/review';
import { longestStretchMinutes, minutesOn } from '../core/usage';
import { makeT } from '../i18n';
import { useAI } from '../services/useAI';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Micro, P, Row } from '../ui/components';
import { C } from '../ui/theme';

/**
 * The end-of-day recap, shown on Today in the evening while its reminder is
 * on (`dayReviewShown`). The model writes it from the day's sentences; with no
 * model to ask, the sentences themselves are the recap, in the person's
 * language, at once, with no wait on a model that is not there. Writing it
 * also stores a one-line day note in memory, which is what lets tomorrow's
 * advice know how today went.
 */
export function DayReview() {
  const app = useApp();
  const { ask, online } = useAI();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);

  const written = dayReviewWritten(app.state.memory, app.today);

  function dayFacts(): DayFacts {
    const w = app.state.workouts.find((x) => x.date === app.today);
    const sleep = app.state.sleep.find((s) => s.date === app.today);
    const mood = app.state.moods.filter((m) => m.date === app.today).slice(-1)[0];
    return {
      kcal: app.budget.consumed,
      kcalTarget: app.budget.target,
      protein: app.budget.proteinConsumed,
      proteinTarget: app.budget.proteinTarget,
      waterMl: app.waterToday,
      waterGoalMl: app.state.settings.waterGoalMl,
      movedMin: w?.status === 'done' ? w.minutes : null,
      sleep: sleep ? { minutes: sleep.minutes, score: sleep.score } : null,
      mood: mood ? { score: mood.score, note: mood.note } : null,
      screenMin: minutesOn(app.state.usage, app.today),
      sittingMin: longestStretchMinutes(app.state.usage, app.today),
      streakDays: app.streakDays,
    };
  }

  // The day's own sentences, in the person's language: the recap when there is no model to ask.
  function writePlain() {
    setText(dayReviewLines(dayFacts(), t).join(' '));
    app.rememberText(summaryLine(), 'episode', 'auto');
  }

  async function write() {
    if (!online) {
      writePlain();
      return;
    }
    setBusy(true);
    try {
      // The model is told the day in English and answers in the person's language.
      const lines = dayReviewLines(dayFacts(), makeT('en'));
      const facts = factsFrom({
        budget: app.budget,
        weightKg: app.state.profile.weightKg,
        goalWeightKg: app.state.profile.goalWeightKg,
        kcalFloor: KCAL_FLOOR[app.state.profile.sex],
        waterMl: app.waterToday,
        waterGoalMl: app.state.settings.waterGoalMl,
        streak: app.streakDays,
      });
      setText(
        await ask([
          { role: 'system', content: systemPrompt(lang, facts) },
          { role: 'user', content: dayReviewPrompt(lang, lines) },
        ]),
      );
      // Kept as a day note so tomorrow has context, not just today's screen.
      app.rememberText(summaryLine(), 'episode', 'auto');
    } catch {
      // The model did not answer after all.
      writePlain();
    } finally {
      setBusy(false);
    }
  }

  /** Short, factual, and free of anything that changes hour to hour. */
  function summaryLine(): string {
    const w = app.state.workouts.find((x) => x.date === app.today);
    const sleep = app.state.sleep.find((s) => s.date === app.today);
    const parts: string[] = [];
    parts.push(app.budget.remaining < 0 ? 'ate over the target' : 'stayed within the target');
    if (w?.status === 'done') parts.push('worked out');
    else parts.push('no workout');
    if (sleep) parts.push(sleep.minutes < 390 ? 'slept short' : 'slept well');
    return parts.join(', ');
  }

  return (
    <Card>
      <Row style={{ gap: 8 }}>
        <Ionicons name="moon-outline" size={15} color={C.cyan} />
        <Micro color={C.cyan}>{t('day_review')}</Micro>
      </Row>

      {text ? (
        <>
          <P>{text}</P>
          <Micro color={C.cyan}>{t('review_saved')}</Micro>
        </>
      ) : written ? (
        <>
          {/* The day note itself is kept in English for the coach; the person reads the day in their own language. */}
          <P dim>{dayReviewLines(dayFacts(), t).join(' ')}</P>
          <Micro>{t('review_saved')}</Micro>
        </>
      ) : busy ? (
        <Row>
          <ActivityIndicator color={C.accent} />
          <Micro>{t('write_review')}</Micro>
        </Row>
      ) : (
        <Btn small tone="soft" label={t('write_review')} onPress={write} />
      )}
    </Card>
  );
}
