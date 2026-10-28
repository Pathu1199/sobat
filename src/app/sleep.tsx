import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { formatDayLabel, formatMinutes, localDate, localHHMM, minutesBetween } from '../core/date';
import { buildSleepLog, prefillAnswers, sleepDay, sleepDebt, sleepFlags, sleepScore } from '../core/sleep';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Divider, Field, H2, H3, Pill, Ring, Row, Screen, Small } from '../ui/components';
import { C, F } from '../ui/theme';

/**
 * The sleep check-in. As its own page, saving goes back; inside a tab
 * (`embedded`), it stays and says it was saved. It is for today, or for the
 * earlier day a link names (`?date=`, from the Sleep tile on a past day).
 */
export default function SleepScreen({ embedded }: { embedded?: boolean } = {}) {
  const app = useApp();
  const router = useRouter();
  const fb = useFeedback();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const { date } = useLocalSearchParams<{ date?: string }>();
  const day = sleepDay(date, app.today);

  // Guess from the last thing logged the day before and the first thing on the day.
  const guess = useMemo(() => {
    const all = [...app.state.meals.map((m) => m.at), ...app.state.water.map((w) => w.at), ...app.state.moods.map((m) => m.at)].sort();
    const dayBeforeLast = all.filter((a) => localDate(a) < day).slice(-1)[0];
    const dayFirst = all.filter((a) => localDate(a) === day)[0];
    return prefillAnswers(dayBeforeLast ? localHHMM(dayBeforeLast) : null, dayFirst ? localHHMM(dayFirst) : null);
  }, [app.state.meals, app.state.water, app.state.moods, day]);

  const [bed, setBed] = useState(guess.bed);
  const [wake, setWake] = useState(guess.wake);
  const [quality, setQuality] = useState(3);
  const [wakeups, setWakeups] = useState(0);
  const [energy, setEnergy] = useState(3);

  const minutes = minutesBetween(bed, wake);
  const score = sleepScore({ bed, wake, quality, wakeups, energy });
  const debt = sleepDebt(app.state.sleep);
  const flags = sleepFlags(app.state.sleep);
  const low = score < 55;

  function save() {
    app.addSleep(buildSleepLog(day, { bed, wake, quality, wakeups, energy }));
    if (embedded) {
      // Going back from a tab would leave it for another tab, so the check-in stays on screen.
      fb.haptic('success');
      fb.notify(t('toast_sleep_saved'));
    } else {
      router.back();
    }
  }

  return (
    <Screen>
      <Card>
        <H2>{t('sleep_checkin')}</H2>
        {day !== app.today ? <Small color={C.text}>{formatDayLabel(day, lang)}</Small> : null}
        <Small>{t('sleep_prefill_hint')}</Small>

        <Row style={{ gap: 12 }}>
          <Field label={t('bed_time')} value={bed} onChangeText={setBed} placeholder="23:00" />
          <Field label={t('wake_time')} value={wake} onChangeText={setWake} placeholder="07:00" />
        </Row>

        <View style={{ gap: 6 }}>
          <Small>{t('sleep_quality')}</Small>
          <Row style={{ gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pill key={n} label={`${n}`} active={quality === n} onPress={() => setQuality(n)} />
            ))}
          </Row>
        </View>

        <View style={{ gap: 6 }}>
          <Small>{t('wakeups')}</Small>
          <Row style={{ gap: 6 }}>
            {[0, 1, 2, 3, 4].map((n) => (
              <Pill key={n} label={`${n}`} active={wakeups === n} onPress={() => setWakeups(n)} />
            ))}
          </Row>
        </View>

        <View style={{ gap: 6 }}>
          <Small>{t('energy_now')}</Small>
          <Row style={{ gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pill key={n} label={`${n}`} active={energy === n} onPress={() => setEnergy(n)} />
            ))}
          </Row>
        </View>

        <Divider />
        <Row style={{ justifyContent: 'space-around', alignItems: 'center' }}>
          <Ring value={score} max={100} size={90} stroke={8} color={score >= 70 ? C.accent : score >= 45 ? C.amber : C.red}>
            <Text style={{ color: C.text, fontSize: F.title, fontWeight: '500' }}>{score}</Text>
          </Ring>
          <View>
            <Text style={{ color: C.text, fontSize: F.title, fontWeight: '500' }}>{formatMinutes(minutes)}</Text>
            <Small>{t('sleep_score')}</Small>
          </View>
        </Row>

        <Btn label={t('save_sleep')} onPress={save} />
      </Card>

      {low ? (
        <Card tone={C.amber}>
          <H3>{t('sleep_quality')}</H3>
          <Small>{t('sleep_low_causes')}</Small>
        </Card>
      ) : null}

      {app.state.sleep.length > 0 ? (
        <Card>
          <H3>{t('sleep_debt')}</H3>
          <Small color={debt < -180 ? C.amber : C.textDim}>{fill(t('sleep_debt_week'), { h: `${debt >= 0 ? '+' : ''}${Math.round(debt / 60)}` })}</Small>
          {flags.map((f) => (
            <Small key={f} color={f === 'apnea_screen' ? C.amber : C.textDim}>
              {t(`flag_${f}`)}
            </Small>
          ))}
          <Divider />
          {[...app.state.sleep]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 7)
            .map((s) => (
              <Row key={s.date} style={{ justifyContent: 'space-between' }}>
                <Small>{s.date}</Small>
                <Small>{formatMinutes(s.minutes)}</Small>
                <Small color={s.score >= 70 ? C.accentText : C.textDim}>{s.score}</Small>
              </Row>
            ))}
        </Card>
      ) : null}
    </Screen>
  );
}
