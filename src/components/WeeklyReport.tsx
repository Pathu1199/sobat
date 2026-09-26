import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { factsFrom, systemPrompt, weeklyReportPrompt } from '../ai/prompts';
import { formatMinutes } from '../core/date';
import { changePct, type GrowthSummary } from '../core/growth';
import { guardAdvice } from '../core/guardrails';
import { KCAL_FLOOR } from '../core/nutrition';
import { makeT } from '../i18n';
import { useAI } from '../services/useAI';
import { useApp } from '../store/AppProvider';
import { Btn, Card, H3, P, Row, Small } from '../ui/components';
import { C } from '../ui/theme';

const LABEL: Record<string, string> = {
  avg_kcal: 'average calories per logged day',
  on_target: 'days within the calorie goal',
  logged_days: 'days logged',
  workout_days: 'workout days',
  move_minutes: 'minutes moving',
  avg_sleep: 'average sleep in minutes',
  avg_water: 'average water in ml',
  avg_mood: 'average mood out of 5',
  screen_time: 'average screen minutes',
  weight_change: 'weight change in kg',
};

/** Turns the week's numbers into a few sentences that say what changed. */
export function WeeklyReport({ summary }: { summary: GrowthSummary }) {
  const app = useApp();
  const { ask, online } = useAI();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);

  const enoughData = summary.metrics.find((m) => m.key === 'logged_days')!.value >= 3;
  if (!enoughData) return null;

  async function write() {
    setBusy(true);
    try {
      const lines = summary.metrics.map((m) => {
        const pct = changePct(m);
        const base = `${LABEL[m.key] ?? m.key}: ${m.value}`;
        return pct === null ? base : `${base} (${pct > 0 ? '+' : ''}${pct}% versus the week before)`;
      });
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
        { role: 'user', content: weeklyReportPrompt(lang, lines) },
      ]);
      setText(guardAdvice(raw, KCAL_FLOOR[app.state.profile.sex]).text.trim());
    } catch {
      setText(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Row style={{ gap: 8 }}>
        <Ionicons name="document-text-outline" size={18} color={C.purple} />
        <H3>{t('weekly_report')}</H3>
      </Row>
      {text ? (
        <P>{text}</P>
      ) : busy ? (
        <Row>
          <ActivityIndicator color={C.teal} />
          <Small>{t('generate')}</Small>
        </Row>
      ) : online ? (
        <Btn small tone="soft" label={t('generate')} onPress={write} />
      ) : (
        <Small color={C.textFaint}>{t('ai_offline_hint')}</Small>
      )}
    </Card>
  );
}
