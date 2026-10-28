import { useRouter } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { makeT } from '../i18n';
import { useAI } from '../services/useAI';
import { useAuth } from '../services/useAuth';
import { useApp } from '../store/AppProvider';
import { Row, StatusChip } from '../ui/components';
import { IconButton } from '../ui/IconButton';
import { C } from '../ui/theme';
import { useBreakpoint } from '../ui/useBreakpoint';
import { useAddSheet } from './AddSheet';

// Pages that put the button beside these actions take it from here.
export { IconButton };

/** AI status; on a desktop the add button, which opens the add sheet for today; on the phone the coach and settings buttons. */
export function TopBarActions() {
  const router = useRouter();
  const { ai } = useAI();
  const { canUseAI } = useAuth();
  const { state, today } = useApp();
  const addSheet = useAddSheet();
  const t = makeT(state.profile.lang);
  const wide = useBreakpoint() === 'desktop';
  const online = ai.route === 'primary' || ai.route === 'fallback';

  return (
    <Row style={{ gap: 4 }}>
      {canUseAI ? (
        <Row style={{ gap: 5, marginHorizontal: 6 }} >
          <View accessibilityLabel={online ? t('ai_on') : t('ai_off')} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: online ? C.green : C.textFaint }} />
          {wide ? <StatusChip label={online ? t('ai_on') : t('ai_off')} color={online ? C.green : C.textFaint} /> : null}
        </Row>
      ) : null}
      {wide ? (
        <IconButton name="add-circle-outline" label={t('add_food')} onPress={() => addSheet.open({ date: today })} />
      ) : (
        <>
          {/* The guide lives in Me; the phone header keeps room for the name. */}
          <IconButton name="chatbubble-ellipses-outline" label={t('tab_coach')} onPress={() => router.push('/coach')} />
          <IconButton name="settings-outline" label={t('settings')} onPress={() => router.push('/settings')} />
        </>
      )}
    </Row>
  );
}
