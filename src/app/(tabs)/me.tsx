import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { ChapterSheet } from '../../components/ChapterSheet';
import { GrocerySheet } from '../../components/GrocerySheet';
import { SavedMealsSheet } from '../../components/SavedMealsSheet';
import { meRows, type MeSheet } from '../../core/bar';
import { mondayOf } from '../../core/date';
import { makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { Card, Divider, ListRow } from '../../ui/components';
import { C } from '../../ui/theme';
import { Page } from '../../ui/TopBar';

type IconName = keyof typeof Ionicons.glyphMap;

/** Me: a plain list of everything that is not on the bar, each one tap from its page or its sheet. */
export default function MeScreen() {
  const app = useApp();
  const router = useRouter();
  const t = makeT(app.state.profile.lang);
  const [sheet, setSheet] = useState<MeSheet | null>(null);
  return (
    <Page title={t('tab_me')}>
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
