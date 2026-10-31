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
 * With `--save` it asks for the client id and secret when they are not in
 * the environment, and hands all three straight to `wrangler secret put`
 * instead of printing the token, so the token never shows on screen.
 *
 * The client id and secret come from a "Desktop app" OAuth client in Google
 * Cloud Console (APIs & Services → Credentials), with the Drive API enabled.
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

const save = process.argv.includes('--save');

async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(question)).trim();
  rl.close();
  return answer;
}

/** Store one secret on the deployed worker, the value going in on stdin. */
function putSecret(name, value) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['wrangler', 'secret', 'put', name], { stdio: ['pipe', 'ignore', 'inherit'] });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`wrangler secret put ${name} exited with ${code}`))));
    child.stdin.end(value);
  });
}

let clientId = process.env.GOOGLE_CLIENT_ID;
let clientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (save && !clientId) clientId = await ask('Google OAuth client id: ');
if (save && !clientSecret) clientSecret = await ask('Google OAuth client secret: ');
if (!clientId || !clientSecret) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the environment first, or run with --save to be asked.');
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
  server.close();
  if (save) {
    try {
      await putSecret('GOOGLE_CLIENT_ID', clientId);
      await putSecret('GOOGLE_CLIENT_SECRET', clientSecret);
      await putSecret('GOOGLE_REFRESH_TOKEN', json.refresh_token);
      console.log('\nConnected. The client id, client secret and refresh token are stored on the relay; nothing was printed.');
    } catch (e) {
      console.error('\nConnected, but storing the secrets failed:', e.message, '\nRun again without --save to see the token and store it by hand.');
      process.exit(1);
    }
    return;
  }
  console.log('\nConnected. Now, from the relay folder, run:\n');
  console.log('  npx wrangler secret put GOOGLE_CLIENT_ID       (paste the client id)');
  console.log('  npx wrangler secret put GOOGLE_CLIENT_SECRET   (paste the client secret)');
  console.log('  npx wrangler secret put GOOGLE_REFRESH_TOKEN   (paste the line below)\n');
  console.log(json.refresh_token);
  console.log('\nKeep that token private: it lets the relay write files to your Drive.');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Open this in the browser, signed in as the Google account whose Drive will hold the files:\n');
  console.log(consent.toString());
  console.log(`\nWaiting on ${redirectUri} …`);
});
