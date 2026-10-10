import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatDayLabel } from '../core/date';
import { planFrom, planVerdict } from '../core/plan';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Btn, Divider, Field, Micro, Pill, Row, Small } from '../ui/components';
import { Sheet } from '../ui/Sheet';
import { C, F } from '../ui/theme';

const RATES = [0.25, 0.5, 0.75, 1];

/**
 * The weight, properly: today's reading (or the last one carried forward),
 * the recent readings to correct or remove, what has changed, whether the
 * plan is working in plain words with one change to make, and the goal and
 * pace to adjust when it is not.
 */
export function WeightSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const app = useApp();
  const router = useRouter();
  const fb = useFeedback();
  const { state, targets, today } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const [kg, setKg] = useState('');
  const [goal, setGoal] = useState(String(state.profile.goalWeightKg));

  const sorted = useMemo(() => [...state.weights].sort((a, b) => b.date.localeCompare(a.date)), [state.weights]);
  const todayEntry = sorted.find((w) => w.date === today);
  const last = sorted[0];
  const plan = useMemo(() => planFrom(state.profile, state.weights, targets, today), [state.profile, state.weights, targets, today]);
  const verdict = planVerdict(plan);
  const value = parseFloat(kg);
  const valid = Number.isFinite(value) && value >= 25 && value <= 350;

  function save() {
    if (!valid) return;
    app.addWeight({ date: today, kg: value });
    setKg('');
    fb.haptic('success');
    fb.notify(`${value} ${t('unit_kg')}`);
  }

  function saveGoal(v: string) {
    setGoal(v);
    const n = parseFloat(v);
    if (Number.isFinite(n) && n >= 30 && n <= 300) app.setProfile({ goalWeightKg: n });
  }

  const tone = verdict === 'working' ? C.green : verdict === 'early' ? C.textDim : verdict === 'slow' ? C.amber : C.red;

  return (
    <Sheet open={open} title={t('weight_title')} onClose={onClose}>
      {/* Today */}
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <Micro>{todayEntry ? t('today_short') : t('weight_carried')}</Micro>
          <Text style={{ color: C.text, fontSize: F.display - 8, fontWeight: '700', letterSpacing: -1 }}>
            {last ? last.kg : state.profile.weightKg}
            <Text style={{ color: C.textFaint, fontSize: F.small, fontWeight: '500', letterSpacing: 0 }}> {t('unit_kg')}</Text>
          </Text>
        </View>
        {last && !todayEntry ? <Small color={C.textFaint}>{formatDayLabel(last.date, lang)}</Small> : null}
      </Row>
      <Row style={{ gap: 10 }}>
        <Field value={kg} onChangeText={setKg} keyboardType="numeric" placeholder={todayEntry ? `${todayEntry.kg}` : t('weight_enter')} />
        <Btn label={todayEntry ? t('edit') : t('save')} onPress={save} disabled={!valid} />
      </Row>

      {/* Change */}
      <Divider />
      <Row style={{ gap: 18 }}>
        <Stat label={t('plan_lost')} value={`${plan.lostKg}`} color={plan.lostKg > 0 ? C.cyan : C.text} />
        <Stat label={t('plan_to_go')} value={`${plan.toGoKg}`} />
        <Stat label={t('weight_pace')} value={plan.actualRate === null ? '—' : `${plan.actualRate}`} sub={`/ ${plan.targetRate}`} color={tone} />
      </Row>

      {/* Verdict */}
      <View style={{ backgroundColor: C.cardAlt, borderRadius: 14, padding: 14, gap: 6, borderLeftWidth: 2, borderLeftColor: tone }}>
        <Row style={{ gap: 8 }}>
          <Ionicons name={verdict === 'working' ? 'checkmark-circle' : verdict === 'early' ? 'hourglass-outline' : 'alert-circle-outline'} size={16} color={tone} />
          <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600' }}>{t(`verdict_${verdict}`)}</Text>
        </Row>
        <Small>{fill(t(`verdict_${verdict}_do`), { rate: plan.targetRate, actual: plan.actualRate ?? 0, kcal: plan.dailyKcal })}</Small>
        {verdict !== 'early' && verdict !== 'working' ? (
          <Btn small tone="soft" label={t('ask_coach_why')} onPress={() => { onClose(); router.push('/coach?ask=stall'); }} />
        ) : null}
      </View>

      {/* Plan */}
      <Divider />
      <Micro>{t('plan_change')}</Micro>
      <Row style={{ gap: 10, alignItems: 'flex-end' }}>
        <Field label={t('goal_weight_q')} value={goal} onChangeText={saveGoal} keyboardType="numeric" />
      </Row>
      <Micro>{t('rate_q')}</Micro>
      <Row style={{ gap: 6, flexWrap: 'wrap' }}>
        {RATES.map((r) => (
          <Pill key={r} label={`${r} ${t('unit_kg')}/${t('week_short')}`} active={state.profile.rateKgPerWeek === r} onPress={() => app.setProfile({ rateKgPerWeek: r })} />
        ))}
      </Row>
      <Small color={C.textFaint}>{fill(t('plan_daily'), { kcal: targets.kcal, p: targets.proteinG })}</Small>

      {/* History */}
      {sorted.length > 0 ? (
        <>
          <Divider />
          <Micro>{t('weight_history')}</Micro>
          {sorted.slice(0, 8).map((w) => (
            <Row key={w.date} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
              <Small>{formatDayLabel(w.date, lang)}</Small>
              <Row style={{ gap: 14 }}>
                <Text style={{ color: C.text, fontSize: F.small, fontWeight: '600' }}>{`${w.kg} ${t('unit_kg')}`}</Text>
                <Pressable
                  onPress={() => {
                    app.removeWeight(w.date);
                    fb.notify(t('weight_removed'), { label: t('undo'), onPress: () => app.addWeight(w) });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('delete')}
                  style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? C.redSoft : 'transparent' })}>
                  <Ionicons name="trash-outline" size={18} color={C.textFaint} />
                </Pressable>
              </Row>
            </Row>
          ))}
        </>
      ) : null}
    </Sheet>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={{ gap: 3, minWidth: 64 }}>
      <Micro>{label}</Micro>
      <Text style={{ color: color ?? C.text, fontSize: F.h2, fontWeight: '700', letterSpacing: -0.5 }}>
        {value}
        {sub ? <Text style={{ color: C.textFaint, fontSize: F.small, fontWeight: '500' }}> {sub}</Text> : null}
      </Text>
    </View>
  );
}
