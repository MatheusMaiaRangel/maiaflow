# Phase 7 handoff — Dashboard builder

## Summary

Each user now builds their own dashboard below the four fixed Today cards (D26). "Editar painel" turns the
read-only dashboard into an editor: widgets are created and edited with a guided builder (metric, optional
"A ÷ B em %", habit filter, grouping, period, chart type, colors, section and size) with a live preview from
the user's own data, moved and resized on a 4-column grid on wide screens (mouse or keyboard), reordered in
one column on phones, and deleted; sections can be added, renamed and removed when empty. "Restaurar padrão"
brings back the phase 6 set. The whole dashboard is stored by the API, so it follows the user to any device
(D28–D30).

- Status: **done**, tested and approved by the owner and pushed to `main` on 2026-10-20.
- Pull request: none (work goes straight to `main`, D17).
- Finished on: 2026-10-20

## What changed

Contract shared by both sides

- [`contracts/dashboard-validation-cases.json`](../../contracts/dashboard-validation-cases.json): 112 whole
  configurations (40 valid, 72 invalid). The front-end tests (`src/lib/widgets/contract.test.ts`) and the API
  tests (`DashboardValidatorTests`, `DashboardContractCasesTests`) must give the same answer for every case;
  the "default dashboard" case must equal `DEFAULT_DASHBOARD`. Add a case here whenever a rule changes.

Backend (`backend/MaiaFlow`)

- Table `dashboards` (migration `20261020014513_AddDashboards`): `user_id` (primary key, FK to users with
  cascade), `config jsonb` (null = use the front-end default), `revision int`, `updated_at`.
- `DashboardController` — `GET/PUT/DELETE /api/dashboard`, owner from the JWT only:
  - `GET` → `{ revision, config }`; `{ revision: 0, config: null }` when never saved.
  - `PUT { revision, config }` → the stored dashboard with `revision + 1`; **409** when `revision` is not the
    stored one (another device saved first). The check is atomic (`INSERT … ON CONFLICT DO NOTHING` for the
    first save, `UPDATE … WHERE revision = expected` afterwards); a concurrent loser gets 409, never 500.
  - `DELETE` ("Restaurar padrão") stores `config: null` and bumps the revision, so stale devices get 409;
    without a saved row it does nothing (204).
- `DashboardValidator` mirrors `widgetErrors()`/`queryErrors()`/`periodError()` plus the dashboard rules:
  version 1, at most 8 sections and 30 widgets (it stops there instead of checking every widget of a huge
  body), ids `^[a-z0-9-]{1,40}$` and unique, section titles 1–40, no overlapping widgets in a section, no
  control characters in titles and labels. Titles are measured like JavaScript's `trim()`. A refused
  dashboard lists at most 20 problems (pt-BR, with section and widget names).
- The stored JSON is the re-serialized typed DTO, never the request body (unknown fields are dropped; fields
  that do not apply to a period or filter kind are cleared). Numbers written as strings do not bind.
- `ApiExceptionHandler` also maps a foreign-key failure from raw SQL to 401 (token of a deleted user);
  `ContractSchemaFilter` marks nullable DTO references.
- Tests: validator unit tests, every shared case through the validator and through a real `PUT`, and
  `DashboardEndpointsTests` (401, empty GET, round trip, revisions, 409 on stale/zero revision, reset,
  ownership, cascade on user delete, 413 over 64 KB on a real Kestrel, 8 concurrent PUTs → one 200).

Frontend (`frontend/`)

- API types regenerated (`npm run api:types`). The BFF route now forwards `PUT` (same origin check as the
  other state-changing methods). The Today seed reads the dashboard on the server (no flash of the default).
- `src/lib/widgets/`:
  - `config.ts` — `dashboardErrors()` (whole dashboard, same rules as the API), `isConfigId`, `overlaps`,
    limits `MAX_SECTIONS`/`MAX_WIDGETS`/`MAX_SECTION_TITLE_LENGTH`, control-character rule.
  - `parse.ts` — reads untrusted JSON into a `DashboardConfig` (shape only; `null` optional fields become
    absent, unknown properties are dropped). `stored.ts` — `toDashboard()`: a stored config that fails the
    rules falls back to the default (plain module, also used by the server seed).
  - `layout.ts` — moves, resizes, compacts and re-packs sections with react-grid-layout's own collision and
    vertical compaction code, so a keyboard move ends where the same drag would.
  - `edit.ts` — save/delete widget, add/rename/delete section, `newWidget`, `withChart` (switching the chart
    nudges grouping and series towards something it can draw), ids.
  - `labels.ts` (editor texts and options, reusing `VARIABLE_INFO` and `GROUPING_LABELS`), `contrast.ts`
    (WCAG ratio of a hex series color against the card in both themes, warning under 3:1).
  - `storage.ts` — `useDashboard`, `useSaveDashboard`, `useResetDashboard`: optimistic, run one after the
    other (mutation `scope`), each save sends the revision the previous one returned; after a failure the
    saves queued behind it are dropped and the server version comes back (toast; 409 says another device
    saved first); the query does not refetch while a save is in flight.
