import React, { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector, PointerType } from 'react-native-gesture-handler';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { cellAt, cellLabel, cellState, linePoints } from '../core/puzzleScreen';
import type { Cell, ZipPuzzle } from '../core/zip';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { C, S } from '../ui/theme';

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
 */
export function ZipBoard({ puzzle, path, onReach, locked, solved, width }: { puzzle: ZipPuzzle; path: Cell[]; onReach: (cell: Cell) => void; locked: boolean; solved: boolean; width: number }) {
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  const { size } = puzzle;
  const side = Math.max(1, Math.floor(width / size));
  const px = side * size;

  const reach = (x: number, y: number, inset: number) => {
    const cell = cellAt(x, y, px, size, inset);
    if (cell !== null) onReach(cell);
  };
  const guard = useTouchGuard();
  // On the JS thread: `onReach` is plain React, and a stroke is a few events a frame at most.
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .enabled(!locked)
    .onBegin((e) => {
      // On the web a key (Enter, Space) on a focused square also starts the pan, with no finger to place: the square's own press takes it.
      if (e.pointerType === PointerType.KEY) return;
      guard.down();
      reach(e.x, e.y, 0);
    })
    .onUpdate((e) => {
      if (e.pointerType !== PointerType.KEY) reach(e.x, e.y, DRAG_INSET);
    })
    .onFinalize(() => guard.up());

  const accent = solved ? C.gold : C.accent;
  const tint = solved ? C.goldSoft : C.accentSoft;
  const stroke = side * 0.4;
  const dot = Math.round(side * 0.6);
  const points = linePoints(path, size, px);
  const cells = Array.from({ length: size * size }, (_, c) => c);
  const start = Number(Object.keys(puzzle.clues).find((k) => puzzle.clues[Number(k)] === 1));

  return (
    <View
      role="group"
      accessibilityLabel={fill(t('zip_board'), { n: size })}
      style={{ alignSelf: 'center', width: px, height: px, borderRadius: S.radiusSm, backgroundColor: C.card, ...S.shadow }}>
      <GestureDetector gesture={pan}>
        <View style={{ width: px, height: px, borderRadius: S.radiusSm, overflow: 'hidden', userSelect: 'none' }}>
          {/* The squares: a light tint where the line is, and a thin line to the right of and under each. */}
          {cells.map((c) => {
            const row = Math.floor(c / size);
            const col = c % size;
            const state = cellState(path, c);
            const n = puzzle.clues[c] ?? 0;
            return (
              <Pressable
                key={c}
                disabled={locked}
                onPress={() => {
                  if (guard.pressAllowed()) onReach(c);
                }}
                accessibilityRole="button"
                accessibilityLabel={cellLabel({ cell: c, size, number: n, state }, t)}
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
          })}

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
            if (n === 0) return null;
            const left = (c % size) * side + (side - dot) / 2;
            const top = Math.floor(c / size) * side + (side - dot) / 2;
            const ring = path.length === 0 && c === start && !locked;
            return (
              <View
                key={c}
                aria-hidden
                importantForAccessibility="no-hide-descendants"
                style={{
                  position: 'absolute',
                  pointerEvents: 'none',
                  left,
                  top,
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
                  {n}
                </Text>
              </View>
            );
          })}
        </View>
      </GestureDetector>
    </View>
  );
}

/**
 * A finger on the board is the pan's. The square it first touched also gets a press when the finger lifts, wherever the finger had gone
 * by then, and that press would cut the line back to the square the stroke began on. So while a touch is the pan's, and for a moment
 * after it, a square's own press does nothing: what reaches `onPress` is then a screen reader's activation or a key. (A hook of its own
 * so the ref stays out of the render that builds the gesture.)
 */
function useTouchGuard() {
  const touching = useRef(false);
  return {
    down: () => {
      touching.current = true;
    },
    up: () => {
      setTimeout(() => {
        touching.current = false;
      }, 300);
    },
    pressAllowed: () => !touching.current,
  };
}
