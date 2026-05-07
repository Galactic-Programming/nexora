# Runbook — Postman with Supabase Auth

> 🇻🇳 Bản tiếng Việt: [`../../vi/runbooks/postman-auth.md`](../../vi/runbooks/postman-auth.md).

How the Postman collection authenticates against this API.

## TL;DR

The collection has a **collection-level pre-request script** that calls Supabase `signInWithPassword` and stores the resulting `access_token` in the active environment. Every protected request inherits collection-level Bearer auth that reads `{{accessToken}}`.

Two token slots are maintained:

- `accessToken` / `accessTokenExpiresAt` — refreshed from `userEmail` + `userPassword`
- `adminAccessToken` / `adminAccessTokenExpiresAt` — refreshed from `adminEmail` + `adminPassword`

The pre-request script picks the admin slot when the request path contains `/auth/admin/`, otherwise the customer slot. You don't have to do anything — just keep the credentials populated.

## One-time setup

1. Import `docs/postman/tourism-api.json`.
2. Import `docs/postman/environments/local.postman_environment.json`.
3. Edit the `local` environment and fill:
   - `supabaseUrl` (auto-prefilled from `.env.example`)
   - `supabaseAnonKey` — Supabase Project Settings → API → `anon` `public`
   - `userEmail`, `userPassword` — a confirmed customer test account
   - `adminEmail`, `adminPassword` — a confirmed account whose email is in your backend's `ADMIN_EMAILS`
4. Make sure both accounts exist in Supabase Auth and are **email-confirmed**. If not, create them via Supabase Dashboard → Authentication → Users → `Add user` (toggle "Auto Confirm User").

## Manual creation via service role key (CLI)

When the dashboard is awkward (or you want to seed fresh users for an integration test), you can use the service role key:

```js
// Node.js one-off — keep the service role key OUT of git
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

await sb.auth.admin.createUser({
  email: 'customer@example.com',
  password: 'CustomerPass123!',
  email_confirm: true, // bypasses confirmation email
});
```

## Running the collection

### Inside Postman

Pick the collection → "Run" → select the `local` environment → "Run Tourism API". The `Health`, `Auth`, and `Users` folders all pass green when:

- Backend is running (`pnpm start:dev`)
- Supabase project has the test users
- `ADMIN_EMAILS` in the backend's `.env` contains `adminEmail`

### Headless via Newman

```bash
pnpm dlx newman@6 run docs/postman/tourism-api.json \
  -e docs/postman/environments/local.postman_environment.json \
  --reporters cli
```

Expected: `assertions: 14 executed, 0 failed` (Sprint B1).

## Common pitfalls

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Pre-request script logs `Supabase credentials missing` | Empty `userEmail`/`userPassword` (or admin equivalents) | Fill the environment, re-run. |
| `401 UNAUTHORIZED` on `/auth/sync` | Supabase token wasn't fetched (check the runner's pre-request output) | Open the request → Console → look for `[pre-request] Supabase auth failed` |
| `401 USER_NOT_SYNCED` on `/users/me` | You ran `/users/me` before `/auth/sync` for a fresh user | Run `/auth/sync` first; the collection ordering already does this. |
| `403 NOT_ADMIN` on `/auth/admin/sync` | Email not in `ADMIN_EMAILS` env var on the backend | Add the email to backend `.env` `ADMIN_EMAILS=admin@example.com,...` and restart. |
| Customer endpoints return ADMIN role | The pre-request reused the admin token from a prior admin request | The script handles this automatically based on path; if you forced `useAdminToken=true` somewhere, unset it. |

## Why pre-request and not Postman OAuth 2 helper?

Supabase doesn't expose a generic OAuth 2 token endpoint that Postman's helper recognizes. The signInWithPassword endpoint is project-scoped (requires `apikey` header). A 30-line pre-request script handles it cleanly and avoids users needing to copy/paste tokens manually.
