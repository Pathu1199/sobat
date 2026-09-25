import { describe, expect, it } from 'vitest';
import { addMemory, contextFor, findDuplicate, makeMemory, MAX_MEMORIES, prune, removeMemory, retrieve, similarity, toPromptLines, tokenize } from '../memory';
import type { MemoryItem } from '../memory';

const TODAY = '2026-09-25';
const mem = (text: string, over: Partial<MemoryItem> = {}): MemoryItem => ({ ...makeMemory({ text, date: TODAY }), ...over });

describe('tokenize', () => {
  it('drops filler words and punctuation', () => {
    expect(tokenize('I am a vegetarian!')).toEqual(['vegetarian']);
  });

  it('keeps Devanagari words', () => {
    expect(tokenize('मी शाकाहारी आहे')).toContain('शाकाहारी');
  });
});

describe('similarity', () => {
  it('is high for the same fact said twice', () => {
    expect(similarity('I am vegetarian', 'I am a vegetarian')).toBeGreaterThan(0.6);
  });

  it('is low for unrelated facts', () => {
    expect(similarity('I am vegetarian', 'my knee hurts on stairs')).toBeLessThan(0.2);
  });

  it('is zero against nothing', () => {
    expect(similarity('', 'anything')).toBe(0);
  });
});

describe('addMemory', () => {
  it('stores a new fact', () => {
    expect(addMemory([], mem('I work night shifts'))).toHaveLength(1);
  });

  it('replaces a near-duplicate instead of piling up', () => {
    const list = addMemory([], mem('I am vegetarian'));
    const next = addMemory(list, mem('I am a vegetarian'));
    expect(next).toHaveLength(1);
  });

  it('keeps what the user typed over what the model guessed', () => {
    const typed = mem('I am vegetarian', { source: 'user', weight: 0.8 });
    const guessed = mem('I am a vegetarian', { source: 'auto', weight: 0.5 });
    const next = addMemory(addMemory([], typed), guessed);
    expect(next[0].source).toBe('user');
  });

  it('stays under the cap', () => {
    let list: MemoryItem[] = [];
    for (let i = 0; i < MAX_MEMORIES + 30; i++) list = addMemory(list, mem(`unrelated fact number ${i} about topic ${i}`));
    expect(list.length).toBeLessThanOrEqual(MAX_MEMORIES);
  });

  it('keeps user facts when pruning to the cap', () => {
    let list: MemoryItem[] = [addMemory([], mem('my knee hurts on stairs', { source: 'user', weight: 0.9 }))[0]];
    for (let i = 0; i < MAX_MEMORIES + 20; i++) {
      list = addMemory(list, mem(`episode ${i} summary ${i}`, { type: 'episode', source: 'auto', weight: 0.2 }));
    }
    expect(list.some((m) => m.text === 'my knee hurts on stairs')).toBe(true);
  });
});

describe('findDuplicate and removeMemory', () => {
  it('finds nothing in an empty store', () => {
    expect(findDuplicate([], 'anything')).toBeNull();
  });

  it('removes by id', () => {
    const list = addMemory([], mem('test fact here'));
    expect(removeMemory(list, list[0].id)).toHaveLength(0);
  });
});

describe('retrieve', () => {
  const list = [
    mem('I am vegetarian and do not eat eggs', { source: 'user', weight: 0.9 }),
    mem('my knee hurts when climbing stairs', { source: 'user', weight: 0.9 }),
    mem('I dislike oats', { source: 'auto', weight: 0.5 }),
    mem('ate too much at a wedding', { type: 'episode', date: '2026-01-01', weight: 0.3 }),
  ];

  it('puts the relevant fact first', () => {
    expect(retrieve(list, 'what should I eat, any vegetarian ideas', TODAY, 2)[0].text).toContain('vegetarian');
  });

  it('respects the limit', () => {
    expect(retrieve(list, 'anything', TODAY, 2)).toHaveLength(2);
  });

  it('ranks a stale episode below current facts', () => {
    const top = retrieve(list, 'knee pain exercise', TODAY, 1)[0];
    expect(top.type).not.toBe('episode');
  });
});

describe('contextFor', () => {
  it('always carries the facts the user typed', () => {
    const list = [
      mem('I am vegetarian', { source: 'user', type: 'fact', weight: 0.9 }),
      ...Array.from({ length: 20 }, (_, i) => mem(`auto note ${i} about running ${i}`, { source: 'auto', weight: 0.6 })),
    ];
    const ctx = contextFor(list, 'tell me about running', TODAY, 5);
    expect(ctx.some((m) => m.text === 'I am vegetarian')).toBe(true);
    expect(ctx.length).toBeLessThanOrEqual(5);
  });
});

describe('toPromptLines', () => {
  it('dates an episode and leaves a fact undated', () => {
    const lines = toPromptLines([mem('slept badly', { type: 'episode', date: '2026-09-20' }), mem('vegetarian')]);
    expect(lines[0]).toContain('On 2026-09-20');
    expect(lines[1]).toContain('Remember');
  });
});

describe('prune', () => {
  it('drops old episodes but keeps old facts', () => {
    const list = [mem('old day', { type: 'episode', date: '2025-01-01' }), mem('I am vegetarian', { date: '2025-01-01' })];
    const kept = prune(list, TODAY);
    expect(kept).toHaveLength(1);
    expect(kept[0].type).toBe('fact');
  });
});

describe('tokenize across scripts', () => {
  it('keeps whole Marathi and Hindi words, matras included', () => {
    expect(tokenize('मला गुडघेदुखी आहे')).toContain('गुडघेदुखी');
    expect(tokenize('मैं शाकाहारी हूँ')).toContain('शाकाहारी');
  });

  it('matches the same Marathi fact written twice', () => {
    expect(similarity('मी शाकाहारी आहे', 'मी शाकाहारी आहे, अंडी खात नाही')).toBeGreaterThan(0.4);
  });
});
