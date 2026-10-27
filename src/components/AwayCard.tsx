import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { daysAway } from '../core/reminders';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Row, Small } from '../ui/components';
import { C, F } from '../ui/theme';

const SEEN = 'away_seen';

/** After two or more days without a log: a plain welcome back, no backfill asked for. Gone for the day once dismissed. */
export function AwayCard() {
  const app = useApp();
  const router = useRouter();
  const t = makeT(app.state.profile.lang);
  const days = daysAway(app.state.meals, app.today, app.state.settings.offDays ?? []);
  if (days < 2 || app.actionsDoneToday.includes(SEEN)) return null;
  return (
    <Card rail={C.amber}>
      <Row style={{ gap: 10, alignItems: 'flex-start' }}>
        <Ionicons name="leaf-outline" size={20} color={C.amber} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: C.text, fontSize: F.title, fontWeight: '500' }}>{fill(t('away_title'), { n: days })}</Text>
          <Small color={C.textDim}>{t('away_body')}</Small>
        </View>
      </Row>
      <Row style={{ gap: 8 }}>
        <Btn small label={t('add_food')} icon={<Ionicons name="add" size={14} color={C.onAccent} />} onPress={() => router.push('/log')} style={{ flex: 1 }} />
        <Btn small tone="ghost" label={t('away_ok')} onPress={() => app.toggleAction(SEEN)} style={{ flex: 1 }} />
      </Row>
    </Card>
  );
}
