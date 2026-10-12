import { describe, expect, it } from 'vitest';
import { bearer, makeVerifier } from './auth';

function lookup(answer: () => Response) {
  let calls = 0;
  const fetchFn = (async () => {
    calls += 1;
    return answer();
  }) as typeof fetch;
  return { fetchFn, count: () => calls };
}
const found = (localId: string, email: string) => () => new Response(JSON.stringify({ users: [{ localId, email }] }), { status: 200 });

describe('bearer', () => {
  it('reads the token out of the header, case-insensitively, and nothing else', () => {
    expect(bearer(new Request('https://x', { headers: { Authorization: 'Bearer abc.def' } }))).toBe('abc.def');
    expect(bearer(new Request('https://x', { headers: { Authorization: 'bearer abc' } }))).toBe('abc');
    expect(bearer(new Request('https://x', { headers: { Authorization: 'Basic abc' } }))).toBeNull();
    expect(bearer(new Request('https://x'))).toBeNull();
  });
});

describe('makeVerifier', () => {
  it('asks Firebase who the token belongs to, and lowercases the email', async () => {
    const { fetchFn } = lookup(found('U1', 'Some@Example.com'));
    const verify = makeVerifier('key', fetchFn);
    expect(await verify('t1')).toEqual({ uid: 'U1', email: 'some@example.com' });
  });

  it('remembers an answer for a few minutes, then asks again', async () => {
    let now = 0;
    const { fetchFn, count } = lookup(found('U1', 'a@b.c'));
    const verify = makeVerifier('key', fetchFn, () => now);
    await verify('t1');
    await verify('t1');
    expect(count()).toBe(1);
    now = 5 * 60 * 1000 + 1;
    await verify('t1');
    expect(count()).toBe(2);
  });

  it('does not cache one token\'s answer for another', async () => {
    const { fetchFn, count } = lookup(found('U1', 'a@b.c'));
    const verify = makeVerifier('key', fetchFn);
    await verify('t1');
    await verify('t2');
    expect(count()).toBe(2);
  });

  it('returns null for an empty token, a refusal, an empty answer, or a network failure', async () => {
    expect(await makeVerifier('key', lookup(found('U', 'e')).fetchFn)('')).toBeNull();
    expect(await makeVerifier('key', lookup(() => new Response('{}', { status: 400 })).fetchFn)('bad')).toBeNull();
    expect(await makeVerifier('key', lookup(() => new Response(JSON.stringify({ users: [] }), { status: 200 })).fetchFn)('none')).toBeNull();
    const failing = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await makeVerifier('key', failing)('t')).toBeNull();
  });

  it('does not cache a refusal', async () => {
    let fail = true;
    const fetchFn = (async () => (fail ? new Response('{}', { status: 400 }) : found('U1', 'a@b.c')())) as typeof fetch;
    const verify = makeVerifier('key', fetchFn);
    expect(await verify('t')).toBeNull();
    fail = false;
    expect(await verify('t')).toEqual({ uid: 'U1', email: 'a@b.c' });
  });
});
