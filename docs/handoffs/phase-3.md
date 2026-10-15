# Phase 3 handoff — Frontend features

## Summary

Every backend feature is usable from the web app: tasks, habits (all six recurrence types), the habit
calendar, the Today screen and the profile page. Server Components read the first screen from the API;
interactive parts use TanStack Query against the same-origin BFF (`/api/...`). The owner tested it and approved
it (decision D17).

- Status: **done**, tested by the owner and pushed to `main` on 2026-10-14.
- Pull request: none (work goes straight to `main`, D17).
- Finished on: 2026-10-14

## What changed

Frontend (`frontend/`)

- **Tasks (`/tasks`)**: list, filter by status (with counts), create, edit, delete (confirmation), mark as
  done with an optimistic update (rolls back and shows a toast on failure). Sorted: pending first, by due
  date, undated last. `TaskRow` and `TaskFormDialog` are reusable.
- **Habits (`/habits`)**: cards with a Portuguese recurrence summary; create; edit title/description;
  change recurrence (optional "apply from" date); delete with a warning that the history goes too.
  The recurrence form covers `Daily`, `Weekly`, `Monthly` (days 1–31 + "Último dia do mês"), `Yearly`,
  `IntervalDays` and `SpecificDaysOfWeek` (bit mask Dom=1 … Sáb=64). Payloads only carry the fields of the
  chosen type.
- **Calendar (`/calendar`)**: month grid (Sunday first, whole weeks), previous/next/"Hoje", per-day status
  dots and counts, day panel with Feito / Não feito / Pendente. Days after today (`id = 0`) are viewable but
  their controls are disabled with "Ainda não chegou o dia"; the hook also refuses to send `id <= 0`. The grid
  is keyboard-navigable (arrows, Home/End, PageUp/PageDown).
- **Today (`/`)**: habits of today with the status control, plus tasks due today and overdue pending tasks
  ("Atrasadas"). Tasks without a due date are not shown here. Progress counters per section.
- **Profile (`/profile`)**: edit name and e-mail (duplicate e-mail shows under the field), change password
  (new + confirmation), delete account with a confirmation dialog. Deleting is a Server Action
  (`deleteAccountAction`) because the cookie must be cleared in the same step; it goes to
  `/login?reason=deleted` ("Sua conta foi excluída.").
- **Shared pieces**: `lib/dates.ts` (calendar-day helpers; `todayInBrasilia()`), `lib/api/browser.ts`
  (typed browser client for the BFF, `ClientApiError`, `errorMessage`, 401 handling), `lib/query-seed.ts`
  (`toSeed`), `components/confirm-dialog.tsx`, `components/form/{textarea-field,form-alert}.tsx`, new shadcn
  components (dialog, alert-dialog, select, checkbox, textarea, tabs, toggle, toggle-group). "Close" labels
  of the dialog and sheet are now "Fechar".
- Small fixes: `min-w-0` on `<main>` and a `minmax(0,1fr)` column on the task list (the filter tabs made the page
  wider than a phone); validation schemas for name/e-mail/password are shared by sign-up and profile.

Backend: no changes. `schema.d.ts` was not regenerated (the contract did not change).

Tests: 48 test files, 411 tests (Vitest + Testing Library), about 98 % line coverage on measured code.

## Review

A TypeScript/React review and a security review ran over the whole diff. Fixed in this phase:

- **Cache leak between accounts (high):** TanStack Query's cache survived logout and re-login in the same tab.
  `ClearQueryCache` now empties it whenever the sign-in or sign-up page mounts (logout, account deletion and
  expired sessions all land there).
- **Concurrent optimistic updates:** rollback restores only the affected task or occurrence, and the refetch
  waits until the last mutation in flight has settled (`isMutating`).
- **Dialogs closing while saving** (Esc, overlay) hid failures: now blocked until the request answers.
- **Calendar range:** the last month the grid can show is now 58 months ahead, so the grid's last week never
  goes past the API's 5-year window; selecting a day outside the allowed months is ignored.
- **"Aplicar a partir de":** the minimum is tomorrow, because today's occurrences already exist once the Today
  or Calendar screen was opened and the API rejects earlier dates.
