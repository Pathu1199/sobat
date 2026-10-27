import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { AddSheetProvider } from '../../components/AddSheet';
import { NudgeToast } from '../../components/NudgeToast';
import { Sidebar } from '../../components/Sidebar';
import { TabBar } from '../../components/TabBar';
import { makeT } from '../../i18n';
import { firebaseEnabled } from '../../services/firebase';
import { useAuth } from '../../services/useAuth';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';
import { Skeleton } from '../../ui/tiles';
import { useIsWide } from '../../ui/useBreakpoint';

export default function TabsLayout() {
  const { state, ready: stateReady } = useApp();
  const auth = useAuth();
  const ready = stateReady && auth.ready;
  const wide = useIsWide();
  const t = makeT(state.profile.lang);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, padding: 16, gap: 12, paddingTop: 72 }}>
        <Skeleton height={28} width="60%" />
        <Skeleton height={190} />
        <Skeleton height={120} />
        <Skeleton height={96} />
      </View>
    );
  }
  // Not signed in: the landing page and nothing else, on every platform.
  if (firebaseEnabled && !auth.user) return <Redirect href="/welcome" />;
  if (!state.profile.onboarded) return <Redirect href="/onboarding" />;

  return (
    // One add sheet for the whole tab area: the ➕, the sidebar, Today's menu and the /log address all open it.
    <AddSheetProvider>
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.bg }}>
        {wide ? <Sidebar /> : null}
        <View style={{ flex: 1 }}>
          {/* Back goes to the tab seen before, so Android back from a page opened from Me returns to Me. */}
          <Tabs
            backBehavior="history"
            tabBar={wide ? () => null : (props) => <TabBar {...props} />}
            screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg } }}>
            {/* Every tab the bar can show; which of them it shows comes from the person's settings (core/bar.ts). */}
            <Tabs.Screen name="index" options={{ title: t('tab_today') }} />
            <Tabs.Screen name="me" options={{ title: t('tab_me') }} />
            <Tabs.Screen name="progress" options={{ title: t('tab_progress') }} />
            <Tabs.Screen name="coach" options={{ title: t('tab_coach') }} />
            <Tabs.Screen name="body" options={{ title: t('tab_body') }} />
            <Tabs.Screen name="sleep-tab" options={{ title: t('sleep_title') }} />
            <Tabs.Screen name="plan-tab" options={{ title: t('tab_plan') }} />
            {/* Old addresses keep working, so links and notifications still land; they are never on the bar. */}
            <Tabs.Screen name="food" options={{ href: null }} />
            <Tabs.Screen name="log" options={{ href: null }} />
            <Tabs.Screen name="growth" options={{ href: null }} />
            <Tabs.Screen name="fit" options={{ href: null }} />
            <Tabs.Screen name="mind" options={{ href: null }} />
          </Tabs>
          <NudgeToast />
        </View>
      </View>
    </AddSheetProvider>
  );
}
