import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { challengesDone, challengeText } from '../core/challenge';
import { medalFace, medalWords, nextWin, type Medal } from '../core/medals';
import { fill, makeT } from '../i18n';
import { useFeedback, useUndoShowing } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { useAnySheetOpen } from '../ui/announce';
import { Btn } from '../ui/components';
import { Sheet } from '../ui/Sheet';
import { C, F, lh, S, TITLE_WEIGHT } from '../ui/theme';
import { MedalArt } from './MedalArt';
import { useLoop } from './tiles/motion';
import { useChallengeData, useMedals, useTodayChallenge } from './useRewards';

/**
 * A win, made to feel like one. A medal earned fills the screen in the
 * reward colours: the medal with a soft shine crossing it, a few sparks
 * rising, its name and a word of what it took, a light tap on the phone, and
 * Keep going or See my medals. Today's challenge done is a smaller one, a
 * sheet. One at a time, each once (core/medals.ts `nextWin`); the first run
 * marks everything already earned as seen. With reduce motion on nothing
 * moves. Mounted on Today; says nothing when there is nothing new. A win
 * that lands while any sheet is open (the add sheet, "Save as my meal?" too,
 * the weight sheet) waits until it has closed, and a toast with Undo, or an
 * "… · Undo" line, stays uncovered until it has gone (five seconds at most),
 * so its Undo can still be reached.
 */
export function Celebration() {
  const app = useApp();
  const { haptic } = useFeedback();
  const { markCelebrated } = app;
  const { medals } = useMedals();
  const today = useTodayChallenge();
  const sheetOpen = useAnySheetOpen();
  const undoShowing = useUndoShowing();
  const { seed, next } = nextWin({ medals, challengeDone: !!today?.progress.done, today: app.today, celebrated: app.state.celebrated, waiting: sheetOpen || undoShowing });
  const nextId = next?.id;

  // Everything already earned on the first run, and old perfect weeks an edit brought back, count as seen, so nobody opens the
  // app to a flood of celebrations. Marking is idempotent, and once the ids are in there is nothing left to seed. A seed can
  // come together with a win to show, so the two are read on their own.
  useEffect(() => {
    if (seed) markCelebrated(seed);
  }, [seed, markCelebrated]);

  // A light tap when a new win appears, not on every render of the same one.
  useEffect(() => {
    if (nextId) haptic('light');
  }, [nextId, haptic]);

  if (!next) return null;
  const done = () => markCelebrated([next.id]);
  // Keyed on the win, so a second medal right after the first opens fresh: its shine and its sparks start again, and no tap of the first is carried over.
  return next.kind === 'medal' ? <MedalWin key={next.id} medal={next.medal} onDone={done} /> : <ChallengeWin key={next.id} onDone={done} />;
}

/** The full-screen celebration of a medal. */
function MedalWin({ medal, onDone }: { medal: Medal; onDone: () => void }) {
  const app = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = makeT(app.state.profile.lang);
  const reduce = useReducedMotion();
  const shine = useLoop(!reduce, 3200);
  const words = medalWords(medal, t);
  return (
    <Modal visible animationType="fade" onRequestClose={onDone}>
      <View accessibilityViewIsModal onAccessibilityEscape={onDone} style={{ flex: 1, backgroundColor: C.goldSoft }}>
        {reduce ? null : <Sparks loop={shine} />}
        {/* A scrolling page, so at a small screen and the largest text nothing runs off its ends; it fills the screen and centres its content when there is room. */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: S.gutter, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <MedalArt size={150} face={medalFace(medal.track, medal.n)} shine={reduce ? undefined : shine} />
          <Text style={{ color: C.goldInk, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{t('medal_new')}</Text>
          <Text accessibilityRole="header" style={{ color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: TITLE_WEIGHT, textAlign: 'center' }}>
            {words.title}
          </Text>
          <Text style={{ color: C.textDim, fontSize: F.body, lineHeight: lh(F.body), textAlign: 'center', maxWidth: 320 }}>{words.line}</Text>
          <View style={{ alignSelf: 'stretch', maxWidth: 320, width: '100%', marginHorizontal: 'auto', gap: 8, marginTop: 8 }}>
            <Btn label={t('celebrate_keep_going')} onPress={onDone} />
            <Btn
              tone="ghost"
              label={t('celebrate_see_medals')}
              onPress={() => {
                onDone();
                router.push('/progress');
              }}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Where the three sparks rise from, across the screen, and how far into the loop each starts. */
const SPARKS = [
  { left: '22%', top: '62%', phase: 0 },
  { left: '72%', top: '58%', phase: 0.33 },
  { left: '50%', top: '70%', phase: 0.66 },
] as const;

/** A few sparks of the reward metal rising and fading, each a third of the loop after the one before. */
function Sparks({ loop }: { loop: SharedValue<number> }) {
  return (
    <>
      {SPARKS.map((s) => (
        <Spark key={s.left} left={s.left} top={s.top} phase={s.phase} loop={loop} />
      ))}
    </>
  );
}

function Spark({ left, top, phase, loop }: { left: `${number}%`; top: `${number}%`; phase: number; loop: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = (loop.get() + phase) % 1;
    return { opacity: 0.8 * (1 - p), transform: [{ translateY: -120 * p }] };
  });
  return <Animated.View style={[{ pointerEvents: 'none', position: 'absolute', left, top, width: 6, height: 6, borderRadius: 3, backgroundColor: C.gold }, style]} />;
}

/** The smaller celebration of today's challenge done: a sheet. */
function ChallengeWin({ onDone }: { onDone: () => void }) {
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  const today = useTodayChallenge();
  const data = useChallengeData();
  if (!today) return null;
  const n = challengesDone(data, app.today);
  return (
    <Sheet open title={t('chal_done_title')} onClose={onDone}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.goldSoft, borderRadius: S.radiusSm, padding: 14 }}>
        <Ionicons name="checkmark-circle" size={28} color={C.goldInk} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{challengeText(today.challenge, t)}</Text>
          <Text style={{ color: C.goldInk, fontSize: F.small, lineHeight: lh(F.small) }}>{n <= 1 ? t('chal_count_one') : fill(t('chal_count'), { n })}</Text>
        </View>
      </View>
      <Btn label={t('celebrate_keep_going')} onPress={onDone} />
    </Sheet>
  );
}
