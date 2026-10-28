import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useGame } from '../../components/useGame';
import { NutrientCard } from '../../components/NutrientCard';
import { RecordCalendar } from '../../components/RecordCalendar';
import { StreakTile } from '../../components/tiles/StreakTile';
import { TileRow } from '../../components/tiles/TileRow';
import { WeightTile } from '../../components/tiles/WeightTile';
import { TopBarActions } from '../../components/TopBarActions';
import { WeightTrendCard } from '../../components/WeightTrendCard';
import { mondayOf, weekDates } from '../../core/date';
import { fullDays, oldProgressLink, recentIntake } from '../../core/progress';
import { lostWords, oneDecimal } from '../../core/tileText';
import { stripSince } from '../../core/weekStrip';
import { fill, makeT, numberText } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { useRecordOn } from '../../store/useRecordOn';
import { Bar, Btn, Card, Divider, Micro, Row, Small, StatQuad } from '../../ui/components';
import { Sheet } from '../../ui/Sheet';
import { C, F, lh, S } from '../../ui/theme';
import { Page } from '../../ui/TopBar';

/**
 * Progress. Its old sections are pages of their own now: an older link that
 * names the coach or the charts (?s=) goes there, and the link is cleared
 * first, so coming back to Progress later never sends the person off again.
 */
export default function ProgressTab() {
  const navigation = useNavigation<{ setParams: (params: { s?: string }) => void }>();
  const router = useRouter();
  const { s } = useLocalSearchParams<{ s?: string | string[] }>();
  const target = oldProgressLink(s);
  const linked = s !== undefined;
  useEffect(() => {
    if (!linked) return;
    // After this commit: on a cold load the web address follows the navigation only after the screens' first effects.
    const id = setTimeout(() => {
      navigation.setParams({ s: undefined });
      if (target) router.replace(target);
    }, 0);
    return () => clearTimeout(id);
  }, [linked, target, navigation, router]);
  return target ? null : <Progress />;
}

/**
 * Five blocks: the Weight and Streak tiles; the weight trend with the goal's
 * date; Lost, To go and this week's full days; the record calendar; and one
 * card with the last seven days' average against the goal, today's
 * nutrition a tap away, the climb as one row (the mountain and every badge
 * on the climb page) and History and Charts as links.
 */
function Progress() {
  const app = useApp();
  const router = useRouter();
  const g = useGame();
  const { state, targets, today } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const [nutrition, setNutrition] = useState(false);
  const since = stripSince(state.profile, state.meals, today);
  const recordOn = useRecordOn();
  const full = useMemo(() => fullDays(weekDates(mondayOf(today)), recordOn, today, since), [recordOn, today, since]);
  // Every complete day, meals all skipped too; free days, days with meals missing and days before the start left out; calories as logged.
  const intake = useMemo(() => recentIntake({ today, since, meals: state.meals, recordOn }), [today, since, state.meals, recordOn]);
  const kg = t('unit_kg');
  const lost = lostWords(g.plan.lostKg);
  const earned = g.badges.filter((b) => b.earned).length;
  const level = t(`level_${g.level.key}`);
  const points = fill(t('points_n'), { n: g.points });
  const badges = fill(t('progress_badges'), { n: earned, of: g.badges.length });
  const avgOff = intake !== null && Math.abs(intake.avg - targets.kcal) > targets.kcal * 0.05;
  const strong = { color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' } as const;

  return (
    <Page title={t('tab_progress')} alt={lang === 'en' ? undefined : t('tab_progress')} right={<TopBarActions />}>
      {/* On Progress the Streak tile is only the tile: a tap here would open the page it is on. */}
      <TileRow>
        <WeightTile />
        <StreakTile />
      </TileRow>

      <WeightTrendCard />

      <Card>
        <StatQuad
          items={[
            { label: t(lost.key), value: `${lost.kg} ${kg}`, color: g.plan.lostKg > 0 ? C.green : undefined },
            { label: t('plan_to_go'), value: `${oneDecimal(g.plan.toGoKg)} ${kg}` },
            { label: t('progress_logged'), value: fill(t('progress_logged_value'), { n: full.n, m: full.of }) },
          ]}
        />
      </Card>

      <RecordCalendar />

      <Card>
        <Small color={avgOff ? C.amber : C.textDim}>
          {intake ? fill(t('progress_avg'), { avg: numberText(intake.avg), goal: numberText(targets.kcal) }) : t('progress_avg_none')}
        </Small>
        <Pressable
          onPress={() => setNutrition(true)}
          accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: S.touch, opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="nutrition-outline" size={20} color={C.violet} />
          <Text style={[strong, { flex: 1 }]}>{t('nutrition_today')}</Text>
          <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
        </Pressable>
        <Divider />
        <Pressable
          onPress={() => router.push('/journey')}
          accessibilityRole="button"
          accessibilityLabel={fill(t('progress_climb_a11y'), { climb: t('journey_title'), level, points, badges })}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="flag-outline" size={20} color={C.cyan} />
          <View style={{ flex: 1, gap: 6 }}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <Text style={strong}>{t('journey_title')}</Text>
              <Micro color={C.textDim}>{`${level} · ${points}`}</Micro>
            </Row>
            <Bar value={g.progress * 100} max={100} color={C.cyan} />
            <Micro color={C.textDim}>{badges}</Micro>
          </View>
          <Ionicons name="chevron-forward" size={16} color={C.textFaint} />
        </Pressable>
        <Divider />
        <Row style={{ gap: 8 }}>
          <Btn small tone="ghost" label={t('history')} onPress={() => router.push('/history')} style={{ flex: 1 }} />
          <Btn small tone="ghost" label={t('charts')} onPress={() => router.push('/growth')} style={{ flex: 1 }} />
        </Row>
      </Card>

      <Sheet open={nutrition} title={t('nutrition_today')} onClose={() => setNutrition(false)}>
        <NutrientCard bare onNavigate={() => setNutrition(false)} />
      </Sheet>
    </Page>
  );
}
