import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { dayTiming, fmtDuration, LATE_HOUR } from '../core/timing';
import type { ISODate } from '../core/types';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, Micro, Row, Small } from '../ui/components';
import { C, F } from '../ui/theme';

/**
 * When the day's eating happened, not just how much. Shows once two meals
 * are in: the window from first to last, the longest gap, and whether dinner
 * ran late, with one line of plain advice for whichever did not hold.
 */
export function TimingCard({ date }: { date: ISODate }) {
  const { state } = useApp();
  const lang = state.profile.lang;
  const t = makeT(lang);
  const tm = useMemo(() => dayTiming(state.meals, date), [state.meals, date]);
  if (tm.meals < 2) return null;
  const color = tm.verdict === 'good' ? C.green : tm.verdict === 'both' ? C.red : C.amber;
  const advice =
    tm.verdict === 'good' ? t('timing_good') : tm.verdict === 'long' ? t('timing_long') : tm.verdict === 'late' ? fill(t('timing_late'), { h: LATE_HOUR }) : t('timing_both');
  return (
    <Card rail={color}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ gap: 6 }}>
          <Ionicons name="time-outline" size={16} color={color} />
          <Micro>{t('timing_title')}</Micro>
        </Row>
        <Micro color={color}>{t(`timing_v_${tm.verdict}`)}</Micro>
      </Row>
      <Row style={{ gap: 14, marginTop: 4 }}>
        <Stat label={t('timing_first')} value={tm.first ?? ''} />
        <Stat label={t('timing_last')} value={tm.last ?? ''} color={tm.lateDinner ? C.amber : undefined} />
        <Stat label={t('timing_window')} value={fmtDuration(tm.windowMinutes)} color={tm.windowMinutes > 12 * 60 ? C.amber : undefined} />
        <Stat label={t('timing_gap')} value={fmtDuration(tm.longestGapMinutes)} />
      </Row>
      <Small color={C.textDim}>{advice}</Small>
    </Card>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: C.textFaint, fontSize: F.tiny, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</Text>
      <Text style={{ color: color ?? C.text, fontSize: F.h3, fontWeight: '800' }}>{value}</Text>
    </View>
  );
}
