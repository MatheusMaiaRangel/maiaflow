# MaiaFlow

Task and habit tracker. ASP.NET Core (.NET 10) + PostgreSQL API in `backend/MaiaFlow`, Next.js web
app in `frontend/` (not built yet — see the roadmap).

Work is organized in phases: [`docs/ROADMAP.md`](docs/ROADMAP.md). Handoffs between phases live in
[`docs/handoffs/`](docs/handoffs/).

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- Docker (for the local PostgreSQL), or any PostgreSQL 16 instance
- Node.js (only once the frontend exists)

## Run the API locally

```bash
# 1. Database credentials (the .env file is git-ignored)
cp .env.example .env            # then edit POSTGRES_PASSWORD
docker compose up -d db

# 2. API secrets, stored outside the repository with user-secrets
cd backend/MaiaFlow
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=maiaflow;Username=maiaflow;Password=<POSTGRES_PASSWORD>"
dotnet user-secrets set "Jwt:Key" "$(openssl rand -base64 48)"   # at least 32 characters

# 3. Create the schema and start the API
cd ../..
dotnet tool restore
dotnet ef database update --project backend/MaiaFlow
dotnet run --project backend/MaiaFlow
```

Swagger UI: <http://localhost:5011/swagger> (Development only). Quick check: `POST /users` →
`POST /auth/login` → paste the token in **Authorize** → try `/tasks` and `/habits`.

Environment variables work too and override user-secrets: `ConnectionStrings__DefaultConnection`
and `Jwt__Key`. `backend/MaiaFlow/appsettings.Development.example.json` shows the expected shape.
The API refuses to start if either is missing.

## Migrations

EF Core migrations are versioned in `backend/MaiaFlow/Migrations`.

```bash
dotnet ef migrations add <Name> --project backend/MaiaFlow   # after changing the model
dotnet ef database update --project backend/MaiaFlow
```

## Build and test

```bash
dotnet build backend/MaiaFlow
dotnet test backend/MaiaFlow.Tests
```

The integration tests start their own PostgreSQL with Testcontainers, so Docker must be running;
they do not touch your development database. Add `--collect:"XPlat Code Coverage"` for coverage.

## API

All routes live under `/api`. Errors are `application/problem+json` (RFC 9457). The full contract
is in Swagger (`/swagger`) and in [`docs/handoffs/phase-1.md`](docs/handoffs/phase-1.md).
Browser clients on another origin must be listed in `Cors:AllowedOrigins` (Development allows
`http://localhost:3000`).
