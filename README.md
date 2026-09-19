# Mafia: Midnight Council

A complete browser Mafia game set in the low-poly town of Blackthorn. Built for **5–16 friends**, with a separate solo practice game with bots. All source files, database migrations, original 3D geometry, music-generation source, tests, and deployment configuration are included here.

**Prepared for your repository:** https://github.com/salikahmed595/MAFIA_GAME

Source code is maintained in the GitHub repository above. Public deployment is a separate setup step. The frontend runs immediately in practice mode. Real multiplayer requires your own Supabase project and the two public environment values below. No paid Higgsfield assets or credits are used.

## Run locally

Use Node.js 24 LTS (the project also supports Node 22.12+).

```bash
npm install
npm run dev
```

Open http://localhost:5173. Choose **Try a solo practice game with bots** to play without cloud setup. You are the Detective; bot actions resolve when you press **Advance practice phase**. This mode is intentionally separate from multiplayer and resets when refreshed.

To enable multiplayer, copy `.env.example` to `.env.local` and fill in your Supabase project settings:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

Restart the development server after changing environment variables. These are public frontend connection values. **Never put a service-role key in these variables.** The game does not require a service-role key.

## What is included

- Responsive React/TypeScript interface with Framer Motion, Tailwind CSS, and custom styling.
- Lazy-loaded React Three Fiber town with original geometry, lit windows, fountain, trees, and lanterns. Battery-saver quality, static scene setting, and WebGL error fallback.
- Create private rooms with collision-checked six-character codes, capacity, and 30/60/120-second phases.
- Room-link joining, nickname validation, anonymous sessions, same-browser room/role restoration, and clear closed/full/started-room errors.
- Lobby readiness, host-only start/restart, private identities, Mafia allies, Doctor protection, Detective investigation, discussion, voting, elimination, and both team win conditions.
- Supabase PostgreSQL authoritative game state, RLS-protected Realtime revision updates, and reconnection polling.
- Original ambient music, volume controls, saved device settings, and reduced-motion support.
- PWA app shell and icons. The cached interface and practice mode can work offline after an initial visit; **multiplayer always needs a connection**. Browser PWA installation availability varies.
- Vitest rule tests, PostgreSQL integration/security tests with PGlite, Playwright desktop/mobile tests, GitHub Actions CI, and Vercel route rewrites.

## Rules

For 5–6 players there is 1 Mafia, for 7–11 there are 2, and for 12–16 there are 3. Every game includes one Doctor and one Detective; other players are Villagers.

1. **Night:** Mafia choose a non-Mafia victim. A unique plurality determines the victim; tied Mafia choices cause no kill. The Doctor protects one player and may protect themselves. The Detective investigates another player; the result appears privately at dawn, even if the Detective died that night. Villagers wait.
2. **Discussion:** Talk in person or on your own voice call. There is no built-in voice or text chat.
3. **Voting:** Each living player can vote once for another living player. The unique plurality is eliminated and their role is announced. Ties and empty votes eliminate nobody.
4. **Victory:** The town wins when no Mafia remain. Mafia win when their living count equals or exceeds the other living players. The host can return the group to the lobby for another game.

Votes and night actions cannot be changed after confirmation. Missing actions are abstentions. Eliminated players spectate and cannot act. Keep roles private and do not coach surviving players after elimination.

## Architecture and security

The Vercel frontend is static. It stores only preferences and the Supabase anonymous session locally; authoritative multiplayer state never lives in browser storage, Vercel server memory, or a filesystem.

`public.game_command` is the authenticated entry point for room creation, joining, snapshots, readiness, start, actions, restart, and lobby leave. It uses a fixed empty search path, validates identity and membership, and locks a room row before mutation. Private tables and helper functions are not accessible to client roles. Public room rows contain only a room code, revision, and update time. RLS restricts those rows to members. Roles and actions are never published to Realtime. Snapshot responses include only the requesting player's role and investigation, plus Mafia teammates when applicable. Full roles become visible after the game ends.

