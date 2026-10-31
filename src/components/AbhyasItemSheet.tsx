import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ABHYAS_ICONS, MAX_TARGET_MIN, MAX_TIMES } from '../core/abhyas';
import { draftOf, formDraft, newDraft, TARGET_CHOICES, targetText, WEEK_ORDER } from '../core/abhyasView';
import { addDays, formatDayLabel } from '../core/date';
import type { AbhyasItem, ISODate } from '../core/types';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { chosenProps } from '../ui/chosen';
import { Btn, Field, Micro, Pill, Row, Segmented } from '../ui/components';
import { IconButton } from '../ui/IconButton';
import { QtyStepper } from '../ui/QtyStepper';
import { Sheet } from '../ui/Sheet';
import { C, F, lh, S } from '../ui/theme';

/** The words each icon in the picker is read out by. */
const ICON_WORDS: Record<(typeof ABHYAS_ICONS)[number], string> = {
  'book-outline': 'abh_icon_book',
  'code-slash-outline': 'abh_icon_code',
  'fitness-outline': 'abh_icon_fitness',
  'language-outline': 'abh_icon_language',
  'leaf-outline': 'abh_icon_leaf',
  'briefcase-outline': 'abh_icon_briefcase',
  'musical-notes-outline': 'abh_icon_music',
  'pencil-outline': 'abh_icon_pencil',
};

/** What Save says when it cannot save, under the part it is about. */
const PROBLEM_WORDS = { name: 'abh_need_name', days: 'abh_need_day', date: 'abh_need_date', target: 'abh_need_target', time: 'sched_time_hint' } as const;

/**
 * One Abhyas item, new or edited: its name, an icon from a short row, whether
 * it repeats on chosen weekdays (all on to start) or belongs to one day (the
 * date the sheet was opened for, moved a day at a time), a minutes target
 * from the chips or the box beside them, and up to three times to be
 * reminded at (a box added takes the focus). Save checks it first
 * (core/abhyasView.ts `formDraft`) and says what is missing under the part it
 * is about; a missing name, at the top, is said beside Save as well. Remove,
 * on an item already on the list, takes it off from today on and hands it to
 * `onRemove`, which shows the Undo where the item was. A sheet opened for a
 * day before today has no Remove: the item would stay on that day, as history
 * does, so there it would seem to do nothing. Mounted afresh for each opening
 * (the caller keys it), so it always opens on the item as it is.
 */
