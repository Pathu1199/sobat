/**
 * Google Drive, as the relay uses it: one folder in the app maker's Drive,
 * one JSON file per account inside it. Plain fetch calls with an injectable
 * `fetch`, so every path has a test that never touches Google.
 *
 * The token comes from a refresh token the app maker granted once, with the
 * `drive.file` scope: the relay can see only files it created itself,
 * nothing else in that Drive.
 */

export type Fetch = typeof fetch;
export type DriveFile = { id: string; name: string; modifiedTime: string; size?: string };
export type OAuthClient = { clientId: string; clientSecret: string; refreshToken: string };

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FIELDS = 'id,name,modifiedTime,size';

export class DriveError extends Error {
  constructor(
    public readonly status: number,
    what: string,
  ) {
    super(`${what}: HTTP ${status}`);
  }
}

async function check(res: Response, what: string): Promise<Response> {
  if (res.ok) return res;
  throw new DriveError(res.status, what);
}

/** A short-lived access token from the long-lived refresh token. */
export async function accessToken(c: OAuthClient, fetchFn: Fetch = fetch): Promise<{ token: string; expiresIn: number }> {
  const body = new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, refresh_token: c.refreshToken, grant_type: 'refresh_token' });
  const res = await check(await fetchFn(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }), 'token');
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new DriveError(500, 'token: no access_token');
  return { token: json.access_token, expiresIn: json.expires_in ?? 3600 };
}

/** Drive's query language quotes with single quotes; a name containing one would break out. */
export function escapeQuery(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

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

export class Drive {
  constructor(
    private readonly token: string,
    private readonly fetchFn: Fetch = fetch,
  ) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.token}`, ...extra };
  }

  private async query(q: string, pageToken?: string): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
    const params = new URLSearchParams({ q, spaces: 'drive', fields: `nextPageToken,files(${FIELDS})`, pageSize: '1000' });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await check(await this.fetchFn(`${API}?${params}`, { headers: this.headers() }), 'list');
    return (await res.json()) as { files: DriveFile[]; nextPageToken?: string };
  }

  async findFolder(name: string): Promise<string | null> {
    const { files } = await this.query(`name = '${escapeQuery(name)}' and mimeType = '${FOLDER_MIME}' and trashed = false`);
    return files[0]?.id ?? null;
  }

  async createFolder(name: string): Promise<string> {
    const res = await check(
      await this.fetchFn(`${API}?fields=id`, { method: 'POST', headers: this.headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name, mimeType: FOLDER_MIME }) }),
      'create folder',
    );
    return ((await res.json()) as { id: string }).id;
  }

  async findFile(folderId: string, name: string): Promise<DriveFile | null> {
    const { files } = await this.query(`name = '${escapeQuery(name)}' and '${escapeQuery(folderId)}' in parents and trashed = false`);
    return files[0] ?? null;
  }

  /** Every file in the folder, across pages. */
  async list(folderId: string): Promise<DriveFile[]> {
    const out: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
      const page = await this.query(`'${escapeQuery(folderId)}' in parents and trashed = false`, pageToken);
      out.push(...page.files);
      pageToken = page.nextPageToken;
    } while (pageToken);
    return out;
  }

  async download(fileId: string): Promise<string> {
    const res = await check(await this.fetchFn(`${API}/${fileId}?alt=media`, { headers: this.headers() }), 'download');
    return res.text();
  }

  /** Write the file, replacing it in place when it exists so Drive keeps one copy. */
  async upload(folderId: string, name: string, json: string, existing: DriveFile | null): Promise<DriveFile> {
    const boundary = `sobat-${Date.now().toString(36)}`;
    const meta = existing ? { name } : { name, mimeType: 'application/json', parents: [folderId] };
    const url = existing ? `${UPLOAD}/${existing.id}?uploadType=multipart&fields=${FIELDS}` : `${UPLOAD}?uploadType=multipart&fields=${FIELDS}`;
    const res = await check(
      await this.fetchFn(url, {
        method: existing ? 'PATCH' : 'POST',
        headers: this.headers({ 'Content-Type': `multipart/related; boundary=${boundary}` }),
        body: multipartBody(meta, json, boundary),
      }),
      'upload',
    );
    return (await res.json()) as DriveFile;
  }

  async delete(fileId: string): Promise<void> {
    const res = await this.fetchFn(`${API}/${fileId}`, { method: 'DELETE', headers: this.headers() });
    // Already gone is as good as deleted.
    if (!res.ok && res.status !== 404) throw new DriveError(res.status, 'delete');
  }
}
