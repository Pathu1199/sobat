import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { makeT } from '../i18n';
import { useAI } from '../services/useAI';
import { useApp } from '../store/AppProvider';
import { C, F, MICRO, S } from '../ui/theme';

type Item = { href: string; icon: keyof typeof Ionicons.glyphMap; labelKey: string };

const ITEMS: Item[] = [
  { href: '/', icon: 'today-outline', labelKey: 'tab_today' },
  { href: '/log', icon: 'add-circle-outline', labelKey: 'tab_log' },
  { href: '/growth', icon: 'trending-up-outline', labelKey: 'growth' },
  { href: '/fit', icon: 'walk-outline', labelKey: 'tab_fit' },
  { href: '/mind', icon: 'heart-outline', labelKey: 'tab_mind' },
  { href: '/coach', icon: 'chatbubble-ellipses-outline', labelKey: 'tab_coach' },
];

/** Replaces the bottom tab bar on wide screens. */
export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { state } = useApp();
  const { ai } = useAI();
  const t = makeT(state.profile.lang);

  const online = ai.route === 'primary' || ai.route === 'fallback';

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
        <View style={{ paddingHorizontal: 12, paddingBottom: 24, gap: 3 }}>
          <Text style={{ color: C.text, fontSize: 21, fontWeight: '600', letterSpacing: -0.4 }}>{t('app_name')}</Text>
          <Text style={[MICRO, { color: C.textGhost }]}>{t('tagline')}</Text>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: online ? C.accent : C.textFaint }} />
          <Text style={[MICRO, { color: C.textFaint }]}>{online ? t('ai_lan') : t('ai_offline')}</Text>
        </View>
      </View>
    </View>
  );
}
