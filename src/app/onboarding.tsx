import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { AccessibilityInfo, Platform, Text, View } from 'react-native';
import { formatDayMonthYear } from '../core/date';
import { healthyWeightRange } from '../core/nutrition';
import { setupBlocks, setupNumber, setupProblems, setupTarget, type SetupField } from '../core/setup';
import type { Activity, Lang, Profile, Sex } from '../core/types';
import { fill, LANG_NAMES, latinDigits, makeT, numberText } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Bar, Btn, Card, Choice, Field, H1, H2, Micro, Row, Screen, Small } from '../ui/components';
import { C, F, lh } from '../ui/theme';

const STEPS = 4;

/**
 * Setup in four short steps with a line showing how far along it is: the
 * language; about you; weight and goal with the healthy range for the height;
 * and the daily target in plain words. Boxes start empty with an example in
 * grey; activity starts at "mostly sitting" and the pace at half a kilo a
 * week. Next checks the answers asked so far (core/setup.ts) and says what to
 * fix, so a button that does not move on always says why. Setup ends at the
 * permissions screen and then Today; the tour waits in Me → Guide.
 */
export default function Onboarding() {
  const app = useApp();
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(app.state.profile.lang);
  const t = makeT(lang);
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);

  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [birthYear, setBirthYear] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [goalWeightKg, setGoalWeightKg] = useState('');
  const [activity, setActivity] = useState<Activity>('sedentary');
  const [rate, setRate] = useState(0.5);

  const problems = setupProblems({ birthYear, height: heightCm, weight: weightKg, goal: goalWeightKg });
  // The last step has no boxes of its own, so any problem left shows there at once, beside the Start it holds back.
  const shown = tried || step === STEPS - 1 ? setupBlocks(problems, step) : [];
  const height = setupNumber(heightCm);
  const weight = setupNumber(weightKg);
  const range = height >= 120 && height <= 230 ? healthyWeightRange(height) : null;
  const draft: Profile = {
    name: name.trim(),
    sex,
    birthYear: Number(birthYear.trim()),
    heightCm: height,
    weightKg: weight,
    startWeightKg: weight,
    activity,
    goalWeightKg: setupNumber(goalWeightKg),
    rateKgPerWeek: rate,
    lang,
    onboarded: true,
    // Day one: no meal-time prompts until tomorrow.
    onboardedOn: app.today,
  };
  const target = problems.length === 0 ? setupTarget(draft, app.today) : null;
  const problemText: Record<SetupField, string> = {
    year: t('setup_bad_year'),
    height: t('setup_bad_height'),
    weight: t('setup_bad_weight'),
    goal: fill(t('setup_bad_goal'), { min: range?.min ?? 30 }),
  };
  const eg = (n: number) => fill(t('setup_eg'), { n });
  // Digits typed on a Marathi or Hindi keyboard are kept as the digits the rest of the app writes.
  const digits = (set: (v: string) => void) => (v: string) => set(latinDigits(v));

  function next() {
    const blocking = setupBlocks(problems, step);
    if (blocking.length > 0) {
      setTried(true);
      // Android and the web read the line below as it appears; iOS has no such region, so it is said aloud.
      if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(blocking.map((p) => problemText[p]).join(' '));
      return;
    }
    setTried(false);
    setStep((s) => Math.min(STEPS - 1, s + 1));
  }

  function back() {
    setTried(false);
    setStep((s) => Math.max(0, s - 1));
  }

  function finish() {
    if (problems.length > 0) return;
    app.setProfile(draft);
    app.addWeight({ date: app.today, kg: draft.weightKg });
    router.replace('/permissions');
  }

  return (
    <Screen>
      <View style={{ paddingTop: 36, gap: 8 }}>
        <H1>{t('app_name')}</H1>
        <Micro>{fill(t('setup_step'), { n: step + 1 })}</Micro>
        <Bar value={step + 1} max={STEPS} />
      </View>

      {step === 0 ? (
        <Card>
          <H2>{t('setup_lang_title')}</H2>
          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            {(Object.keys(LANG_NAMES) as Lang[]).map((l) => (
              <Choice key={l} label={LANG_NAMES[l]} on={lang === l} onPress={() => setLang(l)} />
            ))}
          </Row>
          <Small color={C.textDim}>{t('tagline')}</Small>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card>
          <H2>{t('setup_about_title')}</H2>
          <Field label={t('name_q')} value={name} onChangeText={setName} />
          <View style={{ gap: 7 }}>
            <Micro>{t('sex_q')}</Micro>
            <Row style={{ gap: 8, flexWrap: 'wrap' }}>
              <Choice label={t('male')} on={sex === 'male'} onPress={() => setSex('male')} />
              <Choice label={t('female')} on={sex === 'female'} onPress={() => setSex('female')} />
            </Row>
          </View>
          <Row style={{ gap: 12, alignItems: 'flex-end' }}>
            <Field label={t('birth_year_q')} value={birthYear} onChangeText={digits(setBirthYear)} keyboardType="numeric" placeholder={eg(1990)} />
            <Field label={t('height_q')} value={heightCm} onChangeText={digits(setHeightCm)} keyboardType="numeric" placeholder={eg(165)} />
          </Row>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <H2>{t('setup_weight_title')}</H2>
          <Row style={{ gap: 12, alignItems: 'flex-end' }}>
            <Field label={t('weight_q')} value={weightKg} onChangeText={digits(setWeightKg)} keyboardType="numeric" placeholder={eg(72)} />
            <Field label={t('goal_weight_q')} value={goalWeightKg} onChangeText={digits(setGoalWeightKg)} keyboardType="numeric" placeholder={eg(65)} />
          </Row>
          {range ? <Small color={C.textDim}>{fill(t('setup_range'), { min: range.min, max: range.max })}</Small> : null}
          <View style={{ gap: 7 }}>
            <Micro>{t('activity_q')}</Micro>
            <Row style={{ gap: 6, flexWrap: 'wrap' }}>
              {(['sedentary', 'light', 'moderate', 'active'] as Activity[]).map((a) => (
                <Choice key={a} label={t(a)} on={activity === a} onPress={() => setActivity(a)} />
              ))}
            </Row>
          </View>
          <View style={{ gap: 7 }}>
            <Micro>{t('rate_q')}</Micro>
            <Row style={{ gap: 6, flexWrap: 'wrap' }}>
              {[0.25, 0.5, 0.75, 1].map((r) => (
                <Choice key={r} label={`${r} ${t('unit_kg')}`} on={rate === r} onPress={() => setRate(r)} />
              ))}
            </Row>
          </View>
        </Card>
      ) : null}

      {step === 3 && target ? (
        <Card tone={C.accent}>
          <H2>{t('setup_done_title')}</H2>
          <Text style={{ color: C.text, fontSize: F.number, lineHeight: lh(F.number, true), fontWeight: '400', fontVariant: ['tabular-nums'] }}>
            {numberText(target.kcal)}
            <Text style={{ color: C.textDim, fontSize: F.title, fontWeight: '400' }}>{' kcal'}</Text>
          </Text>
          <Small color={C.text}>{fill(t('setup_target_line'), { kcal: numberText(target.kcal), protein: target.proteinG })}</Small>
          {target.hold ? (
            <Small color={C.textDim}>{t('setup_hold_line')}</Small>
          ) : target.reach ? (
            <Small color={C.textDim}>
              {fill(t('setup_goal_line'), { rate: target.reach.rateKg, goal: target.reach.goalKg, date: formatDayMonthYear(target.reach.date, lang) })}
            </Small>
          ) : null}
          {target.floored ? <Small color={C.amber}>{t('floor_note')}</Small> : null}
          <Micro color={C.textDim}>{t('medical_note')}</Micro>
        </Card>
      ) : null}

      <View>
        {/* Always there, even empty, so a screen reader hears a line as it appears. */}
        <View style={{ gap: 4, paddingBottom: shown.length > 0 ? 10 : 0 }} aria-live="polite">
          {shown.map((p) => (
            <Small key={p} color={C.amber}>
              {problemText[p]}
            </Small>
          ))}
        </View>
        <Row style={{ gap: 8 }}>
          {step > 0 ? <Btn tone="ghost" label={t('setup_back')} onPress={back} style={{ flex: 1 }} /> : null}
          {step < STEPS - 1 ? (
            <Btn label={t('next')} onPress={next} style={{ flex: 1 }} />
          ) : (
            <Btn label={t('finish_setup')} onPress={finish} disabled={problems.length > 0} style={{ flex: 1 }} />
          )}
        </Row>
      </View>
    </Screen>
  );
}
