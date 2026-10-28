import { useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import { BADGE_ICON, nextWin } from '../core/game';
import { fill, makeT } from '../i18n';
import { useFeedback, useUndoToastShowing } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Btn } from '../ui/components';
import { Banner } from '../ui/Banner';
import { Sheet } from '../ui/Sheet';
import { C, F, lh } from '../ui/theme';
import { useAddSheetOpen } from './AddSheet';
import { useGame } from './MountainCard';

const LEVEL_ICON: Record<string, string> = { camp1: '⛺', camp2: '🏕️', camp3: '🧗', camp4: '🏔️', summit: '🚩' };

/**
 * A win, made to feel like one: a badge earned, a camp reached, the week's
 * challenge done. One at a time, each once, on a flat panel with the
 * points so far. Mounted on Today; says nothing when there is nothing new.
 * A win that lands from the add sheet waits until the sheet has closed, its
 * "Save as my meal?" too, so the two never sit on each other, and a toast with
 * Undo stays uncovered until it has gone, so its Undo can still be reached.
 */
export function Celebration() {
  const app = useApp();
  const router = useRouter();
  const fb = useFeedback();
  const t = makeT(app.state.profile.lang);
  const g = useGame();
  const earned = useMemo(() => g.badges.filter((b) => b.earned).map((b) => b.key), [g.badges]);
  const sheetOpen = useAddSheetOpen();
  const undoShowing = useUndoToastShowing();
  const waiting = sheetOpen || undoShowing;
  const { seed, next } = nextWin({ earned, level: g.level.key, challenge: g.challenge, celebrated: app.state.celebrated, waiting });

  // First run: everything already earned counts as seen, so nobody opens the app to ten pop-ups.
  useEffect(() => {
    if (seed) app.markCelebrated(seed);
    // The seed is decided once per load; the action is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.join('|')]);

  useEffect(() => {
    if (next) fb.haptic('success');
    // A buzz when a new win appears, not on every render of the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next?.id]);

  if (!next) return null;
  const icon = next.kind === 'badge' ? BADGE_ICON[next.key] ?? '🏅' : next.kind === 'level' ? LEVEL_ICON[next.key] ?? '⛰️' : '🏆';
  const title = next.kind === 'badge' ? t(`badge_${next.key}`) : next.kind === 'level' ? t(`level_${next.key}`) : fill(t(`challenge_${next.key}`), { n: g.challenge.target });
  const sub = t(`celebrate_${next.kind}`);
  const done = () => app.markCelebrated([next.id]);

  return (
    <Sheet open title={t('celebrate_title')} onClose={done}>
      <Banner style={{ alignItems: 'center', paddingVertical: 28 }}>
        <Text style={{ fontSize: 64 }}>{icon}</Text>
        <Text style={{ color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500', textAlign: 'center' }}>{title}</Text>
        <Text style={{ color: C.textDim, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '400', textAlign: 'center' }}>{sub}</Text>
        <View style={{ backgroundColor: C.accentDim, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, marginTop: 4 }}>
          <Text style={{ color: C.accentText, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{`${fill(t('points_n'), { n: g.points })} · ${t(`level_${g.level.key}`)}`}</Text>
        </View>
      </Banner>
      <Btn label={t('celebrate_keep')} onPress={done} />
      <Btn
        tone="ghost"
        label={t('celebrate_see')}
        onPress={() => {
          done();
          router.push('/progress');
        }}
      />
      <Text style={{ color: C.textFaint, fontSize: F.small, textAlign: 'center' }}>{t('celebrate_footer')}</Text>
    </Sheet>
  );
}
