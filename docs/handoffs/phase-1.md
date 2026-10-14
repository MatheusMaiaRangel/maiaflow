# Phase 1 handoff — Backend: API contract and fixes

## Summary

The API now has a stable, tested contract: every route is under `/api`, errors are
`ProblemDetails`, enums are strings, users act only on themselves (`/api/users/me`), PATCH can clear
optional fields, and the habit recurrence/calendar bugs found in the review are fixed. A test
project covers the domain and the endpoints against a real PostgreSQL.

- Pull request: https://github.com/MatheusMaiaRangel/maiaflow/pull/11 (stacked on phase 0, PR #10)
- Branch: `feat/phase-1-api-contract` (based on `chore/phase-0-foundation`, see PR #10 of phase 0)
- Finished on: 2026-10-13

## What changed

Backend (`backend/MaiaFlow`)
- **Errors (D4):** `DomainValidationException` → 400, `NotFoundException` → 404,
  `ConflictException` → 409, `UnauthorizedAccessException` → 401, anything else → 500 with a
  generic message (logged server-side). One handler,
  [`ApiExceptionHandler`](../../backend/MaiaFlow/Infrastructure/ApiExceptionHandler.cs); a unique
  violation in PostgreSQL also becomes 409. Services throw instead of returning `null`/`false`.
- **Routes (D1, D2):** everything under `/api`; `/users/{id}` is gone, replaced by `/api/users/me`.
- **JSON (D3):** enums are strings. `WeekDays` is an **int bit mask** in the DTOs (Sunday=1,
  Monday=2, Tuesday=4, Wednesday=8, Thursday=16, Friday=32, Saturday=64; 0–127).
- **Status codes:** `201 Created` + `Location` on create, `204 No Content` on delete.
- **CORS:** `Cors:AllowedOrigins` (array). Empty in `appsettings.json`; Development allows
  `http://localhost:3000`.
- **PATCH semantics:** a missing field keeps its value, `null` clears it. Works for task
  `description` and `dueDate`, and habit `description` (`Optional<T>`, JSON merge-patch style).
  Titles, names, e-mails and passwords can be changed but not cleared.
- **Validation:** one set of rules for create and update. Task title 1–150 chars, description ≤ 500;
  habit title 3–150, description ≤ 500; user name 3–100, e-mail valid and ≤ 256, password 6–72
  bytes (validated in plain text, before hashing). Limits match the column sizes, so too-long input
  is a 400 instead of a database error.
- **Users:** e-mail is trimmed and lower-cased, and unique (also on update → 409; unique index
  `IX_users_Email`). Login does one BCrypt check even for unknown e-mails.
- **Habits and calendar:** see "Recurrence rules" below.
- **OpenAPI:** XML comments are in Swagger; every operation documents its 2xx response (needed for
  generated clients); clearable PATCH fields are `nullable`.
- **Limits (abuse protection):** request body ≤ 64 KB; at most 200 habits and 5000 tasks per user;
  habit `startDate` / `effectiveFrom` from 2 years in the past to 5 years ahead; calendar `start` /
  `end` from 10 years back to 5 years ahead and at most 366 days; `daysOfMonth` at most 31 values
  (deduplicated and sorted); `intervalDays` ≤ 3650; undefined enum numbers are rejected.
- **Hardening:** `Jwt:Key` must be 32+ characters and cannot start with `CHANGE_ME`;
  `Jwt:ExpiresMinutes` must be 5–10080; JWT algorithm pinned to HS256; HSTS outside Development;
  a valid token whose user was deleted gets `401` (foreign key violation) instead of `500`.
- **Migrations:** `AddUserEmailUniqueIndex` (also lower-cases and trims existing e-mails first),
  `AddUniqueOccurrenceDate`.

Tests (`backend/MaiaFlow.Tests`): 116 tests, above 80 % line coverage. Domain unit tests, plus
integration tests with `WebApplicationFactory` and a real PostgreSQL started by Testcontainers
(auth, ownership, tasks, habits, calendar, CORS, OpenAPI contract). A fake clock (`TimeProvider`)
makes date logic deterministic.

## API reference

Auth: `Authorization: Bearer <token>` on everything except sign-up and login. Every authenticated
route can return `401`. Errors:

```json
{ "type": "...", "title": "...", "status": 400, "detail": "Mensagem em português", "traceId": "..." }
```

Body binding errors (missing field, unknown enum value, bad JSON) return `400` with the standard
`errors` map. `detail` is user-facing Portuguese.

### Users

| Method | Route | Auth | Request | Success | Errors |
|---|---|---|---|---|---|
| POST | `/api/users` | no | `{ name, email, password }` | `201` `{ name, email }`, `Location: /api/users/me` | 400, 409 (e-mail taken) |
| POST | `/api/auth/login` | no | `{ email, password }` | `200` `{ token }` (JWT, 24 h) | 401 (same message for unknown e-mail and wrong password) |
| GET | `/api/users/me` | yes | — | `200` `{ name, email }` | 404 (user deleted, token still valid) |
| PATCH | `/api/users/me` | yes | `{ name?, email?, password? }` | `200` `{ name, email }` | 400, 404, 409 |
| DELETE | `/api/users/me` | yes | — | `204` (also deletes tasks and habits) | 404 |

### Tasks

`ReadTaskDTO` = `{ id, title, description: string|null, dueDate: string|null, status }` with
`status` one of `"Pending" | "NotCompleted" | "Completed"`.

| Method | Route | Request | Success | Errors |
|---|---|---|---|---|
| POST | `/api/tasks` | `{ title, description?, dueDate? }` | `201` `ReadTaskDTO` (status `Pending`) | 400 |
| GET | `/api/tasks` | — | `200` `ReadTaskDTO[]` (all of the user's tasks; no server-side filter yet) | |
| GET | `/api/tasks/{id}` | — | `200` `ReadTaskDTO` | 404 |
| PATCH | `/api/tasks/{id}` | `{ title?, description?, dueDate? }` (`null` clears description/dueDate) | `200` `ReadTaskDTO` | 400, 404 |
| PATCH | `/api/tasks/{id}/status` | `{ status }` | `200` `ReadTaskDTO` | 400, 404 |
| DELETE | `/api/tasks/{id}` | — | `204` | 404 |

A task that belongs to someone else is a `404`, never a `403`.

### Habits

`ReadHabitDTO` = `{ id, title, description: string|null, startDate, currentEffectiveFrom,
currentFrequencyType, currentIntervalDays: int|null, currentDaysOfWeek: int, currentDaysOfMonth: int[],
currentLastDayOfMonth: boolean }`.
`frequencyType` is one of `"Daily" | "Weekly" | "Monthly" | "Yearly" | "IntervalDays" | "SpecificDaysOfWeek"`.

| Method | Route | Request | Success | Errors |
|---|---|---|---|---|
| POST | `/api/habits` | `{ title, description?, startDate, frequencyType, intervalDays?, daysOfWeek, daysOfMonth?, lastDayOfMonth? }` | `201` `ReadHabitDTO` | 400 |
| GET | `/api/habits` | — | `200` `ReadHabitDTO[]` | |
| GET | `/api/habits/{id}` | — | `200` `ReadHabitDTO` | 404 |
| PATCH | `/api/habits/{id}` | `{ title?, description? }` (`null` clears description) | `200` `ReadHabitDTO` | 400, 404 |
| PATCH | `/api/habits/{id}/recurrence` | `{ frequencyType, intervalDays?, daysOfWeek, daysOfMonth?, lastDayOfMonth?, effectiveFrom? }` | `200` `ReadHabitDTO` | 400, 404 |
| DELETE | `/api/habits/{id}` | — | `204` (also deletes rules and occurrences) | 404 |
| GET | `/api/habits/calendar?start=&end=` | dates `yyyy-MM-dd`, both required, `end >= start`, at most 366 days | `200` `ReadHabitOccurrenceDTO[]` ordered by date | 400 |
| PATCH | `/api/habits/occurrences/{occurrenceId}/status` | `{ status }` (`Pending`, `Completed`, `NotCompleted`) | `200` `ReadHabitOccurrenceDTO` | 404 |

`ReadHabitOccurrenceDTO` = `{ id, habitId, habitTitle, date, status }`.

Required fields per `frequencyType`: `IntervalDays` needs `intervalDays > 0`;
`SpecificDaysOfWeek` needs a non-zero `daysOfWeek`; `Monthly` needs `daysOfMonth` (values 1–31)
and/or `lastDayOfMonth: true` (the "último dia do mês" checkbox: also happens on the last day of every
month, e.g. 28/29 in February). Other types ignore those fields. Example: Monday + Wednesday + Friday is `daysOfWeek: 42`.

### Recurrence rules

- A habit keeps a **history of rules**; each has `EffectiveFrom` (inclusive) and `EffectiveTo`
  (exclusive). Dates are normalized to midnight.
- `Weekly`, `Yearly` and `IntervalDays` are **anchored on the rule's `EffectiveFrom`** (the habit's
  start date, or the day a later rule began). `Yearly` on 29 February only happens in leap years.
  `Monthly` days a month does not have (31 in April) are skipped; `lastDayOfMonth` covers that case.
- **Calendar:** days up to today are stored occurrences (real `id`, created the first time the
  calendar is read, status starts `Pending`). Days after today are **computed on the fly with
  `id = 0`**; they do not exist yet, so updating their status returns `404`. The UI must disable
  future days.
- **Changing the recurrence** only affects days from `effectiveFrom` on. Days whose occurrences were
  already generated are never rewritten, so `effectiveFrom` must be after the last generated day
  (otherwise `400`). Without `effectiveFrom` the change starts on the first ungenerated day: today,
  or tomorrow if today's occurrences already exist. `currentEffectiveFrom` in the response tells
  the UI when it starts. A change can be scheduled in the future.
- **"Today" is the calendar day in Brasília** (`TimeZone` setting, default `America/Sao_Paulo`; Brazil has
  no daylight saving). The server needs tz data (`tzdata` in slim/alpine Docker images, Phase 4).

## How to run and check

```bash
docker compose up -d db
dotnet tool restore
dotnet ef database update --project backend/MaiaFlow   # applies the two new migrations
dotnet build backend/MaiaFlow
dotnet test backend/MaiaFlow.Tests                      # needs Docker (Testcontainers)
dotnet run --project backend/MaiaFlow                   # http://localhost:5011/swagger
```

If your database already has duplicated e-mails or duplicated habit occurrences, the two new unique
indexes will fail to apply; clean the duplicates first (or recreate the dev database).

## Decisions made during the phase

| Decision | Reason |
|---|---|
| D10: `WeekDays` is an `int` bit mask in DTOs; domain keeps the `[Flags]` enum. | Keeps D3 (bit flags on the wire) while all other enums become strings. Values outside 0–127 are rejected. |
| D11: Missing PATCH field = keep, `null` = clear (`Optional<T>`). | The only way to clear optional fields without a separate endpoint. |
| D12: A recurrence change never rewrites generated days; default start = first ungenerated day. | Avoids losing completed/not-completed history and duplicate occurrences. |
| D13: E-mails are stored lower-case and unique. | Uniqueness must not depend on casing. |
| D14: Integration tests use Testcontainers (real PostgreSQL), not an in-memory fake. | Tests exercise the real SQL, indexes and `ON CONFLICT`. |

(Added to the Decisions table in `docs/ROADMAP.md` as D10-D14; the owner can veto any of them.)

## Deviations from the plan

- The roadmap suggests three parallel subagents for Step 2 (users, tasks/habits, tests). The code
  base is small and those areas share files (`Program.cs`, services, DTOs), so the main session did
  Step 2 itself in sequence; tests were written alongside each piece. A code review and a security
  review were run by subagents at the end.
- Extra fixes beyond the roadmap list: unique `(HabitId, Date)` on occurrences with an
  `ON CONFLICT DO NOTHING` insert (concurrent calendar requests duplicated rows), calendar range
  limit, field length validation, calendar returning future days before `start`, future rule hiding
  days before it, `Pending` status for occurrences.

## Open issues and follow-ups

- **Changing e-mail/password has no current-password check.** Worth adding before production;
  needs a contract decision for the profile page (Phase 3).
- **No refresh token:** JWT lasts 24 h; the frontend must handle `401`.
- `GET /api/tasks` has no filter or pagination (Phase 3 can filter on the client; revisit if lists
  grow).
- **Rate limiting is not implemented** (login and sign-up are open to brute force and BCrypt CPU
  abuse). Left for Phase 4 because per-IP limits depend on the proxy setup (`ForwardedHeaders`).
- **Changing e-mail or password needs only the bearer token; tokens are not revocable** (no
  password-change invalidation, 24 h life). Suggested: require `currentPassword` for those changes
  and add a token version claim. Needs a contract decision (the profile page, Phase 3).
- The JWT carries name and e-mail claims; only `sub` is needed. Trim when the frontend is built.
- `AllowedHosts` is `*`; set real hosts in production (Phase 4).
- `current*` fields of `ReadHabitDTO` describe the **latest rule**. If a change is scheduled for the
  future they already show the new rule; use `currentEffectiveFrom` to tell when it starts.
- The migration `AddUserEmailUniqueIndex` fails if lower-casing makes two existing users collide, and
  `AddUniqueOccurrenceDate` fails on duplicated (habit, date) rows; clean those first on real data.
- `NU1903`: `Microsoft.OpenApi` 2.4.1 (via Swashbuckle) has a known advisory; no newer compatible
  version was available at the time. Re-check when updating Swashbuckle.
- `Microsoft.AspNetCore.OpenApi` is still referenced but unused.
- **URGENT, owner action: rotate the old DB password and JWT key.** The GitHub repository is
  **public** and both values are in the history of `main` (commit `eddcfb0` and others). Treat
  them as leaked everywhere they were used; optionally purge history with `git filter-repo`.

## Notes for the next phase

- Phase 2 can generate TypeScript types from `http://localhost:5011/swagger/v1/swagger.json`
  (OpenAPI 3.0.4). Enums are string unions; `daysOfWeek`/`currentDaysOfWeek` are plain numbers.
- Calendar items with `id = 0` are not editable; disable them in the UI.
- `PATCH` bodies: omit a field to keep it, send `null` to clear it. Do not send empty strings to
  clear (a blank description is stored as `null` anyway).
- Run the tests with Docker running; the first run pulls `postgres:16` and the Testcontainers image.
- Start Phase 2 from an up-to-date `main` after Phases 0 and 1 are merged.
