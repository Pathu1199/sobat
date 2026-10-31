import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { MAX_TIMES } from '../core/abhyas';
import { checklistTimes, withChecklistTime } from '../core/checklist';
import { REMINDER_ROWS } from '../core/reminders';
import { isValidTime } from '../core/schedule';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Divider, Field, Micro, Row, Small, Toggle } from '../ui/components';
import { C, S } from '../ui/theme';

/**
 * Settings → Reminders: one switch for each reminder the app sends on its
 * own, in the order they come in a day and a week (core/reminders.ts). The
 * meal-time prompt, Abhyas and "Day so far" start on; while "Day so far" is
 * on, its times sit under its switch. On the web, where only Dhyey open can
 * show them, a note says which come there.
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
          {row.key === 'checklist' && r.checklist ? <ChecklistTimes /> : null}
        </View>
      ))}
      {Platform.OS === 'web' ? <Small color={C.textFaint}>{t('rem_web_note')}</Small> : null}
    </Card>
  );
}

/** "Day so far"'s times: up to three, each a 24-hour time, one added or taken away at a time; the last one stays, the switch above turns it off. */
function ChecklistTimes() {
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  const times = checklistTimes(app.state.settings.checklistTimes);
  const save = (next: string[]) => app.setSettings({ checklistTimes: checklistTimes(next) });
  return (
    <View style={{ gap: 8, paddingTop: 6, paddingBottom: 6 }}>
      <Micro>{t('rem_checklist_times')}</Micro>
      {times.map((time, i) => (
        // Keyed by the time too: a saved time may move in the day's order, and its box starts again from what was saved.
        <TimeRow
          key={`${i}-${time}`}
          time={time}
          label={fill(t('rem_checklist_time'), { n: i + 1 })}
          onChange={(v) => save(times.map((x, j) => (j === i ? v : x)))}
          onRemove={times.length > 1 ? () => save(times.filter((_, j) => j !== i)) : undefined}
        />
      ))}
      {times.length < MAX_TIMES ? <Btn small tone="soft" label={t('rem_checklist_add')} onPress={() => save(withChecklistTime(times))} /> : null}
    </View>
  );
}

/** One time: a box that saves only a valid time, with the 24-hour hint while it holds anything else, and a remove button a finger wide. */
function TimeRow({ time, label, onChange, onRemove }: { time: string; label: string; onChange: (v: string) => void; onRemove?: () => void }) {
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  const [text, setText] = useState(time);
  return (
    <View style={{ gap: 6 }}>
      <Row style={{ gap: 8 }}>
        <Field
          value={text}
          placeholder="20:30"
          accessibilityLabel={label}
          onChangeText={(v) => {
            setText(v);
            if (isValidTime(v) && v !== time) onChange(v);
          }}
        />
        {onRemove ? (
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={fill(t('rem_checklist_remove'), { time })}
            style={{ minWidth: S.touch, minHeight: S.touch, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={16} color={C.textFaint} />
          </Pressable>
        ) : null}
      </Row>
      {!isValidTime(text) ? <Micro color={C.amber}>{t('sched_time_hint')}</Micro> : null}
    </View>
  );
}
