import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { dailyTipPrompt, factsFrom, systemPrompt } from '../ai/prompts';
import { guardAdvice } from '../core/guardrails';
import { contextFor, toPromptLines } from '../core/memory';
import { KCAL_FLOOR } from '../core/nutrition';
import { longestStretchMinutes } from '../core/usage';
import { makeT } from '../i18n';
import { useAI } from '../services/useAI';
import { useApp } from '../store/AppProvider';
import { Card, H3, P, Row, Small } from '../ui/components';
import { C } from '../ui/theme';

/**
 * One tip a day, written from the person's own patterns rather than a generic
 * list. Cached per day and per language so it does not regenerate on every
 * render or cost a model call each time the screen opens.
 */
export function TipCard() {
  const app = useApp();
  const { ask, online } = useAI();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const asked = useRef(false);

  const existing = app.tipToday;

  useEffect(() => {
    if (existing || !online || asked.current) return;
    // Needs a little history before a tip can say anything useful.
    if (app.state.meals.length === 0 && app.state.sleep.length === 0) return;
    asked.current = true;

    const focus: string[] = [];
    const sitting = longestStretchMinutes(app.state.usage, app.today);
    if (sitting >= 120) focus.push(`sat for ${Math.round(sitting / 60)} hours without a real break`);
    const lastSleep = [...app.state.sleep].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0];
    if (lastSleep && lastSleep.minutes < 390) focus.push(`slept only ${Math.floor(lastSleep.minutes / 60)} hours last night`);
    if (app.budget.proteinConsumed < app.budget.proteinTarget * 0.5) focus.push('protein is running low today');
    if (app.waterToday < app.state.settings.waterGoalMl * 0.4) focus.push('water is behind');
    if (app.streakDays >= 3) focus.push(`${app.streakDays} days logged in a row`);

    const facts = factsFrom({
      budget: app.budget,
      weightKg: app.state.profile.weightKg,
      goalWeightKg: app.state.profile.goalWeightKg,
      kcalFloor: KCAL_FLOOR[app.state.profile.sex],
      waterMl: app.waterToday,
      waterGoalMl: app.state.settings.waterGoalMl,
      streak: app.streakDays,
    });
    facts.push(...toPromptLines(contextFor(app.state.memory, focus.join(' '), app.today, 6)));

    ask([
      { role: 'system', content: systemPrompt(lang, facts) },
      { role: 'user', content: dailyTipPrompt(lang, focus) },
    ])
      .then((raw) => {
        const guarded = guardAdvice(raw, KCAL_FLOOR[app.state.profile.sex]);
        const text = guarded.text.trim();
        if (text) app.setTip(text);
      })
      .catch(() => {
        asked.current = false;
      });
  }, [existing, online, lang, app.today]);

  if (!existing) {
    if (!online || asked.current === false) return null;
    return (
      <Card>
        <Row>
          <ActivityIndicator color={C.teal} />
          <Small>{t('daily_tip')}</Small>
        </Row>
      </Card>
    );
  }

  return (
    <Card>
      <Row style={{ gap: 8 }}>
        <Ionicons name="bulb-outline" size={18} color={C.amber} />
        <H3>{t('daily_tip')}</H3>
      </Row>
      <P>{existing}</P>
    </Card>
  );
}