export function AbhyasItemSheet({
  open,
  onClose,
  item,
  date,
  newKind = 'once',
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  /** The item to edit; null for a new one. */
  item: AbhyasItem | null;
  /** The day the sheet was opened for: a new one-off's date. */
  date: ISODate;
  /** Whether a new item starts as a one-off (the card's +) or repeating. */
  newKind?: AbhyasItem['kind'];
  /** After Remove has taken the item off the list. */
  onRemove?: (item: AbhyasItem) => void;
}) {
  const app = useApp();
  const fb = useFeedback();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const [first] = useState(() => (item ? draftOf(item, date) : newDraft(newKind, date)));
  const [name, setName] = useState(first.name);
  const [icon, setIcon] = useState(first.icon);
  const [kind, setKind] = useState(first.kind);
  const [days, setDays] = useState(first.days);
  const [day, setDay] = useState(first.date);
  const [target, setTarget] = useState(first.targetMin);
  // The box beside the chips: a target that is not one of them, as typed.
  const [other, setOther] = useState(first.targetMin !== undefined && !(TARGET_CHOICES as readonly number[]).includes(first.targetMin) ? String(first.targetMin) : '');
  const [times, setTimes] = useState(first.times);
  // The time box just added, which takes the focus as it appears; none of the boxes the sheet opened with.
  const [added, setAdded] = useState<number | null>(null);
  // What is missing shows once Save was pressed, and then follows each change.
  const [tried, setTried] = useState(false);

  const { draft, problem } = formDraft({ name, icon, kind, days, date: day, target, times });
  const shown = tried ? problem : null;
  const problemLine = (p: typeof problem) => (shown === p && p ? <Micro color={C.amber}>{fill(t(PROBLEM_WORDS[p]), { max: MAX_TARGET_MIN })}</Micro> : null);

  const save = () => {
    if (problem) {
      setTried(true);
      fb.announce(fill(t(PROBLEM_WORDS[problem]), { max: MAX_TARGET_MIN }));
      return;
    }
    if (item) app.setAbhyasItem(item.id, draft);
    else app.addAbhyasItem(draft);
    fb.haptic('success');
    onClose();
  };

  const remove = () => {
    if (!item) return;
    onRemove?.(item);
    onClose();
  };

  const minutes = (n: number) => fill(t('abh_min'), { n });
  const targetLabel = (words: string) => `${t('abh_time_target')}, ${words}`;

  return (
    <Sheet open={open} onClose={onClose} title={t(item ? 'abh_edit' : 'abh_new')}>
      <View style={{ gap: 8 }}>
        <Field label={t('abh_name')} value={name} onChangeText={setName} placeholder={t('abh_name_ph')} autoFocus={!item} />
        {problemLine('name')}
      </View>

      <View style={{ gap: 8 }}>
        <Micro>{t('abh_icon')}</Micro>
        {/* Two rows of four: eight in one row are wider than a 375 point phone. */}
        {[ABHYAS_ICONS.slice(0, 4), ABHYAS_ICONS.slice(4)].map((row) => (
          <Row key={row[0]} style={{ gap: 8 }}>
            {row.map((name) => {
              const on = icon === name;
              return (
                <Pressable
                  key={name}
                  onPress={() => setIcon(name)}
                  accessibilityRole="button"
                  accessibilityLabel={t(ICON_WORDS[name])}
                  {...chosenProps(on)}
                  style={({ pressed }) => ({ width: S.touch, height: S.touch, borderRadius: S.radiusXs, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.accent : C.cardAlt, opacity: pressed ? 0.7 : 1 })}>
                  <Ionicons name={name} size={20} color={on ? C.onAccent : C.textDim} />
                </Pressable>
              );
            })}
          </Row>
        ))}
      </View>

      <View style={{ gap: 8 }}>
        <Segmented
          options={[
            { key: 'repeat', label: t('abh_repeats') },
            { key: 'once', label: t('abh_one_day') },
          ]}
          value={kind}
          onChange={setKind}
        />
        {kind === 'repeat' ? (
          <WeekdayToggles days={days} t={t} onToggle={(d) => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])} />
        ) : (
          <View style={{ gap: 8, alignItems: 'flex-start' }}>
            <Micro>{t('abh_date')}</Micro>
            <QtyStepper
              value={formatDayLabel(day, lang)}
              onMinus={() => setDay(addDays(day, -1))}
              onPlus={() => setDay(addDays(day, 1))}
              minusLabel={t('abh_day_before')}
              plusLabel={t('abh_day_after')}
            />
          </View>
        )}
        {problemLine('days')}
        {problemLine('date')}
      </View>

      <View style={{ gap: 8 }}>
        <Micro>{t('abh_time_target')}</Micro>
        <Row style={{ gap: 4, flexWrap: 'wrap' }}>
          <Pill
            label={t('abh_off')}
            accessibilityLabel={targetLabel(t('abh_off'))}
            active={target === undefined}
            onPress={() => {
              setTarget(undefined);
              setOther('');
            }}
          />
          {TARGET_CHOICES.map((n) => (
            <Pill
              key={n}
              label={minutes(n)}
              accessibilityLabel={targetLabel(minutes(n))}
              active={target === n && other === ''}
              onPress={() => {
                setTarget(n);
                setOther('');
              }}
            />
          ))}
          {/* Any other value, beside the chips: digits only, up to MAX_TARGET_MIN (targetText). */}
          <View style={{ width: 110 }}>
            <Field
              value={other}
              keyboardType="numeric"
              placeholder={t('abh_other')}
              accessibilityLabel={targetLabel(t('abh_other'))}
              onChangeText={(v) => {
                const typed = targetText(v);
                setOther(typed.text);
                setTarget(typed.value);
              }}
            />
          </View>
        </Row>
        {problemLine('target')}
      </View>

      <View style={{ gap: 8 }}>
        <Micro>{t('abh_remind_at')}</Micro>
        {times.map((time, i) => (
          // By place: a time is edited where it stands, and an empty box has no time of its own to be known by.
          <Row key={i} style={{ gap: 4 }}>
            <Field
              value={time}
              keyboardType="numeric"
              placeholder="07:00"
              autoFocus={i === added}
              accessibilityLabel={fill(t('abh_time_n'), { n: i + 1 })}
              onChangeText={(v) => setTimes(times.map((x, n) => (n === i ? v : x)))}
            />
            <IconButton name="close" label={fill(t('abh_remove_time'), { n: i + 1 })} onPress={() => setTimes(times.filter((_, n) => n !== i))} />
          </Row>
        ))}
        {times.length < MAX_TIMES ? (
          <Btn
            small
            tone="soft"
            label={t('abh_add_time')}
            icon={<Ionicons name="add" size={18} color={C.accentText} />}
            onPress={() => {
              setAdded(times.length);
              setTimes([...times, '']);
            }}
            style={{ alignSelf: 'flex-start' }}
          />
        ) : null}
        {problemLine('time')}
      </View>

      {/* The name is at the top, out of sight under the keyboard or after a scroll: what it lacks is said here too. */}
      {problemLine('name')}
      <Row style={{ gap: 10, marginTop: 4 }}>
        <Btn label={t('save')} onPress={save} style={{ flex: 1 }} />
        {item && date >= app.today ? <Btn label={t('abh_remove')} tone="danger" onPress={remove} /> : null}
      </Row>
    </Sheet>
  );
}

