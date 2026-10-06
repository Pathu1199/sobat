import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { activeBlock, CHECKINS, checkinKey, minutesLeft, nextBlock } from '../core/schedule';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useMinute } from '../services/useWorkSchedule';
import { useApp } from '../store/AppProvider';
import { Card, Micro, Row } from '../ui/components';
import { Checklist } from '../ui/tiles';
import { C, F } from '../ui/theme';

/**
 * During a break of the office day: what to do with it, as ticks. Between
 * breaks, one quiet line saying what comes next. Nothing on a day off.
 */
export function BreakCheckin() {
  const app = useApp();
  const router = useRouter();
  const fb = useFeedback();
  const { schedule, profile, settings } = app.state;
  const lang = profile.lang;
  const t = makeT(lang);
  const minute = useMinute();

  const active = activeBlock(schedule, app.today, minute);
  const next = active ? null : nextBlock(schedule, app.today, minute);

  if (!active && !next) return null;

  if (!active && next) {
    return (
      <Row style={{ gap: 8, paddingHorizontal: 4 }}>
        <Ionicons name="time-outline" size={14} color={C.textFaint} />
        <Micro>{fill(t('sched_next'), { b: t(`blk_${next.kind}`), t: next.start })}</Micro>
      </Row>
    );
  }

  const block = active!;
  const items = CHECKINS[block.kind].map((item) => ({ key: checkinKey(block, item), item, label: t(`chk_${item}`), done: app.actionsDoneToday.includes(checkinKey(block, item)) }));

  function toggle(key: string) {
    const entry = items.find((i) => i.key === key);
    if (!entry) return;
    const turningOn = !entry.done;
    app.toggleAction(key);
    // Ticking water is drinking water; it counts towards the day.
    if (entry.item === 'water') {
      if (turningOn) {
        app.addWater(settings.glassMl);
        fb.notify(t('toast_water_added'));
      } else {
        app.undoWater();
      }
    }
    if (turningOn && (entry.item === 'log_lunch' || entry.item === 'log_dinner')) router.push('/log');
    if (turningOn) fb.haptic('light');
  }

  const left = minutesLeft(block, minute);
  const allDone = items.every((i) => i.done);

  return (
    <Card rail={allDone ? C.green : C.amber}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ gap: 8 }}>
          <Ionicons name={block.kind === 'lunch' ? 'restaurant-outline' : block.kind === 'end' ? 'home-outline' : 'cafe-outline'} size={16} color={allDone ? C.green : C.amber} />
          <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '600' }}>{t(`blk_${block.kind}`)}</Text>
        </Row>
        <Micro color={left <= 3 ? C.amber : C.textFaint}>{block.end ? fill(t('sched_left'), { n: left }) : block.start}</Micro>
      </Row>
      <View>
        <Checklist color={allDone ? C.green : C.amber} items={items.map(({ key, label, done }) => ({ key, label, done }))} onToggle={toggle} />
      </View>
    </Card>
  );
}
