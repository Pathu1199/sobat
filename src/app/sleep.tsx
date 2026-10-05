import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { formatMinutes, localDate, localHHMM, minutesBetween } from '../core/date';
import { buildSleepLog, prefillAnswers, sleepDebt, sleepFlags, sleepScore } from '../core/sleep';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Divider, Field, H2, H3, Pill, Ring, Row, Screen, Small } from '../ui/components';
import { C, F } from '../ui/theme';

export default function SleepScreen() {
  const app = useApp();
  const router = useRouter();
  const lang = app.state.profile.lang;
  const t = makeT(lang);

  // Guess from the last thing logged yesterday and the first thing today.
  const guess = useMemo(() => {
    const all = [...app.state.meals.map((m) => m.at), ...app.state.water.map((w) => w.at), ...app.state.moods.map((m) => m.at)].sort();
    const yesterdayLast = all.filter((a) => localDate(a) < app.today).slice(-1)[0];
    const todayFirst = all.filter((a) => localDate(a) === app.today)[0];
    return prefillAnswers(yesterdayLast ? localHHMM(yesterdayLast) : null, todayFirst ? localHHMM(todayFirst) : null);
  }, [app.state.meals, app.state.water, app.state.moods, app.today]);

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
    app.addSleep(buildSleepLog(app.today, { bed, wake, quality, wakeups, energy }));
    router.back();
  }

  return (
    <Screen>
      <Card>
        <H2>{t('sleep_checkin')}</H2>
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
            <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '600' }}>{score}</Text>
          </Ring>
          <View>
            <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '600' }}>{formatMinutes(minutes)}</Text>
            <Small>{t('sleep_score')}</Small>
          </View>
        </Row>

        <Btn label={t('save_sleep')} onPress={save} />
      </Card>

      {low ? (
        <Card tone={C.amber}>
          <H3>{t('sleep_quality')}</H3>
          <Small>Caffeine after 6pm? Phone in bed? Late heavy dinner? Any one of these is usually the cause.</Small>
        </Card>
      ) : null}

      {app.state.sleep.length > 0 ? (
        <Card>
          <H3>{t('sleep_debt')}</H3>
          <Small color={debt < -180 ? C.amber : C.textDim}>
            {debt >= 0 ? '+' : ''}
            {Math.round(debt / 60)}h over the last 7 nights
          </Small>
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
                <Small color={s.score >= 70 ? C.accent : C.textDim}>{s.score}</Small>
              </Row>
            ))}
        </Card>
      ) : null}
    </Screen>
  );
}
