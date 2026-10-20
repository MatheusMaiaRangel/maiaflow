# Phase 6 handoff — Task history and metrics engine

## Summary

Tasks now record the day they were created and completed (D25), and every chart below the four Today cards is
produced by one metrics engine from a typed widget configuration (D26). The Today screen shows the default
dashboard in three sections — Tarefas, Hábitos and Tendências — so phase 7 only has to make those
configurations editable and store them. Chart library: Recharts (D27).

- Status: **done**, tested and approved by the owner and pushed to `main` on 2026-10-19.
- Pull request: none (work goes straight to `main`, D17).
- Finished on: 2026-10-19

## What changed

Backend (`backend/MaiaFlow`)

- `TaskItem` has `CreatedOn` and `CompletedOn` (`DateOnly?`, PostgreSQL `date`), migration
  `20261017134012_AddTaskHistoryDates` (two nullable columns, no backfill: existing tasks keep both empty).
- `TaskItem.Create(…, today)` sets `CreatedOn`. `MarkAsCompleted(today)` sets `CompletedOn` only when the task was
  not already completed (completing twice keeps the first day); `MarkAsPending`/`MarkAsNotCompleted` clear it.
  Editing a task never touches either day.
- `TaskService` takes `TimeProvider` (the Brasília clock already registered for habits, D15) for "today".
- `ReadTaskDTO` has `createdOn` / `completedOn` (`yyyy-MM-dd` or `null`; XML docs on the record are the spec).
  No `/api/tasks/stats` (D25).
- Tests: 3 new domain tests and 8 integration tests (`Integration/TaskHistoryEndpointsTests.cs`: create, the Brasília
  day at 23:30, complete, complete again, reopen to Pending and to NotCompleted, edit keeps days, legacy rows stay
  empty, a legacy task completed again after reopening gets a day).

Frontend (`frontend/`)

- API types regenerated (`npm run api:types`). `useSetTaskStatus` clears `completedOn` optimistically when a task
  leaves Completed and restores it on failure (the server fills it when completing).
- **Metrics engine** `src/lib/metrics/` (pure, no fetching):
  - `types.ts` — variables, groupings, periods, filter, query and result types.
  - `catalog.ts` — label, description (pt-BR, for the phase 7 builder), unit and kind of every variable.
  - Variables. Tasks: `created`, `completed`, `completedOnTime`, `completedLate`, `completedWithDueDate`,
    `completedWithoutDueDate` (all placed on their day), `openPending` (pending, due today or later), `openOverdue`
    (pending, due before today), `openWithoutDueDate` (pending, no due date). Habits: `scheduled`, `completed`,
    `notCompleted`, `pending`, `completionRate`, `currentStreak`.
  - Semantics worth knowing:
    - "open" task variables are a snapshot of now: with no grouping they ignore the period; with a time grouping
      they are placed on their due date (tasks without one are left out).
    - `completionRate` = done ÷ counted, where today's and future pending occurrences are not counted (same rule
      as D24); `null` when nothing is counted.
    - `currentStreak` = completed occurrences in a row ending today, today's pending does not break it; looks back
      365 days whatever the period (like D24). As a total it is the best habit's streak.
    - Ratio "A ÷ B in %" only between counts; `null` when B is 0; the counts travel in `parts` ("18 de 22").
  - Groupings: none, day, week (Sunday first, clipped to the period), weekday (Dom…Sáb), habit (by id, newest title).
  - Periods: last 7/30/90 days, **next** 7/30/90 days (needed by "Próximos 7 dias") or a custom range of at most
    366 days.
  - `queryErrors()` returns pt-BR messages for invalid queries; `computeMetrics()` throws on them.