- `src/components/dashboard/`:
  - `dashboard-board.tsx` — read-only view or edit mode (toolbar: Adicionar gráfico, Adicionar seção,
    Restaurar padrão, Concluir), section rename/delete, confirmations, one `aria-live` region.
  - `section-grid.tsx` (≥ 1024 px) — `react-grid-layout` 2, drag by the handle, resize by the corner; each card
    is focusable: Enter picks it up, arrows move, Shift + arrows resize, Enter drops (saves), Esc or leaving
    the card cancels. A refused drop puts the grid back.
  - `section-list.tsx` (< 1024 px) — compact rows, drag handle or Subir/Descer buttons (`aria-disabled` at
    the ends so focus is not lost).
  - `widget-editor.tsx`, `series-fields.tsx`, `color-field.tsx`, `select-field.tsx` — the guided builder
    dialog with a sticky live preview and the `widgetErrors()` messages.
- `widget-card.tsx` takes `actions`, `leading` and a fixed `chartHeight` (editor grid and preview).
- `globals.css` — the grid styles written with the app's tokens (placeholder follows the theme, no motion
  with `prefers-reduced-motion`); the package stylesheet is not imported.
- `src/test/media.ts` — `matchMedia` stand-in for jsdom (`setMediaMatches(true)` for wide screens).
- New dependency: `react-grid-layout@^2.3.0` (`npm audit --omit=dev`: 0 vulnerabilities).
- E2E `e2e/dashboard.spec.ts`: build a widget with the editor and find it in a second browser signed in as
  the same user; keyboard move and resize kept after reload; drag by the handle; delete and restore the
  default (both kept after reload); add, rename and remove a section; phone reorder without sideways scroll.
  Every test also fails on a CSP violation.

Docs: D28–D30 in the roadmap, phase 7 "In review", this handoff.

## How to run and check

```bash
docker compose up -d db
cd backend/MaiaFlow && dotnet ef database update   # applies AddDashboards
dotnet run --project backend/MaiaFlow              # http://localhost:5011
cd frontend && npm run dev                         # http://localhost:3000

# Checks
dotnet test backend/MaiaFlow.Tests                 # Docker must be running
cd frontend && npm run check && npm run build && npm run e2e
```

Results at the end of the phase: backend 458/458, `dotnet build -warnaserror` clean; frontend `npm run check`
green, 805/805 unit tests (97.2 % statements, 98.1 % lines overall; `lib/widgets` 99.7 % lines,
`components/dashboard` 95 % lines); build clean; E2E 39/39 (33 + 6 new, includes the CSP check).

Manual check in the browser (dev database, throwaway account `fase7-demo@maiaflow.test`): edit grid at
1440 px in dark and light mode, keyboard move saved and kept, editor dialog, phone list at 375 px without
sideways scroll and reorder saved.

## Decisions made during the phase

| Decision | Reason |
|---|---|
| D28: one row per user with the whole `DashboardConfig`, `GET/PUT/DELETE /api/dashboard`, revision with 409, same rules on both sides tested by shared cases. | One atomic save keeps a moved layout whole; the revision stops one device from silently overwriting another. |
| D29: `react-grid-layout` 2 with our own keyboard alternative. | Same `{x, y, w, h}` model with collisions, resize and touch; only `style` attributes, allowed by the CSP. |
| D30: one layout; phones reorder (re-pack); sections added/renamed/deleted when empty; saves on drop and on "Salvar". | One source of truth for every screen size. |
| Widgets float up (vertical compaction) and never move sideways on their own. | It is how the grid library works, and a stored section then has no holes or overlaps. |
| Control characters are refused in titles and labels (both sides). | PostgreSQL's `jsonb` cannot store U+0000 (it was a 500); nobody types them on purpose. |
| No contrast warning for the card background. | The tint is 14 % of the color; the text stays readable with any color. |
| Below 1024 px the editor is the reorder list (tablets included). | The read-only view only has the 4-column grid from `lg`. |

## Deviations from the plan

- None in scope. The proposal said "DELETE bumps the revision"; with nothing saved yet it simply does nothing.

## Open issues and follow-ups

- If the dashboard changes on another device while the editor dialog is open, saving uses the layout from
  when the dialog opened; the result is checked, so at worst the save is refused with a toast.
- Moving a widget to the right with the keyboard leaves the columns on its left empty (vertical compaction
  never moves widgets sideways); the user moves the others in.
- Closing the editor (Esc or a click outside) drops the draft without asking.
- Invisible or bidi characters (U+200B, U+202E) are accepted in titles; they only affect the user's own
  screen (rendered as text).
- Every PUT rewrites a jsonb row of up to 64 KB under the normal per-user limit (300/min); a lower limit for
  this route is possible if it ever matters.
- Carried over: see the phase 6 handoff (no backfill of task dates, the 365-day calendar call, …).
- The dev database has the throwaway account `fase7-demo@maiaflow.test` (two daily habits, three tasks; its
  password is not kept, delete or re-create it when needed) and older `.test` accounts.

## Notes for the next phase

- A rule change in the dashboard needs three places: `src/lib/widgets/config.ts` (or `parse.ts`),
  `DashboardValidator.cs` and a case in `contracts/dashboard-validation-cases.json`.
- Under coverage in parallel the editor and board tests can take several seconds each; their suites use a
  20 s timeout.
- jsdom has no `matchMedia`; the test setup installs `src/test/media.ts`.
- Tailwind 4 drops custom properties whose names never appear literally: keep the `--viz-*` names written
  out (see `PALETTE_CSS` in `colors.ts`).