- **BFF:** the `auth` block is case-insensitive (`/api/Auth/login` would have returned the token to the browser).
- Layout: the filter tabs made the task list wider than a phone.

## How "today" works

The API has no "today" endpoint. The Next.js server computes it with `Intl` in `America/Sao_Paulo`
(`todayInBrasilia()`), passes it to client components as a prop, and the browser clock is never used for it.
Dates travel as zone-less `yyyy-MM-ddT00:00:00` and are handled as `yyyy-MM-dd` strings, never through
`new Date(string)`.

## Data flow

Pages (Server Components) fetch with `getAuthedApi()` + `unwrap()` and pass `{ data, fetchedAt }` (`toSeed`)
to client components. The client uses `useQuery` with `initialData` (so there is no extra request while the
seed is fresh, `staleTime` 30 s) and mutations through `getBrowserApi()`. Query keys: `["tasks"]`,
`["habits","list"]`, `["habits","calendar",start,end]`. Habit mutations invalidate the `["habits"]` prefix.

## How to run and check

```bash
docker compose up -d db
dotnet run --project backend/MaiaFlow          # http://localhost:5011
cd frontend
npm run dev                                    # http://localhost:3000
npm run check                                  # lint + typecheck + format + tests
npm run build
```

Manual check done in the browser (desktop and 375 px): sign-up; Today with habits and tasks; completing a
habit and a task; creating a task; the habit dialog with the six frequency types (monthly picker seen);
calendar month, today highlighted, future day disabled; profile name change (header initials followed);
account deletion back to the login page with the notice.

## Decisions made during the phase

| Decision | Reason |
|---|---|
| "Today" is computed on the Next.js server in `America/Sao_Paulo` and passed down as a prop. | The API has no endpoint for it and the browser clock must not decide the day (D15). |
| Account deletion is a Server Action, not a BFF call. | The session cookie has to be cleared together with the deletion. |
| The Today screen shows tasks due today and overdue pending ones; undated tasks are not "for today". | Keeps the screen short; all tasks stay on `/tasks`. |
| Subagents worked in the same working tree on disjoint folders, not in git worktrees. | Nothing may be committed before the owner approves, and the shared base was not in git yet. |

## Deviations from the plan

- No worktrees (see above). The main session built the shared base, Today and Profile; three subagents built
  Tasks, Habits and Calendar in parallel. A code review and a security review ran at the end.

## Open issues and follow-ups

- **Midnight:** a tab left open past midnight keeps the old "today" until the page is reloaded (all screens get
  `today` as a server-computed prop). A `router.refresh()` on tab focus would fix it.
- **Security hardening, phase 4:** no CSP / security headers in `next.config.ts`; the BFF reads the whole body
  before the 64 KB check when there is no `content-length`; `/auth/session-expired` clears the cookie on any GET
  (forced logout by a link from another site); confirm the API never returns exception details in `detail` in
  production.
- Password change and account deletion need no re-authentication (same contract decision as the
  current-password item below).
- On the Today screen a `NotCompleted` task cannot go back to "Pendente" (no actions menu there); use `/tasks`.
- Changing e-mail or password still needs only the bearer token (no current-password check, no token
  revocation); needs a contract decision (open since phase 1).
- Task list has no server-side filter or pagination (filtering is on the client).
- Phase 4: Playwright E2E for sign-up/login, tasks, habits and calendar; the declarative pages are excluded from
  unit coverage and left to it.
- A habit's recurrence change shows `currentEffectiveFrom` ("A partir de …") when it is scheduled for the future.
- `npm audit` findings from phase 2 are unchanged (development tooling only).
- **Rotate the old DB password and JWT key** (owner said they will do it).

## Notes for the next phase

- Playwright flows to cover: sign-up → today; create/complete/delete task; create habit of each type and
  see it in the calendar; mark an occurrence; profile edit; delete account.
- The BFF compares `Origin` with its own origin: set forwarded host/proto correctly behind Docker/proxy.
- Docker images need `tzdata` for the API's time zone, and the web container needs the same date logic
  (`Intl` with `America/Sao_Paulo` works on stock Node images).