Timers use database timestamps. A client displays the deadline relative to the server timestamp received in the snapshot. Every connected member polls every three seconds, with Realtime updates reducing visible delay. On the next authenticated state request after a deadline, the database advances one phase under a row lock. Multiple clients cannot resolve the same phase twice. **If everyone disconnects, resolution waits until someone reconnects**, and the next phase starts with a full timer. No separate scheduler or paid cron service is needed.

Rooms expire after 24 hours. This is an invitation-code party game: anyone who knows a room code can join its lobby until it fills. There is no public directory or application-wide room-count quota; infrastructure quotas and the code namespace still impose practical limits. Use Supabase's authentication rate limits and abuse controls for a public launch. Keep the default sign-in rate limits enabled; a large group signing in simultaneously may need to retry. If enabling Supabase CAPTCHA, add its challenge UI before requiring it, since this version uses the standard anonymous sign-in flow.

Anonymous session restoration works in the same browser/profile. Clearing site data or using another browser creates a new identity. Players can choose **Leave this table** in the lobby; the host transfers to the earliest remaining player. During an active game, closing a page does not remove the player; missed turns abstain and the player can reconnect. If the host loses their stored session during an active game, the current game still resolves without them, but the group should create a fresh room for the next game.

## Exact deployment steps

### 1. Create Supabase

Create a project in the Supabase dashboard, choose your region, and keep your database password private. Under **Project Settings → API**, copy the project URL and public `anon` key for your frontend environment. Do not copy the `service_role` key.

### 2. Apply the migration

Install/use the official Supabase CLI, then from this folder:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Alternatively, run the complete contents of `supabase/migrations/202609190001_mafia.sql` once in the Supabase SQL Editor. Use the CLI for repeatable deployment history. The migration creates tables, indexes, secure functions, RLS policies, and adds the non-sensitive `public.rooms` table to the existing `supabase_realtime` publication.

For a local Supabase instance, install Docker Desktop, start Docker, then run:

```bash
npx supabase start
npx supabase db reset
npx supabase status
```

Use the local URL and anon key shown by `status` in `.env.local`. `db reset` resets the **local** development database and reapplies migrations; do not use reset against production.

### 3. Enable anonymous authentication

In **Authentication → Sign In / Providers**, enable **Anonymous Sign-Ins**. In **Authentication → URL Configuration**, set the production site URL after Vercel gives it to you. Add these allowed redirect URLs, replacing the placeholders:

```text
http://localhost:5173/**
http://localhost:4173/**
https://YOUR-PROJECT.vercel.app/**
https://YOUR-PROJECT-*-YOUR-TEAM.vercel.app/**
https://YOUR-FUTURE-DOMAIN.example/**
```

Use a preview wildcard restricted to your project/team rather than all of `vercel.app`. Anonymous sign-in does not itself use an OAuth redirect, but configure these for consistent development and future authentication additions. For separated staging/production projects, apply the same migrations in each and use the matching environment variables in Vercel Preview/Production.

### 4. Deploy the included Edge Function

Gameplay uses secure PostgreSQL RPCs. The included authenticated `health` Edge Function is optional and contains no privileged credentials:

```bash
npx supabase functions deploy health --project-ref YOUR_PROJECT_REF
```

The function validates the caller's user session and returns a simple deployment check. It is not called by gameplay and does not need browser CORS. Leave JWT verification enabled. Supabase provides the runtime URL and anon key to deployed functions.

### 5. GitHub repository

Your provided `salikahmed595/MAFIA_GAME` repository already exists and was empty when inspected. This folder is its local clone. If using a different account, create an empty GitHub repository first and update the `origin` URL. Never commit `.env.local` or secrets.

### 6. Commit and push the files

From this folder:

```bash
git add .
git commit -m "Build Mafia Midnight Council game"
git branch -M main
git push -u origin main
```

