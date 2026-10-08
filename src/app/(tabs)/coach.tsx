import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCoach } from '../../components/useCoach';
import { useMinute } from '../../services/useWorkSchedule';
import { dayPlan } from '../../core/dayPlan';
import { answerOffline } from '../../core/offlineCoach';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { factsFrom, memoryExtractionPrompt, MEMORY_SCHEMA, systemPrompt } from '../../ai/prompts';
import { adviceText, CoachStrip } from '../../components/CoachStrip';
import { IconButton, TopBarActions } from '../../components/TopBarActions';
import { formatMinutes, toISODate } from '../../core/date';
import { newId } from '../../core/id';
import { foodName, suggestMeals, toMealItem } from '../../core/foods';
import { guardAdvice, HELPLINES, isCrisisText } from '../../core/guardrails';
import { contextFor, dietFrom, isDurableMemory, toPromptLines } from '../../core/memory';
import { KCAL_FLOOR, mealTypeForHour } from '../../core/nutrition';
import { planFrom } from '../../core/plan';
import { journey, journeyFacts } from '../../core/review';
import { avoidedFoodIds, bhajiFor, routineFacts } from '../../core/routine';
import type { ChatOption } from '../../core/types';
import { makeT } from '../../i18n';
import { useAI } from '../../services/useAI';
import { useAuth } from '../../services/useAuth';
import { useApp } from '../../store/AppProvider';
import { BiText, Btn, Card, Divider, Micro, Pill, Row, Small } from '../../ui/components';
import { C, F, S } from '../../ui/theme';
import { TopBar } from '../../ui/TopBar';
import { useBreakpoint } from '../../ui/useBreakpoint';