- **Widget model** `src/lib/widgets/`:
  - `config.ts` — `DashboardConfig` (version 1) → sections → `WidgetConfig` (id, title, chart type, series with
    metric/label/color and an optional mark override, grouping, period, habit filter, `stacked`, `background`,
    layout `{x, y, w, h}` on a 4-column grid). `widgetErrors()` checks texts, colors, layout and chart/grouping/unit
    combinations (number = one ungrouped metric; heatmap = one metric by day; donut = several counts or one count by
    weekday/habit; one unit per bar/line/area chart; only counts stack).
  - `colors.ts` — palette names (blue, orange, aqua, yellow, magenta, green, violet, red + done/missed/pending) or
    `#rrggbb`; anything else never reaches a style. `globals.css` has the `--viz-*` variables for light and dark.
  - `data.ts` — `useDashboardSources` loads the task list and **one** calendar range covering every widget's habit
    days (split in 366-day pieces if needed; today that is one call for the last 365 days) under the calendar keys,
    so marking a habit updates the charts at once; `widgetState` gives loading / error (with retry) / ready per widget.
  - `default-dashboard.ts` — the default set (below).
- **Renderers** `src/components/widgets/`: bar/line/area (`cartesian-chart.tsx`, Recharts `ComposedChart`, a series
  can be drawn as a line over bars), donut (Recharts, total in the middle, legend with numbers), number (with
  "X de Y" for ratios), heatmap (CSS grid, week columns, 4 levels + "nothing planned"), list (best first, bar for
  percentages). Every chart is a `figure role="img"` with a text summary, has a legend when it has 2+ series, a hover
  tooltip, and "Ver os números" (a table). `widget-card.tsx` adds title, period, its own loading/error/empty states
  and the grid placement (4 columns from `lg`, 2 from `sm`, 1 on phones). Empty means: charts with only zeros or
  "—"; a list only when it has no rows (a new habit is listed with "—"); a number is never empty. A configuration
  that fails `widgetErrors()` shows why instead of breaking the page.
- **Today** (`components/today/dashboards.tsx`): "Resumo" = the four fixed cards (still from D24) + `DashboardView`
  with the default dashboard:
  - Tarefas: Concluídas por dia (bars of completed + line of created, 30 days), No prazo (on time ÷ completed with a
    due date, 30 days), Situação (donut: no prazo / atrasadas / sem prazo / concluídas em 30 dias), Próximos 7 dias
    (open tasks by due day).
  - Hábitos: Últimos 30 dias (stacked feitos / não feitos / pendentes, calendar colors), Por hábito (rate + current
    streak) — the phase 5 charts, now from configurations.
  - Tendências: Mapa de 90 dias (habit completion rate per day), Por dia da semana (habit completion rate, 90 days).
- Removed: `components/today/daily-chart.tsx`, `habit-rates-chart.tsx` and their helpers in `lib/dashboard.ts`.
- New dependency: `recharts@^3.10.1` (D27).
- E2E (`e2e/today.spec.ts`): the three sections and their widgets, empty states, marking a habit updates "Por
  hábito", "Últimos 30 dias" and the 90-day map, completing/reopening a task updates the task widgets, one column on
  a phone without sideways scroll.

Review: code review (approved; the two accessibility items — a numbers table under the donut, no Recharts
keyboard layer inside a `role="img"` — and the invalid-configuration guard were fixed) and security review (no
critical/high; widget rows are capped at 50 so a stored layout cannot build a huge grid; colors only reach styles as
palette variables or a validated hex; all user text is rendered as React text).

Docs: D27 in the roadmap, phase 6 marked "Done", this handoff.

## How to run and check

```bash
docker compose up -d db
dotnet run --project backend/MaiaFlow          # http://localhost:5011 (apply the migration first:
                                               #   cd backend/MaiaFlow && dotnet ef database update)
cd frontend && npm run dev                     # http://localhost:3000

# Checks
dotnet test backend/MaiaFlow.Tests             # Docker must be running
cd frontend && npm run check && npm run build && npm run e2e
```

