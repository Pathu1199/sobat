import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import SleepScreen from '../sleep';
import FitScreen from './fit';
import { YogaPanel } from '../../components/YogaPanel';
import { Screen } from '../../ui/components';
import MindScreen from './mind';
import { TopBarActions } from '../../components/TopBarActions';
import { makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { SectionTabs } from '../../ui/SectionTabs';
import { C } from '../../ui/theme';
import { TopBar } from '../../ui/TopBar';

type Section = 'move' | 'yoga' | 'sleep' | 'mind';
const SECTIONS: Section[] = ['move', 'yoga', 'sleep', 'mind'];

/** Body: one tab, several sections; ?s= picks one on arrival. */
export default function BodyTab() {
  const { state } = useApp();
  const lang = state.profile.lang;
  const t = makeT(lang);
  const { s } = useLocalSearchParams<{ s?: string }>();
  const wanted = typeof s === 'string' && (SECTIONS as string[]).includes(s) ? (s as Section) : SECTIONS[0];
  const [section, setSection] = useState<Section>(wanted);
  useEffect(() => {
    // A link that names a section wins over what was open last time.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (typeof s === 'string') setSection(wanted);
  }, [s, wanted]);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title={t('tab_body')} alt={lang === 'en' ? undefined : t('tab_body')} right={<TopBarActions />} />
      <SectionTabs options={[{ key: 'move', label: t('fit_title') }, { key: 'yoga', label: t('yoga_tab') }, { key: 'sleep', label: t('sleep_title') }, { key: 'mind', label: t('mind_title') }]} value={section} onChange={setSection} />
      {section === 'move' ? <FitScreen embedded /> : null}
      {section === 'yoga' ? (
        <Screen>
          <YogaPanel />
        </Screen>
      ) : null}
      {section === 'sleep' ? <SleepScreen /> : null}
      {section === 'mind' ? <MindScreen embedded /> : null}
    </View>
  );
}
