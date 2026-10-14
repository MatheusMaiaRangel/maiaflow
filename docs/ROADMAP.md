# MaiaFlow Roadmap

Plan for turning MaiaFlow into a working full-stack app: an ASP.NET Core API (`backend/`) and a
Next.js web app (`frontend/`). The work is split into phases. **A phase only starts after the
previous one is finished and the owner approved it.**

Each phase is expected to run in its own Claude Code session. When a session starts, read this
file first, then the handoff of the last finished phase in [`docs/handoffs/`](handoffs/).

## Status

| Phase | Title | Status | Handoff |
|---|---|---|---|
| 0 | Environment and foundation | Done | [phase-0](handoffs/phase-0.md) |
| 1 | Backend: API contract and fixes | Done | [phase-1](handoffs/phase-1.md) |
| 2 | Frontend foundation (Next.js) | In progress | — |
| 3 | Frontend features | Not started | — |
| 4 | Quality and delivery | Not started | — |

Update this table when a phase starts (`In progress`) and when it ends (`Done`, with a link to its
handoff).

## Working agreement

### How a phase runs

1. The main session coordinates: it splits the phase into tasks and hands them to subagents.
   Tasks that touch different areas run in parallel, each subagent in its own git worktree, so
   they do not overwrite each other. Long-running work (installs, builds, test suites) runs as
   background tasks.
2. Before every commit, the main session reviews the diff and runs the relevant checks (build,
   tests, lint, typecheck). Nothing is committed red.
3. Commit right after each piece of work is finished. Do not batch unrelated changes until the
   end of the phase.
4. At the end of the phase:
   - write the handoff file `docs/handoffs/phase-N.md` from [the template](handoffs/TEMPLATE.md);
   - update the status table above;
   - push the work to `main` (no pull request; see "Branches" below);
   - report to the owner and wait for approval before starting the next phase.

### Language

- Code, identifiers, comments, commit messages, and docs: **English**.
- User-facing text in the web app (labels, messages, validation errors shown on screen):
  **Brazilian Portuguese**, since the users are Brazilian.

### Commits

