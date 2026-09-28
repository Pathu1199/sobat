import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { takesScreen } from '../core/breaks';
import { fill, makeT } from '../i18n';
import { useBreakMonitor } from '../services/useBreakMonitor';
import { useApp } from '../store/AppProvider';
import { C, F, MICRO, S } from '../ui/theme';
import { useBreakpoint } from '../ui/useBreakpoint';

/**
 * Two jobs, one surface: the quiet heads-up a minute before a screen-taking
 * break, and the posture and blink nudges, which never take the screen at all.
 */
export function BreakToast() {
  const monitor = useBreakMonitor();
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  const insets = useSafeAreaInsets();
  const wide = useBreakpoint() !== 'mobile';

  const nudging = monitor.phase === 'breaking' && monitor.kind !== null && !takesScreen(monitor.kind);
  const warning = monitor.phase === 'warning' && monitor.nextKind !== null;
  if (!state.profile.onboarded || (!nudging && !warning)) return null;

  const kind = nudging ? monitor.kind! : monitor.nextKind!;
  const title = nudging ? t(`brk_${kind}`) : t('break_soon').replace('{s}', String(Math.max(0, Math.round(monitor.secondsLeft))));
  const body = nudging ? t(`brk_${kind}_hint`) : t('break_soon_hint');

  return (
    <View
      style={{
        position: 'absolute',
        right: wide ? 20 : 12,
        left: wide ? undefined : 12,
        bottom: (wide ? 20 : 96) + insets.bottom,
        maxWidth: 360,
        alignSelf: wide ? 'flex-end' : 'center',
        backgroundColor: C.cardHigh,
        borderWidth: S.hairline,
        borderColor: C.borderStrong,
        borderRadius: S.radius,
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 6,
        zIndex: 940,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={nudging ? 'body-outline' : 'time-outline'} size={15} color={nudging ? C.cyan : C.amber} />
        <Text style={[MICRO, { color: nudging ? C.cyan : C.amber }]}>{title}</Text>
      </View>
      <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: 18 }}>{body}</Text>

      {warning ? (
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
          {state.breakSettings.snoozeMinutes.map((m) => (
            <Pressable key={m} onPress={() => monitor.snooze(m)} hitSlop={6} accessibilityRole="button">
              <Text style={{ color: C.accent, fontSize: F.small, fontWeight: '600' }}>{fill(t('brk_snooze_n'), { n: m })}</Text>
            </Pressable>
          ))}
          {monitor.skipsLeft > 0 ? (
            <Pressable onPress={monitor.skip} hitSlop={6} accessibilityRole="button">
              <Text style={{ color: C.textFaint, fontSize: F.small }}>{t('break_skip')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
