import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { SavedMealsSheet } from '../../components/SavedMealsSheet';
import { meRows } from '../../core/bar';
import { makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { Card, Divider, ListRow } from '../../ui/components';
import { C } from '../../ui/theme';
import { Page } from '../../ui/TopBar';

type IconName = keyof typeof Ionicons.glyphMap;

/** Me: a plain list of everything that is not on the bar, each one tap from its page. */
export default function MeScreen() {
  const app = useApp();
  const router = useRouter();
  const t = makeT(app.state.profile.lang);
  const [saved, setSaved] = useState(false);
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
                if (row.sheet) setSaved(true);
                else if (row.href) router.push(row.href as never);
              }}
              trailing={<Ionicons name="chevron-forward" size={16} color={C.textFaint} />}
            />
          </View>
        ))}
      </Card>
      <SavedMealsSheet open={saved} onClose={() => setSaved(false)} />
    </Page>
  );
}
