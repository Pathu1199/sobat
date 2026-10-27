import { describe, expect, it } from 'vitest';
import { TEXT_SCALES } from '../theme';
import {
  ART_H,
  ART_SHARE,
  ART_W,
  arcPoints,
  MOUNTAIN,
  NIGHT_ARC,
  pointAlong,
  polylineLength,
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
    expect(tileMinHeight(1)).toBe(164);
    expect(tileMinHeight(1.25)).toBe(195);
    for (const s of TEXT_SCALES) expect(TILE_TOP + tileTextHeight(s)).toBeLessThanOrEqual((1 - ART_SHARE) * tileMinHeight(s));
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

  it('keeps every piece of art inside the 100 × 42 box', () => {
    for (const p of [...WALK_PATH, WALK_GOAL, ...NIGHT_ARC, ...STARS, ...MOUNTAIN]) {
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

  it('writes a wave twice as wide as the tile, so sliding it one tile width loops without a seam', () => {
    const d = wavePath(200, 100, 3, 8);
    expect(d.startsWith('M0 3')).toBe(true);
    expect(d.match(/Q/g)).toHaveLength(4);
    expect(d.endsWith('L200 8 L0 8 Z')).toBe(true);
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
