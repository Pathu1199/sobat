import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { makeT } from '../i18n';
import { useAI } from '../services/useAI';
import { useAuth } from '../services/useAuth';
import { useBreakMonitor } from '../services/useBreakMonitor';
import { useApp } from '../store/AppProvider';
import { Ring } from '../ui/components';
import { Wordmark } from '../ui/Logo';
import { C, F, MICRO, S } from '../ui/theme';

type Item = { href: string; icon: keyof typeof Ionicons.glyphMap; labelKey: string };

const ITEMS: Item[] = [
  { href: '/', icon: 'today-outline', labelKey: 'tab_today' },
  { href: '/food', icon: 'restaurant-outline', labelKey: 'tab_food' },
  { href: '/log', icon: 'add-circle-outline', labelKey: 'tab_log' },
  { href: '/body', icon: 'body-outline', labelKey: 'tab_body' },
  { href: '/progress', icon: 'trending-up-outline', labelKey: 'tab_progress' },
];

/** Replaces the bottom tab bar on wide screens. */
export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const monitor = useBreakMonitor();
  const app = useApp();
  const { state } = app;
  const { ai } = useAI();
  const { canUseAI } = useAuth();
  const t = makeT(state.profile.lang);

  const online = ai.route === 'primary' || ai.route === 'fallback';
  const nextEvery = monitor.nextKind ? state.breakSettings[monitor.nextKind].everyMinutes : state.breakSettings.micro.everyMinutes;
  const left = Number.isFinite(monitor.secondsLeft) ? Math.ceil(monitor.secondsLeft / 60) : 0;
  const elapsed = Math.max(0, nextEvery - left);

  return (
    <View
      style={{
        width: 248,
        backgroundColor: C.bgAlt,
        borderRightWidth: 1,
        borderRightColor: C.border,
        paddingVertical: 24,
        paddingHorizontal: 14,
        justifyContent: 'space-between',
      }}>
      <View style={{ gap: 4 }}>
        <View style={{ paddingHorizontal: 12, paddingBottom: 24 }}>
          <Wordmark size={21} alt={t('tagline')} />
        </View>

        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Pressable
              key={item.href}
              onPress={() => router.push(item.href as never)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 11,
                paddingHorizontal: 12,
                borderRadius: S.radiusSm,
                backgroundColor: active ? C.cardAlt : 'transparent',
                borderWidth: S.hairline,
                borderColor: active ? C.border : 'transparent',
              }}>
              <Ionicons name={item.icon} size={18} color={active ? C.accent : C.textFaint} />
              <Text style={{ color: active ? C.text : C.textDim, fontSize: F.body, fontWeight: active ? '600' : '400' }}>
                {t(item.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: 4 }}>
        <Pressable
          onPress={() => router.push('/guide')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 12, borderRadius: S.radiusSm }}>
          <Ionicons name="help-circle-outline" size={19} color={C.textFaint} />
          <Text style={{ color: C.textDim, fontSize: F.body }}>{t('guide_title')}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/memory')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 12, borderRadius: S.radiusSm }}>
          <Ionicons name="bookmark-outline" size={19} color={C.textFaint} />
          <Text style={{ color: C.textDim, fontSize: F.body }}>{t('mem_fact')}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/settings')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 12, borderRadius: S.radiusSm }}>
          <Ionicons name="settings-outline" size={19} color={C.textFaint} />
          <Text style={{ color: C.textDim, fontSize: F.body }}>{t('settings')}</Text>
        </Pressable>
        <View style={{ paddingHorizontal: 12, paddingVertical: 10, gap: 10, borderTopWidth: S.hairline, borderTopColor: C.border, marginTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ring value={monitor.enabled ? elapsed : 0} max={nextEvery} size={34} stroke={3} color={C.accent}>
              <Text style={{ color: C.text, fontSize: F.micro, fontWeight: '600' }}>{monitor.enabled ? left : '--'}</Text>
            </Ring>
            <View style={{ flex: 1 }}>
              <Text style={[MICRO, { color: C.textFaint }]}>{t('next_break')}</Text>
              <Text style={{ color: C.textDim, fontSize: F.small }}>{monitor.enabled ? `${left} ${t('minutes')}` : t('break_off')}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="water-outline" size={16} color={C.cyan} />
            <Text style={{ color: C.textDim, fontSize: F.small }}>
              {Math.round(app.waterToday / state.settings.glassMl)}
              <Text style={{ color: C.textFaint }}> / {Math.round(state.settings.waterGoalMl / state.settings.glassMl)} {t('water_glasses')}</Text>
            </Text>
          </View>
        </View>
        {canUseAI ? (
          <Pressable onPress={() => router.push('/settings')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: online ? C.green : C.textFaint }} />
            <Text style={[MICRO, { color: online ? C.green : C.textFaint }]}>{online ? t('ai_on') : t('ai_off')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
