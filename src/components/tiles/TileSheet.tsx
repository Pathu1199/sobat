import React, { useState } from 'react';
import { View } from 'react-native';
import { sheetAmount } from '../../core/tiles';
import type { ISODate } from '../../core/types';
import { makeT } from '../../i18n';
import { useFeedback } from '../../services/feedback';
import { useApp } from '../../store/AppProvider';
import { Btn, Field, Micro, Pill, Row } from '../../ui/components';
import { Sheet } from '../../ui/Sheet';
import { bottleLabel, type Added } from '../../ui/tileWords';

const BOTTLES = [500, 750, 1000];
const WALK_GOALS = [20, 30, 45, 60];

/** A long press on the water or walk tile: the bottle size or the walk goal, and another amount for the day shown. */
export function TileSheet({ kind, date, onClose, onAdded }: { kind: 'water' | 'walk' | null; date: ISODate; onClose: () => void; onAdded: (a: Added) => void }) {
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  return (
    <Sheet open={kind !== null} title={kind === 'walk' ? t('tile_walk') : t('water')} onClose={onClose}>
      {kind ? <TileSheetBody key={kind} kind={kind} date={date} onClose={onClose} onAdded={onAdded} /> : null}
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
    onAdded({ kind, id, amount: n });
    onClose();
  }

  return (
    <View style={{ gap: 14 }}>
      <Micro>{kind === 'water' ? t('tile_bottle_size') : t('walk_target')}</Micro>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        {kind === 'water'
          ? BOTTLES.map((ml) => <Pill key={ml} label={bottleLabel(ml, t)} active={bottleMl === ml} onPress={() => app.setSettings({ bottleMl: ml })} />)
          : WALK_GOALS.map((m) => <Pill key={m} label={`${m} ${t('tile_unit_min')}`} active={walkGoalMin === m} onPress={() => app.setSettings({ walkGoalMin: m })} />)}
      </Row>
      <Micro>{t('tile_other_amount')}</Micro>
      <Row style={{ gap: 10, alignItems: 'flex-end' }}>
        <Field label={kind === 'water' ? t('tile_amount_ml') : t('tile_amount_min')} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder={kind === 'water' ? '250' : '15'} />
        <Btn label={t('water_add')} onPress={add} disabled={!ok} />
      </Row>
    </View>
  );
}
