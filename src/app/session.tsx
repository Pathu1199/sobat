import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { buildSteps, completedExerciseIds, progressAt, stepSeconds, totalSeconds } from '../core/session';
import { buildSession, readiness } from '../core/fitness';
import { weeksSince } from '../core/fitness';
import type { Exercise } from '../core/types';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Bar, Btn, Card, Divider, H2, H3, P, Pill, Row, Screen, Small } from '../ui/components';
import { C, F } from '../ui/theme';

/** Walks through the session one set at a time, with a timer and rest. */
export default function SessionScreen() {
  const app = useApp();
  const router = useRouter();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const { width } = useWindowDimensions();

  const startDate = app.state.weights[0]?.date ?? app.today;
  const week = weeksSince(startDate, app.today);
  const lastSleep = [...app.state.sleep].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0];
  const lastWorkout = [...app.state.workouts].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0];
  const moodToday = app.state.moods.filter((m) => m.date === app.today).slice(-1)[0];
  const r = useMemo(() => readiness({ lastSleep, lastWorkout, moodScore: moodToday?.score }), [lastSleep, lastWorkout, moodToday]);
  const session = useMemo(() => buildSession(app.exercises, week, r), [app.exercises, week, r]);

  const steps = useMemo(() => buildSteps(session.exercises), [session.exercises]);
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState(() => (steps[0] ? stepSeconds(steps[0]) : 0));
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [felt, setFelt] = useState(3);
  const [pain, setPain] = useState(false);
  const startedAt = useRef(Date.now());

  const step = steps[index];
  const done = index >= steps.length;

  useEffect(() => {
    if (!step) return;
    setLeft(stepSeconds(step));
    // Rest runs itself; a set waits for you to be ready.
    setRunning(step.kind === 'rest');
  }, [index]);

  useEffect(() => {
    if (!running || done || finished) return;
    if (left <= 0) {
      buzz();
      setIndex((i) => i + 1);
      return;
    }
    const id = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
  }, [running, left, done, finished]);

  function buzz() {
    if (Platform.OS === 'web') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  function finish(status: 'done' | 'skipped') {
    const minutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    app.addWorkout({
      id: app.today,
      date: app.today,
      exerciseIds: completedExerciseIds(steps, index),
      minutes: status === 'done' ? minutes : 0,
      status,
      felt,
      pain,
    });
    router.replace('/fit');
  }

  const name = (e: Exercise) => (lang === 'mr' ? e.name_mr : lang === 'hi' ? e.name_hi : e.name_en);
  const instructions = (e: Exercise) => (lang === 'mr' ? e.instructions_mr : lang === 'hi' ? e.instructions_hi : e.instructions_en);

  if (steps.length === 0) {
    return (
      <Screen>
        <Card>
          <H3>{t('no_data_yet')}</H3>
          <Btn label={t('cancel')} tone="ghost" onPress={() => router.back()} />
        </Card>
      </Screen>
    );
  }

  // Everything done, or the person chose to stop early.
  if (done || finished) {
    const reached = completedExerciseIds(steps, index).length;
    return (
      <Screen>
        <Card tone={C.teal}>
          <H2>{done ? t('session_complete') : t('session_stopped')}</H2>
          <Small>
            {reached} / {session.exercises.length} · {Math.max(1, Math.round((Date.now() - startedAt.current) / 60000))} min
          </Small>
          <Divider />
          <Small>{t('how_did_it_feel')}</Small>
          <Row style={{ gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pill key={n} label={`${n}`} active={felt === n} onPress={() => setFelt(n)} />
            ))}
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Small>{t('any_pain')}</Small>
            <Pill label={pain ? t('done') : t('cancel')} active={pain} onPress={() => setPain(!pain)} />
          </Row>
          {pain ? <Small color={C.amber}>{t('pain_note')}</Small> : null}
          <Btn label={t('save')} onPress={() => finish(done ? 'done' : 'skipped')} />
        </Card>
      </Screen>
    );
  }

  // useWindowDimensions can report 0 on the first render, which would make the
  // ring radius negative and the SVG invalid.
  const size = Math.max(140, Math.min(260, width - 80));
  const stroke = 6;
  const rad = (size - stroke) / 2;
  const circ = 2 * Math.PI * rad;
  const total = stepSeconds(step);
  const pct = total > 0 ? left / total : 0;
  const isRest = step.kind === 'rest';
  const current = isRest ? step.nextExercise : step.exercise;
  const accent = isRest ? C.blue : C.teal;

  return (
    <Screen>
      <Bar value={progressAt(steps, index)} max={1} color={C.teal} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Small>
          {index + 1} / {steps.length}
        </Small>
        <Small>{Math.round(totalSeconds(steps) / 60)} min</Small>
      </Row>

      <Card tone={accent}>
        <View style={{ alignItems: 'center', gap: 14, paddingVertical: 10 }}>
          <Text style={{ color: accent, fontSize: F.small, letterSpacing: 1 }}>{isRest ? t('rest') : t('tab_fit')}</Text>
          <H2>{isRest ? `${t('next')}: ${name(current)}` : name(current)}</H2>

          {!isRest && step.kind === 'exercise' ? (
            <Small>
              {t('sets')} {step.setIndex + 1} / {step.totalSets}
              {step.reps ? ` · ${step.reps} ${t('reps')}` : ''}
            </Small>
          ) : null}

          <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
              <Circle cx={size / 2} cy={size / 2} r={rad} stroke={C.cardAlt} strokeWidth={stroke} fill="none" />
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={rad}
                stroke={accent}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${circ}`}
                strokeDashoffset={circ * (1 - pct)}
                strokeLinecap="round"
              />
            </Svg>
            <Text style={{ color: C.text, fontSize: size * 0.24, fontWeight: '200', letterSpacing: -2 }}>
              {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
            </Text>
          </View>

          <Row style={{ gap: 10 }}>
            <Btn
              small
              tone={running ? 'soft' : 'primary'}
              label={running ? t('stop') : t('start')}
              onPress={() => setRunning((x) => !x)}
              style={{ minWidth: 110 }}
            />
            <Btn small tone="ghost" label={t('next')} onPress={() => setIndex((i) => i + 1)} style={{ minWidth: 100 }} />
          </Row>
        </View>
      </Card>

      {!isRest ? (
        <Card>
          <H3>{name(current)}</H3>
          {instructions(current).map((line, i) => (
            <Row key={i} style={{ alignItems: 'flex-start' }}>
              <Text style={{ color: C.teal, fontSize: F.small, width: 16 }}>{i + 1}</Text>
              <P style={{ flex: 1 }}>{line}</P>
            </Row>
          ))}
          <Small color={C.amber}>{current.safety_en}</Small>
        </Card>
      ) : null}

      <Row style={{ gap: 10 }}>
        <Btn tone="ghost" label={t('finish')} onPress={() => setFinished(true)} style={{ flex: 1 }} />
        <Btn tone="ghost" label={t('cancel')} onPress={() => router.back()} style={{ flex: 1 }} />
      </Row>
    </Screen>
  );
}
