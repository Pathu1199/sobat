import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { factsFrom, memoryExtractionPrompt, MEMORY_SCHEMA, systemPrompt } from '../../ai/prompts';
import { IconButton, TopBarActions } from '../../components/TopBarActions';
import { formatMinutes, toISODate } from '../../core/date';
import { suggestMeals, toMealItem } from '../../core/foods';
import { guardAdvice, HELPLINES, isCrisisText } from '../../core/guardrails';
import { contextFor, dietFrom, isDurableMemory, toPromptLines } from '../../core/memory';
import { KCAL_FLOOR, mealTypeForHour } from '../../core/nutrition';
import type { ChatOption } from '../../core/types';
import { makeT } from '../../i18n';
import { useAI } from '../../services/useAI';
import { useApp } from '../../store/AppProvider';
import { BiText, Btn, Card, Divider, Micro, Pill, Row, Small } from '../../ui/components';
import { C, F, S } from '../../ui/theme';
import { TopBar } from '../../ui/TopBar';
import { useBreakpoint } from '../../ui/useBreakpoint';

export default function CoachScreen() {
  const app = useApp();
  const { ai, ask, askJSON } = useAI();
  const router = useRouter();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const en = makeT('en');
  const wide = useBreakpoint() === 'desktop';
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [crisis, setCrisis] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const lastSleep = [...app.state.sleep].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0];
  const lastOptions = [...app.state.chat].reverse().find((m) => m.role === 'assistant' && m.options && m.options.length > 0)?.options ?? [];

  const rail = (
    <View style={{ width: 300, gap: 14, paddingVertical: S.pad, paddingRight: S.gutterWide }}>
      <Card>
        <Micro>{t('todays_numbers')}</Micro>
        <Stat label={t('kcal_left')} value={String(Math.max(0, app.budget.remaining))} />
        <Stat label={t('protein')} value={`${app.budget.proteinConsumed} / ${app.budget.proteinTarget} g`} />
        <Stat label={t('water')} value={`${app.waterToday} / ${app.state.settings.waterGoalMl} ml`} />
        <Stat label={t('sleep_title')} value={lastSleep ? `${formatMinutes(lastSleep.minutes)} · ${lastSleep.score}` : '--'} />
        <Divider />
        <Pressable onPress={() => router.push('/memory')}>
          <Small color={C.accent}>{`${app.state.memory.length} ${en('mem_fact')} ›`}</Small>
        </Pressable>
      </Card>
      {lastOptions.length > 0 ? (
        <Card>
          <Micro>{t('offered')}</Micro>
          {lastOptions.map((o) => (
            <Pressable key={o.foodId} onPress={() => logOption(o)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                <BiText en={o.name_en} alt={lang === 'en' ? undefined : o.name_mr} size={F.small} />
                <Small>{`${o.kcal} kcal`}</Small>
              </Row>
            </Pressable>
          ))}
        </Card>
      ) : null}
    </View>
  );

  const quick =
    lang === 'mr'
      ? ['आता काय खाऊ?', 'आज खूप खाल्ले', 'व्यायामाचा कंटाळा', 'झोप लागत नाही']
      : lang === 'hi'
        ? ['अभी क्या खाऊँ?', 'आज ज़्यादा खा लिया', 'कसरत का मन नहीं', 'नींद नहीं आती']
        : ['What should I eat now?', 'I overate today', 'No motivation to exercise', 'I cannot sleep'];

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;

    if (isCrisisText(clean)) {
      setCrisis(true);
      setInput('');
      return;
    }

    app.addChat({ id: String(Date.now()), role: 'user', text: clean, at: new Date().toISOString() });
    setInput('');
    setBusy(true);

    const diet = dietFrom(app.state.memory);
    const options = suggestMeals(app.foods, Math.max(app.budget.perMeal, 300), diet);
    const chatOptions: ChatOption[] = options.slice(0, 3).map((o) => ({
      foodId: o.food.id,
      name_en: o.food.name_en,
      name_mr: o.food.name_mr,
      grams: o.grams,
      kcal: o.kcal,
      protein: o.protein,
    }));

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
      if (options.length > 0) {
        facts.push(
          'Meal options that fit the remaining budget: ' +
            options.slice(0, 8).map((o) => `${o.food.name_en} ${o.kcal} kcal ${o.protein} g protein`).join('; '),
        );
      }
      facts.push(...toPromptLines(contextFor(app.state.memory, clean, app.today, 10)));

      const history = app.state.chat.slice(-8).map((m) => ({ role: m.role, content: m.text }));
      const raw = await ask([{ role: 'system', content: systemPrompt(lang, facts) }, ...history, { role: 'user', content: clean }]);
      const reply = guardAdvice(raw, floor).text.trim();
      const foodish = /eat|food|dinner|lunch|meal|breakfast|snack|खा|जेव|नाश्ता|भूक/i.test(clean);
      app.addChat({
        id: String(Date.now() + 1),
        role: 'assistant',
        text: reply,
        at: new Date().toISOString(),
        options: foodish ? chatOptions : undefined,
      });
      learn(clean, reply);
    } catch {
      app.addChat({ id: String(Date.now() + 1), role: 'assistant', text: t('ai_offline_hint'), at: new Date().toISOString() });
    } finally {
      setBusy(false);
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60);
    }
  }

  /** Pull durable facts out in the background; failing to learn never breaks the chat. */
  async function learn(userText: string, assistantText: string) {
    try {
      const out = await askJSON<{ memories?: { text: string; type: string }[] }>(
        [{ role: 'user', content: memoryExtractionPrompt(userText, assistantText) }],
        MEMORY_SCHEMA,
      );
      for (const m of out.memories ?? []) {
        const type = m.type === 'preference' || m.type === 'goal' ? m.type : 'fact';
        if (m.text && isDurableMemory(m.text)) app.rememberText(m.text, type, 'auto');
      }
    } catch {
      // Nothing learned this time.
    }
  }

  function logOption(o: ChatOption) {
    const food = app.foods.find((f) => f.id === o.foodId);
    if (!food) return;
    const now = new Date();
    const item = toMealItem(food, o.grams);
    app.addMeal({
      id: String(now.getTime()),
      at: now.toISOString(),
      date: toISODate(now),
      type: mealTypeForHour(now.getHours()),
      items: [item],
      kcal: item.kcal,
      protein: Math.round(item.protein),
    });
    router.push('/');
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar
        title={en('coach_title')}
        alt={lang === 'en' ? undefined : t('coach_title')}
        left={wide ? undefined : <IconButton name="chevron-back" label={t('close')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
        right={<TopBarActions />}
      />
      <View style={{ flex: 1, flexDirection: 'row', maxWidth: S.maxWide, width: '100%', alignSelf: 'center' }}>
        <View style={{ flex: 1 }}>
          <ScrollView
            ref={scroller}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: S.pad, gap: 14, maxWidth: 780, width: '100%', alignSelf: 'center' }}
            keyboardShouldPersistTaps="handled">
            <Row style={{ justifyContent: 'space-between' }}>
              <Pressable onPress={() => router.push('/memory')}>
                <Micro color={C.textDim}>{`${app.state.memory.length} ${en('mem_fact')}`}</Micro>
              </Pressable>
              {app.state.chat.length > 0 ? (
                <Pressable onPress={app.clearChat}>
                  <Micro color={C.accent}>{`+ ${en('new_chat')}`}</Micro>
                </Pressable>
              ) : null}
            </Row>

            {crisis ? (
              <Card tone={C.red}>
                <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '600' }}>{t('helpline_title')}</Text>
                <Small>{t('helpline_body')}</Small>
                {HELPLINES.map((h) => (
                  <Pressable key={h.number} onPress={() => Linking.openURL(`tel:${h.number.replace(/-/g, '')}`)}>
                    <Row style={{ justifyContent: 'space-between', paddingVertical: 7 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.text, fontSize: F.body, fontWeight: '500' }}>{h.name}</Text>
                        <Small color={C.textFaint}>{h.note}</Small>
                      </View>
                      <Text style={{ color: C.cyan, fontWeight: '600' }}>{h.number}</Text>
                    </Row>
                  </Pressable>
                ))}
                <Btn small tone="ghost" label={t('done')} onPress={() => setCrisis(false)} />
              </Card>
            ) : null}

            {app.state.chat.length === 0 ? (
              <>
                <Small color={C.textDim}>{t('no_chat_yet')}</Small>
                <Row style={{ flexWrap: 'wrap', gap: 8 }}>
                  {quick.map((q) => (
                    <Pill key={q} label={q} onPress={() => send(q)} />
                  ))}
                </Row>
              </>
            ) : null}

            {app.state.chat.map((m) =>
              m.role === 'user' ? (
                <View key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '86%', backgroundColor: C.accent, borderRadius: 16, borderBottomRightRadius: 5, padding: 13 }}>
                  <Text style={{ color: C.white, fontSize: F.body, lineHeight: 20 }}>{m.text}</Text>
                </View>
              ) : (
                <View key={m.id} style={{ gap: 10 }}>
                  <View style={{ maxWidth: '92%', backgroundColor: C.card, borderWidth: S.hairline, borderColor: C.border, borderRadius: 16, borderBottomLeftRadius: 5, padding: 14, gap: 10 }}>
                    <Text style={{ color: C.text, fontSize: F.body, lineHeight: 21 }}>{m.text}</Text>
                    <Row style={{ gap: 14 }}>
                      <Pressable onPress={() => app.rememberText(m.text, 'preference', 'user')}>
                        <Micro color={C.textFaint}>{en('remember_this')}</Micro>
                      </Pressable>
                    </Row>
                  </View>

                  {m.options && m.options.length > 0 ? (
                    <View style={{ gap: 8 }}>
                      <Micro>{en('from_your_database')}</Micro>
                      {m.options.map((o) => (
                        <Pressable
                          key={o.foodId}
                          onPress={() => logOption(o)}
                          style={({ pressed }) => ({
                            backgroundColor: C.card,
                            borderWidth: S.hairline,
                            borderColor: C.border,
                            borderRadius: S.radiusSm,
                            padding: 13,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                            opacity: pressed ? 0.7 : 1,
                          })}>
                          <View style={{ flex: 1, gap: 3 }}>
                            <BiText en={o.name_en} alt={lang === 'en' ? undefined : o.name_mr} size={F.body} />
                            <Micro>{`${o.grams} g`}</Micro>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 2 }}>
                            <Text style={{ color: C.violet, fontSize: F.small, fontWeight: '600' }}>{o.protein}g</Text>
                            <Text style={{ color: C.textDim, fontSize: F.tiny }}>{o.kcal} kcal</Text>
                          </View>
                          <Ionicons name="add-circle-outline" size={19} color={C.accent} />
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              ),
            )}

            {busy ? <ActivityIndicator color={C.accent} /> : null}
            <View style={{ height: 8 }} />
          </ScrollView>

          <View style={{ padding: 12, borderTopWidth: S.hairline, borderTopColor: C.border, backgroundColor: C.bgAlt }}>
            <View style={{ maxWidth: 780, width: '100%', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <ChatInput value={input} onChangeText={setInput} placeholder={t('ask_placeholder')} onSubmit={() => send(input)} />
              </View>
              <Pressable
                onPress={() => send(input)}
                disabled={busy || !input.trim()}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: busy || !input.trim() ? C.cardAlt : C.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="arrow-up" size={19} color={busy || !input.trim() ? C.textGhost : C.white} />
              </Pressable>
            </View>
          </View>
        </View>
        {wide ? rail : null}
      </View>
    </View>
  );
}

function ChatInput({ value, onChangeText, placeholder, onSubmit }: { value: string; onChangeText: (v: string) => void; placeholder: string; onSubmit: () => void }) {
  const { TextInput } = require('react-native') as typeof import('react-native');
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={C.textGhost}
      onSubmitEditing={onSubmit}
      returnKeyType="send"
      style={{
        backgroundColor: C.card,
        borderWidth: S.hairline,
        borderColor: C.border,
        borderRadius: 999,
        paddingHorizontal: 17,
        paddingVertical: 12,
        color: C.text,
        fontSize: F.body,
      }}
    />
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Micro>{label}</Micro>
      <Text style={{ color: C.text, fontSize: F.small, fontWeight: '600' }}>{value}</Text>
    </Row>
  );
}
