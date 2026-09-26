import React from 'react';
import { Text } from 'react-native';
import { biggestLever, type DayScore } from '../core/insights';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, Micro, RingStat, Row, Small } from '../ui/components';
import { C, F, scoreColor } from '../ui/theme';

/** Five rings, one composite number, and the sentence that explains it. */
export function DayScoreCard({ score }: { score: DayScore }) {
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  const lever = biggestLever(score);
  const known = [score.eating, score.movement, score.water, score.sleep, score.mood].filter((n) => n !== null).length;

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Micro>{t('day_score')}</Micro>
        <Row style={{ gap: 6, alignItems: 'baseline' }}>
          <Text style={{ color: known > 0 ? scoreColor(score.total) : C.textGhost, fontSize: F.h1, fontWeight: '300', letterSpacing: -1 }}>
            {known > 0 ? score.total : '--'}
          </Text>
          <Micro>/ 100</Micro>
        </Row>
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <RingStat label={t('eaten')} value={score.eating} color={scoreColor(score.eating)} />
        <RingStat label={t('burned')} value={score.movement} color={scoreColor(score.movement)} />
        <RingStat label={t('water')} value={score.water} color={scoreColor(score.water)} />
        <RingStat label={t('sleep_title')} value={score.sleep} color={scoreColor(score.sleep)} />
        <RingStat label={t('mind_title')} value={score.mood} color={scoreColor(score.mood)} />
      </Row>
      <Small color={lever ? C.amber : C.textFaint}>{lever ? t(`lever_${lever}`) : t('lever_none')}</Small>
    </Card>
  );
}
