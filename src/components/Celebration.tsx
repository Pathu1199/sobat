import { useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import { BADGE_ICON, nextWin } from '../core/game';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Btn } from '../ui/components';
import { GradientBanner } from '../ui/GradientBanner';
import { Sheet } from '../ui/Sheet';
import { C, F } from '../ui/theme';
import { useGame } from './MountainCard';

const LEVEL_ICON: Record<string, string> = { camp1: '⛺', camp2: '🏕️', camp3: '🧗', camp4: '🏔️', summit: '🚩' };

/**
 * A win, made to feel like one: a badge earned, a camp reached, the week's
 * challenge done. One at a time, each once, on the brand gradient with the
 * points so far. Mounted on Today; says nothing when there is nothing new.
 */
export function Celebration() {
  const app = useApp();
  const router = useRouter();
  const fb = useFeedback();
  const t = makeT(app.state.profile.lang);
  const g = useGame();
  const earned = useMemo(() => g.badges.filter((b) => b.earned).map((b) => b.key), [g.badges]);
  const { seed, next } = nextWin({ earned, level: g.level.key, challenge: g.challenge, celebrated: app.state.celebrated });

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
      <GradientBanner style={{ alignItems: 'center', paddingVertical: 28 }}>
        <Text style={{ fontSize: 64 }}>{icon}</Text>
        <Text style={{ color: '#FFFFFF', fontSize: F.h1, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 }}>{title}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: F.body, fontWeight: '600', textAlign: 'center' }}>{sub}</Text>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, marginTop: 4 }}>
          <Text style={{ color: '#FFFFFF', fontSize: F.small, fontWeight: '800' }}>{`${g.points} XP · ${t(`level_${g.level.key}`)}`}</Text>
        </View>
      </GradientBanner>
      <Btn label={t('celebrate_keep')} onPress={done} />
      <Btn
        tone="ghost"
        label={t('celebrate_see')}
        onPress={() => {
          done();
          router.push('/progress');
        }}
      />
      <Text style={{ color: C.textFaint, fontSize: F.tiny, textAlign: 'center' }}>{t('celebrate_footer')}</Text>
    </Sheet>
  );
}
