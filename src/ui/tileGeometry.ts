import { lh } from './theme';

/**
 * Where the living tiles draw. The words sit in a fixed place at the top of
 * every tile; the art has the bottom 42%, which on a square tile is a 100 × 42
 * box, and every art component draws in that box so a marker such as the flag
 * stays exactly where it belongs. The tile's own type sizes (from the spec's
 * tile layout) scale with the person's text size; at a large size the tile
 * grows taller rather than letting the art reach the words. Pure: the point
 * lookups also run on the UI thread inside animations, so they are worklets.
 */
export type Pt = { x: number; y: number };

export const ART_W = 100;
export const ART_H = 42;
/** The share of the tile's height the art may use, from the bottom. */
export const ART_SHARE = 0.42;
/** The words' margins: from the top, and from both sides. */
export const TILE_TOP = 14;
export const TILE_SIDE = 15;
export const TILE_RADIUS = 22;
/** Space between the name, the number and the short line. */
export const TILE_LINE_GAP = 2;
/** Room left under the short line before the art zone starts. */
const TILE_GAP = 6;

const BASE = { name: 13, number: 30, unit: 14, line: 12 };
export type TileType = typeof BASE;

/** The tile's type at a text scale, in whole points. */
export function tileType(scale: number): TileType {
  return {
    name: Math.round(BASE.name * scale),
    number: Math.round(BASE.number * scale),
    unit: Math.round(BASE.unit * scale),
    line: Math.round(BASE.line * scale),
  };
}

/** The height of the words: the name line, the number (tight, it has no matras) and the short line. */
export function tileTextHeight(scale: number): number {
  const ty = tileType(scale);
  return lh(ty.name) + TILE_LINE_GAP + lh(ty.number, true) + TILE_LINE_GAP + lh(ty.line);
}

/** The least height that keeps the words above the art zone. A tile is square unless this is taller. */
export function tileMinHeight(scale: number): number {
  return Math.ceil((TILE_TOP + tileTextHeight(scale) + TILE_GAP) / (1 - ART_SHARE));
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** An SVG path through the points. */
export function toPath(points: Pt[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${r1(p.x)} ${r1(p.y)}`).join(' ');
}

export function polylineLength(points: Pt[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}

/** The point a fraction of the way along the points, held at both ends. Runs inside animations. */
export function pointAlong(points: Pt[], fraction: number): Pt {
  'worklet';
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1 || fraction <= 0) return points[0];
  // The ends exactly, so a full streak sits on the summit and not a rounding error short of it.
  if (fraction >= 1) return points[points.length - 1];
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  let want = fraction * total;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg > 0 && want <= seg) {
      const k = want / seg;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    want -= seg;
  }
  return points[points.length - 1];
}

/** A smooth curve through four control points, as `n` straight pieces. */
export function cubicPoints(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 24): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({
      x: r1(u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x),
      y: r1(u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y),
    });
  }
  return out;
}

/** Part of a circle, from one angle to another in degrees (0 points right, 270 straight up on screen), as `n` pieces. */
export function arcPoints(cx: number, cy: number, r: number, fromDeg: number, toDeg: number, n = 24): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = ((fromDeg + ((toDeg - fromDeg) * i) / n) * Math.PI) / 180;
    out.push({ x: r1(cx + r * Math.cos(a)), y: r1(cy + r * Math.sin(a)) });
  }
  return out;
}

/** The top of the water: a gentle wave `amp` high, filled down to `height`, `width` wide. */
export function wavePath(width: number, wavelength: number, amp: number, height: number): string {
  const half = wavelength / 2;
  let d = `M0 ${amp}`;
  let up = true;
  for (let x = 0; x < width - 0.01; x += half) {
    d += ` Q${r1(x + half / 2)} ${up ? 0 : 2 * amp} ${r1(x + half)} ${amp}`;
    up = !up;
  }
  return `${d} L${r1(width)} ${height} L0 ${height} Z`;
}

/** How bright star `i` of three is at loop time `t` (0 to 1): each twinkles a third of a turn after the one before. */
export function starOpacity(t: number, i: number): number {
  'worklet';
  return 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (t + i / 3)));
}

/** Walk: a dotted path from the start to a goal ring; the walker dot rides it. */
export const WALK_PATH: Pt[] = cubicPoints({ x: 6, y: 34 }, { x: 34, y: 46 }, { x: 58, y: 0 }, { x: 84, y: 16 });
export const WALK_GOAL: Pt = { x: 90, y: 14 };

/** Sleep: a night arc from the left over the top to the right, and three stars. */
export const NIGHT_ARC: Pt[] = arcPoints(50, 40, 32, 180, 360);
export const STARS: Pt[] = [
  { x: 10, y: 10 },
  { x: 90, y: 7 },
  { x: 50, y: 28 },
];

/** Streak: a mountain; the climb runs up its left ridge to the summit, where the flag stands. */
export const MOUNTAIN: Pt[] = [
  { x: 2, y: 42 },
  { x: 26, y: 24 },
  { x: 38, y: 30 },
  { x: 64, y: 10 },
  { x: 80, y: 22 },
  { x: 98, y: 42 },
];
export const RIDGE: Pt[] = MOUNTAIN.slice(0, 4);
export const SUMMIT: Pt = MOUNTAIN[3];
export const FLAG_TOP: Pt = { x: 64, y: 0 };
export const FLAG_D = 'M64 0 L73 2.5 L64 5 Z';

/** Breathe: a circle in the middle that grows and shrinks between these radii. */
export const BREATHE_CENTRE: Pt = { x: 50, y: 21 };
export const BREATHE_MIN_R = 7;
export const BREATHE_MAX_R = 19;
