import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { medalFace, shelf, shelfWords } from '../core/medals';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card } from '../ui/components';
import { C, F, lh, MICRO } from '../ui/theme';
import { MedalArt } from './MedalArt';
import { useMedals } from './useRewards';

/**
 * The trophy shelf on Progress: every medal earned (the kilos as the highest
 * one, a job's perfect weeks as one with how many), then the next medal of
 * each track, faded, with how far it is ("9 to go"). Three to a row; each
 * place is read as one line.
 */
export function TrophyShelf() {
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  const { input, medals } = useMedals();
  const tiles = useMemo(() => shelf(input), [input]);
  return (
    <Card>
      <Text accessibilityRole="header" style={[MICRO, { color: C.textDim }]}>
        {`${t('shelf_title')} · ${fill(t('shelf_count'), { n: medals.length })}`}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 }}>
        {tiles.map((tile) => {
          const w = shelfWords(tile, t);
          return (
            <View key={tile.key} accessible accessibilityLabel={[w.label, w.sub].filter(Boolean).join(', ')} style={{ width: '33.33%', alignItems: 'center', gap: 4, paddingHorizontal: 2 }}>
              <MedalArt size={56} face={medalFace(tile.track, tile.n)} faded={!tile.earned} />
              <Text style={{ color: C.text, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500', textAlign: 'center' }}>{w.label}</Text>
              {w.sub ? <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small), textAlign: 'center' }}>{w.sub}</Text> : null}
            </View>
          );
        })}
      </View>
    </Card>
  );
}
