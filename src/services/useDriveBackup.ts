import { exchangeCodeAsync, makeRedirectUri, ResponseType, useAuthRequest } from 'expo-auth-session';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { useApp } from '../store/AppProvider';
import { downloadBackup, DRIVE_SCOPE, findBackup, uploadBackup } from './driveBackup';

// On the web the sign-in opens a popup; this closes it once Google comes back.
WebBrowser.maybeCompleteAuthSession();

const GOOGLE = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

type ClientIds = { webClientId?: string; androidClientId?: string };
const IDS: ClientIds = (Constants.expoConfig?.extra as { google?: ClientIds } | undefined)?.google ?? {};
const CLIENT_ID = (Platform.OS === 'web' ? IDS.webClientId : IDS.androidClientId) ?? '';

/**
 * Google only hands a token to the browser for about an hour, and we do not
 * store it: a backup is a deliberate tap, and asking again later is fine.
 */
let cached: { token: string; expiresAt: number } | null = null;

export type DriveStatus = 'idle' | 'busy' | 'backed_up' | 'restored' | 'none' | 'cancelled' | 'error';

export function useDriveBackup() {
  const app = useApp();
  const [status, setStatus] = useState<DriveStatus>('idle');

  // A web client can only use the implicit flow (no secret to exchange a code
  // with); an Android client exchanges a code with PKCE and no secret.
  const web = Platform.OS === 'web';
  // Google's Android clients only accept a redirect scheme equal to the package
  // name; on the web the popup lands back on the Settings page of this origin.
  const redirectUri = web ? makeRedirectUri({ path: 'settings' }) : 'com.varad.sobat:/oauthredirect';
  const [request, , promptAsync] = useAuthRequest(
    {
      clientId: CLIENT_ID || 'not-configured',
      scopes: [DRIVE_SCOPE],
      redirectUri,
      responseType: web ? ResponseType.Token : ResponseType.Code,
      usePKCE: !web,
    },
    GOOGLE,
  );

  const getToken = useCallback(async (): Promise<string | null> => {
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    // promptAsync is the first await on purpose: a web popup must follow the tap directly.
    const result = await promptAsync();
    if (result.type !== 'success') return null;
    let token: string | undefined;
    let expiresIn = 3600;
    if (web) {
      token = result.params.access_token;
      expiresIn = Number(result.params.expires_in ?? 3600);
    } else {
      const res = await exchangeCodeAsync(
        { clientId: CLIENT_ID, code: result.params.code, redirectUri, extraParams: { code_verifier: request?.codeVerifier ?? '' } },
        GOOGLE,
      );
      token = res.accessToken;
      expiresIn = res.expiresIn ?? 3600;
    }
    if (!token) return null;
    cached = { token, expiresAt: Date.now() + expiresIn * 1000 };
    return token;
  }, [promptAsync, request, redirectUri, web]);

  const run = useCallback(
    async (job: (token: string) => Promise<DriveStatus>) => {
      setStatus('busy');
      try {
        const token = await getToken();
        if (!token) {
          setStatus('cancelled');
          return;
        }
        setStatus(await job(token));
      } catch (e) {
        // A stale token is thrown away so the next tap signs in again.
        if (e instanceof Error && e.message === 'unauthorized') cached = null;
        setStatus('error');
      }
    },
    [getToken],
  );

  const backup = useCallback(
    () =>
      run(async (token) => {
        const existing = await findBackup(token);
        await uploadBackup(token, app.exportJSON(), existing);
        app.setSettings({ driveBackupAt: new Date().toISOString() });
        return 'backed_up';
      }),
    [app, run],
  );

  const restore = useCallback(
    () =>
      run(async (token) => {
        const file = await findBackup(token);
        if (!file) return 'none';
        const json = await downloadBackup(token, file);
        return app.importState(json).ok ? 'restored' : 'error';
      }),
    [app, run],
  );

  return { configured: CLIENT_ID.length > 0, status, backup, restore, lastBackupAt: app.state.settings.driveBackupAt ?? null };
}
