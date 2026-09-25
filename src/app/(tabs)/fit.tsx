import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { buildSession, phaseForWeek, readiness, shouldEasePlan, weeksSince } from '../../core/fitness';
import type { Exercise } from '../../core/types';
import { makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { Bar, Btn, Card, Divider, H2, H3, P, Pill, Ring, Row, Screen, Small } from '../../ui/components';
import { C, F, readinessColor } from '../../ui/theme';

export default function FitScreen() {
  const app = useApp();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const [open, setOpen] = useState<string | null>(null);

  const startDate = app.state.weights[0]?.date ?? app.today;
  const week = weeksSince(startDate, app.today);
  const phase = phaseForWeek(week);

  const lastSleep = [...app.state.sleep].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0];
  const lastWorkout = [...app.state.workouts].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0];
  const moodToday = app.state.moods.filter((m) => m.date === app.today).slice(-1)[0];

  const r = useMemo(
    () => readiness({ lastSleep, lastWorkout, moodScore: moodToday?.score }),
    [lastSleep, lastWorkout, moodToday],
  );

  const eased = shouldEasePlan(app.state.workouts);
  const session = useMemo(
    () => buildSession(app.exercises, eased ? Math.max(1, week - 2) : week, r),
    [app.exercises, week, r, eased],
  );

  const doneToday = app.state.workouts.find((w) => w.date === app.today);

  function complete(status: 'done' | 'skipped') {
    app.addWorkout({
      id: app.today,
      date: app.today,
      exerciseIds: session.exercises.map((e) => e.id),
      minutes: status === 'done' ? session.totalMinutes : 0,
      status,
    });
  }

  const name = (e: Exercise) => (lang === 'mr' ? e.name_mr : lang === 'hi' ? e.name_hi : e.name_en);
  const steps = (e: Exercise) => (lang === 'mr' ? e.instructions_mr : lang === 'hi' ? e.instructions_hi : e.instructions_en);

  return (
    <Screen>
      <Card>
        <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ gap: 4 }}>
            <H2>{t(session.title)}</H2>
            <Small>{t('readiness')} {r.score} · week {week} · phase {phase.phase}</Small>
            <Small>{session.totalMinutes} min · {session.exercises.length} moves</Small>
          </View>
          <Ring value={r.score} max={100} size={84} stroke={8} color={readinessColor(r.level)}>
            <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '600' }}>{r.score}</Text>
          </Ring>
        </Row>
        <P dim>{t(session.note)}</P>
        {r.reasons.length > 0 ? (
          <Row style={{ flexWrap: 'wrap', gap: 6 }}>
            {r.reasons.map((x) => (
              <Pill key={x} label={x.replace(/_/g, ' ')} />
            ))}
          </Row>
        ) : null}
        {eased ? <Small color={C.amber}>Plan eased after 3 missed days.</Small> : null}

        <Divider />
        {doneToday ? (
          <Small color={doneToday.status === 'done' ? C.teal : C.textFaint}>
            {doneToday.status === 'done' ? `${t('done')} · ${doneToday.minutes} min` : t('skip_session')}
          </Small>
        ) : (
          <Row style={{ gap: 8 }}>
            <Btn label={t('start_session')} onPress={() => complete('done')} style={{ flex: 1 }} />
            <Btn label={t('skip_session')} tone="ghost" onPress={() => complete('skipped')} style={{ flex: 1 }} />
          </Row>
        )}
      </Card>

      {session.exercises.map((e) => (
        <Card key={e.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <H3>{name(e)}</H3>
              <Small>
                {e.mode === 'time' ? `${e.default_seconds}${t('seconds')}` : `${e.default_reps} ${t('reps')}`} × {e.default_sets} {t('sets')} · {t('rest')} {e.rest_seconds}s
              </Small>
            </View>
            <Pill label={e.category.replace('_', ' ')} />
          </Row>
          <Btn small tone="ghost" label={open === e.id ? t('done') : t('why')} onPress={() => setOpen(open === e.id ? null : e.id)} />
          {open === e.id ? (
            <View style={{ gap: 6 }}>
              {steps(e).map((s, i) => (
                <Row key={i}>
                  <Text style={{ color: C.teal, fontSize: F.small }}>{i + 1}</Text>
                  <P style={{ flex: 1 }}>{s}</P>
                </Row>
              ))}
              <Small color={C.amber}>{e.safety_en}</Small>
              <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                {e.muscles.map((m) => (
                  <Pill key={m} label={m} />
                ))}
                <Pill label={e.equipment} />
                <Pill label={`${e.impact} impact`} />
              </Row>
            </View>
          ) : null}
        </Card>
      ))}

      <Card>
        <H3>{t('week_summary')}</H3>
        <Small>{t('workout_days')}: {app.state.workouts.filter((w) => w.status === 'done').length}</Small>
        <Bar value={phase.walkMinutes} max={35} color={C.teal} />
        <Small>Walking target this week: {phase.walkMinutes} min</Small>
      </Card>

      <Small color={C.textFaint}>{t('medical_note')}</Small>
    </Screen>
  );
}
