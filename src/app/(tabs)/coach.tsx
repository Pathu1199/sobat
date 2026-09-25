import React, { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { factsFrom, systemPrompt } from '../../ai/prompts';
import { AIBadge } from '../../components/AIBadge';
import { guardAdvice, HELPLINES, isCrisisText } from '../../core/guardrails';
import { KCAL_FLOOR } from '../../core/nutrition';
import { suggestMeals } from '../../core/foods';
import { makeT } from '../../i18n';
import { useAI } from '../../services/useAI';
import { useApp } from '../../store/AppProvider';
import { Btn, Card, Field, H3, P, Pill, Row, Small } from '../../ui/components';
import { C, F } from '../../ui/theme';

export default function CoachScreen() {
  const app = useApp();
  const { ai, ask, online } = useAI();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [crisis, setCrisis] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const quick =
    lang === 'mr'
      ? ['आता काय खाऊ?', 'आज खूप खाल्ले', 'व्यायामाचा कंटाळा आहे', 'झोप लागत नाही']
      : lang === 'hi'
        ? ['अभी क्या खाऊँ?', 'आज ज़्यादा खा लिया', 'कसरत का मन नहीं', 'नींद नहीं आती']
        : ['What should I eat now?', 'I overate today', 'No motivation to exercise', 'I cannot sleep'];

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;

    // Crisis check happens before the model sees anything.
    if (isCrisisText(clean)) {
      setCrisis(true);
      setInput('');
      return;
    }

    const userMsg = { id: String(Date.now()), role: 'user' as const, text: clean, at: new Date().toISOString() };
    app.addChat(userMsg);
    setInput('');
    setBusy(true);

    try {
      const floor = KCAL_FLOOR[app.state.profile.sex];
      const facts = factsFrom({
        budget: app.budget,
        weightKg: app.state.profile.weightKg,
        goalWeightKg: app.state.profile.goalWeightKg,
        kcalFloor: floor,
        waterMl: app.waterToday,
        waterGoalMl: app.state.settings.waterGoalMl,
        streak: app.streakDays,
      });

      // Give the model real options from the food list so it cannot invent numbers.
      const options = suggestMeals(app.foods, Math.max(app.budget.perMeal, 300));
      if (options.length > 0) {
        facts.push(
          'Meal options that fit the remaining budget: ' +
            options.slice(0, 8).map((o) => `${o.food.name_en} ${o.kcal} kcal ${o.protein} g protein`).join('; '),
        );
      }

      const history = app.state.chat.slice(-8).map((m) => ({ role: m.role, content: m.text }));
      const raw = await ask([{ role: 'system', content: systemPrompt(lang, facts) }, ...history, { role: 'user', content: clean }]);
      const guarded = guardAdvice(raw, floor);
      app.addChat({ id: String(Date.now() + 1), role: 'assistant', text: guarded.text.trim(), at: new Date().toISOString() });
    } catch {
      app.addChat({ id: String(Date.now() + 1), role: 'assistant', text: t('ai_offline_hint'), at: new Date().toISOString() });
    } finally {
      setBusy(false);
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 12, maxWidth: 760, width: '100%', alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled">
        <Row style={{ justifyContent: 'space-between' }}>
          <H3>{t('coach_title')}</H3>
          <AIBadge route={ai.route} lang={lang} />
        </Row>

        {crisis ? (
          <Card tone={C.red}>
            <H3>{t('helpline_title')}</H3>
            <P>{t('helpline_body')}</P>
            {HELPLINES.map((h) => (
              <Pressable key={h.number} onPress={() => Linking.openURL(`tel:${h.number.replace(/-/g, '')}`)}>
                <Row style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
                  <View style={{ flex: 1 }}>
                    <P>{h.name}</P>
                    <Small>{h.note}</Small>
                  </View>
                  <Text style={{ color: C.teal, fontWeight: '600' }}>{h.number}</Text>
                </Row>
              </Pressable>
            ))}
            <Btn small tone="ghost" label={t('done')} onPress={() => setCrisis(false)} />
          </Card>
        ) : null}

        {!online ? <Small color={C.textFaint}>{t('ai_offline_hint')}</Small> : null}

        {app.state.chat.length === 0 ? (
          <Row style={{ flexWrap: 'wrap', gap: 8 }}>
            {quick.map((q) => (
              <Pill key={q} label={q} onPress={() => send(q)} />
            ))}
          </Row>
        ) : null}

        {app.state.chat.map((m) => (
          <View
            key={m.id}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
              backgroundColor: m.role === 'user' ? C.tealSoft : C.card,
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 14,
              padding: 12,
            }}>
            <Text style={{ color: C.text, fontSize: F.body, lineHeight: 22 }}>{m.text}</Text>
          </View>
        ))}

        {busy ? <ActivityIndicator color={C.teal} /> : null}
      </ScrollView>

      <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bgAlt }}>
        <Row style={{ maxWidth: 760, width: '100%', alignSelf: 'center' }}>
          <Field value={input} onChangeText={setInput} placeholder={t('ask_placeholder')} />
          <Btn small label={t('next')} onPress={() => send(input)} disabled={busy || !input.trim()} />
        </Row>
        {app.state.chat.length > 0 ? <Btn small tone="ghost" label={t('reset_data')} onPress={app.clearChat} style={{ marginTop: 8 }} /> : null}
      </View>
    </View>
  );
}
