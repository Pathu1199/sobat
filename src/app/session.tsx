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
import { BiText, Bar, Btn, Card, Divider, Micro, Pill, Row, Screen, SectionHeader, Small } from '../ui/components';
import { C, F, S } from '../ui/theme';

/** Walks through the session one set at a time, with a timer and rest. */
export default function SessionScreen() {
  const app = useApp();
  const router = useRouter();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const en = makeT('en');
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
          <Micro>{en('no_data_yet')}</Micro>
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
        <Card tone={C.accent}>
          <Micro color={C.accent}>{en(done ? 'session_complete' : 'session_stopped')}</Micro>
          <Text style={{ color: C.text, fontSize: 30, fontWeight: '300' }}>
            {reached}
            <Text style={{ color: C.textFaint, fontSize: F.h2 }}> / {session.exercises.length}</Text>
          </Text>
          <Micro>{`${Math.max(1, Math.round((Date.now() - startedAt.current) / 60000))} min`}</Micro>
          <Divider />
          <Micro>{en('how_did_it_feel')}</Micro>
          <Row style={{ gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pill key={n} label={`${n}`} active={felt === n} onPress={() => setFelt(n)} />
            ))}
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Micro>{en('any_pain')}</Micro>
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
  const accent = isRest ? C.cyan : C.accent;

  return (
    <Screen>
      <Bar value={progressAt(steps, index)} max={1} color={C.accent} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Micro>{`${index + 1} / ${steps.length}`}</Micro>
        <Micro>{`${Math.round(totalSeconds(steps) / 60)} min`}</Micro>
      </Row>

      <Card tone={accent}>
        <View style={{ alignItems: 'center', gap: 14, paddingVertical: 10 }}>
          <Micro color={accent}>{isRest ? en('rest') : current.category.replace('_', ' ')}</Micro>
          <BiText
            en={isRest ? `${en('next')}: ${current.name_en}` : current.name_en}
            alt={lang === 'en' ? undefined : name(current)}
            size={F.h2}
            weight="600"
          />

          {!isRest && step.kind === 'exercise' ? (
            <Micro>{`${en('sets')} ${step.setIndex + 1} / ${step.totalSets}${step.reps ? ` · ${step.reps} ${en('reps')}` : ''}`}</Micro>
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
        <View style={{ gap: 10 }}>
          <SectionHeader title={en('how_to')} />
          <Card>
            {instructions(current).map((line, i) => (
              <Row key={i} style={{ alignItems: 'flex-start', gap: 10 }}>
                <Text style={{ color: C.accent, fontSize: F.tiny, width: 12, marginTop: 3 }}>{i + 1}</Text>
                <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: 20, flex: 1 }}>{line}</Text>
              </Row>
            ))}
            <Divider />
            <Small color={C.amber}>{current.safety_en}</Small>
          </Card>
        </View>
      ) : null}

      <Row style={{ gap: 10 }}>
        <Btn tone="ghost" label={t('finish')} onPress={() => setFinished(true)} style={{ flex: 1 }} />
        <Btn tone="ghost" label={t('cancel')} onPress={() => router.back()} style={{ flex: 1 }} />
      </Row>
    </Screen>
  );
}
