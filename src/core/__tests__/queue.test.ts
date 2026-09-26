import { describe, expect, it } from 'vitest';
import { dequeue, enqueue, markFailed, MAX_ATTEMPTS, MAX_QUEUED, nextToProcess, pendingCount, type QueuedPhoto } from '../queue';

function photo(id: string, attempts = 0): QueuedPhoto {
  return { id, uri: `file://${id}`, base64: 'aaa', at: '', date: '2026-09-26', attempts };
}

describe('enqueue', () => {
  it('adds a photo', () => {
    expect(enqueue([], photo('a'))).toHaveLength(1);
  });

  it('drops the oldest once it is full, keeping the newest', () => {
    let q: QueuedPhoto[] = [];
    for (let i = 0; i < MAX_QUEUED + 3; i++) q = enqueue(q, photo(`p${i}`));
    expect(q).toHaveLength(MAX_QUEUED);
    expect(q[q.length - 1].id).toBe(`p${MAX_QUEUED + 2}`);
    expect(q.find((p) => p.id === 'p0')).toBeUndefined();
  });
});

describe('dequeue', () => {
  it('removes just the one', () => {
    const q = [photo('a'), photo('b')];
    expect(dequeue(q, 'a').map((p) => p.id)).toEqual(['b']);
  });

  it('is harmless for an id that is not there', () => {
    expect(dequeue([photo('a')], 'zzz')).toHaveLength(1);
  });
});

describe('markFailed', () => {
  it('counts the attempt', () => {
    expect(markFailed([photo('a')], 'a', 'boom')[0].attempts).toBe(1);
  });

  it('gives up after the limit rather than retrying forever', () => {
    let q = [photo('a', MAX_ATTEMPTS - 1)];
    q = markFailed(q, 'a', 'boom');
    expect(q).toHaveLength(0);
  });

  it('leaves other photos alone', () => {
    const q = markFailed([photo('a'), photo('b')], 'a', 'boom');
    expect(q.find((p) => p.id === 'b')!.attempts).toBe(0);
  });
});

describe('nextToProcess and pendingCount', () => {
  it('picks the oldest still worth trying', () => {
    expect(nextToProcess([photo('a'), photo('b')])!.id).toBe('a');
  });

  it('is empty when nothing is waiting', () => {
    expect(nextToProcess([])).toBeNull();
    expect(pendingCount([])).toBe(0);
  });

  it('ignores photos that ran out of attempts', () => {
    const q = [photo('a', MAX_ATTEMPTS), photo('b')];
    expect(nextToProcess(q)!.id).toBe('b');
    expect(pendingCount(q)).toBe(1);
  });
});
