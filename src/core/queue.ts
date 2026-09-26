import type { ISODate } from './types';

/**
 * Photos taken while the PC is unreachable. The app promises they are queued,
 * so they have to actually be kept and retried, not silently dropped.
 */

export type QueuedPhoto = {
  id: string;
  uri: string;
  base64: string;
  at: string;
  date: ISODate;
  attempts: number;
  lastError?: string;
};

/** Base64 images are heavy, so the queue is deliberately short. */
export const MAX_QUEUED = 5;
export const MAX_ATTEMPTS = 3;

export function enqueue(queue: QueuedPhoto[], photo: QueuedPhoto): QueuedPhoto[] {
  const next = [...queue, photo];
  // Drop the oldest rather than refusing the newest: the recent meal matters more.
  return next.length <= MAX_QUEUED ? next : next.slice(next.length - MAX_QUEUED);
}

export function dequeue(queue: QueuedPhoto[], id: string): QueuedPhoto[] {
  return queue.filter((p) => p.id !== id);
}

export function markFailed(queue: QueuedPhoto[], id: string, error: string): QueuedPhoto[] {
  return queue
    .map((p) => (p.id === id ? { ...p, attempts: p.attempts + 1, lastError: error } : p))
    // A photo the model keeps failing on is never going to work; stop holding it.
    .filter((p) => p.attempts < MAX_ATTEMPTS);
}

export function nextToProcess(queue: QueuedPhoto[]): QueuedPhoto | null {
  return queue.find((p) => p.attempts < MAX_ATTEMPTS) ?? null;
}

export function pendingCount(queue: QueuedPhoto[]): number {
  return queue.filter((p) => p.attempts < MAX_ATTEMPTS).length;
}
