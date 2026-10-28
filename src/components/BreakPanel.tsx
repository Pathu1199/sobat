import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { breakStats } from '../core/breaks';
import { formatMinutes, localHHMM } from '../core/date';
import { longestStretchMinutes, minutesOn } from '../core/usage';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useBreakMonitor } from '../services/useBreakMonitor';
import { useApp } from '../store/AppProvider';
import { Bar, Btn, Card, Micro, Ring, Row } from '../ui/components';
import { C, F, lh } from '../ui/theme';

/**
 * The eye-care breaks as they run: a countdown ring to the next break,
 * today's breaks taken, the longest stretch sitting, pause an hour or resume,
 * a break now, and a button that sets a longer gap when breaks keep being
 * skipped (the next of the break settings' choices up, `suggestLongerInterval`),
 * then says the new gap in a toast. In Settings → Features, under the eye-care breaks switch, only
 * while that switch is on.
 */
export function BreakPanel() {
  const app = useApp();
  const fb = useFeedback();
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
  const suggestion = monitor.suggestion;

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ gap: 8 }}>
          <Ionicons name="timer-outline" size={15} color={C.accent} />
          <Micro color={C.accentText}>{t('break_monitor')}</Micro>
        </Row>
        <Micro>{`${t('screen_time')} ${formatMinutes(screen, t)}`}</Micro>
      </Row>

      {monitor.enabled ? (
        <Row style={{ gap: 16, alignItems: 'center' }}>
          <Ring value={elapsed} max={nextEvery} size={88} stroke={5} color={left <= 1 ? C.amber : C.accent}>
            <Text style={{ color: C.text, fontSize: F.title, lineHeight: lh(F.title, true), fontWeight: '400' }}>{left}</Text>
            <Micro>{t('minutes')}</Micro>
          </Ring>
          <View style={{ flex: 1, gap: 10 }}>
            <View>
              <Micro>{monitor.nextKind ? `${t('break_next')} · ${t(`brk_${monitor.nextKind}`)}` : t('break_next')}</Micro>
              <Text style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{`${left} ${t('minutes')}`}</Text>
            </View>
            <View style={{ gap: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Micro>{t('break_compliance')}</Micro>
                <Text style={{ color: stats.compliancePct >= 60 ? C.cyan : C.textDim, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>
                  {stats.taken}
                  <Text style={{ color: C.textFaint, fontWeight: '500' }}> / {todayBreaks.length}</Text>
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
        <Text style={{ color: sitting >= 120 ? C.amber : C.text, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{formatMinutes(sitting, t)}</Text>
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
      {suggestion ? (
        // Skipped five times running: says so, and the button sets the longer gap it offers.
        <View style={{ gap: 8 }}>
          <Micro color={C.amber}>{fill(t('brk_suggest_line'), { kind: t(`brk_${suggestion.kind}`) })}</Micro>
          <Btn
            small
            tone="soft"
            label={fill(t('brk_suggest_set'), { kind: t(`brk_${suggestion.kind}`), n: suggestion.minutes })}
            onPress={() => {
              app.setBreakSettings({ [suggestion.kind]: { ...app.state.breakSettings[suggestion.kind], everyMinutes: suggestion.minutes } });
              // The button goes once the gap is set, so the new gap is said, and heard, in a toast.
              fb.notify(fill(t('brk_gap_now'), { kind: t(`brk_${suggestion.kind}`), n: suggestion.minutes }));
            }}
          />
        </View>
      ) : null}
    </Card>
  );
}
