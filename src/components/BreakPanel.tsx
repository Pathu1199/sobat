import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { breakStats } from '../core/breaks';
import { formatMinutes, localHHMM } from '../core/date';
import { longestStretchMinutes, minutesOn } from '../core/usage';
import { fill, makeT } from '../i18n';
import { useBreakMonitor } from '../services/useBreakMonitor';
import { useApp } from '../store/AppProvider';
import { Bar, Btn, Card, Micro, Ring, Row } from '../ui/components';
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
  const nextEvery = monitor.nextKind ? app.state.breakSettings[monitor.nextKind].everyMinutes : app.state.breakSettings.micro.everyMinutes;
  const left = Number.isFinite(monitor.secondsLeft) ? Math.ceil(monitor.secondsLeft / 60) : 0;
  const elapsed = Math.max(0, nextEvery - left);
  const pausedUntilMs = app.state.breakSettings.pausedUntilMs;

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
          <Ring value={elapsed} max={nextEvery} size={88} stroke={5} color={left <= 1 ? C.amber : C.accent}>
            <Text style={{ color: C.text, fontSize: 26, fontWeight: '200', letterSpacing: -1 }}>{left}</Text>
            <Micro>{t('minutes')}</Micro>
          </Ring>
          <View style={{ flex: 1, gap: 10 }}>
            <View>
              <Micro>{monitor.nextKind ? `${t('break_next')} · ${t(`brk_${monitor.nextKind}`)}` : t('break_next')}</Micro>
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

      <Row style={{ gap: 8 }}>
        {monitor.pausedByHand ? (
          <Btn small tone="soft" label={t('brk_resume')} onPress={() => app.pauseBreaks(null)} style={{ flex: 1 }} />
        ) : (
          <Btn small tone="ghost" label={t('brk_pause_hour')} onPress={() => app.pauseBreaks(60)} style={{ flex: 1 }} />
        )}
        <Btn small tone="soft" label={t('brk_take_now')} onPress={() => monitor.takeNow('micro')} style={{ flex: 1 }} />
      </Row>
      {pausedUntilMs !== null ? (
        <Micro color={C.amber}>{fill(t('brk_paused_until'), { t: localHHMM(new Date(pausedUntilMs).toISOString()) })}</Micro>
      ) : null}
      {monitor.suggestion ? (
        <Micro color={C.amber}>{`${t(`brk_${monitor.suggestion.kind}`)} · ${t('break_every')} ${monitor.suggestion.minutes} ${t('minutes')}?`}</Micro>
      ) : null}
    </Card>
  );
}
