import { afterEach, describe, expect, it, vi } from 'vitest';
import { chat, chatJSON, isMixedContent, normalizeUrl, parseLooseJSON } from '../ollama';
import { FOOD_PHOTO_SCHEMA } from '../prompts';

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

describe('chat', () => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  function replyWith(content: string) {
    calls.length = 0;
    vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { ok: true, status: 200, json: async () => ({ message: { content } }) };
    });
  }
  afterEach(() => vi.unstubAllGlobals());

  it('asks qwen3 not to think, at the top level of the request', async () => {
    replyWith('ok');
    await chat('localhost:11434', 'qwen3:8b', [{ role: 'user', content: 'hi' }]);
    expect(calls[0].url).toBe('http://localhost:11434/api/chat');
    expect(calls[0].body.think).toBe(false);
  });

  it('leaves the think flag off for models that do not think', async () => {
    replyWith('ok');
    await chat('localhost:11434', 'qwen2.5vl:7b', [{ role: 'user', content: 'hi' }]);
    expect('think' in calls[0].body).toBe(false);
  });

  it('strips markdown asterisks and any thinking block from a chat reply', async () => {
    replyWith('<think>the user wants dal</think>\n**Dal** and *one* roti.\n* Walk 10 minutes\n* Drink water');
    const text = await chat('localhost:11434', 'qwen3:8b', [{ role: 'user', content: 'hi' }]);
    expect(text).toBe('Dal and one roti.\n• Walk 10 minutes\n• Drink water');
  });

  it('leaves JSON replies as they came', async () => {
    replyWith('{"a":"*x*"}');
    expect(await chat('localhost:11434', 'qwen3:8b', [{ role: 'user', content: 'hi' }], { json: {} })).toBe('{"a":"*x*"}');
  });
});

describe('chatJSON for a food photo', () => {
  function replyWith(obj: unknown) {
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, json: async () => ({ message: { content: JSON.stringify(obj) } }) }));
  }
  afterEach(() => vi.unstubAllGlobals());
  type Photo = { items: { name_en: string; name_mr: string; grams_est: number | null; confidence: number }[] };

  it('keeps only numeric grams, clamped to 20 to 800', async () => {
    replyWith({
      items: [
        { name_en: 'Poha', grams_est: 180, confidence: 0.9 },
        { name_en: 'Chapati', grams_est: '80', confidence: 0.8 },
        { name_en: 'Rice', grams_est: 'a plate', confidence: 0.7 },
        { name_en: 'Dal', grams_est: 5000, confidence: 2 },
        { name_en: 'Pickle', grams_est: 3, confidence: -1 },
        { name_en: 'Curd', confidence: 0.5 },
      ],
    });
    const out = await chatJSON<Photo>('localhost:11434', 'qwen2.5vl:7b', [], FOOD_PHOTO_SCHEMA);
    expect(out.items.map((i) => i.grams_est)).toEqual([180, 80, null, 800, 20, null]);
    expect(out.items.map((i) => i.confidence)).toEqual([0.9, 0.8, 0.7, 1, 0, 0.5]);
  });

  it('drops items with no name and survives a reply with no list', async () => {
    replyWith({ items: [{ grams_est: 100 }, { name_en: '  ', grams_est: 100 }, { name_en: 'Upma', name_mr: 42, grams_est: 150 }] });
    const out = await chatJSON<Photo>('localhost:11434', 'qwen2.5vl:7b', [], FOOD_PHOTO_SCHEMA);
    expect(out.items).toEqual([{ name_en: 'Upma', name_mr: '', portion: '', grams_est: 150, confidence: 0.5 }]);
    replyWith({ items: 'none' });
    expect((await chatJSON<Photo>('localhost:11434', 'qwen2.5vl:7b', [], FOOD_PHOTO_SCHEMA)).items).toEqual([]);
  });

  it('whatever the model says, the grams that reach the meal are a real number', async () => {
    replyWith({ items: [{ name_en: 'Thali', grams_est: 'NaN' }, { name_en: 'Bhaji', grams_est: null }, { name_en: 'Vada', grams_est: '1e9' }] });
    const out = await chatJSON<Photo>('localhost:11434', 'qwen2.5vl:7b', [], FOOD_PHOTO_SCHEMA);
    for (const v of out.items) {
      // The photo screens do exactly this with the result.
      const grams = Math.max(20, Math.round(v.grams_est || 100));
      expect(Number.isFinite(grams)).toBe(true);
      expect(grams).toBeLessThanOrEqual(800);
    }
  });
});
