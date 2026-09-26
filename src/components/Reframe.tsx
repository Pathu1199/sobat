import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { factsFrom, systemPrompt } from '../ai/prompts';
import { guardAdvice, isCrisisText } from '../core/guardrails';
import { KCAL_FLOOR } from '../core/nutrition';
import type { Lang } from '../core/types';
import { makeT } from '../i18n';
import { useAI } from '../services/useAI';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Field, H3, P, Row, Small } from '../ui/components';
import { C } from '../ui/theme';

function reframePrompt(lang: Lang, thought: string): string {
  return [
    'The person is stuck on this thought:',
    `"${thought}"`,
    '',
    'Help them look at it again, the way a good friend would. In three short parts:',
    '1. Say the thought back so they feel heard. Do not argue with it.',
    '2. Name what is actually true and what is a guess, gently.',
    '3. One small thing they could do in the next hour.',
    '',
    'Rules: under 100 words. No therapy jargon, no "you should", no toxic positivity.',
    'You are not a counsellor and must not act like one.',
  ].join('\n');
}

/** Self-help reframing, kept deliberately small and non-clinical. */
export function Reframe({ onCrisis }: { onCrisis: () => void }) {
  const app = useApp();
  const { ask, online } = useAI();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const [thought, setThought] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function go() {
    const clean = thought.trim();
    if (!clean) return;
    // Checked before the model sees it, same as everywhere else in the app.
    if (isCrisisText(clean)) {
      onCrisis();
      return;
    }
    setBusy(true);
    try {
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
        { role: 'user', content: reframePrompt(lang, clean) },
      ]);
      setAnswer(guardAdvice(raw, KCAL_FLOOR[app.state.profile.sex]).text.trim());
    } catch {
      setAnswer(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Row style={{ gap: 8 }}>
        <Ionicons name="repeat-outline" size={18} color={C.violet} />
        <H3>{t('reframe')}</H3>
      </Row>
      <Field value={thought} onChangeText={setThought} placeholder={t('reframe_input')} multiline />
      {answer ? <P>{answer}</P> : null}
      {busy ? (
        <ActivityIndicator color={C.accent} />
      ) : online ? (
        <Btn small tone="soft" label={t('reframe_ask')} onPress={go} disabled={!thought.trim()} />
      ) : (
        <Small color={C.textFaint}>{t('ai_offline_hint')}</Small>
      )}
    </Card>
  );
}
