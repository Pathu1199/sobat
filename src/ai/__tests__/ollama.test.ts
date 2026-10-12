import { describe, expect, it } from 'vitest';
import { isMixedContent, normalizeUrl, parseLooseJSON } from '../ollama';

describe('isMixedContent', () => {
  it('an https page may not reach an http address', () => {
    expect(isMixedContent('http://localhost:11434', 'https:')).toBe(true);
    expect(isMixedContent('http://192.168.1.23:11434', 'https:')).toBe(true);
    expect(isMixedContent('http://varad-pc:11434', 'https:')).toBe(true);
  });

  it('an address typed without a scheme is http, so it is blocked too', () => {
    expect(isMixedContent('localhost:11434', 'https:')).toBe(true);
    expect(isMixedContent('192.168.1.23:11434', 'https:')).toBe(true);
  });

  it('https is fine from anywhere', () => {
    expect(isMixedContent('https://pc.tail1234.ts.net', 'https:')).toBe(false);
    expect(isMixedContent('https://pc.tail1234.ts.net', 'http:')).toBe(false);
  });

  it('an http page, the desktop shell and the phone may reach http', () => {
    expect(isMixedContent('http://localhost:11434', 'http:')).toBe(false);
    expect(isMixedContent('http://localhost:11434', 'tauri:')).toBe(false);
    expect(isMixedContent('http://192.168.1.23:11434', 'app:')).toBe(false);
  });

  it('no address is not a blocked address', () => {
    expect(isMixedContent('', 'https:')).toBe(false);
    expect(isMixedContent('   ', 'https:')).toBe(false);
  });
});

describe('normalizeUrl', () => {
  it('adds the scheme and strips trailing slashes', () => {
    expect(normalizeUrl('localhost:11434')).toBe('http://localhost:11434');
    expect(normalizeUrl('http://pc:11434/')).toBe('http://pc:11434');
    expect(normalizeUrl('  https://pc:11434//  ')).toBe('https://pc:11434');
    expect(normalizeUrl('')).toBe('');
  });
});

describe('parseLooseJSON', () => {
  it('reads plain JSON, fenced JSON, and JSON wrapped in prose', () => {
    expect(parseLooseJSON<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
    expect(parseLooseJSON<{ a: number }>('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseLooseJSON<{ a: number }>('Here you go: {"a":1} hope it helps')).toEqual({ a: 1 });
    expect(parseLooseJSON<number[]>('Sure! [1,2,3].')).toEqual([1, 2, 3]);
  });

  it('refuses when there is no JSON at all', () => {
    expect(() => parseLooseJSON('no json here')).toThrow();
  });
});
