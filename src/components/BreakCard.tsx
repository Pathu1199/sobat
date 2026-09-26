import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { breakStats } from '../core/breaks';
import { formatMinutes } from '../core/date';
import { longestStretchMinutes, minutesOn } from '../core/usage';
import { makeT } from '../i18n';
import { useBreakMonitor } from '../services/useBreakMonitor';
import { useApp } from '../store/AppProvider';
import { Bar, Card, Micro, Row, Small } from '../ui/components';
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
          <Ionicons name="timer-outline" size={15} color={C.accent} />
          <Micro color={C.accent}>{t('break_monitor')}</Micro>
        </Row>
        <Micro>{formatMinutes(screen)}</Micro>
      </Row>

      {monitor.enabled ? (
        <>
          <Row style={{ alignItems: 'baseline', gap: 7 }}>
            <Text style={{ color: C.text, fontSize: 30, fontWeight: '200', letterSpacing: -1 }}>{left}</Text>
            <Micro>{`${t('minutes')} · ${t('break_next')}`}</Micro>
          </Row>
          <Bar value={elapsed} max={monitor.workMinutes} color={left <= 1 ? C.amber : C.accent} />
        </>
      ) : (
        <Micro>{t('break_off')}</Micro>
      )}

      <Row style={{ justifyContent: 'space-between' }}>
        <Micro>{t('break_compliance')}</Micro>
        <Text style={{ color: stats.compliancePct >= 60 ? C.cyan : C.textDim, fontSize: F.small, fontWeight: '600' }}>
          {stats.taken}
          <Text style={{ color: C.textFaint, fontWeight: '400' }}> / {todayBreaks.length || 0}</Text>
        </Text>
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <Micro>{t('longest_sitting')}</Micro>
        <Text style={{ color: sitting >= 120 ? C.amber : C.text, fontSize: F.small, fontWeight: '600' }}>{formatMinutes(sitting)}</Text>
      </Row>

      {monitor.suggestion ? (
        <Micro color={C.amber}>{`${t('break_every')} ${monitor.suggestion} ${t('minutes')}?`}</Micro>
      ) : null}
    </Card>
  );
}
