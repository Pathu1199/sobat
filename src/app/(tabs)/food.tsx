import React from 'react';
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
import { useSectionParam } from '../../ui/useSectionParam';
import { C } from '../../ui/theme';
import { TopBar } from '../../ui/TopBar';

type Section = 'plan' | 'foods' | 'recipes' | 'history' | 'routine';
const SECTIONS: Section[] = ['plan', 'foods', 'recipes', 'history', 'routine'];

/** Food: one tab, several sections; ?s= picks one on arrival. */
export default function FoodTab() {
  const { state } = useApp();
  const lang = state.profile.lang;
  const t = makeT(lang);
  const [section, setSection] = useSectionParam(SECTIONS);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title={t('tab_food')} alt={lang === 'en' ? undefined : t('tab_food')} right={<TopBarActions />} />
      <SectionTabs options={[{ key: 'plan', label: t('diet_title') }, { key: 'foods', label: t('foods_title') }, { key: 'recipes', label: t('recipes') }, { key: 'history', label: t('history') }, { key: 'routine', label: t('pattern_title') }]} value={section} onChange={setSection} />
      {section === 'plan' ? <PlanScreen /> : null}
      {section === 'foods' ? <FoodsScreen /> : null}
      {section === 'recipes' ? <RecipesScreen /> : null}
      {section === 'history' ? <HistoryScreen /> : null}
      {section === 'routine' ? <RoutineScreen /> : null}
    </View>
  );
}
