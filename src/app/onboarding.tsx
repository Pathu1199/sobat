import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { bmiBand, dailyTargets, healthyWeightRange } from '../core/nutrition';
import type { Activity, Lang, Profile, Sex } from '../core/types';
import { LANG_NAMES, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Divider, Field, H1, H2, H3, P, Pill, Row, Screen, Small } from '../ui/components';
import { C, F } from '../ui/theme';

export default function Onboarding() {
  const app = useApp();
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(app.state.profile.lang);
  const t = makeT(lang);

  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [birthYear, setBirthYear] = useState('1998');
  const [heightCm, setHeightCm] = useState('172');
  const [weightKg, setWeightKg] = useState('100');
  const [goalWeightKg, setGoalWeightKg] = useState('80');
  const [activity, setActivity] = useState<Activity>('sedentary');
  const [rate, setRate] = useState(0.5);

  const draft: Profile = {
    name,
    sex,
    birthYear: Number(birthYear) || 1998,
    heightCm: Number(heightCm) || 170,
    weightKg: Number(weightKg) || 80,
    activity,
    goalWeightKg: Number(goalWeightKg) || 70,
    rateKgPerWeek: rate,
    lang,
    onboarded: true,
  };

  const targets = dailyTargets(draft);
  const range = healthyWeightRange(draft.heightCm);
  const valid = draft.heightCm >= 120 && draft.heightCm <= 230 && draft.weightKg >= 30 && draft.weightKg <= 300 && draft.goalWeightKg >= 30;

  function finish() {
    if (!valid) return;
    app.setProfile(draft);
    app.addWeight({ date: app.today, kg: draft.weightKg });
    router.replace('/permissions');
  }

  return (
    <Screen>
      <View style={{ paddingTop: 40, gap: 4 }}>
        <H1>{t('app_name')}</H1>
        <Small>{t('tagline')}</Small>
      </View>

      <Card>
        <H3>{t('language')}</H3>
        <Row style={{ gap: 8 }}>
          {(Object.keys(LANG_NAMES) as Lang[]).map((l) => (
            <Pill key={l} label={LANG_NAMES[l]} active={lang === l} onPress={() => setLang(l)} />
          ))}
        </Row>
      </Card>

      <Card>
        <H3>{t('onboarding_title')}</H3>
        <Field label={t('name_q')} value={name} onChangeText={setName} placeholder="Varad" />

        <View style={{ gap: 6 }}>
          <Small>{t('sex_q')}</Small>
          <Row style={{ gap: 8 }}>
            <Pill label={t('male')} active={sex === 'male'} onPress={() => setSex('male')} />
            <Pill label={t('female')} active={sex === 'female'} onPress={() => setSex('female')} />
          </Row>
        </View>

        <Row style={{ gap: 12 }}>
          <Field label={t('birth_year_q')} value={birthYear} onChangeText={setBirthYear} keyboardType="numeric" />
          <Field label={t('height_q')} value={heightCm} onChangeText={setHeightCm} keyboardType="numeric" />
        </Row>
        <Row style={{ gap: 12 }}>
          <Field label={t('weight_q')} value={weightKg} onChangeText={setWeightKg} keyboardType="numeric" />
          <Field label={t('goal_weight_q')} value={goalWeightKg} onChangeText={setGoalWeightKg} keyboardType="numeric" />
        </Row>

        <View style={{ gap: 6 }}>
          <Small>{t('activity_q')}</Small>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {(['sedentary', 'light', 'moderate', 'active'] as Activity[]).map((a) => (
              <Pill key={a} label={t(a)} active={activity === a} onPress={() => setActivity(a)} />
            ))}
          </Row>
        </View>

        <View style={{ gap: 6 }}>
          <Small>{t('rate_q')}</Small>
          <Row style={{ gap: 6 }}>
            {[0.25, 0.5, 0.75, 1].map((r) => (
              <Pill key={r} label={`${r} kg`} active={rate === r} onPress={() => setRate(r)} />
            ))}
          </Row>
        </View>
      </Card>

      <Card tone={C.teal}>
        <H2>{targets.kcal} kcal</H2>
        <Small>
          {t('target')} · {targets.proteinG} g {t('protein')}
        </Small>
        <Divider />
        <Row style={{ justifyContent: 'space-between' }}>
          <Small>{t('bmi_label')}</Small>
          <Small color={targets.band === 'normal' ? C.teal : C.amber}>
            {targets.bmi} ({targets.band})
          </Small>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Small>{t('healthy_range')}</Small>
          <Small>
            {range.min} - {range.max} kg
          </Small>
        </Row>
        {targets.floored ? <Small color={C.amber}>{t('floor_note')}</Small> : null}
        <Small color={C.textFaint}>{t('medical_note')}</Small>
      </Card>

      <Btn label={t('finish_setup')} onPress={finish} disabled={!valid} />
    </Screen>
  );
}
