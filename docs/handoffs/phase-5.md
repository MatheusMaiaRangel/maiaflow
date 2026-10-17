# Phase 5 handoff — Home screen: calendar and dashboards

## Summary

The Today screen (`/`) now has the month calendar and a "Resumo" with four stat cards and two history
charts, fed by a new endpoint, `GET /api/habits/stats` (decision D24). A tab left open past midnight now
moves to the new day by itself. The owner approved the layout before it was built (mockup in the session).

- Status: **done**, tested and approved by the owner and pushed to `main` on 2026-10-17.
- Pull request: none (work goes straight to `main`, D17).
- Finished on: 2026-10-17

## What changed

Backend (`backend/MaiaFlow`)

- `GET /api/habits/stats?days=N` (`HabitController.GetStats`, `HabitService.GetStatsAsync`): `days` 7–90,
  default 30; anything else is a 400 ("O período deve ter entre 7 e 90 dias."). The window is
  `[today − (days − 1), today]` in Brasília.
  - It first stores the past occurrences that were never opened, like `/calendar`. The generation loop is
    now one private method shared by both (`MaterializeOccurrencesUpToAsync`).
  - One query reads the user's occurrences of the last 365 days; the window is a subset of it.
  - `days`: every day of the window, oldest first, zeros included, counts by status.
  - `habits`: every habit of the user in the order of `GET /api/habits` (also those with nothing in the
    window): counts, `completionRate` (0–1, 4 decimals; today's pending occurrence left out; `null` when
    nothing is left to count), `currentStreak` and `bestStreak` over the 365-day look-back (today pending
    does not break a run; a past pending or a "not done" does).
- `Domain/Habit/HabitStatistics.cs`: pure streak and rate helpers. DTOs in
  `Application/DTOs/Habit/ReadHabitStatsDTO.cs` (their XML docs are the spec).
- Tests: 11 unit (`Domain/HabitStatisticsTests.cs`) and 19 integration (`Integration/HabitStatsEndpointsTests.cs`:
  401, 400 cases, windows of 7/30/90, counts, rates, streaks, materialization, ownership, order).

Frontend (`frontend/`)

- Layout (`components/today/today-view.tsx`): on `lg` two equal columns, today's habits and tasks on the
  left, `HabitCalendar` (with its day panel) on the right, "Resumo" full width below. Below `lg` one column:
  calendar → lists → cards → charts. The calendar comes first in the DOM and is placed in the right column on
  `lg`. `max-w-3xl` removed.
- "Resumo" (`components/today/dashboards.tsx`, `stat-cards.tsx`, `daily-chart.tsx`, `habit-rates-chart.tsx`,
  helpers in `lib/dashboard.ts`):
  - Cards: "Progresso do dia" (habits + tasks of today), "Atrasadas" (link to `/tasks`), "Maior sequência"
    ("12 seguidas" + habit), "Conclusão em 30 dias" (from the `days` series, today's pending left out).
  - "Últimos 30 dias": stacked CSS bars (done / not done / pending, colors from `status-meta.ts`), `role="img"`
    with a summary, tooltips, and a "Ver os números" table.
  - "Por hábito": rate per habit (sorted, `—` when null) and current streak.
  - Loading, empty (no habits → "Criar hábito") and error ("Tentar novamente") states in every part.
- `lib/habits/stats.ts`: `useHabitStats(days, today, seed)`, key `["habits","stats",days,today]` (under the
  habits prefix, so habit changes refresh it; keyed by day so the new day's seed wins after midnight).
  `useSetOccurrenceStatus` now also invalidates the stats after the last mutation in flight.
- Server seed (`lib/today-server.ts`): tasks, the month grid and stats in parallel; the habits list is seeded
  by filtering the grid to today (one calendar call instead of two). A stats failure other than 401 does not
  break the page (the client fetches it and shows the error state); 401 still redirects to login.
- Midnight fix (`components/day-change-refresh.tsx`, rendered in `app/(app)/layout.tsx`): when the tab
  becomes visible, gets focus, or every 60 s while visible, it compares the server's day with
  `todayInBrasilia()` and calls `router.refresh()` once per new day. `HabitCalendar` gets `key={today}` on `/`
  and `/calendar`, so its month and selection follow the new day.
- `EmptyState` has an optional `action` slot; section error/skeleton moved to `components/today/section-states.tsx`.
- API types regenerated (`npm run api:types`).
- E2E: new `e2e/today.spec.ts` (calendar + lists + summary on desktop, calendar to the right; marking today's
  habit updates "Progresso do dia" and "Por hábito"; at 375 px the calendar comes first, no sideways scroll).
  `e2e/auth.spec.ts` scopes the empty-state texts to their regions.

Docs: D24 in the roadmap; this handoff.

## How to run and check

```bash
docker compose up -d db
dotnet run --project backend/MaiaFlow          # http://localhost:5011
cd frontend && npm run dev                     # http://localhost:3000

# Checks
dotnet test backend/MaiaFlow.Tests             # Docker must be running
cd frontend && npm run check && npm run build && npm run e2e
```

Results at the end of the phase: backend 164/164 (95.9 % of hand-written lines; `HabitService` and
`HabitStatistics` 100 %), `dotnet build -warnaserror` clean; frontend 485/485 (98.6 % lines, 92.8 % branches);
build clean; E2E 32/32.

Manual check done in the browser: Today with two daily habits and 14 days of history — the numbers match by
hand (100 % and 14 in a row for one habit, 64 % for the other, 82 % overall); layout at desktop width. The
frontend agent also checked 1366, 800 and 375 px in light and dark mode.

## Decisions made during the phase

| Decision | Reason |
|---|---|
| D24: `GET /api/habits/stats?days=N` (7–90, default 30): per-day counts and per-habit counts, rate and streaks (365-day look-back). Tasks are not included. | The dashboards need history; tasks have no completion date, so including them would need a migration. |
| Layout: 50/50 on desktop (lists left, calendar right, dashboards below); on phones calendar → lists → cards → charts. | Owner's choice from the mockup. |
| Charts are plain CSS/SVG, no chart library. | Two simple charts do not justify a dependency; works with the CSP as is. |
| Subagents worked in the same working tree on disjoint folders (backend / frontend), no worktrees. | Nothing may be committed before the owner approves. |

## Deviations from the plan

- The midnight fix from the phase 3/4 open issues was done here (owner agreed).
- The session hit the usage limit after the subagents finished and resumed for the review and checks.

## Open issues and follow-ups

- `DayChangeRefresh` refreshes once per new day; if that one refresh fails (offline when the tab wakes up), it
  does not retry until the next reload. Low impact.
- `/stats` and `/calendar` both materialize occurrences and run in parallel on the Today screen's first load;
  safe (unique index + `ON CONFLICT DO NOTHING`), only some duplicated work on the first request after a gap.
- A streak counts occurrences, not calendar days ("seguidas"), and only looks back 365 days.
- Task history is not in the dashboards (no completion date on tasks).
- Carried over from phase 4: shared rate-limit bucket without a proxy, HTTPS needed off localhost, the
  recurrence-change race, forms filling after hydration, current-password check, Docker hardening.
- The dev database has throwaway accounts created during the manual checks (e-mails ending in `.test`).

## Notes for the next phase

- The Today screen is `src/app/(app)/page.tsx` → `components/today/today-view.tsx`; the dashboards are
  self-contained in `components/today/dashboards.tsx` and reuse the same queries as the lists.
- Any query that depends on "today" should have the day in its key (see `statsKey`), or it keeps yesterday's
  cache after the midnight refresh.
