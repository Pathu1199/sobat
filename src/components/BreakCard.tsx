import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { breakStats } from '../core/breaks';
import { formatMinutes } from '../core/date';
import { longestStretchMinutes, minutesOn } from '../core/usage';
import { makeT } from '../i18n';
import { useBreakMonitor } from '../services/useBreakMonitor';
import { useApp } from '../store/AppProvider';
import { Bar, Card, H3, Row, Small } from '../ui/components';
import { C, F } from '../ui/theme';

/** Shows how long until the next pause, and how the day has gone so far. */
export function BreakCard() {
  const app = useApp();
  const monitor = useBreakMonitor();
  const t = makeT(app.state.profile.lang);

  const todayBreaks = app.state.breaks.filter((b) => b.date === app.today);
  const stats = breakStats(todayBreaks);
  const screen = minutesOn(app.state.usage, app.today);
  const sitting = longestStretchMinutes(app.state.usage, app.today);

  const left = Number.isFinite(monitor.minutesLeft) ? Math.ceil(monitor.minutesLeft) : 0;
  const elapsed = monitor.workMinutes - left;

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ gap: 8 }}>
          <Ionicons name="timer-outline" size={18} color={C.accent} />
          <H3>{t('break_monitor')}</H3>
        </Row>
        <Small color={C.textFaint}>{formatMinutes(screen)}</Small>
      </Row>

      {monitor.enabled ? (
        <>
          <Row style={{ alignItems: 'flex-end', gap: 6 }}>
            <Text style={{ color: C.text, fontSize: 30, fontWeight: '200' }}>{left}</Text>
            <Text style={{ color: C.textDim, fontSize: F.small, marginBottom: 6 }}>
              {t('minutes')} · {t('break_next').toLowerCase()}
            </Text>
          </Row>
          <Bar value={elapsed} max={monitor.workMinutes} color={left <= 1 ? C.amber : C.accent} />
        </>
      ) : (
        <Small color={C.textFaint}>{t('break_off')}</Small>
      )}

      <Row style={{ justifyContent: 'space-between' }}>
        <Small>{t('break_compliance')}</Small>
        <Small color={stats.compliancePct >= 60 ? C.accent : C.textDim}>
          {stats.taken} / {todayBreaks.length || 0}
        </Small>
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <Small>{t('longest_sitting')}</Small>
        <Small color={sitting >= 120 ? C.amber : C.textDim}>{formatMinutes(sitting)}</Small>
      </Row>

      {monitor.suggestion ? (
        <Small color={C.amber}>
          {t('break_every')} {monitor.suggestion} {t('minutes')}?
        </Small>
      ) : null}
    </Card>
  );
}