Review `git status` before pushing. The lockfile is included for reproducible installs. `node_modules`, local environments, build artifacts, and test results are ignored.

### 7. Import into Vercel

In Vercel, open **[New Project](https://vercel.com/new)** and select **Import** beside the existing GitHub repository `salikahmed595/MAFIA_GAME`. If you are on `/new/clone` and see **Private Repository Name**, go back: that page creates a second GitHub repository. The existing repository does not need to be cloned again.

Set the **Vercel Project Name** to `mafia-game` (all lowercase). The GitHub repository stays named `MAFIA_GAME`. Vercel project names cannot contain uppercase letters; the uppercase default shown on the clone page triggers the name validation error. Use the repository root as the project root and configure:

| Setting           | Value           |
| ----------------- | --------------- |
| Framework         | Vite            |
| Install command   | `npm install`   |
| Build command     | `npm run build` |
| Output directory  | `dist`          |
| Node.js version   | 24.x LTS        |
| Production branch | `main`          |

### 8. Add environment variables

In **Project Settings → Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Production and Preview. Vite embeds these public values at build time. Redeploy after changing them. Do not add a service-role key to the frontend.

### 9. Deploy production

Click **Deploy**. Copy the resulting URL into Supabase's site/redirect settings. Vercel's Git integration automatically deploys pushes to `main` to production and other branches/PRs to preview deployments. The included `vercel.json` serves `index.html` for room URLs, so `/room/ABC123` works on direct access and refresh. Hashed assets get long-lived caching.

### 10. Test with multiple phones

1. Open the deployed URL on at least **five separate phones or browser profiles**. Tabs in one browser share an anonymous identity and do not count as separate players.
2. Host: enter a nickname, choose capacity and timer, and create a room. Copy the room link.
3. Guests: open that link, enter different nicknames, and join. Verify the same roster appears everywhere.
4. Have everyone mark ready. Start as host. Privately reveal each role and confirm no other roles appear.
5. Make night choices, wait for dawn, check the Doctor outcome and Detective-only result, then discuss and vote.
6. Refresh one phone during a game. Check that its identity, role, and submitted action are restored.
7. Temporarily disconnect another phone, reconnect, and check that it catches up. Verify no phase resolves twice and eliminated players cannot act.
8. Complete the game, check team victory and final role reveal, and replay from the lobby.
9. Check full-room, wrong-code, late-join, music volume, battery-saver, and direct-room-refresh behavior.

## Development and verification

```bash
npm run lint
npm run test
npm run build
npm run preview
```

Browser tests:

```bash
npx playwright install chromium
npm run test:e2e
```

Vitest runs both rule tests and the actual SQL migration in an isolated embedded PostgreSQL engine. Database tests cover unauthorized reads/writes, membership filtering, capacity, role privacy, readiness, actions, saves, investigations, ties, victories, restart, host transfer, and expiration. These do not replace the phone test above: live Supabase Auth, WebSocket delivery, Vercel hosting, and real concurrent network requests need your deployed services.

`npm run format` formats frontend/config/test files. Regenerate the original music with `node tools/generate-music.mjs`.

## Folder map

```text
src/
  App.tsx                   Screens, room interaction, settings, rules
  components/Town.tsx       Lazy-loaded original 3D village
  lib/api.ts                Supabase session and RPC client
  lib/game.ts               Types and shared game rules
  lib/practice.ts           Local bot practice game
  styles.css                Responsive visual design
public/                     Static icon and original ambient audio
supabase/migrations/        Database schema, policies, secure game engine
supabase/functions/health/  Optional authenticated Edge Function
tests/                      Rule, database/security, desktop/mobile tests
tools/                      Reproducible music generator
.github/workflows/ci.yml    Automated lint, test, build, browser checks
vercel.json                 SPA routing and deployment configuration
.env.example               Public frontend configuration template
```

Official setup references: [Supabase database functions](https://supabase.com/docs/guides/database/functions), [anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), and [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
