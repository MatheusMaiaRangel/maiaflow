# Phase 4 handoff — Quality and delivery

## Summary

The project is tested end to end, runs with one `docker compose up`, and has a CI workflow for every push.
A code review and a security review of the whole codebase ran at the end and their findings were fixed
(the remaining ones are listed below).

- Status: **done**, tested by the owner and pushed to `main` on 2026-10-15.
- Pull request: none (work goes straight to `main`, D17).
- Finished on: 2026-10-15

## What changed

End-to-end tests (`frontend/e2e`, `frontend/playwright.config.ts`)

- Playwright suite, 29 tests: sign-up/login/logout and their errors, redirect to login and back; tasks
  (create, complete optimistically, edit, mark not completed, delete); habits (one of each of the six
  recurrence types, change recurrence, validation errors, delete); calendar (today done / not done, future
  day disabled); profile (name and header initials, password change, account deletion); every main page
  under the CSP with no console errors.
- `npm run e2e` builds and starts its own API (port 5111, Release, Production settings, random JWT key,
  migrates on startup, rate limits lifted) and the production web build (port 3100), against the database
  `maiaflow_e2e` (credentials from the root `.env`, or `E2E_DB_CONNECTION`). `E2E_BASE_URL` runs against an
  existing deployment instead. Every test signs up its own account and deletes it; a fixture fails any test
  that logs a CSP violation.

Infrastructure

- `backend/Dockerfile` (sdk → aspnet, `tzdata` + `curl`, user `app`, health check on the 401 of
  `/api/users/me`), `frontend/Dockerfile` (Next.js `standalone`, user `node`), `.dockerignore` files.
- `docker-compose.yml`: `db` unchanged for local development; new `api` (not published on the host) and
  `web` (`127.0.0.1:3000` by default). `no-new-privileges` and `cap_drop: ALL` on api and web.
  `docker-compose.expose-api.yml` publishes the API for debugging (and then ignores forwarded headers).
- `.env.example` documents every variable (`JWT_KEY`, `APP_ORIGIN`, `FORWARD_CLIENT_IP`, `WEB_PORT`,
  `WEB_BIND`, `TRUSTED_PROXY_NETWORKS`, optional `API_PORT`/`API_BIND`).
- `.github/workflows/ci.yml`: backend (build with warnings as errors, tests with coverage), frontend (lint,
  typecheck, format, unit tests with coverage, build, `npm audit --omit=dev`), E2E (Postgres service +
  Playwright) and Docker (build, `up --wait`, smoke test of `/login` and its headers, API not published).

Backend (`backend/MaiaFlow`)

- Rate limiting (`Infrastructure/RateLimitingExtensions.cs`): login 10/min and sign-up 5/min per client
  address; login 10/min per account (normalized e-mail); 300/min per signed-in user on every authenticated
  route. 429 with `Retry-After` and a problem body. All limits are configurable under `RateLimiting`.
- Forwarded headers (`X-Forwarded-For`/`-Proto`) are trusted only from `ForwardedHeaders:TrustedNetworks`.
- `AllowedHosts` is `localhost` by default (compose sets `api;localhost`); `Database:MigrateOnStartup`.
- Fixes from the reviews: at most 100 recurrence rules per habit (calendar DoS); habit lists and calendar in
  a stable order; habit updates no longer overwrite the occurrence cursor (no more `DbSet.Update`); read-only
  queries untracked; Kestrel's 413 is kept instead of 400; dead repository methods removed; EF constructors
  initialized so the solution builds with warnings as errors.
- `Microsoft.OpenApi` 2.12.2 referenced directly (the transitive 2.4.1 had GHSA-v5pm-xwqc-g5wc) and
  `Microsoft.EntityFrameworkCore.Relational` 10.0.5 (one version for the API and the tests).
- New tests: rate limits, allowed hosts, generic 500 without internals, forwarded-headers config, 413
  mapping, `GET /api/habits` ownership/order, rule cap. 134 tests, 95% line coverage of hand-written code.

Frontend (`frontend/`)

- Content-Security-Policy with a per-request nonce, set in `src/proxy.ts` (`src/lib/security/csp.ts`); the
  theme script gets the nonce from the root layout. Other security headers and `poweredByHeader: false` in
  `next.config.ts`, plus `output: "standalone"` when `NEXT_OUTPUT=standalone` (Docker).
- BFF: enforces the 64 KB limit while streaming the body (no more reading everything first when there is no
  `Content-Length`); expected origin resolved from `APP_ORIGIN`, then `X-Forwarded-Host`/`-Proto`, then the
  request; `Cache-Control: no-store` on its responses.
