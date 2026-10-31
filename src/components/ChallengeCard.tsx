import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { challengeText } from '../core/challenge';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card } from '../ui/components';
import { C, F, lh, S } from '../ui/theme';
import { spokenLine } from '../ui/toastWords';
import { useTodayChallenge } from './useRewards';

/**
 * "Today's challenge" on Today: one small step from the user's own last week
 * (core/challenge.ts), how far today has come, and "Done" once it is. Its
 * icon sits on the reward fill; the words are the page's. Nothing on an off
 * day. Read as one line by a screen reader.
 */
export function ChallengeCard() {
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  const today = useTodayChallenge();
  if (!today) return null;
  const { challenge, progress } = today;
  const text = challengeText(challenge, t);
  const sub = progress.done ? t('chal_done') : progress.of > 1 ? fill(t('chal_progress'), { n: progress.n, m: progress.of }) : null;
  return (
    <Card still>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessible accessibilityRole="text" accessibilityLabel={spokenLine([t('chal_title'), text, sub])}>
        <View style={{ width: 40, height: 40, borderRadius: S.radiusXs, backgroundColor: C.goldSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={progress.done ? 'checkmark' : 'flag-outline'} size={20} color={C.goldInk} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>{t('chal_title')}</Text>
          <Text style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{text}</Text>
          {sub ? <Text style={{ color: progress.done ? C.goldInk : C.textDim, fontSize: F.small, lineHeight: lh(F.small), fontWeight: progress.done ? '500' : '400' }}>{sub}</Text> : null}
        </View>
      </View>
    </Card>
  );
}
