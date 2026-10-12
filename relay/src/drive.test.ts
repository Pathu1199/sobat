import { describe, expect, it } from 'vitest';
import { accessToken, Drive, DriveError, escapeQuery, multipartBody } from './drive';

type Call = { url: string; method: string; body?: string; headers: Record<string, string> };

/** A fetch that records calls and answers from a queue. */
function recorder(answers: (() => Response)[]) {
  const calls: Call[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method ?? 'GET', body: init?.body as string | undefined, headers: (init?.headers ?? {}) as Record<string, string> });
    const next = answers.shift();
    return next ? next() : new Response('{}', { status: 500 });
  }) as typeof fetch;
  return { fetchFn, calls };
}
const ok = (body: unknown, status = 200) => () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

describe('escapeQuery', () => {
  it('keeps a quote in a name from breaking out of the query', () => {
    expect(escapeQuery("o'brien")).toBe("o\\'brien");
    expect(escapeQuery('a\\b')).toBe('a\\\\b');
  });
});

describe('multipartBody', () => {
  it('is a metadata part then the file, closed by the boundary', () => {
    const body = multipartBody({ name: 'x.json' }, '{"a":1}', 'B');
    expect(body.startsWith('--B\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{"name":"x.json"}\r\n--B\r\n')).toBe(true);
    expect(body.endsWith('\r\n{"a":1}\r\n--B--\r\n')).toBe(true);
  });
});

describe('accessToken', () => {
  it('exchanges the refresh token with the client credentials', async () => {
    const { fetchFn, calls } = recorder([ok({ access_token: 'at', expires_in: 1800 })]);
    const t = await accessToken({ clientId: 'id', clientSecret: 'sec', refreshToken: 'rt' }, fetchFn);
    expect(t).toEqual({ token: 'at', expiresIn: 1800 });
    expect(calls[0].method).toBe('POST');
    expect(String(calls[0].body)).toContain('grant_type=refresh_token');
    expect(String(calls[0].body)).toContain('refresh_token=rt');
  });

  it('fails loudly when Google refuses', async () => {
    const { fetchFn } = recorder([ok({ error: 'invalid_grant' }, 400)]);
    await expect(accessToken({ clientId: 'id', clientSecret: 'sec', refreshToken: 'rt' }, fetchFn)).rejects.toBeInstanceOf(DriveError);
  });
});

describe('Drive', () => {
  it('finds a folder by name and mime type, within non-trashed files', async () => {
    const { fetchFn, calls } = recorder([ok({ files: [{ id: 'fld', name: 'Sobat', modifiedTime: 't' }] })]);
    expect(await new Drive('tok', fetchFn).findFolder('Sobat')).toBe('fld');
    const q = new URL(calls[0].url).searchParams.get('q')!;
    expect(q).toContain("name = 'Sobat'");
    expect(q).toContain('application/vnd.google-apps.folder');
    expect(q).toContain('trashed = false');
    expect(calls[0].headers.Authorization).toBe('Bearer tok');
  });

  it('creates a new file inside the folder with POST, and replaces an existing one with PATCH', async () => {
    const { fetchFn, calls } = recorder([ok({ id: 'new', name: 'A.json', modifiedTime: 't1' }), ok({ id: 'new', name: 'A.json', modifiedTime: 't2' })]);
    const d = new Drive('tok', fetchFn);
    const created = await d.upload('fld', 'A.json', '{}', null);
    expect(created.id).toBe('new');
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toContain('uploadType=multipart');
    expect(String(calls[0].body)).toContain('"parents":["fld"]');

    await d.upload('fld', 'A.json', '{"b":2}', created);
    expect(calls[1].method).toBe('PATCH');
    expect(calls[1].url).toContain('/files/new?');
    expect(String(calls[1].body)).not.toContain('parents');
  });

  it('walks every page of a listing', async () => {
    const { fetchFn, calls } = recorder([
      ok({ files: [{ id: '1', name: 'a', modifiedTime: 't' }], nextPageToken: 'p2' }),
      ok({ files: [{ id: '2', name: 'b', modifiedTime: 't' }] }),
    ]);
    const files = await new Drive('tok', fetchFn).list('fld');
    expect(files.map((f) => f.id)).toEqual(['1', '2']);
    expect(new URL(calls[1].url).searchParams.get('pageToken')).toBe('p2');
  });

  it('downloads the media of a file', async () => {
    const { fetchFn, calls } = recorder([ok('{"x":1}')]);
    expect(await new Drive('tok', fetchFn).download('abc')).toBe('{"x":1}');
    expect(calls[0].url).toContain('/files/abc?alt=media');
  });

  it('treats an already-deleted file as deleted', async () => {
    const { fetchFn } = recorder([ok({ error: 'gone' }, 404)]);
    await expect(new Drive('tok', fetchFn).delete('abc')).resolves.toBeUndefined();
  });

  it('raises any other failure with its status', async () => {
    const { fetchFn } = recorder([ok({ error: 'rate' }, 429)]);
    await expect(new Drive('tok', fetchFn).download('abc')).rejects.toMatchObject({ status: 429 });
  });
});