- `/auth/session-expired` only clears the cookie when the API confirms the token is dead (401/404), so a link
  from another site cannot sign anyone out.
- Sign-in/sign-up pass the client address to the API (`X-Forwarded-For`) only when `FORWARD_CLIENT_IP=true`.
- Open redirect fixed in `?next=` (control characters such as `/\t/evil.com`).
- The recurrence form's "apply from" minimum respects a current rule that starts in the future.
- `shadcn` moved to `devDependencies` (its CLI pulled a vulnerable `braces` into the runtime audit).
- API types regenerated (429 responses).

Docs: complete `README.md` (what it is, prerequisites, Docker Compose, local development, tests, CI,
structure) and an updated `frontend/README.md`.

## How to run and check

```bash
# Unit/integration (Docker must be running for the backend tests)
dotnet test backend/MaiaFlow.Tests
cd frontend && npm run check && npm run build

# End to end (local PostgreSQL from `docker compose up -d db`; first time: npx playwright install chromium)
cd frontend && npm run e2e

# Whole app in containers (needs POSTGRES_PASSWORD and JWT_KEY in .env)
docker compose up -d --build      # http://localhost:3000
```

Results at the end of the phase: backend 134/134, frontend 435/435 (97% lines), E2E 29/29 (also repeated
3× without flakes), `npm audit --omit=dev` clean, no vulnerable NuGet packages, solution builds with
`-warnaserror`.

## Decisions made during the phase

| Decision | Reason |
|---|---|
| D21: Rate limits on login/sign-up per address, login per account, and per signed-in user; client address from trusted forwarded headers only. | Brute force and BCrypt CPU abuse; the per-account limit still works when every visitor shares the web server's address. |
| D22: The CSP is built per request in `proxy.ts` with a nonce; other headers live in `next.config.ts`. | A nonce cannot be static; Next.js stamps it on its own scripts. |
| D23: Docker images: API on aspnet with tzdata, web as Next.js `standalone`; only the web port is published, on 127.0.0.1 by default. The API migrates the database on startup. | One command to run the app; the API stays private behind the BFF (D20). |
| Subagents worked in the same working tree on disjoint folders (no worktrees). | Nothing may be committed before the owner approves. |

## Deviations from the plan

- The phase was interrupted by a usage limit and resumed in a new session from the old transcript; the E2E
  and Docker/CI subagents were restarted to finish their parts.
- The security follow-ups from phase 3 were done here, as planned.

## Open issues and follow-ups

- **Shared rate-limit bucket without a proxy:** with the default compose every visitor reaches the API from
  the web container's address, so the per-address login/sign-up limits are shared (someone could slow logins
  for everybody for a minute). The per-account limit still protects each account. For a public deployment,
  put a reverse proxy in front that overwrites `X-Forwarded-For` and set `FORWARD_CLIENT_IP=true`.
- The session cookie is `Secure` in production: any host other than `localhost` needs HTTPS (TLS reverse
  proxy) and `APP_ORIGIN`. Changing `APP_ORIGIN` needs an image rebuild (Server Actions read it at build).
- Narrow race left: a recurrence change validated just before a concurrent calendar request generates the
  same day could leave that day under the old rule (the cursor no longer goes backwards). A concurrency token
  on `Habit` would close it.
- Forms fill their initial values only after hydration: typing in Perfil → Nome before JavaScript loads
  appends to the name.
- Midnight: a tab left open past midnight keeps the old "today" until reload (from phase 3).
- Password/e-mail change and account deletion without the current password: owner decision pending (not
  changed in this phase).
- Calendar generation does one round trip per lagging habit on the first request of the day (fine at the
  current 200-habit limit).
- Sign-up says when an e-mail is already registered (accepted for UX; rate limited).
- Docker hardening not done: images not pinned by digest, no read-only root filesystem, the API migrates
  with the same database user it uses for requests. DataProtection keys are not persisted (only matters for
  features that use them; none today).
- `npm audit` findings in development tooling are unchanged.

## Notes for the next phase

- Phase 5 (Home calendar and dashboards) starts from here; the Today screen is `src/app/(app)/page.tsx` +
  `src/components/today/`.
- New API rate limits: tests and the E2E config lift them; if you add a heavy client flow, remember the
  300/min per-user limit.
- `npm run e2e` rebuilds the web app only when `src/` changed (`E2E_REBUILD=1` forces it).
- CI is green on GitHub (all four jobs). The first run failed only because `PageProps`/`LayoutProps` are
  generated into `.next/`, which a clean checkout lacks; `npm run typecheck` now runs `next typegen` first.
- After changing the API contract, regenerate types with the API running (`npm run api:types`, or
  `OPENAPI_URL=...` for another port).
