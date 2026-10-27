import { describe, expect, it } from 'vitest';
import { S, TEXT_SCALES } from '../theme';
import {
  ART_FIT,
  ART_H,
  ART_SHARE,
  ART_W,
  arcPoints,
  BREATHE_CENTRE,
  BREATHE_MAX_R,
  FLAG,
  FLAG_D,
  FLAG_TOP,
  MOUNTAIN,
  NIGHT_ARC,
  pointAlong,
  polylineLength,
  restOfSweep,
  RIDGE,
  STARS,
  starOpacity,
  SUMMIT,
  TILE_TOP,
  tileMinHeight,
  tileTextHeight,
  tileType,
  toPath,
  WALK_GOAL,
  WALK_PATH,
  wavePath,
} from '../tileGeometry';

describe('tile type and height', () => {
  it('uses the tile sizes from the spec at scale 1: name 13, number 30, unit 14, line 12', () => {
    expect(tileType(1)).toEqual({ name: 13, number: 30, unit: 14, line: 12 });
    expect(tileType(1.25)).toEqual({ name: 16, number: 38, unit: 18, line: 15 });
  });

  it('is square at scale 1 on a phone, and grows only as tall as the words need, so the art never reaches them', () => {
    expect(tileMinHeight(1)).toBe(157);
    expect(tileMinHeight(1.25)).toBe(188);
    for (const s of TEXT_SCALES) expect(TILE_TOP + tileTextHeight(s)).toBeLessThanOrEqual((1 - ART_SHARE) * tileMinHeight(s));
  });

  it('stays square two to a row on a 360 and a 375 point phone at text scale 1, with the words clear of the art', () => {
    for (const screen of [360, 375]) {
      // Two tiles between the 16 point gutters, with the row's gap between them.
      const w = (screen - 2 * S.gutter - S.gap) / 2;
      expect(w, `${screen}`).toBeGreaterThanOrEqual(tileMinHeight(1));
      // A square tile that wide: the art has its bottom 42%, and the words end above it.
      expect(TILE_TOP + tileTextHeight(1), `${screen}`).toBeLessThan((1 - ART_SHARE) * w);
    }
  });
});

describe('paths', () => {
  const L = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];

  it('writes a path and measures it', () => {
    expect(toPath(L)).toBe('M0 0 L10 0 L10 10');
    expect(polylineLength(L)).toBe(20);
  });

  it('finds the point a fraction of the way along, held at both ends', () => {
    expect(pointAlong(L, 0.25)).toEqual({ x: 5, y: 0 });
    expect(pointAlong(L, 0.5)).toEqual({ x: 10, y: 0 });
    expect(pointAlong(L, 1)).toEqual({ x: 10, y: 10 });
    expect(pointAlong(L, 2)).toEqual({ x: 10, y: 10 });
    expect(pointAlong(L, -1)).toEqual({ x: 0, y: 0 });
  });

  it('draws an arc from the left over the top to the right', () => {
    expect(arcPoints(50, 40, 32, 180, 360, 2)).toEqual([{ x: 18, y: 40 }, { x: 50, y: 8 }, { x: 82, y: 40 }]);
  });

  it('keeps every piece of art inside the 100 × 42 box, the flag and the breathing circle at its largest among them', () => {
    const breath = [
      { x: BREATHE_CENTRE.x - BREATHE_MAX_R, y: BREATHE_CENTRE.y - BREATHE_MAX_R },
      { x: BREATHE_CENTRE.x + BREATHE_MAX_R, y: BREATHE_CENTRE.y + BREATHE_MAX_R },
    ];
    for (const p of [...WALK_PATH, WALK_GOAL, ...NIGHT_ARC, ...STARS, ...MOUNTAIN, FLAG_TOP, ...FLAG, ...breath]) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(ART_W);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(ART_H);
    }
  });

  it('ends the climb on the summit, so a full streak puts the climber under the flag', () => {
    expect(RIDGE[RIDGE.length - 1]).toEqual(SUMMIT);
    expect(pointAlong(RIDGE, 1)).toEqual(SUMMIT);
  });

  it('stands the flag on the summit: the pole rises straight up from it and the flag flies from the top of the pole', () => {
    expect(FLAG_TOP.x).toBe(SUMMIT.x);
    expect(FLAG_TOP.y).toBeLessThan(SUMMIT.y);
    expect(FLAG[0]).toEqual(FLAG_TOP);
    expect(FLAG_D.startsWith(`M${SUMMIT.x} ${FLAG_TOP.y} `)).toBe(true);
    expect(FLAG_D.endsWith(' Z')).toBe(true);
  });

  it('seats the art on the tile\'s bottom edge, its shape kept, on a tile taller than square', () => {
    expect(ART_FIT).toBe('xMidYMax meet');
  });

  it('writes a wave twice as wide as the tile, so sliding it one tile width loops without a seam', () => {
    const d = wavePath(200, 100, 3, 8);
    expect(d.startsWith('M0 3')).toBe(true);
    expect(d.endsWith('L200 8 L0 8 Z')).toBe(true);
    // Each half wave as [control x, control y, end x, end y]; one wavelength on, the same half wave comes again.
    const halves = [...d.matchAll(/Q(\S+) (\S+) (\S+) (\S+)/g)].map((m) => m.slice(1, 5).map(Number));
    expect(halves).toHaveLength(4);
    for (let i = 0; i + 2 < halves.length; i++) {
      const [cx, cy, ex, ey] = halves[i];
      expect(halves[i + 2]).toEqual([cx + 100, cy, ex + 100, ey]);
    }
    // It ends at the height it starts, so the copy one tile width along joins it.
    expect(halves[halves.length - 1][3]).toBe(3);
  });

  it('draws the water flat, and never loops for ever, when the wavelength is 0 or less or not a number', () => {
    for (const wavelength of [0, -10, Number.NaN]) expect(wavePath(200, wavelength, 3, 8)).toBe('M0 3 L200 3 L200 8 L0 8 Z');
  });

  it('runs the point lookups on the UI thread: each is a worklet, and pointAlong measures with polylineLength', () => {
    for (const f of [pointAlong, polylineLength, starOpacity]) expect(f.toString()).toMatch(/['"]worklet['"]/);
    expect(pointAlong.toString()).toContain('polylineLength(');
  });

  it('finishes a wave\'s sweep from where it stands, so stopping or starting it again never jumps', () => {
    const r = restOfSweep(0.4, 2600);
    expect(r.from).toBe(0.4);
    expect(r.duration).toBeCloseTo(1560);
    // The end of a sweep is the same picture as its start: a whole sweep to go.
    expect(restOfSweep(1, 2600)).toEqual({ from: 0, duration: 2600 });
    expect(restOfSweep(0, 2600)).toEqual({ from: 0, duration: 2600 });
    expect(restOfSweep(Number.NaN, 2600)).toEqual({ from: 0, duration: 2600 });
  });

  it('lets the stars twinkle between faint and full', () => {
    for (let t = 0; t <= 1; t += 0.1) {
      for (const i of [0, 1, 2]) {
        expect(starOpacity(t, i)).toBeGreaterThanOrEqual(0.35);
        expect(starOpacity(t, i)).toBeLessThanOrEqual(1);
      }
    }
  });
});
