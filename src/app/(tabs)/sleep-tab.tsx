import React from 'react';
import { View } from 'react-native';
import { makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';
import { TopBar } from '../../ui/TopBar';
import SleepScreen from '../sleep';

/** Sleep as a tab, for a person who put it on the bar. /sleep stays the page links and the sleep tile open. */
export default function SleepTab() {
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title={t('sleep_title')} />
      <SleepScreen embedded />
    </View>
  );
}
