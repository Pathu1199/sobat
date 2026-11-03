import React, { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector, PointerType, type ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { boardPx, cellAt, cellLabel, cellState, linePoints, pressAllowed, type CellState } from '../core/puzzleScreen';
import { cellOfNumber, rowCol, type Cell, type ZipPuzzle } from '../core/zip';
import { fill, makeT } from '../i18n';
import type { Lang } from '../core/types';
import { useApp } from '../store/AppProvider';
import { C, S, themeMode } from '../ui/theme';

/**
 * How much of each edge of a square a moving finger ignores, as a fraction of the square: a finger cutting the corner between two
 * squares then touches neither, so it cannot cut the line back by brushing a square it did not mean. A touch-down or a tap has none.
 */
const DRAG_INSET = 0.15;

/**
 * Today's puzzle board: a grid of squares with thin lines between, the numbers in dark circles, and the line as one thick rounded
 * stroke in the accent colour over a light tint on the squares it covers (gold, once the puzzle is solved). `path` is the line drawn so far.
 *
 * The finger draws it: a pan, from the first touch (so a tap on a square is the same as a stroke that stays in it), tells `onReach`
 * each square it comes to, and `step` in the puzzle's core decides what the line does with it. Every square is also a button with its own
 * label ("Row 2, column 3, number 4, on the line") that does the same on activation, so the puzzle can be played one tap at a time, by a
 * screen reader and from a keyboard. `locked` leaves the board to look at (a solved day). The drawing itself does not move.
 * `width` is the room the board has, in points; it takes the whole squares that fit.
 *
 * `scrollRef` is the ref of the page's scroll view (`Screen`'s `scrollRef`): the pan blocks it, so on a phone a stroke that runs
 * up or down the board draws instead of scrolling the page.
 *
 * Each square and each number is a memoised piece of its own with plain props, so a step of the line redraws only the squares that
 * changed (the end it left and the end it reached), not all 64 of an 8 x 8 board; `onReach` must be the same function from one render to the next.
 */
export function ZipBoard({
  puzzle,
  path,
  onReach,
  locked,
  solved,
  width,
  scrollRef,
}: {
  puzzle: ZipPuzzle;
  path: Cell[];
  onReach: (cell: Cell) => void;
  locked: boolean;
  solved: boolean;
  width: number;
  scrollRef?: React.RefObject<GestureScrollView | null>;
}) {
  const app = useApp();
  const lang = app.state.profile.lang;
  const { size } = puzzle;
  const px = boardPx(width, size);
  const side = px / size;

  const [guard] = useState(makeTouchGuard);
  // The pan and the press are made once and change only with what they depend on (the puzzle, the board's size, whether it is locked),
  // not with every step of the line: a new gesture each render is a new thing for the detector to take up, and a new `press` would
  // redraw every square. (The React Compiler leaves a Gesture Handler chain as it is, so these are said outright.)
  // On the JS thread: `onReach` is plain React, and a stroke is a few events a frame at most.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .enabled(!locked)
        .blocksExternalGesture(...(scrollRef ? [scrollRef] : []))
        .onBegin((e) => {
          // On the web a key (Enter, Space) on a focused square also starts the pan, with no finger to place: the square's own press takes it.
          if (e.pointerType === PointerType.KEY) return;
          guard.begin();
          reachAt(onReach, e.x, e.y, px, size, 0);
        })
        .onUpdate((e) => {
          if (e.pointerType === PointerType.KEY) return;
          guard.moved();
          reachAt(onReach, e.x, e.y, px, size, DRAG_INSET);
        })
        .onFinalize(() => guard.end()),
    [locked, scrollRef, guard, onReach, px, size],
  );

  // A square's own press: a screen reader's activation or a key, not the press that comes with a finger lifting off a stroke.
  const press = useCallback(
    (cell: Cell) => {
      if (guard.allowed()) onReach(cell);
    },
    [guard, onReach],
  );

  const accent = solved ? C.gold : C.accent;
  // Under the line, a light tint: the accent's soft tone by day, its dim one in the dark, where the soft one is heavy on the card.
  const tint = solved ? C.goldSoft : themeMode() === 'dark' ? C.accentDim : C.accentSoft;
  const stroke = side * 0.4;
  const points = linePoints(path, size, px);
  const cells = Array.from({ length: size * size }, (_, c) => c);
  const start = cellOfNumber(puzzle, 1);
  const t = makeT(lang);

  return (
    <View
      role="group"
      accessibilityLabel={fill(t('zip_board'), { n: size })}
      style={{ alignSelf: 'center', width: px, height: px, borderRadius: S.radiusSm, backgroundColor: C.card, ...S.shadow }}>
      <GestureDetector gesture={pan}>
        <View style={{ width: px, height: px, borderRadius: S.radiusSm, overflow: 'hidden' }}>
          {/* The squares: a light tint where the line is, and a thin line to the right of and under each. */}
          {cells.map((c) => (
            <ZipCell key={c} cell={c} size={size} side={side} state={cellState(path, c)} number={puzzle.clues[c] ?? 0} locked={locked} tint={tint} lang={lang} onPress={press} />
          ))}

          {/* The line, under the numbers and out of the way of the squares' buttons. */}
          <Svg width={px} height={px} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
            {points.length === 1 ? <Circle cx={points[0].x} cy={points[0].y} r={stroke / 2} fill={accent} /> : null}
            {points.length > 1 ? (
              <Polyline points={points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={accent} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
            ) : null}
          </Svg>

          {/* The numbers, in circles of the text colour over the line; 1 wears a ring in the accent while there is no line, to say where to start. */}
          {cells.map((c) => {
            const n = puzzle.clues[c] ?? 0;
            return n === 0 ? null : <ZipNumber key={c} cell={c} size={size} side={side} number={n} ring={path.length === 0 && c === start && !locked} />;
          })}
        </View>
      </GestureDetector>
    </View>
  );
}

/** Tells `onReach` the square a point on the board is in (nothing when it is in none, or in the inset's edge of one). */
function reachAt(onReach: (cell: Cell) => void, x: number, y: number, px: number, size: number, inset: number) {
  const cell = cellAt(x, y, px, size, inset);
  if (cell !== null) onReach(cell);
}

/**
 * One square: its tint when the line is on it, the thin line to its right and under it, and its own button with its spoken label.
 * Memoised on plain props, so it redraws only when its own state, number or colours change.
 */
const ZipCell = memo(function ZipCell({
  cell,
  size,
  side,
  state,
  number,
  locked,
  tint,
  lang,
  onPress,
}: {
  cell: Cell;
  size: number;
  side: number;
  state: CellState;
  number: number;
  locked: boolean;
  tint: string;
  lang: Lang;
  onPress: (cell: Cell) => void;
}) {
  const { row, col } = rowCol(cell, size);
  return (
    <Pressable
      disabled={locked}
      onPress={() => onPress(cell)}
      accessibilityRole="button"
      accessibilityLabel={cellLabel({ cell, size, number, state }, makeT(lang))}
      accessibilityState={{ disabled: locked }}
      style={{
        position: 'absolute',
        left: col * side,
        top: row * side,
        width: side,
        height: side,
        backgroundColor: state === 'free' ? 'transparent' : tint,
        borderRightWidth: col < size - 1 ? S.hairline : 0,
        borderBottomWidth: row < size - 1 ? S.hairline : 0,
        borderColor: C.borderStrong,
      }}
    />
  );
});

/** One number, in a circle of the text colour (with a ring in the accent on the square to start from); memoised on plain props. */
const ZipNumber = memo(function ZipNumber({ cell, size, side, number, ring }: { cell: Cell; size: number; side: number; number: number; ring: boolean }) {
  const dot = Math.round(side * 0.6);
  const { row, col } = rowCol(cell, size);
  return (
    <View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        left: col * side + (side - dot) / 2,
        top: row * side + (side - dot) / 2,
        width: dot,
        height: dot,
        borderRadius: dot / 2,
        backgroundColor: C.text,
        alignItems: 'center',
        justifyContent: 'center',
        ...(ring ? { borderWidth: 3, borderColor: C.accent } : null),
      }}>
      {/* Sized to the square, not to the text-size setting, so a number never outgrows its circle. */}
      <Text allowFontScaling={false} style={{ color: C.card, fontSize: Math.round(side * 0.34), lineHeight: Math.round(side * 0.4), fontWeight: '500', fontVariant: ['tabular-nums'] }}>
        {number}
      </Text>
    </View>
  );
});

/**
 * What the board knows of the touches on it, for `pressAllowed`: whether a finger is down and when the pan last heard from it (it
 * began, moved or ended). A square's own press arrives just after a finger lifts, for the square the stroke began on, and would cut the
 * line back to it; a clock tells it from a screen reader's activation or a key, so nothing here is a timer and a quick second stroke
 * cannot be cut by the first one's. Made once per board (state, so the same object every render), with its own variables rather than a
 * ref, which the render that builds the gesture may not read.
 */
function makeTouchGuard() {
  let active = false;
  let at = Number.NEGATIVE_INFINITY;
  return {
    begin: () => {
      active = true;
      at = Date.now();
    },
    moved: () => {
      at = Date.now();
    },
    end: () => {
      active = false;
      at = Date.now();
    },
    allowed: () => pressAllowed(Date.now(), at, active),
  };
}
