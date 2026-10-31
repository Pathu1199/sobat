import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { ChapterSheet } from '../../components/ChapterSheet';
import { GrocerySheet } from '../../components/GrocerySheet';
import { SavedMealsSheet } from '../../components/SavedMealsSheet';
import { goalLine, meRows, type MeSheet } from '../../core/bar';
import { firstName } from '../../core/todayLayout';
import { mondayOf } from '../../core/date';
import { makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { Card, Divider, ListRow } from '../../ui/components';
import { Logo } from '../../ui/Logo';
import { C } from '../../ui/theme';
import { Page } from '../../ui/TopBar';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Me: the user's first name with their goal and pace under it (the goal
 * alone while the targets hold the weight) and the Dhyey mark beside them
 * ("Me" when no name was given), then a plain list of everything that is not
 * on the bar, each one tap from its page or its sheet.
 */
export default function MeScreen() {
  const app = useApp();
  const router = useRouter();
  const { profile } = app.state;
  const t = makeT(profile.lang);
  const [sheet, setSheet] = useState<MeSheet | null>(null);
  return (
    <Page
      title={firstName(profile.name) ?? t('tab_me')}
      subtitle={goalLine(profile, app.targets.hold, t)}
      right={
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          {/* The mark in the accent's word colour, which holds 4.5:1 on the soft circle in both themes. */}
          <Logo mono ink={C.accentText} size={26} />
        </View>
      }>
      <Card>
        {meRows(app.state.settings.tabs).map((row, i) => (
          <View key={row.key}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              icon={<Ionicons name={row.icon as IconName} size={18} color={C.textDim} />}
              title={t(row.labelKey)}
              sub={row.subKey ? t(row.subKey) : undefined}
              onPress={() => {
                if (row.sheet) setSheet(row.sheet);
                else if (row.href) router.push(row.href as never);
              }}
              trailing={<Ionicons name="chevron-forward" size={16} color={C.textFaint} />}
            />
          </View>
        ))}
      </Card>
      <SavedMealsSheet open={sheet === 'savedMeals'} onClose={() => setSheet(null)} />
      {/* This week's plan as a shopping list, the same sheet the diet plan opens. */}
      <GrocerySheet open={sheet === 'grocery'} onClose={() => setSheet(null)} plan={app.weekPlan} monday={mondayOf(app.today)} />
      {/* Start a new chapter: one sheet in plain words, on Me. */}
      <ChapterSheet open={sheet === 'chapter'} onClose={() => setSheet(null)} />
    </Page>
  );
}