export default function CoachScreen() {
  const app = useApp();
  const { ask, askJSON, ai } = useAI();
  const { canUseAI } = useAuth();
  const aiOnline = ai.route === 'primary' || ai.route === 'fallback';
  const aiLive = canUseAI && aiOnline;
  const chatOpen = true;
  const minute = useMinute();
  const advice = useCoach(minute);
  const router = useRouter();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const wide = useBreakpoint() === 'desktop';
  const [input, setInput] = useState('');
  const { ask: askParam } = useLocalSearchParams<{ ask?: string }>();
  const asked = useRef<string | null>(null);
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
          <Small color={C.accent}>{`${app.state.memory.length} ${t('mem_fact')} ›`}</Small>
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
      ? ['माझे वजन का कमी होत नाही?', 'आता काय खाऊ?', 'आज खूप खाल्ले', 'व्यायामाचा कंटाळा', 'झोप लागत नाही']
      : lang === 'hi'
        ? ['मेरा वज़न क्यों नहीं घट रहा?', 'अभी क्या खाऊँ?', 'आज ज़्यादा खा लिया', 'कसरत का मन नहीं', 'नींद नहीं आती']
        : ['Why is my weight not dropping?', 'What should I eat now?', 'I overate today', 'No motivation to exercise', 'I cannot sleep'];

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;

    if (isCrisisText(clean)) {
      setCrisis(true);
      setInput('');
      return;
    }

    app.addChat({ id: newId(), role: 'user', text: clean, at: new Date().toISOString() });
    setInput('');
    setBusy(true);

    const diet = dietFrom(app.state.memory);
    // Never offer something the routine says to stay away from.
    const avoided = avoidedFoodIds(app.state.routine);
    const options = suggestMeals(app.foods, Math.max(app.budget.perMeal, 300), diet).filter((o) => !avoided.has(o.food.id));
    const chatOptions: ChatOption[] = options.slice(0, 3).map((o) => ({
      foodId: o.food.id,
      name_en: o.food.name_en,
      name_mr: o.food.name_mr,
      grams: o.grams,
      kcal: o.kcal,
      protein: o.protein,
    }));

    // No model: answer from the numbers, at once.
    if (!aiLive) {
      const plan = planFrom(app.state.profile, app.state.weights, app.targets, app.today);
      const review = journey({
        today: app.today,
        meals: app.state.meals,
        water: app.state.water,
        sleep: app.state.sleep,
        workouts: app.state.workouts,
        weights: app.state.weights,
        kcalTarget: app.targets.kcal,
        proteinTarget: app.targets.proteinG,
        waterGoalMl: app.state.settings.waterGoalMl,
        avoid: app.state.routine.avoid,
        plan,
      });
      const loggedTypes = Array.from(new Set(app.state.meals.filter((m) => m.date === app.today).map((m) => m.type)));
      const dp = dayPlan({ remaining: app.budget.remaining, hour: app.hour, loggedTypes, foods: app.foods, avoided, preferred: app.state.routine.enabled ? bhajiFor(app.state.routine, app.today) : [] });
      const lastSleep = [...app.state.sleep].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0];
      const answer = answerOffline(
        clean,
        {
          budget: app.budget,
          hour: app.hour,
          plan,
          journey: review,
          dayPlan: dp,
          advice,
          waterMl: app.waterToday,
          waterGoalMl: app.state.settings.waterGoalMl,
          streakDays: app.streakDays,
          lastSleepMinutes: lastSleep?.minutes ?? null,
          stepsToday: app.stepsToday,
          kcalTarget: app.targets.kcal,
          proteinTarget: app.targets.proteinG,
          optionsFor: (max) =>
            suggestMeals(app.foods, max, { ...diet, minKcal: 40 })
              .filter((o) => !avoided.has(o.food.id))
              .slice(0, 3)
              .map((o) => ({ foodId: o.food.id, name_en: o.food.name_en, name_mr: o.food.name_mr, grams: o.grams, kcal: o.kcal, protein: o.protein })),
          foodName: (id) => {
            const fd = app.foods.find((x) => x.id === id);
            return fd ? foodName(fd, lang) : id;
          },
          mealName: (m) => t(m),
        },
        t,
      );
      const extra = answer.text.includes(t('oc_right_now')) ? '\n\n' + advice.slice(0, 2).map((a) => `• ${adviceText(a, t)}`).join('\n') : '';
      app.addChat({ id: newId(), role: 'assistant', text: answer.text + extra, at: new Date().toISOString(), options: answer.options.length ? answer.options : undefined });
      setBusy(false);
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60);
      return;
    }

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
      // Two weeks of the person's own numbers, so "why am I not losing" is answered from evidence.
      const plan = planFrom(app.state.profile, app.state.weights, app.targets, app.today);
      const review = journey({
        today: app.today,
        meals: app.state.meals,
        water: app.state.water,
        sleep: app.state.sleep,
        workouts: app.state.workouts,
        weights: app.state.weights,
        kcalTarget: app.targets.kcal,
        proteinTarget: app.targets.proteinG,
        waterGoalMl: app.state.settings.waterGoalMl,
        avoid: app.state.routine.avoid,
        plan,
      });
      facts.push(...journeyFacts(review, { kcalTarget: app.targets.kcal, proteinTarget: app.targets.proteinG, waterGoalMl: app.state.settings.waterGoalMl, plan }));
      facts.push(
        ...routineFacts(
          app.state.routine,
          app.foods,
          app.today,
          app.state.meals.filter((m) => m.date === app.today),
          app.spentToday,
        ),
      );
      facts.push(...toPromptLines(contextFor(app.state.memory, clean, app.today, 10)));

      const history = app.state.chat.slice(-8).map((m) => ({ role: m.role, content: m.text }));
      const raw = await ask([{ role: 'system', content: systemPrompt(lang, facts) }, ...history, { role: 'user', content: clean }]);
      const reply = guardAdvice(raw, floor).text.trim();
      const foodish = /eat|food|dinner|lunch|meal|breakfast|snack|खा|जेव|नाश्ता|भूक/i.test(clean);
      app.addChat({
        id: newId(),
        role: 'assistant',
        text: reply,
        at: new Date().toISOString(),
        options: foodish ? chatOptions : undefined,
      });
      learn(clean, reply);
    } catch {
      app.addChat({ id: newId(), role: 'assistant', text: t('ai_offline_hint'), at: new Date().toISOString() });
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
      id: newId(),
      at: now.toISOString(),
      date: toISODate(now),
      type: mealTypeForHour(now.getHours()),
      items: [item],
      kcal: item.kcal,
      protein: Math.round(item.protein),
    });
    router.push('/');
  }

  // Arriving with ?ask=stall sends the stall question once, with the data pack behind it.
  useEffect(() => {
    if (askParam === 'stall' && asked.current !== askParam) {
      asked.current = askParam;
      void send(quick[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askParam]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar
        title={t('coach_title')}
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
                <Micro color={C.textDim}>{`${app.state.memory.length} ${t('mem_fact')}`}</Micro>
              </Pressable>
              {app.state.chat.length > 0 ? (
                <Pressable onPress={app.clearChat}>
                  <Micro color={C.accent}>{`+ ${t('new_chat')}`}</Micro>
                </Pressable>
              ) : null}
            </Row>

            <CoachStrip max={8} />

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

            {!aiLive ? <Micro color={C.textFaint}>{t('offline_coach')}</Micro> : null}
            {canUseAI && !aiOnline ? (
              <Card rail={C.textGhost}>
                <Row style={{ gap: 10 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.textGhost }} />
                  <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600', flex: 1 }}>{t('local_ai_down')}</Text>
                </Row>
                <Small color={C.textDim}>{t('coach_ai_off_hint')}</Small>
                <Pressable onPress={() => router.push('/settings')}>
                  <Micro color={C.accent}>{`${t('local_ai')} ›`}</Micro>
                </Pressable>
              </Card>
            ) : null}

            {chatOpen && app.state.chat.length === 0 ? (
              <>
                <Small color={C.textDim}>{t('no_chat_yet')}</Small>
                <Row style={{ flexWrap: 'wrap', gap: 8 }}>
                  {quick.map((q) => (
                    <Pill key={q} label={q} onPress={() => send(q)} />
                  ))}
                </Row>
              </>
            ) : null}

            {chatOpen ? app.state.chat.map((m) =>
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
                        <Micro color={C.textFaint}>{t('remember_this')}</Micro>
                      </Pressable>
                    </Row>
                  </View>

                  {m.options && m.options.length > 0 ? (
                    <View style={{ gap: 8 }}>
                      <Micro>{t('from_your_database')}</Micro>
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
            ) : null}

            {busy ? <ActivityIndicator color={C.accent} /> : null}
            <View style={{ height: 8 }} />
          </ScrollView>

          {chatOpen ? (
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
          ) : null}
        </View>
        {wide ? rail : null}
      </View>
    </View>
  );
}

function ChatInput({ value, onChangeText, placeholder, onSubmit }: { value: string; onChangeText: (v: string) => void; placeholder: string; onSubmit: () => void }) {
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
