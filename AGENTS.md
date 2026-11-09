# MagnetimShare — instructions for coding agents

Read this whole file before changing anything. It describes the real project
and the owner's working rules. It replaces the Grok App Builder sandbox
contract that used to live here; nothing in this repository runs in that
sandbox any more.

## The product

MagnetimShare (magnetimshare.com) prints magnets at events: weddings, bar and
bat mitzvahs, conferences, company events. It is the only public product.

- **Guest:** scans the event QR, lands on `/e/:slug`, signs in anonymously,
  shoots a photo inside the event's magnet frame and sends it. One magnet per
  send, up to the event's per-guest quota. The phone crops the photo to the
  frame window; it never draws the frame itself.
- **Operator (print station):** sees the event's queue, composes each photo
  with the full-size frame overlay, prints it on the magnet printer and marks
  the job delivered or rejected. This station is not built yet.
- **Admin:** signs in with Google at `/admin` (server-side allowlist), creates
  events, assigns frames from the studio, sets the event live and prints the
  table card with the QR.

Success is measured at the print station: time from send to magnet in hand,
failed sends, magnets per hour per operator, and zero photo leaks between
guests.

## Stack

- Vite + React 18 + TypeScript, React Router v6 (`src/App.tsx` holds every
  route). The frame studio under `src/features/studio` is plain JavaScript.
- Supabase: anonymous auth for guests, Google for admins, Postgres with RLS on
  every table, a private `media` storage bucket, realtime on `print_jobs`.
- Tailwind v4. Design tokens live only in `src/theme.css`.
- Hosted on Vercel (team `effitags-projects`, project `magnetshare`).
- Hebrew, right to left, mobile first around 375px wide.

## Where things are

| Path | What it holds |
| --- | --- |
| `src/features/home` | Public site: home page, contact, legal pages |
| `src/features/guest` | Guest landing and camera |
| `src/features/admin` | Admin events, event editor, table card |
| `src/features/studio` | Frame studio (JavaScript, ported from MemoriaShare) |
| `src/services/api.ts` | Every database and storage call |
| `src/services/types.ts` | Shared data types |
| `src/theme.css` | Colors, fonts, shadows |
| `supabase/migrations` | Every schema change, one file per change, in order |
| `supabase/schema.sql` | Reference snapshot of the schema |

Platform leftovers from Grok App Builder are not used by the product: the
PGlite database, Better Auth, the Nitro server layer and `server/`, the Grok
PWA plugin and its `grok.com` script, `src/lib/auth`, `src/lib/app-data`,
`src/lib/db.ts`, `src/lib/multiplayer`, `migrations/auth`, `startup.sh` and the
`scripts/*` sandbox tooling. Do not build on them. Remove them only in a task
that asks for it.

## Rules

1. Change only what the task asks for. No drive-by refactors, renames or
   restyling. If something else looks wrong, report it instead of fixing it.
2. One task, one branch, one pull request into `main`. Never push to `main`.
3. Never merge a pull request unless the owner explicitly says so.
4. Production deploys only from `main`. Never promote a preview deployment to
   production by hand.
5. Report back item by item, numbered the same way as the request.
6. All database and storage access goes through `src/services/api.ts`.
7. Guests must never see another guest's photos or jobs. Every new table gets
   RLS in the same migration.
8. Schema changes go in a new file under `supabase/migrations`. Apply them to
   the test project first. On production, never apply a migration or run SQL
   that writes unless the owner explicitly says "run". Read-only queries are
   fine on both projects.
9. There are two Supabase projects, and no other project is in scope.
   - Production: `kyxbkpfbcudvxooyxmpy` (MagnetimShare Prod, Frankfurt). Only
     the Vercel Production environment uses it. It holds real event data.
     Every write, migration or settings change needs the owner's explicit
     "run".
   - Test: `gexvrhhnmezkugldjjax` (MagnetimShare Lab, Frankfurt). Vercel
     Preview deployments and local runs use it. It holds test data only.
     Migrations from an open pull request may be applied here without asking.
     Before any write, confirm the target ref is `gexvrhhnmezkugldjjax`.

   Never point a preview or a local run at production, and never copy
   production data into the test project.

   Lab is in the same Supabase organization as production, so they share the
   organization's quotas, including Realtime concurrent connections. Never run
   a load test against Lab while production is active. Any load test needs the
   owner's separate approval.
10. No secrets in the repository: no `.env` files, no service role key, no
    tokens. Only `VITE_` variables reach the browser.
11. Public screens never mention MemoriaShare. The brand is MagnetimShare.
12. Use the tokens in `src/theme.css`; do not hard-code colors or fonts.
13. Every screen must work on a phone first. Check 375px wide before desktop.

## Checks before opening a pull request

Run these and make sure they pass. GitHub Actions runs the same checks on every
pull request.

- `npm run build`
- `npx vitest run` (product unit tests)
- `npx tsc --noEmit --checkJs false` (TypeScript files; the studio JavaScript
  is not type checked yet)

`npm test` also runs Grok sandbox tests that fail outside that sandbox. Do not
use it as a gate.

## Running locally

`npm run dev` starts the app on port 8080. It needs `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` of the test project in the environment.
