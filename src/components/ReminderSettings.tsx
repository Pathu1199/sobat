import React from 'react';
import { Platform, View } from 'react-native';
import { REMINDER_ROWS } from '../core/reminders';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, Divider, Small, Toggle } from '../ui/components';
import { C } from '../ui/theme';

/**
 * Settings → Reminders: one switch for each reminder the app sends on its
 * own, in the order they come in a day and a week (core/reminders.ts). Only
 * the meal-time prompt starts on. On the web, where only Dhyey open can show
 * them, a note says which come there.
 */
export function ReminderSettings() {
  const app = useApp();
  const r = app.state.settings.reminders;
  const t = makeT(app.state.profile.lang);
  return (
    <Card>
      {REMINDER_ROWS.map((row, i) => (
        <View key={row.key}>
          {i > 0 ? <Divider /> : null}
          <Toggle title={t(`rem_${row.name}`)} desc={t(`rem_${row.name}_desc`)} on={r[row.key]} onToggle={() => app.setSettings({ reminders: { ...r, [row.key]: !r[row.key] } })} />
        </View>
      ))}
      {Platform.OS === 'web' ? <Small color={C.textFaint}>{t('rem_web_note')}</Small> : null}
    </Card>
  );
}
