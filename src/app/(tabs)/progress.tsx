import React from 'react';
import { View } from 'react-native';
import JourneyScreen from '../journey';
import CoachScreen from './coach';
import GrowthScreen from './growth';
import { TopBarActions } from '../../components/TopBarActions';
import { makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { SectionTabs } from '../../ui/SectionTabs';
import { useSectionParam } from '../../ui/useSectionParam';
import { C } from '../../ui/theme';
import { TopBar } from '../../ui/TopBar';

type Section = 'climb' | 'charts' | 'coach';
const SECTIONS: Section[] = ['climb', 'charts', 'coach'];

/** Progress: one tab, several sections; ?s= picks one on arrival. */
export default function ProgressTab() {
  const { state } = useApp();
  const lang = state.profile.lang;
  const t = makeT(lang);
  const [section, setSection] = useSectionParam(SECTIONS);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title={t('tab_progress')} alt={lang === 'en' ? undefined : t('tab_progress')} right={<TopBarActions />} />
      <SectionTabs options={[{ key: 'climb', label: t('journey_title') }, { key: 'charts', label: t('charts') }, { key: 'coach', label: t('tab_coach') }]} value={section} onChange={setSection} />
      {section === 'climb' ? <JourneyScreen /> : null}
      {section === 'charts' ? <GrowthScreen embedded /> : null}
      {section === 'coach' ? <CoachScreen embedded /> : null}
    </View>
  );
}
