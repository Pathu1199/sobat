import React, { useState } from 'react';
import { View } from 'react-native';
import { sheetAmount } from '../../core/tiles';
import type { ISODate } from '../../core/types';
import { makeT } from '../../i18n';
import { useFeedback } from '../../services/feedback';
import { useApp } from '../../store/AppProvider';
import { Btn, Field, Micro, Pill, Row } from '../../ui/components';
import { Sheet } from '../../ui/Sheet';
import { bottleLabel, bottleName, walkGoalLabel, walkGoalName, type Added } from '../../ui/tileWords';

/** The bottle sizes and walk goals offered here and in Settings. */
export const BOTTLES = [500, 750, 1000];
export const WALK_GOALS = [20, 30, 45, 60];

/**
 * A long press on the water or walk tile: the bottle size or the walk goal,
 * and another amount for the day shown. While it closes it keeps the title
 * and the body of the kind it was opened for, so walk never turns into water
 * as it slides away.
 */
export function TileSheet({ kind, date, onClose, onAdded }: { kind: 'water' | 'walk' | null; date: ISODate; onClose: () => void; onAdded: (a: Added) => void }) {
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  const [last, setLast] = useState(kind);
  // State that follows a changed value is adjusted while rendering: the kind last opened stays until another is.
  if (kind !== null && kind !== last) setLast(kind);
  const shown = kind ?? last;
  return (
    <Sheet open={kind !== null} title={shown === 'walk' ? t('tile_walk') : t('water')} onClose={onClose}>
      {shown ? <TileSheetBody key={shown} kind={shown} date={date} onClose={onClose} onAdded={onAdded} /> : null}
    </Sheet>
  );
}

function TileSheetBody({ kind, date, onClose, onAdded }: { kind: 'water' | 'walk'; date: ISODate; onClose: () => void; onAdded: (a: Added) => void }) {
  const app = useApp();
  const fb = useFeedback();
  const t = makeT(app.state.profile.lang);
  const { bottleMl, walkGoalMin } = app.state.settings;
  const [amount, setAmount] = useState('');
  const n = sheetAmount(kind, amount);
  // Nothing is drunk or walked in the future: the store would log nothing, so Add stays off there.
  const ok = n !== null && date <= app.today;

  function add() {
    if (n === null || !ok) return;
    const id = kind === 'water' ? app.addWater(n, date) : app.logWalk(date, n);
    fb.haptic('light');
    onAdded({ kind, id, amount: n, date });
    onClose();
  }

  return (
    <View style={{ gap: 14 }}>
      <Micro>{kind === 'water' ? t('tile_bottle_size') : t('walk_target')}</Micro>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        {kind === 'water'
          ? BOTTLES.map((ml) => <Pill key={ml} label={bottleLabel(ml, t)} accessibilityLabel={bottleName(ml, t)} active={bottleMl === ml} onPress={() => app.setSettings({ bottleMl: ml })} />)
          : WALK_GOALS.map((m) => <Pill key={m} label={walkGoalLabel(m, t)} accessibilityLabel={walkGoalName(m, t)} active={walkGoalMin === m} onPress={() => app.setSettings({ walkGoalMin: m })} />)}
      </Row>
      <Micro>{t('tile_other_amount')}</Micro>
      <Row style={{ gap: 10, alignItems: 'flex-end' }}>
        <Field label={kind === 'water' ? t('tile_amount_ml') : t('tile_amount_min')} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder={kind === 'water' ? '250' : '15'} />
        <Btn label={t('water_add')} onPress={add} disabled={!ok} />
      </Row>
    </View>
  );
}
