# Sobat relay

A Cloudflare Worker that sends Sobat's reminders while the web app is closed.
It stores, per phone, the push address the browser issued and the reminder
times the app uploaded, and every five minutes it sends what is due. It never
receives food, weight, sleep or mood; see `src/core/pushSchedule.ts` in the
app for exactly what is sent.

## One-time setup

```bash
cd relay && npm install
npx wrangler login                                 # opens the browser
npx wrangler kv namespace create SUBS              # paste the id into wrangler.toml
npx wrangler secret put VAPID_PRIVATE_KEY          # from ~/.sobat/vapid.json on the Mac mini
npm run deploy                                     # prints the worker URL
```

Put the worker URL into `app.json` → `expo.extra.push.relayUrl`, push, and the
site picks it up. The public key in `wrangler.toml` must match
`expo.extra.push.vapidPublicKey`.

## Tests

```bash
npm test
```
