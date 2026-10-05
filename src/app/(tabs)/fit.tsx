import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { TopBarActions } from '../../components/TopBarActions';
import { formatDayLabel } from '../../core/date';
import { buildSession, phaseForWeek, phaseProgress, readiness, shouldEasePlan, weeksSince } from '../../core/fitness';
import { totalSeconds, buildSteps } from '../../core/session';
import type { Exercise } from '../../core/types';
import { fill, makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { BiText, Bar, Btn, Card, Divider, Micro, Pill, Ring, Row, SectionHeader, Small, StatQuad } from '../../ui/components';
import { C, F, readinessColor } from '../../ui/theme';
import { Cols } from '../../ui/tiles';
import { Page } from '../../ui/TopBar';
import { useBreakpoint } from '../../ui/useBreakpoint';

export default function FitScreen() {
  const app = useApp();
  const router = useRouter();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const en = makeT('en');
  const [open, setOpen] = useState<string | null>(null);

  const startDate = app.state.weights[0]?.date ?? app.today;
  const week = weeksSince(startDate, app.today);
  const phase = phaseForWeek(week);
  const prog = phaseProgress(week);
  const phaseLine = useMemo(
    () => (prog.phaseWeeks ? fill(t('phase_of'), { p: prog.phase, w: prog.weekInPhase, n: prog.phaseWeeks }) : `${t('phase_label')} ${prog.phase} · ${t('week_label')} ${week}`),
    [prog, t, week],
  );
  const wide = useBreakpoint() === 'desktop';

  const lastSleep = [...app.state.sleep].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0];
  const lastWorkout = [...app.state.workouts].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0];
  const moodToday = app.state.moods.filter((m) => m.date === app.today).slice(-1)[0];

  const r = useMemo(() => readiness({ lastSleep, lastWorkout, moodScore: moodToday?.score }), [lastSleep, lastWorkout, moodToday]);
  const eased = shouldEasePlan(app.state.workouts);
  const session = useMemo(() => buildSession(app.exercises, eased ? Math.max(1, week - 2) : week, r), [app.exercises, week, r, eased]);
  const steps = useMemo(() => buildSteps(session.exercises), [session.exercises]);

  const doneToday = app.state.workouts.find((w) => w.date === app.today);
  const doneCount = app.state.workouts.filter((w) => w.status === 'done').length;

  const name = (e: Exercise) => (lang === 'mr' ? e.name_mr : lang === 'hi' ? e.name_hi : e.name_en);
  const instructions = (e: Exercise) => (lang === 'mr' ? e.instructions_mr : lang === 'hi' ? e.instructions_hi : e.instructions_en);

  const hero = (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Micro>{`${en('readiness')} · ${en('period_today')}`}</Micro>
        <Micro color={readinessColor(r.level)}>{en(session.title)}</Micro>
      </Row>

      <Row style={{ gap: 20, alignItems: 'center' }}>
        <Ring value={r.score} max={100} size={96} stroke={6} color={readinessColor(r.level)}>
          <Text style={{ color: C.text, fontSize: 26, fontWeight: '300' }}>{r.score}</Text>
          <Micro>{en('readiness')}</Micro>
        </Ring>
        <View style={{ flex: 1, gap: 9 }}>
          <BiText en={en(session.title)} alt={lang === 'en' ? undefined : t(session.title)} size={F.h2} weight="600" />
          <Small>{t(session.note)}</Small>
          {r.reasons.length > 0 ? (
            <Row style={{ flexWrap: 'wrap', gap: 6 }}>
              {r.reasons.slice(0, 3).map((x) => (
                <Pill key={x} label={t(`reason_${x}`)} />
              ))}
            </Row>
          ) : null}
        </View>
      </Row>

      <Divider />
      <StatQuad
        items={[
          { label: en('week_label'), value: String(week) },
          { label: en('phase_label'), value: String(phase.phase) },
          { label: en('minutes'), value: String(Math.round(totalSeconds(steps) / 60)) },
          { label: en('moves'), value: String(session.exercises.length) },
        ]}
      />

      {eased ? <Small color={C.amber}>{en('plan_eased')}</Small> : null}

      <View style={{ gap: 6 }}>
        <Micro>{phaseLine}</Micro>
        {prog.phaseWeeks ? <Bar value={prog.weekInPhase} max={prog.phaseWeeks} color={C.accent} height={3} /> : null}
      </View>

      <Divider />
      {doneToday ? (
        <Row style={{ gap: 8 }}>
          <Ionicons
            name={doneToday.status === 'done' ? 'checkmark-circle' : 'remove-circle-outline'}
            size={17}
            color={doneToday.status === 'done' ? C.accent : C.textGhost}
          />
          <Small color={doneToday.status === 'done' ? C.accent : C.textFaint}>
            {doneToday.status === 'done' ? `${t('done')} · ${doneToday.minutes} min` : t('skip_session')}
          </Small>
        </Row>
      ) : (
        <Row style={{ gap: 8 }}>
          <Btn label={t('start_session')} onPress={() => router.push('/session')} style={{ flex: 1 }} />
          <Btn
            tone="ghost"
            label={t('skip_session')}
            onPress={() =>
              app.addWorkout({ id: app.today, date: app.today, exerciseIds: [], minutes: 0, status: 'skipped' })
            }
            style={{ flex: 1 }}
          />
        </Row>
      )}
    </Card>
  );

  const moves = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={en('todays_moves')} meta={`${session.exercises.length}`} />
      {session.exercises.map((e) => (
        <Card key={e.id}>
          <Pressable onPress={() => setOpen(open === e.id ? null : e.id)}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1, gap: 4 }}>
                <BiText en={e.name_en} alt={lang === 'en' ? undefined : name(e)} />
                <Micro>
                  {e.mode === 'time' ? `${e.default_seconds}s` : `${e.default_reps} ${en('reps')}`} · {e.default_sets} {en('sets')} ·{' '}
                  {en('rest')} {e.rest_seconds}s
                </Micro>
              </View>
              <Pill label={t(`cat_${e.category}`)} />
              <Ionicons name={open === e.id ? 'chevron-up' : 'chevron-down'} size={16} color={C.textFaint} />
            </Row>
          </Pressable>

          {open === e.id ? (
            <View style={{ gap: 9 }}>
              <Divider />
              {instructions(e).map((s, i) => (
                <Row key={i} style={{ alignItems: 'flex-start', gap: 10 }}>
                  <Text style={{ color: C.accent, fontSize: F.tiny, width: 12, marginTop: 3 }}>{i + 1}</Text>
                  <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: 19, flex: 1 }}>{s}</Text>
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
    </View>
  );

  const weekCard = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={en('week_summary')} meta={`${doneCount} ${en('total')}`} />
      <Card>
        <StatQuad
          items={[
            { label: en('workout_days_m'), value: String(doneCount) },
            { label: en('walk_target'), value: `${phase.walkMinutes}m` },
            { label: en('strength_days'), value: String(phase.strengthDays) },
            { label: en('phase_label'), value: String(phase.phase) },
          ]}
        />
      </Card>
    </View>
  );

  const history = (
    <View style={{ gap: 10 }}>
      <SectionHeader title={en('workout_days_m')} meta={`${doneCount} ${en('total')}`} />
      <Card>
        {[...app.state.workouts]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 10)
          .map((w, i) => (
            <View key={w.id}>
              {i > 0 ? <Divider /> : null}
              <Row style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
                <Small>{formatDayLabel(w.date, lang)}</Small>
                <Small color={w.status === 'done' ? C.accent : C.textFaint}>{w.status === 'done' ? `${t('done')} · ${w.minutes} min` : t('skip_session')}</Small>
              </Row>
            </View>
          ))}
        {app.state.workouts.length === 0 ? <Small color={C.textGhost}>{t('no_data_yet')}</Small> : null}
      </Card>
    </View>
  );

  if (wide) {
    return (
      <Page title={en('fit_title')} alt={lang === 'en' ? undefined : t('fit_title')} right={<TopBarActions />} wide>
        <Cols weights={[1.3, 1]}>
          <>
            {hero}
            {moves}
          </>
          <>
            {weekCard}
            {history}
            <Small color={C.textGhost}>{t('medical_note')}</Small>
          </>
        </Cols>
      </Page>
    );
  }

  return (
    <Page title={en('fit_title')} alt={lang === 'en' ? undefined : t('fit_title')} right={<TopBarActions />}>
      {hero}
      {moves}
      {weekCard}
      {history}
      <Small color={C.textGhost}>{t('medical_note')}</Small>
    </Page>
  );
}
