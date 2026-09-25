import type { ISODate } from './types';

/**
 * What the app remembers about you between days. Facts you type, preferences
 * learned from thumbs up and down, and a one-line summary of each day. This is
 * what makes tomorrow's advice aware of what you said last week.
 */

export type MemoryType = 'fact' | 'preference' | 'goal' | 'episode' | 'correction';

export type MemoryItem = {
  id: string;
  type: MemoryType;
  text: string;
  createdAt: string;
  date: ISODate;
  /** 0 to 1. Higher survives pruning and ranks higher in retrieval. */
  weight: number;
  source: 'user' | 'auto';
  tags: string[];
};

export const MAX_MEMORIES = 200;
const DUPLICATE_THRESHOLD = 0.6;

const STOP = new Set(['the', 'a', 'an', 'is', 'am', 'are', 'i', 'my', 'me', 'to', 'of', 'and', 'in', 'on', 'for', 'it', 'that', 'this', 'have', 'has']);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    // \p{M} keeps Devanagari vowel signs. Without it "शाकाहारी" collapses to
    // "आह", because matras are marks rather than letters.
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/** Jaccard overlap. Crude, but enough to stop the same fact being stored twice. */
export function similarity(a: string, b: string): number {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  A.forEach((w) => {
    if (B.has(w)) shared++;
  });
  return shared / (A.size + B.size - shared);
}

export function findDuplicate(list: MemoryItem[], text: string): MemoryItem | null {
  let best: MemoryItem | null = null;
  let bestScore = 0;
  for (const m of list) {
    const score = similarity(m.text, text);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return bestScore >= DUPLICATE_THRESHOLD ? best : null;
}

/**
 * Adds a memory, replacing a near-duplicate instead of piling up, and keeping
 * the list under a cap by dropping the least useful.
 */
export function addMemory(list: MemoryItem[], item: MemoryItem): MemoryItem[] {
  const dup = findDuplicate(list, item.text);
  let next: MemoryItem[];
  if (dup) {
    // Something you typed yourself always beats something the model guessed.
    const keepUser = dup.source === 'user' && item.source !== 'user';
    const merged: MemoryItem = keepUser
      ? { ...dup, weight: Math.max(dup.weight, item.weight), date: item.date }
      : { ...item, id: dup.id, weight: Math.max(dup.weight, item.weight) };
    next = list.map((m) => (m.id === dup.id ? merged : m));
  } else {
    next = [...list, item];
  }
  if (next.length <= MAX_MEMORIES) return next;
  const ranked = [...next].sort((a, b) => scoreFor(b) - scoreFor(a));
  return ranked.slice(0, MAX_MEMORIES);
}

function scoreFor(m: MemoryItem): number {
  const typeBoost = m.type === 'episode' ? 0 : m.type === 'goal' ? 0.3 : 0.15;
  const userBoost = m.source === 'user' ? 0.25 : 0;
  return m.weight + typeBoost + userBoost;
}

export function removeMemory(list: MemoryItem[], id: string): MemoryItem[] {
  return list.filter((m) => m.id !== id);
}

function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000);
}

/**
 * Pick the few memories worth spending prompt space on for this question.
 * Episodes fade with age; facts and goals do not.
 */
export function retrieve(list: MemoryItem[], query: string, today: ISODate, limit = 8): MemoryItem[] {
  const qTokens = new Set(tokenize(query));
  const scored = list.map((m) => {
    const overlap = qTokens.size === 0 ? 0 : similarity(m.text, query);
    const age = Math.max(0, daysBetween(m.date, today));
    const recency = m.type === 'episode' ? Math.max(0, 1 - age / 30) : 1;
    const tagHit = m.tags.some((t) => qTokens.has(t)) ? 0.2 : 0;
    return { m, score: overlap * 0.45 + m.weight * 0.3 + recency * 0.2 + tagHit };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.m);
}

/** Always include what you typed yourself, then fill the rest by relevance. */
export function contextFor(list: MemoryItem[], query: string, today: ISODate, limit = 10): MemoryItem[] {
  const pinned = list.filter((m) => m.source === 'user' && (m.type === 'fact' || m.type === 'goal')).slice(-5);
  const rest = retrieve(
    list.filter((m) => !pinned.includes(m)),
    query,
    today,
    Math.max(0, limit - pinned.length),
  );
  return [...pinned, ...rest];
}

export function toPromptLines(items: MemoryItem[]): string[] {
  return items.map((m) => `${m.type === 'episode' ? `On ${m.date}` : 'Remember'}: ${m.text}`);
}

export function makeMemory(input: {
  text: string;
  type?: MemoryType;
  date: ISODate;
  source?: 'user' | 'auto';
  weight?: number;
  tags?: string[];
}): MemoryItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: input.type ?? 'fact',
    text: input.text.trim(),
    createdAt: new Date().toISOString(),
    date: input.date,
    weight: input.weight ?? (input.source === 'user' ? 0.8 : 0.5),
    source: input.source ?? 'user',
    tags: input.tags ?? [],
  };
}

/** Drop weak old episodes so the store does not fill with day summaries. */
export function prune(list: MemoryItem[], today: ISODate, keepEpisodeDays = 60): MemoryItem[] {
  return list.filter((m) => {
    if (m.type !== 'episode') return true;
    return daysBetween(m.date, today) <= keepEpisodeDays;
  });
}
