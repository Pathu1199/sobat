import { describe, expect, it } from 'vitest';
import { standing, storyLine, storySeed } from '../storyLines';

describe('storyLines', () => {
  it('reads where the day stands from the calories', () => {
    expect(standing(0, 1700)).toBe('fresh');
    expect(standing(600, 1700)).toBe('room');
    expect(standing(1200, 1700)).toBe('steady');
    expect(standing(1650, 1700)).toBe('close');
    expect(standing(1900, 1700)).toBe('over');
  });

  it('changes the line between nudges, in the chosen language, with the calorie tail', () => {
    const a = storyLine('water', 'mr', storySeed('2026-10-08', 0), { consumed: 600, target: 1700 });
    const b = storyLine('water', 'mr', storySeed('2026-10-08', 1), { consumed: 600, target: 1700 });
    expect(a).not.toBe(b);
    expect(a).toContain('1100 kcal');
    expect(/[ऀ-ॿ]/.test(a)).toBe(true);
    const over = storyLine('stop', 'en', 3, { consumed: 1900, target: 1700 });
    expect(over).toContain('200 kcal over');
  });

  it('speaks of water the way the coach counts it, never in glasses: the water advice it follows counts bottles', () => {
    for (const lang of ['en', 'mr', 'hi'] as const) {
      for (let seed = 0; seed < 8; seed++) expect(storyLine('water', lang, seed), `${lang} ${seed}`).not.toMatch(/glass|ग्लास|गिलास/);
    }
  });

  it('is the same for the same day and counter', () => {
    expect(storyLine('break', 'hi', storySeed('2026-10-08', 2))).toBe(storyLine('break', 'hi', storySeed('2026-10-08', 2)));
  });
});
