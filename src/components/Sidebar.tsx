import { Ionicons } from '@expo/vector-icons';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { barItems, hrefOf, routeAt, viewedDate } from '../core/bar';
import { makeT } from '../i18n';
import { useAI } from '../services/useAI';
import { useAuth } from '../services/useAuth';
import { useBreakMonitor } from '../services/useBreakMonitor';
import { useApp } from '../store/AppProvider';
import { Ring } from '../ui/components';
import { Wordmark } from '../ui/Logo';
import { C, F, lh, MICRO, S } from '../ui/theme';
import { useAddSheet } from './AddSheet';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Replaces the bottom bar on wide screens with the same list in the same
 * order (core/bar.ts): Today, the person's extra tabs, Add food, and Me. Each
 * page is a link, the one open marked as the current page; holding one opens
 * Customize, as holding a tab on the bar does. The break timer shows only
 * while screen breaks are switched on.
 */
export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { date } = useGlobalSearchParams<{ date?: string }>();
  const monitor = useBreakMonitor();
  const { state, today } = useApp();
  const addSheet = useAddSheet();
  const { ai } = useAI();
  const { canUseAI } = useAuth();
  const t = makeT(state.profile.lang);

  const online = ai.route === 'primary' || ai.route === 'fallback';
  const nextEvery = monitor.nextKind ? state.breakSettings[monitor.nextKind].everyMinutes : state.breakSettings.micro.everyMinutes;
  const left = Number.isFinite(monitor.secondsLeft) ? Math.ceil(monitor.secondsLeft / 60) : 0;
  const elapsed = Math.max(0, nextEvery - left);
  // The day Today is showing, only while Today is in front, so Add food logs there.
  const viewed = viewedDate({ name: routeAt(pathname), params: { date } });

  function add() {
    addSheet.open({ date: viewed ?? today });
  }

  return (
    <View style={{ width: 248, backgroundColor: C.bgAlt, borderRightWidth: S.hairline, borderRightColor: C.border, paddingVertical: 24, paddingHorizontal: 14, justifyContent: 'space-between' }}>
      <View style={{ gap: 4 }}>
        <View style={{ paddingHorizontal: 12, paddingBottom: 24 }}>
          <Wordmark size={21} alt={t('tagline')} />
        </View>
        {barItems(state.settings.tabs).map((item) => {
          if (item.route === null) {
            return (
              <Pressable
                key={item.key}
                onPress={add}
                accessibilityRole="button"
                accessibilityLabel={t(item.labelKey)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: S.touch, marginVertical: 6, paddingHorizontal: 12, borderRadius: S.radiusSm, backgroundColor: C.accent, opacity: pressed ? 0.85 : 1 })}>
                <Ionicons name="add" size={18} color={C.onAccent} />
                <Text style={{ color: C.onAccent, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{t(item.labelKey)}</Text>
              </Pressable>
            );
          }
          const href = hrefOf(item.route);
          const active = pathname === href;
          return (
            <Pressable
              key={item.key}
              onPress={() => router.navigate(href as never)}
              onLongPress={() => router.push('/customize' as never)}
              accessibilityRole="link"
              // The web says "current page"; the phone, which has no aria-current, says "selected".
              aria-current={active ? 'page' : undefined}
              aria-selected={Platform.OS === 'web' ? undefined : active || undefined}
              accessibilityLabel={t(item.labelKey)}
              accessibilityHint={t('cust_hint')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: S.touch, paddingHorizontal: 12, borderRadius: S.radiusSm, backgroundColor: active ? C.cardAlt : 'transparent', borderWidth: S.hairline, borderColor: active ? C.border : 'transparent' }}>
              <Ionicons name={item.icon as IconName} size={18} color={active ? C.accentText : C.textFaint} />
              <Text style={{ color: active ? C.text : C.textDim, fontSize: F.body, lineHeight: lh(F.body), fontWeight: active ? '500' : '400' }}>{t(item.labelKey)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: 4 }}>
        {state.settings.features.breaks ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: S.hairline, borderTopColor: C.border }}>
            <Ring value={monitor.enabled ? elapsed : 0} max={nextEvery} size={34} stroke={3} color={C.accent}>
              <Text style={{ color: C.text, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{monitor.enabled ? left : '--'}</Text>
            </Ring>
            <View style={{ flex: 1 }}>
              <Text style={[MICRO, { color: C.textFaint }]}>{t('next_break')}</Text>
              <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>{monitor.enabled ? `${left} ${t('minutes')}` : t('break_off')}</Text>
            </View>
          </View>
        ) : null}
        {canUseAI ? (
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel={online ? t('ai_on') : t('ai_off')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: S.touch, paddingHorizontal: 12 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: online ? C.green : C.textFaint }} />
            <Text style={[MICRO, { color: online ? C.green : C.textFaint }]}>{online ? t('ai_on') : t('ai_off')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
