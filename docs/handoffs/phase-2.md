# Phase 2 handoff — Frontend foundation (Next.js)

## Summary

A user can sign up, sign in, and land on an empty authenticated area (sidebar + header, light/dark
theme, Portuguese copy). The browser only talks to the Next.js app; the app talks to the API and keeps
the API's JWT in an `httpOnly` cookie. API types are generated from the OpenAPI document, and the
backend's OpenAPI contract was tightened so those types are precise.

- Status: **in review**. The owner is testing; nothing from this phase's frontend work is committed yet
  (see D17).
- Already on `main` before the "test first" instruction: the Next.js scaffold, the OpenAPI contract
  change, and the workflow docs.
- Finished on: 2026-10-14

## What changed

Frontend (`frontend/`, see its [README](../../frontend/README.md))
- Next.js 16.4 App Router, React 19, TypeScript strict, ESLint, Prettier (with the Tailwind plugin),
  Tailwind CSS 4, shadcn/ui (`base-nova` style, Base UI primitives).
- **Auth (D5, D19, D20):**
  - `loginAction` / `signupAction` Server Actions validate with Zod, call the API, store the JWT in the
    `maiaflow_token` cookie (`httpOnly`, `SameSite=Lax`, `Secure` in production, lifetime = token
    expiry) and redirect. Sign-up signs in automatically.
  - `src/proxy.ts` (Next 16's name for middleware) redirects by looking at the cookie only (present and
    not expired). The API stays the authority: a 401 sends the user to `/auth/session-expired`, which
    clears the cookie and shows "Sua sessão expirou".
  - `?next=` after login is checked (same-site paths only) to prevent open redirects.
  - **BFF:** `/api/[...path]` forwards same-origin calls to the API and adds the token. It never
    forwards `/api/auth/*`, requires a same-origin `Origin` on state-changing calls, caps bodies at
    64 KB, clears the cookie on 401. Used by TanStack Query in phase 3.
- **Typed API:** `npm run api:types` generates `src/lib/api/schema.d.ts` from the running API;
  `src/lib/api/client.ts` wraps `openapi-fetch` for server-side use (`getAuthedApi`, `unwrap`).
- **Layout:** app shell with a sidebar (mobile: sheet menu), header with theme toggle (light / dark /
  system) and account menu (name, e-mail, "Sair"); placeholder pages for Hoje, Tarefas, Hábitos,
  Calendário and Perfil; loading skeleton, error boundary, 404 and global error pages.
- **Forms:** react-hook-form + Zod with Portuguese messages; the server validates again.

Backend
- OpenAPI contract: non-nullable reference types are required and non-nullable, response DTOs are fully
  required, PATCH bodies have no required fields. Generated types are `id: number`, not `id?: number`.
  Covered by contract tests (117 backend tests).

Tests: 113 frontend tests (Vitest, Testing Library), 96.8 % line coverage on the measured code. The
declarative pages/layouts and the generated shadcn components are excluded from coverage and left to
the phase 4 Playwright tests.

## How to run and check

```bash
docker compose up -d db
dotnet run --project backend/MaiaFlow          # http://localhost:5011
cd frontend
cp .env.example .env.local
npm install
npm run dev                                    # http://localhost:3000
npm run check                                  # lint + typecheck + format + tests
npm run build
```

Manual check done in the browser: sign-up lands on "Hoje" with the avatar initials; the cookie is not
visible to `document.cookie`; `/api/auth/login` through the BFF is 404; a forged token on `/tasks`
goes through `/auth/session-expired` back to login; wrong password shows "E-mail ou senha inválidos.";
theme choice persists across sign-out; the mobile menu opens.

## Decisions made during the phase

| Decision | Reason |
|---|---|
| D17 (revised): work goes to `main` without PRs, but nothing is committed until the owner tests and approves. | Owner's request. |
| D18: Next.js Cache Components stay off. | The app is entirely behind a login; avoids Suspense around every cookie read. |
| D19: the API's JWT goes in the cookie as-is, no session library. | Fewer moving parts; the API validates it on every call. |
| D20: browser calls go through the same-origin BFF; sign-in/sign-up are Server Actions only. | The token never reaches client-side JavaScript. |
| `@types/node` ^24 and Vitest 5 | Vitest requires `@types/node` 22+ or 24+; the scaffold had 20. |

(D17–D20 are in the Decisions table of `docs/ROADMAP.md`.)

## Deviations from the plan

- The roadmap suggests subagents for the auth and layout tracks. Both were small and share files
  (`layout.tsx`, `providers`), so the main session did them in sequence. No subagent review was run on
  the frontend yet; a code/security review is planned for phase 4.
- The roadmap said "replace `frontend.js`": done (it was empty).
- The backend OpenAPI change was not in the plan; it was needed for usable generated types.

## Open issues and follow-ups

- `npm audit` reports 9 high-severity findings, all in development tooling (`braces` through
  `eslint-config-next`, and the `shadcn` CLI). None is in code that runs in production. Re-check when
  updating dependencies.
- shadcn's registry now imports `cn` from the `cn` npm package (published by the shadcn maintainers,
  no dependencies) instead of `clsx` + `tailwind-merge`. Checked and kept.
- `npm run api:types` needs the API running. Regenerate it (and commit the result) whenever the API
  contract changes.
- The BFF compares `Origin` with the request's own origin. Behind a reverse proxy that rewrites the
  host (phase 4, Docker), set the forwarded host/proto correctly or the check will reject valid calls.
- Docker images based on slim/alpine need `tzdata` for the API's `America/Sao_Paulo` time zone.
- Pages other than login/sign-up are placeholders ("Em breve") until phase 3.
- The JWT lives 24 h and there is no refresh; expiry sends the user back to login with a notice.
- Still open from phase 1: rate limiting (phase 4), current-password check and token revocation.
- **Rotate the old DB password and JWT key** (public git history). The owner said they will do it later.

## Notes for the next phase

- Server Components call the API with `getAuthedApi()` + `unwrap()`; interactive pieces (optimistic
  updates, mutations) use TanStack Query against `/api/...` (the BFF). `Providers` already mounts the
  `QueryClientProvider` and the toaster.
- PATCH: omit a field to keep it, send `null` to clear it. Calendar items with `id = 0` are future days
  and cannot be updated; disable them in the UI.
- Enums are string unions in the generated types; `daysOfWeek` is a number bit mask (Sunday=1 … Saturday=64).
- "Today" is the date in Brasília, computed by the server; do not derive it from the browser clock.
- Add new shadcn components with `npx shadcn@latest add <name>`; they use Base UI (`render` prop instead
  of `asChild`).
- Read `frontend/AGENTS.md`: this Next.js version differs from older ones (e.g. `proxy.ts`, typed
  `PageProps` / `LayoutProps` helpers); its docs are in `node_modules/next/dist/docs/`.
