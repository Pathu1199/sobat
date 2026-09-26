import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { breakStats } from '../core/breaks';
import { formatMinutes } from '../core/date';
import { longestStretchMinutes, minutesOn } from '../core/usage';
import { makeT } from '../i18n';
import { useBreakMonitor } from '../services/useBreakMonitor';
import { useApp } from '../store/AppProvider';
import { Bar, Card, Micro, Ring, Row } from '../ui/components';
import { C, F } from '../ui/theme';

/** The desktop break panel: a countdown ring, today's compliance, the longest stretch. */
export function BreakPanel() {
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
        <Micro>{`${t('screen_time')} ${formatMinutes(screen)}`}</Micro>
      </Row>

      {monitor.enabled ? (
        <Row style={{ gap: 16, alignItems: 'center' }}>
          <Ring value={elapsed} max={monitor.workMinutes} size={88} stroke={5} color={left <= 1 ? C.amber : C.accent}>
            <Text style={{ color: C.text, fontSize: 26, fontWeight: '200', letterSpacing: -1 }}>{left}</Text>
            <Micro>{t('minutes')}</Micro>
          </Ring>
          <View style={{ flex: 1, gap: 10 }}>
            <View>
              <Micro>{t('break_next')}</Micro>
              <Text style={{ color: C.text, fontSize: F.body, fontWeight: '500' }}>{`${left} ${t('minutes')}`}</Text>
            </View>
            <View style={{ gap: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Micro>{t('break_compliance')}</Micro>
                <Text style={{ color: stats.compliancePct >= 60 ? C.cyan : C.textDim, fontSize: F.small, fontWeight: '600' }}>
                  {stats.taken}
                  <Text style={{ color: C.textFaint, fontWeight: '400' }}> / {todayBreaks.length}</Text>
                </Text>
              </Row>
              <Bar value={stats.taken} max={Math.max(1, todayBreaks.length)} color={C.cyan} />
            </View>
          </View>
        </Row>
      ) : (
        <Micro>{t('break_off')}</Micro>
      )}

      <Row style={{ justifyContent: 'space-between' }}>
        <Micro>{t('longest_sitting')}</Micro>
        <Text style={{ color: sitting >= 120 ? C.amber : C.text, fontSize: F.small, fontWeight: '600' }}>{formatMinutes(sitting)}</Text>
      </Row>
      {monitor.suggestion ? <Micro color={C.amber}>{`${t('break_every')} ${monitor.suggestion} ${t('minutes')}?`}</Micro> : null}
    </Card>
  );
}
