import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useGame } from '../components/MountainCard';
import { BADGE_ICON } from '../core/game';
import { WeightSheet } from '../components/WeightSheet';
import { formatDayLabel } from '../core/date';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Bar, Card, Divider, Micro, Pill, Row, Screen, SectionHeader, Small } from '../ui/components';
import { Mountain } from '../ui/Mountain';
import { C, F } from '../ui/theme';

/** The whole climb: the mountain, the camps, every weigh-in, the level, the week's challenge and every badge. */
export default function Journey() {
  const app = useApp();
  const router = useRouter();
  const { state } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const g = useGame();
  const [weighOpen, setWeighOpen] = useState(false);
  const weights = [...state.weights].sort((a, b) => b.date.localeCompare(a.date));
  const earned = g.badges.filter((b) => b.earned);

  return (
    <Screen>
      <Card rail={C.cyan}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Micro color={C.textDim}>{t('journey_title')}</Micro>
          <Pill label={`⛰ ${t(`level_${g.level.key}`)}`} color={C.cardAlt} textColor={C.cyan} />
        </Row>
        <Mountain tall progress={g.progress} startLabel={`${g.plan.startKg} kg`} nowLabel={`${g.plan.currentKg} kg`} goalLabel={`${g.plan.goalKg} kg`} camps={g.camps} trail={g.trail} />
        <Row style={{ gap: 18 }}>
          <Stat label={t('plan_lost')} value={`${g.plan.lostKg}`} unit="kg" color={C.cyan} />
          <Stat label={t('plan_to_go')} value={`${g.plan.toGoKg}`} unit="kg" />
          <Stat label={t('plan_goal')} value={`${g.plan.goalKg}`} unit="kg" />
        </Row>
        <View style={{ gap: 4 }}>
          {g.plan.etaAtTarget && g.plan.toGoKg > 0 ? <Small>{fill(t('plan_goal_by'), { d: formatDayLabel(g.plan.etaAtTarget, lang), r: g.plan.targetRate })}</Small> : null}
          {g.plan.toGoKg > 0 && g.plan.actualRate !== null && g.plan.etaAtActual ? <Small color={C.textDim}>{fill(t('plan_actual'), { d: formatDayLabel(g.plan.etaAtActual, lang), r: g.plan.actualRate })}</Small> : null}
          <Small color={C.textDim}>{fill(t('plan_daily'), { kcal: g.plan.dailyKcal, p: g.plan.proteinG })}</Small>
          <Small color={C.textFaint}>{fill(t('journey_weigh_hint'), { day: t(`wd_${state.settings.weighDay}`) })}</Small>
        </View>
        <Pressable onPress={() => setWeighOpen(true)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="scale-outline" size={16} color={C.accent} />
          <Small color={C.accent}>{t('journey_add_weight')}</Small>
        </Pressable>
      </Card>

      <SectionHeader title={t('level_title')} icon={<Ionicons name="flag-outline" size={13} color={C.textFaint} />} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '600' }}>{t(`level_${g.level.key}`)}</Text>
          <Micro>{g.level.next ? `${g.points} / ${g.level.next} ${t('xp')}` : `${g.points} ${t('xp')}`}</Micro>
        </Row>
        <Bar value={g.level.progress * 100} max={100} color={C.amber} />
        <Micro color={C.textFaint}>{t('xp_how')}</Micro>
      </Card>

      <SectionHeader title={t('challenge_week')} icon={<Ionicons name="trophy-outline" size={13} color={C.textFaint} />} />
      <Card rail={g.challenge.done ? C.green : undefined}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600', flex: 1 }}>{fill(t(`challenge_${g.challenge.key}`), { n: g.challenge.target })}</Text>
          <Micro color={g.challenge.done ? C.green : C.textDim}>{g.challenge.done ? t('challenge_done') : `${g.challenge.n}/${g.challenge.target}`}</Micro>
        </Row>
        <Bar value={g.challenge.n} max={g.challenge.target} color={g.challenge.done ? C.green : C.accent} />
        <Micro color={C.textFaint}>{fill(t('challenge_days_left'), { n: g.challenge.daysLeft })}</Micro>
      </Card>

      <SectionHeader title={t('badges')} meta={`${earned.length}/${g.badges.length}`} icon={<Ionicons name="medal-outline" size={13} color={C.textFaint} />} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {g.badges.map((b) => (
          <View key={b.key} style={{ flexBasis: '47%', flexGrow: 1 }}>
            <Card>
              <Row style={{ gap: 10, alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 22, opacity: b.earned ? 1 : 0.35 }}>{BADGE_ICON[b.key] ?? '🏅'}</Text>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: b.earned ? C.text : C.textDim, fontSize: F.small, fontWeight: '600' }}>{t(`badge_${b.key}`)}</Text>
                  {b.earned ? <Micro color={C.green}>{t('badge_earned')}</Micro> : <Bar value={b.n} max={b.target} color={C.textGhost} height={3} />}
                  {!b.earned ? <Micro color={C.textFaint}>{`${b.n}/${b.target}`}</Micro> : null}
                </View>
              </Row>
            </Card>
          </View>
        ))}
      </View>

      <SectionHeader title={t('weigh_history')} meta={`${weights.length}`} icon={<Ionicons name="scale-outline" size={13} color={C.textFaint} />} />
      <Card>
        {weights.length === 0 ? <Small color={C.textFaint}>{t('weigh_history_empty')}</Small> : null}
        {weights.slice(0, 12).map((w, i) => {
          const prev = weights[i + 1];
          const diff = prev ? Math.round((w.kg - prev.kg) * 10) / 10 : null;
          return (
            <React.Fragment key={w.date}>
              {i > 0 ? <Divider /> : null}
              <Row style={{ justifyContent: 'space-between' }}>
                <Small>{formatDayLabel(w.date, lang)}</Small>
                <Row style={{ gap: 10 }}>
                  {diff !== null ? <Micro color={diff < 0 ? C.green : diff > 0 ? C.amber : C.textFaint}>{`${diff > 0 ? '+' : ''}${diff}`}</Micro> : null}
                  <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600' }}>{`${w.kg} kg`}</Text>
                </Row>
              </Row>
            </React.Fragment>
          );
        })}
      </Card>

      <Pressable onPress={() => router.push('/growth')} style={{ alignSelf: 'center', paddingVertical: 6 }}>
        <Micro color={C.accent}>{`${t('growth')} ›`}</Micro>
      </Pressable>
      <WeightSheet open={weighOpen} onClose={() => setWeighOpen(false)} />
    </Screen>
  );
}


function Stat({ label, value, unit, color }: { label: string; value: string; unit: string; color?: string }) {
  return (
    <View style={{ gap: 3, minWidth: 64 }}>
      <Micro>{label}</Micro>
      <Text style={{ color: color ?? C.text, fontSize: F.h2, fontWeight: '700', letterSpacing: -0.5 }}>
        {value}
        <Text style={{ color: C.textFaint, fontSize: F.small, fontWeight: '500' }}> {unit}</Text>
      </Text>
    </View>
  );
}
