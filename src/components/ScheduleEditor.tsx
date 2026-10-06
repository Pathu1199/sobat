import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { DEFAULT_SCHEDULE, isValidTime, newBreak, orderedBlocks, type ScheduleBlock } from '../core/schedule';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Divider, Field, Micro, Pill, Row, Small, Toggle } from '../ui/components';
import { C, F } from '../ui/theme';

const WEEK = [1, 2, 3, 4, 5, 6, 0];

/** The office day, editable: on or off, which days, and every block's times. */
export function ScheduleEditor() {
  const app = useApp();
  const s = app.state.schedule;
  const t = makeT(app.state.profile.lang);

  function patch(id: string, p: Partial<ScheduleBlock>) {
    app.setSchedule({ blocks: s.blocks.map((b) => (b.id === id ? { ...b, ...p } : b)) });
  }

  return (
    <Card>
      <Toggle title={t('sched_enabled')} desc={t('sched_desc')} on={s.enabled} onToggle={() => app.setSchedule({ enabled: !s.enabled })} />
      <Divider />
      <Micro>{t('sched_days')}</Micro>
      <Row style={{ gap: 6, flexWrap: 'wrap' }}>
        {WEEK.map((d) => (
          <Pill key={d} label={t(`wd_${d}`)} active={s.days.includes(d)} onPress={() => app.setSchedule({ days: s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d] })} />
        ))}
      </Row>
      <Divider />
      {orderedBlocks(s).map((b, i) => (
        <BlockRow key={b.id} block={b} first={i === 0} onChange={(p) => patch(b.id, p)} onRemove={b.kind === 'start' || b.kind === 'end' ? undefined : () => app.setSchedule({ blocks: s.blocks.filter((x) => x.id !== b.id) })} />
      ))}
      <Row style={{ gap: 8 }}>
        <Btn small tone="soft" label={t('sched_add_break')} onPress={() => app.setSchedule({ blocks: [...s.blocks, newBreak(orderedBlocks(s).filter((b) => b.kind !== 'end').slice(-1)[0] ?? null)] })} style={{ flex: 1 }} />
        <Btn small tone="ghost" label={t('sched_reset')} onPress={() => app.setSchedule(DEFAULT_SCHEDULE)} style={{ flex: 1 }} />
      </Row>
      <Small color={C.textFaint}>{t('sched_phone_note')}</Small>
    </Card>
  );
}

/** One block: its name, start, and end for the ones that have one. Only a valid time is saved. */
function BlockRow({ block, first, onChange, onRemove }: { block: ScheduleBlock; first: boolean; onChange: (p: Partial<ScheduleBlock>) => void; onRemove?: () => void }) {
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  const [start, setStart] = useState(block.start);
  const [end, setEnd] = useState(block.end ?? '');
  const hasEnd = block.kind !== 'start' && block.kind !== 'end';

  return (
    <View style={{ gap: 8, paddingVertical: 6 }}>
      {!first ? <Divider /> : null}
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: C.text, fontSize: F.body, fontWeight: '500' }}>{t(`blk_${block.kind}`)}</Text>
        {onRemove ? (
          <Pressable onPress={onRemove} hitSlop={10} accessibilityLabel={t('delete')}>
            <Ionicons name="close" size={16} color={C.textGhost} />
          </Pressable>
        ) : null}
      </Row>
      <Row style={{ gap: 10 }}>
        <Field
          label={hasEnd ? t('time_from') : t('sched_at')}
          value={start}
          placeholder="09:00"
          onChangeText={(v) => {
            setStart(v);
            if (isValidTime(v)) onChange({ start: v });
          }}
        />
        {hasEnd ? (
          <Field
            label={t('time_to')}
            value={end}
            placeholder="09:15"
            onChangeText={(v) => {
              setEnd(v);
              if (isValidTime(v)) onChange({ end: v });
            }}
          />
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </Row>
      {!isValidTime(start) || (hasEnd && !isValidTime(end)) ? <Micro color={C.amber}>{t('sched_time_hint')}</Micro> : null}
    </View>
  );
}
