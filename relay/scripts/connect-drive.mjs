#!/usr/bin/env node
/**
 * Connect the relay to the app maker's Google Drive. Run once, on your own
 * machine, as the Google account whose Drive will hold the files:
 *
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/connect-drive.mjs
 *
 * It opens a consent page for the `drive.file` scope — the relay will only
 * ever see files it created itself — and prints the refresh token for
 * `npx wrangler secret put GOOGLE_REFRESH_TOKEN`. Nothing is stored here.
 *
 * The client id and secret come from a "Desktop app" OAuth client in Google
 * Cloud Console (APIs & Services → Credentials), with the Drive API enabled.
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the environment first.');
  process.exit(1);
}

const PORT = 8899;
const redirectUri = `http://127.0.0.1:${PORT}/`;
const state = randomBytes(16).toString('hex');

const consent = new URL('https://accounts.google.com/o/oauth2/v2/auth');
consent.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: 'code',
  scope: 'https://www.googleapis.com/auth/drive.file',
  // offline + consent is what makes Google issue a refresh token.
  access_type: 'offline',
  prompt: 'consent',
  state,
}).toString();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', redirectUri);
  if (url.pathname !== '/') {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get('code');
  const got = url.searchParams.get('state');
  if (!code || got !== state) {
    res.writeHead(400, { 'Content-Type': 'text/plain' }).end('Missing code or wrong state. Close this tab and run the script again.');
    return;
  }
  const body = new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' });
  const token = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const json = await token.json();
  if (!token.ok || !json.refresh_token) {
    res.writeHead(500, { 'Content-Type': 'text/plain' }).end('Google did not return a refresh token. See the terminal.');
    console.error('Token exchange failed:', JSON.stringify(json, null, 2));
    server.close();
    process.exit(1);
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' }).end('Connected. You can close this tab and go back to the terminal.');
  console.log('\nConnected. Now, from the relay folder, run:\n');
  console.log('  npx wrangler secret put GOOGLE_CLIENT_ID       (paste the client id)');
  console.log('  npx wrangler secret put GOOGLE_CLIENT_SECRET   (paste the client secret)');
  console.log('  npx wrangler secret put GOOGLE_REFRESH_TOKEN   (paste the line below)\n');
  console.log(json.refresh_token);
  console.log('\nKeep that token private: it lets the relay write files to your Drive.');
  server.close();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Open this in the browser, signed in as the Google account whose Drive will hold the files:\n');
  console.log(consent.toString());
  console.log(`\nWaiting on ${redirectUri} …`);
});
