import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';
import { makeT } from '../i18n';
import { useAI } from '../services/useAI';
import { useApp } from '../store/AppProvider';
import { Row, StatusChip } from '../ui/components';
import { C } from '../ui/theme';
import { useBreakpoint } from '../ui/useBreakpoint';

/** Streak, AI status, and on the phone the coach and settings buttons. */
export function TopBarActions({ streak }: { streak?: number }) {
  const router = useRouter();
  const { ai } = useAI();
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  const wide = useBreakpoint() === 'desktop';
  const online = ai.route === 'primary' || ai.route === 'fallback';

  return (
    <Row style={{ gap: 4 }}>
      {wide && streak && streak > 0 ? <StatusChip label={`${streak}d`} color={C.amber} /> : null}
      <View
        accessibilityLabel={online ? t('ai_lan') : t('ai_offline')}
        style={{ width: 7, height: 7, borderRadius: 4, marginHorizontal: 6, backgroundColor: online ? C.accent : C.textGhost }}
      />
      {wide ? (
        <IconButton name="add-circle-outline" label={t('tab_log')} onPress={() => router.push('/log')} />
      ) : (
        <>
          <IconButton name="chatbubble-ellipses-outline" label={t('tab_coach')} onPress={() => router.push('/coach')} />
          <IconButton name="settings-outline" label={t('settings')} onPress={() => router.push('/settings')} />
        </>
      )}
    </Row>
  );
}

export function IconButton({
  name,
  label,
  onPress,
  disabled,
}: {
  name: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? C.cardAlt : 'transparent',
        opacity: disabled ? 0.3 : 1,
      })}>
      <Ionicons name={name} size={20} color={C.textDim} />
    </Pressable>
  );
}
