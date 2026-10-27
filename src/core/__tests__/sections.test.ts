import { describe, expect, it } from 'vitest';
import { linkOf, sectionFromLink } from '../sections';

const SECTIONS = ['plan', 'foods', 'recipes', 'history'] as const;

describe('sectionFromLink: what a ?s= link opens', () => {
  it('opens the section only when the link changes, so a link left in the address never overrides a pick by hand', () => {
    // A cold load of /food?s=history opens History from the start; the same param seen again changes nothing.
    expect(sectionFromLink(SECTIONS, 'history', 'history')).toBeNull();
    // A new link opens its section, even the one opened before once the param was cleared.
    expect(sectionFromLink(SECTIONS, 'recipes', 'history')).toBe('recipes');
    expect(sectionFromLink(SECTIONS, 'history', undefined)).toBe('history');
    // Clearing the param, or a name that is not a section, changes nothing.
    expect(sectionFromLink(SECTIONS, undefined, 'history')).toBeNull();
    expect(sectionFromLink(SECTIONS, 'nonsense', undefined)).toBeNull();
    expect(sectionFromLink(SECTIONS, ['plan'], undefined)).toBeNull();
  });
});

describe('linkOf: the ?s= value as one name', () => {
  it('is the name when the address has one', () => {
    expect(linkOf('history')).toBe('history');
    expect(linkOf(undefined)).toBeUndefined();
  });

  it('a repeated ?s=a&s=b (a new array on every render) names no section and reads the same each time, so the page never loops', () => {
    // The page compares this render's link with the last one it saw; two arrays are never equal, two undefineds are.
    const first = linkOf(['plan', 'foods']);
    const again = linkOf(['plan', 'foods']);
    expect(first).toBeUndefined();
    expect(first === again).toBe(true);
    expect(sectionFromLink(SECTIONS, again, first)).toBeNull();
  });
});
