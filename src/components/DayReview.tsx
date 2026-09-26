import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { dayReviewPrompt, factsFrom, systemPrompt } from '../ai/prompts';
import { formatMinutes } from '../core/date';
import { guardAdvice } from '../core/guardrails';
import { KCAL_FLOOR } from '../core/nutrition';
import { longestStretchMinutes, minutesOn } from '../core/usage';
import { makeT } from '../i18n';
import { useAI } from '../services/useAI';
import { useApp } from '../store/AppProvider';
import { Btn, Card, H3, P, Row, Small } from '../ui/components';
import { C } from '../ui/theme';

/**
 * The end-of-day recap. Writing it also stores a one-line day note in memory,
 * which is what lets tomorrow's advice know how today went.
 */
export function DayReview() {
  const app = useApp();
  const { ask, online } = useAI();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);

  const hour = new Date().getHours();
  const existing = app.state.memory.find((m) => m.type === 'episode' && m.date === app.today);

  // Only worth offering once the day is mostly over and there is something to say.
  const hasData = app.budget.consumed > 0 || app.state.sleep.some((s) => s.date === app.today);
  if (hour < 20 || !hasData) return null;

  function factLines(): string[] {
    const out: string[] = [];
    out.push(`Ate ${app.budget.consumed} of ${app.budget.target} kcal, protein ${app.budget.proteinConsumed} of ${app.budget.proteinTarget} g.`);
    out.push(`Water ${app.waterToday} of ${app.state.settings.waterGoalMl} ml.`);
    const w = app.state.workouts.find((x) => x.date === app.today);
    out.push(w?.status === 'done' ? `Moved for ${w.minutes} minutes.` : 'No workout today.');
    const sleep = app.state.sleep.find((s) => s.date === app.today);
    if (sleep) out.push(`Slept ${formatMinutes(sleep.minutes)}, score ${sleep.score}.`);
    const mood = app.state.moods.filter((m) => m.date === app.today).slice(-1)[0];
    if (mood) out.push(`Mood ${mood.score} out of 5${mood.note ? `, wrote: ${mood.note}` : ''}.`);
    const screen = minutesOn(app.state.usage, app.today);
    if (screen > 0) out.push(`Screen time ${formatMinutes(screen)}, longest sitting ${formatMinutes(longestStretchMinutes(app.state.usage, app.today))}.`);
    if (app.streakDays > 1) out.push(`${app.streakDays} days logged in a row.`);
    return out;
  }

  async function write() {
    setBusy(true);
    try {
      const lines = factLines();
      const facts = factsFrom({
        budget: app.budget,
        weightKg: app.state.profile.weightKg,
        goalWeightKg: app.state.profile.goalWeightKg,
        kcalFloor: KCAL_FLOOR[app.state.profile.sex],
        waterMl: app.waterToday,
        waterGoalMl: app.state.settings.waterGoalMl,
        streak: app.streakDays,
      });
      const raw = await ask([
        { role: 'system', content: systemPrompt(lang, facts) },
        { role: 'user', content: dayReviewPrompt(lang, lines) },
      ]);
      const guarded = guardAdvice(raw, KCAL_FLOOR[app.state.profile.sex]).text.trim();
      setText(guarded);
      // Kept as a day note so tomorrow has context, not just today's screen.
      app.rememberText(summaryLine(), 'episode', 'auto');
    } catch {
      // Offline: fall back to a plain summary built from the numbers.
      const plain = factLines().join(' ');
      setText(plain);
      app.rememberText(summaryLine(), 'episode', 'auto');
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
        <Ionicons name="moon-outline" size={18} color={C.blue} />
        <H3>{t('day_review')}</H3>
      </Row>

      {text ? (
        <>
          <P>{text}</P>
          <Small color={C.teal}>{t('review_saved')}</Small>
        </>
      ) : existing ? (
        <>
          <P dim>{existing.text}</P>
          <Small color={C.textFaint}>{t('review_saved')}</Small>
        </>
      ) : busy ? (
        <Row>
          <ActivityIndicator color={C.teal} />
          <Small>{t('write_review')}</Small>
        </Row>
      ) : (
        <Btn small tone="soft" label={t('write_review')} onPress={write} />
      )}
    </Card>
  );
}
