# MaiaFlow

Task and habit tracker for people in Brazil. You keep a to-do list with due dates, create habits with
flexible recurrences (daily, weekly, monthly, yearly, every N days, specific weekdays) and mark each day
on a calendar. The **Hoje** (today) screen shows what is due today.

- **API:** ASP.NET Core (.NET 10) + PostgreSQL 16 + EF Core, in [`backend/MaiaFlow`](backend/MaiaFlow).
- **Web:** Next.js 16 (App Router, TypeScript) + Tailwind CSS + shadcn/ui, in [`frontend/`](frontend).
  The browser only talks to the web app, which forwards calls to the API (backend-for-frontend); the
  API's JWT lives in an `httpOnly` cookie and never reaches client-side JavaScript.
- "Today" is always the calendar day in Brasília (`America/Sao_Paulo`), on the server and in the browser.

Work is organized in phases: see [`docs/ROADMAP.md`](docs/ROADMAP.md) (phases, status and settled
decisions) and the handoffs in [`docs/handoffs/`](docs/handoffs/).

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with Compose v2: database, full stack, and the backend
  integration tests (Testcontainers).
- For local development without containers: [.NET 10 SDK](https://dotnet.microsoft.com/download) and
  [Node.js 24](https://nodejs.org/) (npm included).

## Run everything with Docker Compose

```bash
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD and JWT_KEY (generate it with: openssl rand -base64 48)
docker compose up -d --build
```

Open <http://localhost:3000>. The API applies database migrations on startup; only the web app is
published on the host (on `127.0.0.1` by default). `docker compose down` stops everything; add `-v` to
also delete the database volume.

Variables in `.env` (all documented in [`.env.example`](.env.example)):

| Variable                                            | What it is                                                                                                             |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Database credentials, also used by the API.                                                                            |
| `JWT_KEY`                                           | Signing key for the API's tokens (32+ characters). The API refuses to start with the placeholder.                      |
| `WEB_PORT`, `WEB_BIND`                              | Host port and interface of the web app (default `127.0.0.1:3000`).                                                     |
| `APP_ORIGIN`                                        | Public URL of the web app, only when it is not reached at `http://localhost:<WEB_PORT>` (e.g. behind a reverse proxy). |
| `FORWARD_CLIENT_IP`                                 | `true` only behind a reverse proxy that overwrites `X-Forwarded-For`, so login rate limits are per visitor.            |
| `TRUSTED_PROXY_NETWORKS`                            | Networks whose `X-Forwarded-*` headers the API trusts (default: Docker bridges).                                       |

The session cookie is `Secure` in production. Browsers accept it on `http://localhost`, but any other
host needs HTTPS: put a TLS reverse proxy in front of the web container and set `APP_ORIGIN`.

To reach the API from the host (debugging), add the override file:
`docker compose -f docker-compose.yml -f docker-compose.expose-api.yml up -d` (port `API_PORT`,
default 5012).

## Local development

### 1. Database

```bash
cp .env.example .env            # set POSTGRES_PASSWORD (JWT_KEY is only for the full stack)
docker compose up -d db         # PostgreSQL on 127.0.0.1:5432
```

### 2. API (http://localhost:5011)

Secrets live outside the repository, in user-secrets (or environment variables, which win):

```bash
cd backend/MaiaFlow
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=maiaflow;Username=maiaflow;Password=<POSTGRES_PASSWORD>"
dotnet user-secrets set "Jwt:Key" "$(openssl rand -base64 48)"
cd ../..
dotnet tool restore
dotnet ef database update --project backend/MaiaFlow
dotnet run --project backend/MaiaFlow
```

Swagger UI: <http://localhost:5011/swagger> (Development only). The API refuses to start without a
connection string or with a JWT key shorter than 32 characters.
[`appsettings.Development.example.json`](backend/MaiaFlow/appsettings.Development.example.json) shows
the expected shape.

### 3. Web app (http://localhost:3000)

```bash
cd frontend
cp .env.example .env.local      # API_URL, default http://localhost:5011
npm install
npm run dev
```

### Migrations

EF Core migrations are versioned in `backend/MaiaFlow/Migrations`.

```bash
dotnet ef migrations add <Name> --project backend/MaiaFlow   # after changing the model
dotnet ef database update --project backend/MaiaFlow
```

After changing the API contract, regenerate the frontend types with the API running:
`cd frontend && npm run api:types`.

## Tests

| What                               | Command                              | Notes                                                                                                       |
| ---------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Backend unit + integration         | `dotnet test backend/MaiaFlow.Tests` | Needs Docker: Testcontainers starts its own PostgreSQL. Add `--collect:"XPlat Code Coverage"` for coverage. |
| Frontend lint, types, format, unit | `cd frontend && npm run check`       | Vitest + Testing Library. `npx vitest run --coverage` for coverage.                                         |
| Frontend production build          | `cd frontend && npm run build`       |                                                                                                             |
| End to end                         | `cd frontend && npm run e2e`         | Playwright with the real API and PostgreSQL. See below.                                                     |

### End-to-end tests

`npm run e2e` builds and starts its own API (port 5111) and web app (port 3100), so it never touches
your dev servers. It uses the database `maiaflow_e2e` on the local PostgreSQL (credentials from the
root `.env`; the API creates it on first run). Every test signs up its own account and deletes it at the
end. First time only: `npx playwright install chromium`.

- `npm run e2e:headed` / `npm run e2e:ui` to watch the browser, `npm run e2e:report` for the last report.
- `E2E_DB_CONNECTION="Host=...;Database=...;Username=...;Password=..."` to use another database.
- `E2E_BASE_URL=http://localhost:3000 npm run e2e` to test a running deployment (e.g. Docker Compose)
  without starting servers.

### Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push to `main` and on pull requests:
backend build and tests with coverage, frontend lint/typecheck/format/tests/build, the E2E suite, and a
Docker Compose build and smoke test.

## Project structure

```text
backend/
  MaiaFlow/                 ASP.NET Core API
    Controllers/            HTTP endpoints, all under /api
    Application/            DTOs and service interfaces
    Domain/                 entities, recurrence rules, domain exceptions
    Infrastructure/         EF Core, repositories, services, error handling, rate limiting
    Migrations/             EF Core migrations
  MaiaFlow.Tests/           xUnit: domain tests + integration tests (Testcontainers)
frontend/
  src/app/(auth)/           login and sign-up (Server Actions)
  src/app/(app)/            signed-in area: Hoje, tarefas, hábitos, calendário, perfil
  src/app/api/[...path]/    BFF: forwards same-origin /api/* calls with the JWT from the cookie
  src/proxy.ts              optimistic auth redirect + Content-Security-Policy
  src/components/           UI by feature (shadcn/ui primitives in components/ui)
  src/lib/                  API client, auth, dates, validation, hooks
  e2e/                      Playwright suite
docs/                       roadmap and phase handoffs
docker-compose.yml          db, api and web services
```

More on the web app in [`frontend/README.md`](frontend/README.md). The API contract is in Swagger and in
[`docs/handoffs/phase-1.md`](docs/handoffs/phase-1.md). All routes live under `/api`; errors are
`application/problem+json` (RFC 9457).
