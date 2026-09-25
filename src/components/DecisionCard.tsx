import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { decisionPrompt, factsFrom, systemPrompt } from '../ai/prompts';
import type { Decision } from '../core/decide';
import { guardAdvice } from '../core/guardrails';
import { KCAL_FLOOR } from '../core/nutrition';
import type { Lang } from '../core/types';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, H3, Pill, Row, Small, P } from '../ui/components';
import { C, severityColor } from '../ui/theme';
import { useAI } from '../services/useAI';

/**
 * The rules produce the advice. The model only rewrites it in a friendlier
 * voice, and its output is checked before it is shown. If the model is off,
 * the card still works.
 */
export function DecisionCard({ decision, lang }: { decision: Decision; lang: Lang }) {
  const t = makeT(lang);
  const { ask, online } = useAI();
  const { state, budget, waterToday, streakDays, targets } = useApp();
  const [words, setWords] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const actionText = decision.actionKeys.map((k) => t(`act_${k}`));
  const tone = severityColor(decision.severity);

  useEffect(() => {
    let cancelled = false;
    if (!online) {
      setWords(null);
      return;
    }
    setLoading(true);
    const facts = factsFrom({
      budget,
      weightKg: state.profile.weightKg,
      goalWeightKg: state.profile.goalWeightKg,
      kcalFloor: KCAL_FLOOR[state.profile.sex],
      waterMl: waterToday,
      waterGoalMl: state.settings.waterGoalMl,
      streak: streakDays,
    });
    ask([
      { role: 'system', content: systemPrompt(lang, facts) },
      { role: 'user', content: decisionPrompt(decision, lang, actionText) },
    ])
      .then((raw) => {
        if (cancelled) return;
        const guarded = guardAdvice(raw, KCAL_FLOOR[state.profile.sex]);
        setWords(guarded.text.trim());
      })
      .catch(() => {
        if (!cancelled) setWords(null);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // Re-word only when the situation itself changes, not on every render.
  }, [decision.situation, decision.severity, online, lang]);

  return (
    <Card tone={tone}>
      <Row style={{ justifyContent: 'space-between' }}>
        <H3>{t(`sit_${decision.situation}`)}</H3>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tone }} />
      </Row>

      {loading ? <ActivityIndicator color={C.teal} /> : null}
      {words ? <P>{words}</P> : null}

      <View style={{ gap: 6 }}>
        {actionText.map((a, i) => (
          <Row key={i}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone }} />
            <P style={{ flex: 1 }}>{a}</P>
          </Row>
        ))}
      </View>

      <Small color={C.textFaint}>{t('why')}</Small>
      <Row style={{ flexWrap: 'wrap', gap: 6 }}>
        {decision.facts.map((f) => (
          <Pill key={f.label} label={`${t(f.label === 'protein' ? 'protein' : f.label === 'target' ? 'target' : f.label === 'eaten' ? 'eaten' : 'kcal_left')} ${f.value}`} />
        ))}
      </Row>
    </Card>
  );
}
