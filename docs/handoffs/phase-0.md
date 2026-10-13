# Phase 0 handoff — Environment and foundation

## Summary

The backend builds and runs against a real PostgreSQL, the repository is clean, secrets are out of
git, and new sessions start ready to work. The API was smoke-tested end to end (sign-up, login,
create and list tasks, 401 without token, Swagger and the OpenAPI JSON served).

- Pull request: _not opened yet (waiting for the owner's go-ahead)_
- Branch: `chore/phase-0-foundation` (based on `docs/roadmap`, which carries the roadmap commit
  that is not in `main` yet)
- Finished on: 2026-10-13

## What changed

Repo / tooling
- Root [`.gitignore`](../../.gitignore) (dotnet, Node/Next, IDE, `.env`); `.idea/` is no longer
  tracked. `Migrations/` is no longer ignored.
- [`docker-compose.yml`](../../docker-compose.yml) with a local PostgreSQL 16 (`db` service,
  bound to `127.0.0.1:5432`, password required from `.env`); [`.env.example`](../../.env.example).
- [`dotnet-tools.json`](../../dotnet-tools.json) pins `dotnet-ef` 10.0.5 (`dotnet tool restore`).
- [`README.md`](../../README.md): prerequisites, how to run, migrations.
- SessionStart hook ([`.claude/settings.json`](../../.claude/settings.json),
  [`.claude/hooks/session-start.sh`](../../.claude/hooks/session-start.sh)): in remote sessions it
  installs the .NET 10 SDK when missing; always runs `dotnet tool restore`, `dotnet restore`, and
  `npm install` if `frontend/package.json` exists.

Backend
- `appsettings.json` no longer has the connection string or `Jwt:Key`. They come from
  user-secrets or env vars (`ConnectionStrings__DefaultConnection`, `Jwt__Key`);
  [`appsettings.Development.example.json`](../../backend/MaiaFlow/appsettings.Development.example.json)
  shows the shape. `UserSecretsId` added to the csproj.
- [`Program.cs`](../../backend/MaiaFlow/Program.cs): fails fast with a clear message when the
  connection string, `Jwt:Key`, issuer or audience are missing, or the key is shorter than 32
  characters.
- Migrations are versioned (6 files + snapshot). They apply cleanly on an empty database and
  `dotnet ef migrations has-pending-model-changes` reports no drift.
- `MaiaFlow.http` now points to `/swagger/v1/swagger.json`.

## How to run and check

```bash
cp .env.example .env   # set POSTGRES_PASSWORD
docker compose up -d db
cd backend/MaiaFlow
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=maiaflow;Username=maiaflow;Password=<POSTGRES_PASSWORD>"
dotnet user-secrets set "Jwt:Key" "$(openssl rand -base64 48)"
cd ../..
dotnet tool restore
dotnet ef database update --project backend/MaiaFlow
dotnet build backend/MaiaFlow
dotnet run --project backend/MaiaFlow   # http://localhost:5011/swagger
```

There is no test project yet (Phase 1).

## Decisions made during the phase

| Decision | Reason |
|---|---|
| D8: EF Core migrations are versioned in git; the existing six were kept as they are (no squash). | They apply cleanly on a fresh database and match the model snapshot, and rewriting them would break any database that already has the old history. |
| D9: Local database runs through `docker-compose.yml` (service `db`); Phase 4 extends the same file. | One way to get a database in every environment, no host PostgreSQL install. |

(Add D8 and D9 to the Decisions table in `docs/ROADMAP.md` when the owner confirms.)

## Deviations from the plan

- "Install the .NET 10 SDK in the container" was skipped: this session runs on the owner's
  machine, where SDK 10.0.112 is already installed. The SessionStart hook covers remote sessions
  and was run locally (SDK-present path only); the install path was not exercised.
- Database name/user changed from `MaiaFlow_db`/`maiatron` to `maiaflow`/`maiaflow` in the new
  local setup. The old `MaiaFlow_Postgres` Docker container and its volume were left untouched.

## Open issues and follow-ups

- **Rotate the secrets (owner action).** The old DB password and `Jwt:Key` are still in git
  history (D7). Change the password wherever it was used and never reuse that JWT key.
- `dotnet build` warns `NU1903`: `Microsoft.OpenApi` 2.4.1 (transitive, via Swashbuckle) has a
  known high-severity advisory. Check for a Swashbuckle update in Phase 1, before the OpenAPI
  document becomes the frontend contract.
- `Microsoft.AspNetCore.OpenApi` is referenced but unused (Swashbuckle serves the document).
  Decide in Phase 1 which one stays.
- The `docs/roadmap` branch (roadmap commit) is not merged into `main`; this PR will carry it.
- `MaiaFlow-Documentacao.md` (backend documentation, in Portuguese) is untracked in the repo
  root; the owner has not said whether to commit it or where it should live.
- Still open from the initial review (Phase 1): enums as numbers (task `status` returns `0`),
  `/api` prefix, `ProblemDetails`, CORS, `/users/me`, and the rest of the list in the roadmap.

## Notes for the next phase

- Phase 1 is Step 1 first (domain exceptions, global handler, JSON string enums, CORS, status
  codes, `/api` prefix) because everything else depends on `Program.cs`.
- `dotnet run` applies `launchSettings.json` (Development + user-secrets). To test a different
  environment use `--no-launch-profile`.
- Integration tests in Phase 1 need a PostgreSQL: reuse `docker compose up -d db` with a separate
  database name, or Testcontainers.
- Start Phase 1 from an up-to-date `main` once this PR is merged.
