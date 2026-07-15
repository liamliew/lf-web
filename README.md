# LF Inventory (lf-web)

A lightweight inventory management web app for LF Creative — track assets,
containers, locations, team members, and audits. Built with SvelteKit,
Tailwind CSS, shadcn-svelte, and Supabase.

`lf-web` is a standalone web client for the **same Supabase project** used by
the `lf-scan` Android app. Both apps read and write the same tables, so a
check-in scanned on a phone in the warehouse shows up instantly on the web
dashboard, and vice versa.

## Tech stack

- **SvelteKit** (adapter-node) — server-rendered, self-hosted
- **Tailwind CSS v4** + **shadcn-svelte** (bits-ui) — dark, dense, data-forward UI
- **Supabase** — Postgres + auth-adjacent data layer shared with lf-scan
- **PM2** — process manager for the Proxmox deployment

## Local development

```sh
npm install
cp .env.example .env   # then fill in the Supabase values below
npm run dev
```

Visit `http://localhost:5173`. Sign in with Google or Microsoft — see
[Supabase Auth Setup](#supabase-auth-setup) for provider configuration and
how access is granted to a new account.

Other useful scripts:

```sh
npm run check   # svelte-check + TypeScript
npm run lint    # prettier --check + eslint
npm run format  # prettier --write
npm run build   # production build (adapter-node -> build/)
npm run preview # preview the production build locally
```

## Environment variables

Set these in `.env` (never commit this file — it's gitignored):

| Variable                    | Where it's used                             | Exposed to browser?  |
| --------------------------- | ------------------------------------------- | -------------------- |
| `PUBLIC_SUPABASE_URL`       | `src/lib/supabase.ts`, `supabase-server.ts` | Yes                  |
| `PUBLIC_SUPABASE_ANON_KEY`  | `src/lib/supabase.ts`                       | Yes                  |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/lib/supabase-server.ts`                | **No — server only** |

The service role key bypasses Row Level Security. Only import
`src/lib/supabase-server.ts` from server-side code (`+page.server.ts`,
`+server.ts`, `hooks.server.ts`) — never from a `.svelte` file.

## Supabase Auth Setup

lf-web supports signing in with Google or Microsoft (Azure AD) via Supabase
Auth, on top of the existing Employee ID + password login. None of this is
scriptable via SQL — it's all dashboard configuration:

1. Go to the Supabase dashboard → **Authentication → Providers**.
2. **Enable Google:**
   - Create an OAuth app at [console.cloud.google.com](https://console.cloud.google.com).
   - Authorized redirect URI: `https://[project-ref].supabase.co/auth/v1/callback`
   - Add the Client ID and Secret to the Google provider in Supabase.
3. **Enable Microsoft (Azure):**
   - Create an app at [portal.azure.com](https://portal.azure.com) → App registrations.
   - Redirect URI: `https://[project-ref].supabase.co/auth/v1/callback`
   - Add the Client ID and Secret to the Azure provider in Supabase.
4. Set **Site URL** in Authentication → URL Configuration:
   `https://inventory.lfcrea.com`
5. Add `https://inventory.lfcrea.com/auth/callback` to **Redirect URLs** in
   the same settings page (also add `http://localhost:5173/auth/callback`
   for local development).

**How access is gated.** Signing in with Google/Microsoft only creates a
Supabase Auth user — it does **not** grant access to lf-web by itself. A new
OAuth account can authenticate but has no `inventory_team_members` row linked
to it yet, so `src/routes/auth/callback/+server.ts` immediately signs it back
out and redirects to `/login?error=not_registered`. This is what stops any
Google/Microsoft account from reaching the app.

To grant access: the employee signs in with Google/Microsoft once (which
creates their `auth.users` row and bounces them back to login with the
"not registered" message), then an **admin** goes to the Team page, clicks
**Link Auth Account** next to that employee's row, and enters their email.
Once linked, that Google/Microsoft account can sign in normally. Admins can
unlink an account the same way if an employee leaves or needs re-linking.

Employees who don't have (or don't want to use) a Google/Microsoft account
can skip all of this and sign in with their Employee ID and password instead
— that path doesn't touch Supabase Auth at all.

## Data model

`src/lib/types.ts` defines the shared shape of every table: `Asset`,
`Container`, `Location`, `InventoryEvent`, `TeamMember`, `Audit`,
`AuditItem`, `ScanSession`, `ScanSessionItem`. Table and column names
(`inventory_assets`, `inventory_containers`, `inventory_locations`,
`inventory_events`, `inventory_team_members`, `inventory_audits`,
`inventory_audit_items`) match lf-scan exactly — if the Android app's schema
changes, update `types.ts` and the `src/services/*` files here to match.

Authentication is Google/Microsoft OAuth only — see
[Supabase Auth Setup](#supabase-auth-setup) below for provider setup and how
access is granted. Supabase Auth handles the login, and the resulting
`auth.users` row is linked to an `inventory_team_members` row via the
`supabase_auth_id` column; an admin must link the two records on the Team
page before a new OAuth account can access anything.

`hooks.server.ts` resolves the session server-side on every request (via
`getUser()`, not the unverified `getSession()`) and populates
`event.locals.session`/`event.locals.member`; `src/routes/(app)/+layout.server.ts`
redirects to `/login` if neither is present. Nothing relies on `localStorage`.

The Employee ID + password lookup in `src/lib/auth.ts`
(`authenticateEmployee`) still exists, but only as a local re-verification
step before changing your own password on the Settings page — it is not a
login method.

## Deployment to Proxmox (PM2 + nginx)

1. On the Proxmox host/VM/container, clone the repo and install dependencies:

   ```sh
   git clone <repo-url> lf-web
   cd lf-web
   npm ci
   cp .env.example .env   # fill in production Supabase values
   ```

2. Build and start with PM2:

   ```sh
   npm run build
   pm2 start ecosystem.config.cjs
   pm2 save
   ```

   `ecosystem.config.cjs` runs the adapter-node output (`build/index.js`) on
   `0.0.0.0:3001`.

3. For subsequent deploys, pull the latest code and run:

   ```sh
   npm run deploy   # npm run build && pm2 restart lf-web
   ```

4. Point nginx at the Node process and proxy `inventory.lfcrea.com` to it:

   ```nginx
   server {
     listen 80;
     server_name inventory.lfcrea.com;
     location / {
       proxy_pass http://localhost:3001;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
     }
   }
   ```

   Reload nginx (`sudo nginx -t && sudo systemctl reload nginx`), then add
   TLS with `certbot --nginx -d inventory.lfcrea.com` once DNS for
   `inventory.lfcrea.com` points at the Proxmox host.

## How this shares data with lf-scan

- Both apps point at the **same Supabase project** (same `PUBLIC_SUPABASE_URL`).
- Both read/write the same `inventory_*` tables via the same column names.
- Every mutation (check-in, check-out, container add/remove, audit scan)
  writes an `inventory_events` row, so the `/activity` page here shows
  actions taken from the Android app in real time, and Android sees actions
  taken from the web dashboard.
- Employee accounts (`inventory_team_members`) are shared — the same PIN and
  password work on both lf-scan and lf-web.

## Appearance: light/dark theme

The app supports light and dark mode, saved per-employee to their account —
independent of whatever theme lf-scan has set on Android.

- **Storage**: `inventory_employee_settings`, the same per-employee key/value
  table lf-scan uses for its own settings (`kiosk_mode`, `scan_trigger_mode`,
  etc.), under the key `web_theme` (see `src/lib/theme.ts`). Prefixing with
  `web_` is what keeps it from ever colliding with an Android-side key.
- **No flash on load**: `hooks.server.ts` reads a `lf_theme` cookie (a fast
  cache of the DB value) on every request and injects the right class
  (`dark` or nothing) into `<html>` server-side via `transformPageChunk`,
  before any HTML reaches the browser. The cookie is only missing on a
  user's very first request or after clearing cookies, in which case hooks
  does a one-time lookup against `inventory_employee_settings` and re-seeds
  the cookie.
- **Changing it**: the toggle in the top bar or Settings → Appearance calls
  `POST /api/theme` (`src/routes/api/theme/+server.ts`), which derives the
  employee from the verified session (never from client input), upserts the
  DB row, and updates the cookie — all before the DOM class is flipped
  client-side for instant feedback.
- **Contrast**: `src/app.css` defines two full token sets (`:root` for light,
  `.dark` for dark) rather than one dark palette with light mode bolted on.
  Body/muted text and the four status colors (available/checked-out/lost/
  under-repair) each use different shades per mode so they clear WCAG AA
  (4.5:1) against their own background — the light-mode status colors in
  particular are noticeably darker/more saturated than the dark-mode ones,
  since a color picked to glow on near-black usually reads as washed-out on
  white.

## Fonts

Google Sans Code (used for monospace text — asset IDs, barcodes, etc.) is
loaded via `<link rel="preconnect">` + `<link rel="stylesheet">` tags in
`src/app.html`, not a CSS `@import` and not assumed to be installed locally.
If you add another custom font, load it the same way — a `<link>` in
`app.html`, never a bare `font-family` pointing at something that has to
already be on the machine.

## Project structure

```
src/
  app.html          Font <link> tags; %theme.class% slot on <html>
  hooks.server.ts   Resolves the Supabase Auth session + theme on every request
  lib/
    server/         Server-only — never reachable from client code
    supabase.ts     Browser client (@supabase/ssr)
    supabase-server.ts  Request-scoped + admin server clients
    auth.ts         Client-side password re-verification (Settings page only)
    theme.ts        Shared theme type/cookie/settings-key constants
  components/       layout/, ui/ (shadcn-svelte), assets/, shared/
  stores/           Svelte stores (current user, toast, theme)
  services/         Data access layer — one file per table/domain
  routes/
    api/theme/      POST — persists the caller's theme preference
    auth/callback/  OAuth redirect target — exchanges code, checks link
    (auth)/         /login — unauthenticated
    (app)/          Everything else — session-guarded in +layout.server.ts
```

## Scope note

This project is fully standalone. It does not read from or modify the
`lf-scan` Android project, `lfcrea-frontend`, or `lf-portal`.
