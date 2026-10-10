import { describe, expect, it, vi } from 'vitest';
import { BACKUP_NAME, downloadBackup, findBackup, multipartBody, uploadBackup } from '../../services/driveBackup';

const ok = (body: unknown, text = false) =>
  ({ ok: true, status: 200, json: async () => body, text: async () => (text ? String(body) : JSON.stringify(body)) }) as unknown as Response;
const fail = (status: number) => ({ ok: false, status, json: async () => ({}), text: async () => '' }) as unknown as Response;

describe('multipartBody', () => {
  it('puts the metadata first, the file second, and closes the boundary', () => {
    const body = multipartBody({ name: BACKUP_NAME }, '{"a":1}', 'B');
    expect(body.startsWith('--B\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{"name":"sobat-backup.json"}\r\n--B\r\n')).toBe(true);
    expect(body).toContain('\r\n\r\n{"a":1}\r\n--B--\r\n');
  });
});

describe('findBackup', () => {
  it('asks only for an untrashed file by name and returns the newest', async () => {
    const fetchFn = vi.fn(async () => ok({ files: [{ id: 'f1', modifiedTime: '2026-10-06T05:00:00Z' }] }));
    const file = await findBackup('tok', fetchFn as unknown as typeof fetch);
    expect(file?.id).toBe('f1');
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(decodeURIComponent(url)).toContain(`name = '${BACKUP_NAME}' and trashed = false`);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('returns null when there is none, and names an expired login', async () => {
    expect(await findBackup('tok', (async () => ok({ files: [] })) as unknown as typeof fetch)).toBeNull();
    await expect(findBackup('tok', (async () => fail(401)) as unknown as typeof fetch)).rejects.toThrow('unauthorized');
  });
});

describe('uploadBackup', () => {
  it('creates a new file with POST and replaces an existing one with PATCH', async () => {
    const fetchFn = vi.fn(async () => ok({ id: 'f1', modifiedTime: 'now' }));
    await uploadBackup('tok', '{}', null, fetchFn as unknown as typeof fetch);
    await uploadBackup('tok', '{}', { id: 'f1', modifiedTime: 'x' }, fetchFn as unknown as typeof fetch);
    const [createUrl, createInit] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    const [patchUrl, patchInit] = fetchFn.mock.calls[1] as unknown as [string, RequestInit];
    expect(createInit.method).toBe('POST');
    expect(createUrl).toContain('uploadType=multipart');
    expect(String(createInit.body)).toContain('"mimeType":"application/json"');
    expect(patchInit.method).toBe('PATCH');
    expect(patchUrl).toContain('/files/f1?');
    expect((patchInit.headers as Record<string, string>)['Content-Type']).toMatch(/^multipart\/related; boundary=/);
  });
});

describe('downloadBackup', () => {
  it('fetches the file contents as text', async () => {
    const fetchFn = vi.fn(async () => ok('{"version":2}', true));
    expect(await downloadBackup('tok', { id: 'f1', modifiedTime: 'x' }, fetchFn as unknown as typeof fetch)).toBe('{"version":2}');
    expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toContain('/files/f1?alt=media');
  });
});