Results at the end of the phase: backend 175/175, `dotnet build -warnaserror` clean; frontend `npm run check` green,
592/592 unit tests (98.4 % lines, 93.1 % branches; `lib/metrics` 99.5 %, `lib/widgets` 100 % lines,
`components/widgets` 95.6 %); build clean; E2E 33/33 (includes the CSP check).

Manual check in the browser (dev database, a throwaway account `fase6-demo@maiaflow.test` with three daily habits
over 95 days and 40 tasks whose days were back-dated by SQL): every widget renders with data at 1440 px and 375 px,
light and dark mode, no console errors.

## Decisions made during the phase

| Decision | Reason |
|---|---|
| D27: Recharts 3 for bar/line/area/donut, plain HTML/CSS for heatmap/list/number; colors as `--viz-*` CSS variables with light and dark steps, or a hex color. | Works under the nonce CSP; colors follow the theme. |
| Periods also have "next N days". | "Próximos 7 dias" looks forward; the roadmap only listed past presets and custom ranges. |
| Extra task variable `completedWithDueDate`. | "No prazo" needs on time ÷ completed *with* a due date; dividing by all completed tasks would count tasks without a due date as late. |
| "Open" task variables are a snapshot: no grouping ignores the period, time groupings use the due date. | An overdue task from two months ago is still overdue today. |
| The current streak looks back 365 days whatever the widget's period; the dashboard loads the last 365 days of occurrences once. | Matches D24 and the "Maior sequência" card; one request feeds every habit widget. |
| A dashboard has sections (Tarefas, Hábitos, Tendências), each a 4-column grid; widgets have `{x, y, w, h}`. | Matches the mockup; phase 7 can move widgets inside a section and add sections. |
| Weeks start on Sunday. | Same as the calendar. |

## Deviations from the plan

- The approved mockup was not available to this session; the layout follows the roadmap's list of widgets
  (Tarefas: 2×2 chart, two small cards, a tall donut; Hábitos and Tendências: two halves). Adjust if the mockup
  differs.

## Open issues and follow-ups

- Tasks completed before the migration have no `completedOn` and do not appear in completion charts (by design,
  D25); tasks created before it have no `createdOn`. Completing such a task again does not give it a day (it is
  already Completed); reopening and completing it does.
- The optimistic task update does not know the completion day; the task charts catch up when the list refetches
  (right after the request).
- `/api/habits/calendar` is now also called for the last 365 days on every Today load (plus the month grid and the
  stats endpoint). Fine for a few habits; a heavy user (many daily habits) would get a large payload.
- Carried over from phase 5: `DayChangeRefresh` does not retry a failed refresh; streaks count occurrences, not days.
- Carried over from phase 4: shared rate-limit bucket without a proxy, HTTPS needed off localhost, the
  recurrence-change race, forms filling after hydration, current-password check, Docker hardening.
- The dev database has the throwaway account `fase6-demo@maiaflow.test` with back-dated history (re-created on
  2026-10-19; its password is not kept anywhere, delete and re-create it when needed) and older `.test` accounts.

- Review leftovers (accepted for now): widgets are recomputed on every render of the dashboard (cheap with 9
  widgets; memoize when the builder allows many); line/area charts leave gaps where a rate has nothing to measure.

## Notes for the next phase

- Phase 7 edits `DashboardConfig` (`src/lib/widgets/config.ts`); validate with `widgetErrors()` on the client and
  mirror the same rules on the server (known variables/groupings/charts, hex colors, sizes, ownership).
- `VARIABLE_INFO` and `GROUPING_LABELS` (`src/lib/metrics/catalog.ts`) have the pt-BR texts the builder needs.
- Tailwind 4 drops CSS custom properties whose names never appear literally in the sources: keep the `--viz-*`
  names written out (see `PALETTE_CSS` in `colors.ts`); building `--viz-${name}` at run time breaks the colors.
- A query that depends on "today" must have the day in its key (the calendar keys carry the dates already).
