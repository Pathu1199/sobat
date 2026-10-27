import React from 'react';
import { View } from 'react-native';
import { makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';
import { TopBar } from '../../ui/TopBar';
import PlanScreen from '../plan';

/** The diet plan as a tab, for a person who put it on the bar. /plan and Food → Plan stay where links open it. */
export default function PlanTab() {
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title={t('hdr_plan')} />
      <PlanScreen />
    </View>
  );
}
