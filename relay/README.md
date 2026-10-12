# Sobat relay

A Cloudflare Worker with two jobs.

**Account data.** Each signed-in person's logs are one file, `<uid>.json`, in a
folder called `Sobat` in the app maker's Google Drive. The relay is the only
thing that can reach that Drive: it checks the person's Firebase sign-in on
every request, lets them at their own file, and lets the admin at all of them.
A write carries the version the device last saw, and is refused when the file
has moved on, so two devices merge rather than overwrite each other.

**Reminders.** It stores, per phone, the push address the browser issued and
the reminder times the app uploaded, and every five minutes it sends what is
due. Only times and labels travel — see `src/core/pushSchedule.ts` in the app.

## Routes

| Route | Who | What |
| --- | --- | --- |
| `GET /data` | signed in | the person's file, or `null` |
| `PUT /data` | signed in | `{ state, baseModifiedTime }` → `409` with the current file if stale |
| `DELETE /data` | signed in | delete the file and the directory entry |
| `GET /admin/users` | admin | every account: who, last seen, size, blocked |
| `PATCH /admin/users/:uid` | admin | `{ disabled }` |
| `DELETE /admin/users/:uid` | admin | delete that account's file and entry |
| `POST /subscribe` · `/unsubscribe` · `/test` | anyone | reminders |

"Signed in" means a Firebase ID token in `Authorization: Bearer …`. "Admin"
means that token's email equals `ADMIN_EMAIL`.

## One-time setup

```bash
cd relay && npm install
npx wrangler login                                 # opens the browser
npx wrangler kv namespace create SUBS              # paste the id into wrangler.toml
npx wrangler kv namespace create USERS             # paste the id into wrangler.toml
npx wrangler secret put VAPID_PRIVATE_KEY          # from ~/.sobat/vapid.json
```

### Connect your Google Drive

1. In [Google Cloud Console](https://console.cloud.google.com) make a project
   (or reuse the Firebase one), enable the **Google Drive API**, and under
   **APIs & Services → Credentials** create an OAuth client of type
   **Desktop app**. Note the client id and secret.
2. Run the consent flow on your own machine, signed in as the Google account
   whose Drive will hold the files:

   ```bash
   GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… node scripts/connect-drive.mjs
   ```

   It prints a link; open it, approve, and it prints a refresh token.
3. Store all three as secrets:

   ```bash
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put GOOGLE_REFRESH_TOKEN
   ```

The scope is `drive.file`: the relay can see and edit only files it created
itself, nothing else in that Drive. The folder appears as `Sobat` in your
Drive, one JSON file per account, and you can open any of them.

### Deploy

```bash
npm run deploy                                     # prints the worker URL
```

Put the URL into `app.json` → `expo.extra.push.relayUrl`, push, and the site
picks it up. `GET /` on the worker reports whether Drive and Firebase are
configured.

## Tests

```bash
npm test
```

Every route is tested against an in-memory Drive and KV; nothing touches
Google.
