import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import FoodsScreen from '../foods';
import HistoryScreen from '../history';
import PlanScreen from '../plan';
import RecipesScreen from '../recipes';
import RoutineScreen from '../routine';
import { TopBarActions } from '../../components/TopBarActions';
import { makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { SectionTabs } from '../../ui/SectionTabs';
import { C } from '../../ui/theme';
import { TopBar } from '../../ui/TopBar';

type Section = 'plan' | 'foods' | 'recipes' | 'history' | 'routine';
const SECTIONS: Section[] = ['plan', 'foods', 'recipes', 'history', 'routine'];

/** Food: one tab, several sections; ?s= picks one on arrival. */
export default function FoodTab() {
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
      <TopBar title={t('tab_food')} alt={lang === 'en' ? undefined : t('tab_food')} right={<TopBarActions />} />
      <SectionTabs options={[{ key: 'plan', label: t('diet_title') }, { key: 'foods', label: t('foods_title') }, { key: 'recipes', label: t('recipes') }, { key: 'history', label: t('history') }, { key: 'routine', label: t('routine_title') }]} value={section} onChange={setSection} />
      {section === 'plan' ? <PlanScreen /> : null}
      {section === 'foods' ? <FoodsScreen /> : null}
      {section === 'recipes' ? <RecipesScreen /> : null}
      {section === 'history' ? <HistoryScreen /> : null}
      {section === 'routine' ? <RoutineScreen /> : null}
    </View>
  );
}