/** Between two weekday toggles, across and down. */
const TOGGLE_GAP = 2;

/**
 * The weekdays an item repeats on, Monday to Sunday side by side, each a
 * seventh of the row and a finger tall and wide (a seventh of a 360 point
 * phone's sheet is just 44 wide), on in teal. On a sheet too narrow for seven
 * fingers they wrap into two rows of four, Monday to Thursday over Friday to
 * Sunday, rather than shrink. Read out as buttons that say whether they are on.
 */
function WeekdayToggles({ days, onToggle, t }: { days: number[]; onToggle: (d: number) => void; t: (key: string) => string }) {
  const [perRow, setPerRow] = useState<number>(WEEK_ORDER.length);
  const rows: readonly (readonly number[])[] = perRow === WEEK_ORDER.length ? [WEEK_ORDER] : [WEEK_ORDER.slice(0, perRow), WEEK_ORDER.slice(perRow)];
  return (
    <View
      style={{ gap: TOGGLE_GAP }}
      onLayout={(e) => setPerRow(e.nativeEvent.layout.width >= WEEK_ORDER.length * S.touch + (WEEK_ORDER.length - 1) * TOGGLE_GAP ? WEEK_ORDER.length : 4)}>
      {rows.map((row) => (
        <View key={row[0]} style={{ flexDirection: 'row', gap: TOGGLE_GAP }}>
          {/* Each in a plain cell of the same share as the empty place, so Friday to Sunday line up under Monday to Wednesday. */}
          {row.map((d) => (
            <View key={d} style={{ flex: 1, minWidth: S.touch }}>
              <WeekdayToggle d={d} on={days.includes(d)} onToggle={onToggle} t={t} />
            </View>
          ))}
          {row.length < perRow ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

function WeekdayToggle({ d, on, onToggle, t }: { d: number; on: boolean; onToggle: (d: number) => void; t: (key: string) => string }) {
  return (
    <Pressable
      onPress={() => onToggle(d)}
      accessibilityRole="button"
      accessibilityLabel={t(`wd_${d}`)}
      {...chosenProps(on)}
      style={({ pressed }) => ({
        minHeight: S.touch,
        paddingHorizontal: 2,
        borderRadius: S.radiusXs,
        borderWidth: S.hairline,
        borderColor: on ? C.accent : C.border,
        backgroundColor: on ? C.accent : C.card,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.8 : 1,
      })}>
      <Text numberOfLines={1} style={{ color: on ? C.onAccent : C.text, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>
        {t(`wd_${d}`)}
      </Text>
    </Pressable>
  );
}