[Conventional Commits](https://www.conventionalcommits.org/) with a scope:

```
<type>(<scope>): <short imperative summary>

<optional body: what changed and why>
```

- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`, `style`, `perf`.
- Scopes: `api` (backend), `web` (frontend), `db` (migrations), `repo` (root/tooling), `docs`.
- One logical change per commit. Each commit must build on its own.
- Examples: `feat(api): add GET /api/users/me`, `fix(web): redirect to login on 401`,
  `chore(repo): stop tracking .idea folder`.

### Branches

- Since phase 2 the owner works **directly on `main`**: no feature branches and no pull requests
  (decision D17). Commits still follow the rules above, one logical change each, and are pushed
  right after the checks pass. Phases 0 and 1 went through pull requests #10 and #11.
- A phase handoff replaces the PR description: summary, changes, how it was tested.

## Decisions

Decisions already agreed with the owner. Do not reopen them without asking.

| # | Decision | Reason |
|---|---|---|
| D1 | All API routes use the `/api` prefix (`/api/tasks`, `/api/habits`, ...). | Keeps API routes clearly apart from Next.js page routes. |
| D2 | Replace `GET/PATCH/DELETE /users/{id}` with `/api/users/me`; the user id comes from the JWT. | Today any logged-in user can read, edit, or delete any other user (no ownership check). With `/me` there is no id to tamper with, the frontend does not need to know its own id, and it matches how tasks and habits already work. An admin area, if ever needed, gets its own routes (`/api/admin/users/{id}`) behind a role. |
| D3 | Enums are serialized as strings in JSON (`"Completed"`, not `2`). | Readable payloads and frontend types that do not depend on enum order. `WeekDays` stays a bit-flag value on the wire (see Phase 1). |
| D4 | Domain errors return `ProblemDetails` with proper status codes (400/404/409) instead of 500. | The frontend needs to show useful validation messages. |
| D5 | Frontend talks to the API through the Next.js server (BFF). The JWT lives in an `httpOnly` cookie. | Avoids exposing the token to browser JavaScript and avoids CORS for the main flow. CORS is still configurable on the API for development tools. |
| D6 | Frontend stack: Next.js (App Router) + TypeScript strict, Tailwind CSS + shadcn/ui, react-hook-form + Zod, TanStack Query for interactive client state, API types generated from the backend OpenAPI document. | Mainstream, well-documented stack with typed end-to-end contract. |
| D7 | Secrets (DB password, JWT key) are not committed. Use .NET user-secrets / environment variables, with a committed example file. | The current values in `appsettings.json` are in git history and must be rotated. |
| D8 | EF Core migrations are versioned in git; the existing six were kept as they are (no squash). | They apply cleanly on a fresh database and match the model snapshot; rewriting them would break databases that already have the old history. |
| D9 | The local database runs through `docker-compose.yml` (service `db`); Phase 4 extends the same file. | One way to get a database in every environment. |
| D10 | `WeekDays` is an `int` bit mask in DTOs; the domain keeps the `[Flags]` enum. | Keeps D3 (bit flags on the wire) while all other enums become strings. |
| D11 | PATCH: a missing field keeps the value, `null` clears it (`Optional<T>`). | The only way to clear optional fields without extra endpoints. |
| D12 | A recurrence change never rewrites generated days; default start is the first ungenerated day. | Preserves completed/not-completed history and avoids duplicate occurrences. |
| D13 | E-mails are stored trimmed and lower-case and are unique. | Uniqueness must not depend on casing. |
| D14 | Integration tests use Testcontainers with a real PostgreSQL. | They exercise the real SQL, indexes and `ON CONFLICT`. |
| D15 | "Today" is the calendar day in Brasília (`TimeZone` = `America/Sao_Paulo`), not UTC. | Users are in Brazil; late-evening actions must land on the right day. |
| D16 | Monthly habits have a `lastDayOfMonth` option (checkbox); day 31 alone still skips short months. | Lets users mean "end of month" explicitly. |
| D17 | From phase 2 on, work and commit directly on `main` (no branches, no PRs). | Solo project; the owner prefers the simpler flow. |

## Phases

### Phase 0 — Environment and foundation

**Goal:** the backend builds and runs in this environment, the repository is clean, and new
sessions start ready to work.

Tasks:
- [ ] Install the .NET 10 SDK in the container (it is not preinstalled) — background task.
- [ ] Get PostgreSQL running (Docker or local), apply EF Core migrations, confirm the API starts
      and Swagger opens. Note: `Migrations/` is currently git-ignored; decide whether to version
      migrations (recommended) and record the decision.
- [ ] Root `.gitignore` (dotnet, Node/Next, IDE files); stop tracking `.idea/`.
- [ ] Move secrets out of `appsettings.json` (user-secrets / env vars) and add
      `appsettings.Development.example.json` or a `.env.example` (D7).
- [ ] Initial `README.md`: what the project is, prerequisites, how to run, link to this roadmap.
- [ ] SessionStart hook (`.claude/`) so new cloud sessions install the .NET SDK and dependencies
      automatically.

Done when: `dotnet build` passes, the API answers requests against a real database, Swagger
opens, and the handoff is written.

### Phase 1 — Backend: API contract and fixes

**Goal:** a stable, secure, tested API contract for the frontend to build on.

Step 1 (one subagent, runs first because everything else depends on `Program.cs`):
- [ ] Domain exceptions (e.g. `DomainValidationException`, `NotFoundException`,
      `ConflictException`) replacing generic `Exception`/`ArgumentException` throws and the
      `try/catch` blocks in controllers.
- [ ] Global exception handler returning `ProblemDetails` (400 validation, 404 not found,
      409 conflict such as duplicated e-mail) (D4).
- [ ] `JsonStringEnumConverter` for enums (D3).
- [ ] Configurable CORS policy (allowed origins from configuration).
- [ ] Correct status codes: `201 Created` (with location) on create, `204 No Content` on delete.
- [ ] `/api` prefix on every route (D1).

Step 2 (three subagents in parallel, separate worktrees):
- [ ] **Users and security:** `GET/PATCH/DELETE /api/users/me` (D2); remove `/users/{id}`;
      `404` instead of `500` for missing users; e-mail uniqueness also on update.
- [ ] **Tasks and habits:** PATCH able to clear optional fields (description, due date);
      consistent title rules between create and update; review recurrence logic
      (`Weekly`/`Yearly` anchored on `EffectiveFrom`, `IntervalDays`, `WeekDays` flags);
      document that calendar occurrences in the future have `id = 0` and cannot be updated.
- [ ] **Tests:** xUnit test project with domain tests (recurrence rules, validations) and
      integration tests (`WebApplicationFactory` + real PostgreSQL) covering auth, ownership,
      and the main endpoints.

Done when: build and tests pass, Swagger reflects the final contract, and the handoff lists
every endpoint with its request/response shapes.

### Phase 2 — Frontend foundation (Next.js)

**Goal:** a user can sign up, log in, and land on an empty authenticated area.

Step 1 (one subagent):
- [ ] Scaffold Next.js (App Router, TypeScript strict) in `frontend/`, replacing the empty
      `frontend/frontend.js`. ESLint, Prettier, Tailwind CSS, shadcn/ui (D6).
- [ ] Script that generates API types from the backend OpenAPI document
      (`openapi-typescript`) and a typed server-side API client.

Step 2 (two subagents in parallel):
- [ ] **Auth (BFF):** login, sign-up, and logout via Server Actions / Route Handlers; JWT stored
      in an `httpOnly` cookie; `middleware.ts` protecting authenticated routes; redirect to
      login on `401` (D5).
- [ ] **Layout and design system:** app shell (sidebar + header), light/dark theme, base
      components, loading and error states, Portuguese copy.

Done when: sign-up → login → authenticated area works against the real API, and lint,
typecheck, and build pass.

### Phase 3 — Frontend features

**Goal:** every backend feature is usable from the web app.

Four subagents in parallel, each in its own worktree; the main session merges them:
- [ ] **Tasks:** list, filter by status, create/edit/delete, mark as done with optimistic update.
- [ ] **Habits:** CRUD and a recurrence form covering all six frequency types
      (`Daily`, `Weekly`, `Monthly`, `Yearly`, `IntervalDays`, `SpecificDaysOfWeek`) and the
      weekday bit flags.
- [ ] **Calendar:** month view of habit occurrences; mark occurrences as done/not done; future
      days disabled.
- [ ] **Today and profile:** dashboard with today's tasks and habits; profile page to edit name,
      e-mail, and password; delete account.

Done when: every flow works end to end against the real API, and lint, typecheck, and build pass.

### Phase 4 — Quality and delivery

**Goal:** the project is tested end to end, easy to run, and checked on every push.

- [ ] **E2E tests** (one subagent): Playwright covering sign-up/login, tasks, habits, and
      calendar flows.
- [ ] **Infrastructure** (one subagent): `docker-compose.yml` with database, API, and web;
      GitHub Actions running build, tests, and lint for backend and frontend.
- [ ] Code review and security review of the whole codebase; fix findings.
- [ ] Complete `README.md`.

Done when: CI is green, `docker compose up` brings up the whole app, and the final handoff is
written.

## Known issues found during the initial review

Inputs for the phases above, so they are not lost between sessions:

- No CORS configured; browser calls from another origin fail. (Phase 1, D5)
- Enums serialized as numbers. (Phase 1, D3)
- Domain validation errors and duplicated e-mail return `500`. (Phase 1, D4)
- No `/me` endpoint; `/users/{id}` has no ownership check. (Phase 1, D2)
- `GET /users/{id}` with an unknown id returns `500`. (Phase 1)
- PATCH treats `null` as "keep current value", so optional fields cannot be cleared. (Phase 1)
- Task title requires 1 character on create but 3 on update. (Phase 1)
- Future calendar occurrences are computed on the fly with `id = 0`. (Phase 1 docs, Phase 3 UI)
- JWT expires after 24h and there is no refresh token; the frontend redirects to login on `401`.
- DB password and JWT key are committed in `appsettings.json`. (Phase 0, D7)
- `[Route("api/[controller]")]` on controllers is overridden by absolute routes. (Phase 1, D1)
