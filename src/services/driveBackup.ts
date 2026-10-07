/**
 * Google Drive backup: one JSON file, the same one Export writes, kept in the
 * person's own Drive. The drive.file scope lets Fitoo see only files Fitoo
 * made, nothing else in the Drive. These are plain fetch calls so they can be
 * tested with a fake fetch and used from any platform.
 */

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const BACKUP_NAME = 'sobat-backup.json';

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export type DriveFile = { id: string; modifiedTime: string };
type Fetch = typeof fetch;

/** The multipart/related body Drive wants: metadata part, then the file. */
export function multipartBody(meta: object, json: string, boundary: string): string {
  return [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(meta),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    json,
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

async function check(res: Response, what: string): Promise<Response> {
  if (res.ok) return res;
  if (res.status === 401) throw new Error('unauthorized');
  throw new Error(`${what}: HTTP ${res.status}`);
}

/** The existing backup, if there is one. Trashed copies do not count. */
export async function findBackup(token: string, fetchFn: Fetch = fetch): Promise<DriveFile | null> {
  const q = encodeURIComponent(`name = '${BACKUP_NAME}' and trashed = false`);
  const res = await check(
    await fetchFn(`${API}?q=${q}&spaces=drive&fields=files(id,modifiedTime)&orderBy=modifiedTime desc&pageSize=1`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    'list',
  );
  const json = (await res.json()) as { files?: DriveFile[] };
  return json.files?.[0] ?? null;
}

/** Write the backup, replacing the previous one in place so Drive keeps a single file. */
export async function uploadBackup(token: string, json: string, existing: DriveFile | null, fetchFn: Fetch = fetch): Promise<DriveFile> {
  const boundary = `sobat-${Date.now().toString(36)}`;
  const meta = existing ? { name: BACKUP_NAME } : { name: BACKUP_NAME, mimeType: 'application/json' };
  const url = existing ? `${UPLOAD}/${existing.id}?uploadType=multipart&fields=id,modifiedTime` : `${UPLOAD}?uploadType=multipart&fields=id,modifiedTime`;
  const res = await check(
    await fetchFn(url, {
      method: existing ? 'PATCH' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipartBody(meta, json, boundary),
    }),
    'upload',
  );
  return (await res.json()) as DriveFile;
}

export async function downloadBackup(token: string, file: DriveFile, fetchFn: Fetch = fetch): Promise<string> {
  const res = await check(await fetchFn(`${API}/${file.id}?alt=media`, { headers: { Authorization: `Bearer ${token}` } }), 'download');
  return res.text();
}
