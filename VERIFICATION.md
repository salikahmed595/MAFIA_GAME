# Verification — 19 September 2026

Tested locally on Windows with Node.js 22.22.2. The deployment configuration recommends Node.js 24 LTS.

| Check | Result |
| --- | --- |
| `npm install` | Passed; reproducible lockfile included |
| Dependency audit after patched tooling update | 0 reported vulnerabilities |
| `npm run lint` | Passed |
| `npm run test` | 15 tests passed: 5 rule/practice tests and 10 PostgreSQL integration/security tests |
| `npm run build` | Passed; production frontend and PWA service worker generated |
| `npm run test:e2e` | 6 tests passed on desktop and iPhone-size Chromium profiles |
| Production room deep-link refresh | Passed |
| Original background audio playback and volume | Passed |
| PWA manifest and 192/512-pixel icons | Passed |
| Offline practice after initial cache installation | Passed |
| Browser runtime errors during production check | None |
| Desktop/mobile screenshots | Inspected; 3D town rendered and no horizontal overflow |

The 3D renderer is in a separate lazy-loaded chunk, approximately 233 KB gzipped. Vite reports its standard advisory for chunks over 500 KB uncompressed; this does not fail the build.

The SQL migration was executed against embedded PostgreSQL (PGlite), with simulated Supabase authenticated/anonymous roles and user claims. Tests exercise the actual policies and functions, including role privacy, direct-access denial, room membership, host controls, capacity, Doctor protection, private investigation, ties, win conditions, restart, expiration, and host transfer.

No live Supabase project credentials were provided, so cloud Auth/Realtime, simultaneous real-device networking, the optional deployed Edge Function, and Vercel deployment remain to be verified using the README's setup and phone-test steps. At the initial local handoff, no files had been pushed to GitHub. The source was subsequently prepared for upload at the explicit request of the owner. No public deployment was made and no Higgsfield credits were spent.
