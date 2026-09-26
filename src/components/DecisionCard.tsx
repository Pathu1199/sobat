import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { decisionPrompt, factsFrom, systemPrompt } from '../ai/prompts';
import type { Decision } from '../core/decide';
import { guardAdvice } from '../core/guardrails';
import { contextFor, toPromptLines } from '../core/memory';
import { KCAL_FLOOR, type Budget, type Targets } from '../core/nutrition';
import type { Lang } from '../core/types';
import { makeT } from '../i18n';
import { useAI } from '../services/useAI';
import { useApp } from '../store/AppProvider';
import { Bullet, Card, Divider, Micro, Quote, Row, StatQuad } from '../ui/components';
import { C, F, severityColor } from '../ui/theme';

/**
 * The rules produce the advice; the model only rewrites it in a warmer voice,
 * and its output is checked before it is shown. With the model off, the card
 * still says everything that matters.
 */
export function DecisionCard({ decision, lang, targets, budget }: { decision: Decision; lang: Lang; targets: Targets; budget: Budget }) {
  const t = makeT(lang);
  const { ask, online } = useAI();
  const app = useApp();
  const { state, waterToday, streakDays } = app;
  const [words, setWords] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const actionText = decision.actionKeys.map((k) => t(`act_${k}`));
  const tone = severityColor(decision.severity);
  const floor = KCAL_FLOOR[state.profile.sex];

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
      kcalFloor: floor,
      waterMl: waterToday,
      waterGoalMl: state.settings.waterGoalMl,
      streak: streakDays,
    });
    facts.push(...toPromptLines(contextFor(state.memory, decision.situation, app.today, 6)));

    ask([
      { role: 'system', content: systemPrompt(lang, facts) },
      { role: 'user', content: decisionPrompt(decision, lang, actionText) },
    ])
      .then((raw) => {
        if (cancelled) return;
        setWords(guardAdvice(raw, floor).text.trim());
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

  // An energy breakdown the user can check the advice against.
  const activeBurn = Math.max(0, targets.tdee - targets.bmr);
  const quad = [
    { label: t('bmr'), value: targets.bmr.toLocaleString() },
    { label: t('active_burn'), value: String(activeBurn) },
    { label: t('deficit'), value: `${budget.remaining >= 0 ? '-' : '+'}${Math.abs(targets.deficit)}`, color: C.cyan },
    { label: t('tdee'), value: targets.tdee.toLocaleString() },
  ];

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ gap: 8 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tone }} />
          <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '600' }}>{t(`sit_${decision.situation}`)}</Text>
        </Row>
        <Micro>{`${t('metabolic_rule')} ${decision.situation.length}`}</Micro>
      </Row>

      {loading && !words ? <ActivityIndicator color={C.accent} /> : null}

      {words ? (
        lang === 'en' ? (
          <Text style={{ color: C.textDim, fontSize: F.body, lineHeight: 21 }}>{words}</Text>
        ) : (
          <Quote>{words}</Quote>
        )
      ) : (
        <Text style={{ color: C.textDim, fontSize: F.body, lineHeight: 21 }}>
          {budget.remaining >= 0
            ? t('under_by').replace('{n}', String(Math.abs(budget.remaining)))
            : t('over_by').replace('{n}', String(Math.abs(budget.remaining)))}
        </Text>
      )}

      <View style={{ gap: 4 }}>
        {actionText.map((a, i) => (
          <Bullet key={i} color={tone}>
            {a}
          </Bullet>
        ))}
      </View>

      <Divider />
      <StatQuad items={quad} />
    </Card>
  );
}
