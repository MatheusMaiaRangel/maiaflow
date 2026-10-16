/**
 * Playwright end-to-end suite: a real browser against the real web app, the real API and PostgreSQL.
 *
 *   npm run e2e           run the suite headless (also: e2e:headed, e2e:ui, e2e:report)
 *
 * Default mode starts its own servers on dedicated ports, so it never touches a running dev setup:
 *   - API  http://127.0.0.1:5111  built in Release, Production environment, migrates the database on
 *                                 startup, rate limits raised, random JWT key per run
 *   - Web  http://localhost:3100  `next build` (only when src/ changed since the last build) + `next start`,
 *                                 pointed at that API
 *
 * Environment variables:
 *   E2E_BASE_URL       run against an already running deployment (docker compose, CI smoke run) and
 *                      start no servers. The tests only talk to the web app, never to the API directly.
 *   E2E_DB_CONNECTION  Npgsql connection string of the throwaway database. Default: database
 *                      `maiaflow_e2e` on localhost:5432 with POSTGRES_USER / POSTGRES_PASSWORD from the
 *                      root .env file. Never use a database you care about: tests create and delete accounts.
 *   CI                 retries 1, 2 workers, html + github reporters, `test.only` forbidden.
 *
 * Every test creates its own account (e-mail e2e-<random>@example.test) and deletes it afterwards, which
 * removes all its data, so tests are independent and run in parallel.
 */
import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { randomJwtKey, resolveDbConnection } from "./e2e/support/server-env";

const API_PORT = 5111;
const WEB_PORT = 3100;
const API_URL = `http://127.0.0.1:${API_PORT}`;
const WEB_URL = `http://localhost:${WEB_PORT}`;
const SERVER_START_TIMEOUT_MS = 240_000;
const API_PROJECT_DIR = "../backend/MaiaFlow";
const API_OUTPUT_DIR = `${API_PROJECT_DIR}/bin/Release/net10.0`;

const isCI = Boolean(process.env.CI);
const externalBaseUrl = process.env.E2E_BASE_URL?.trim();

const SOURCES_THAT_AFFECT_THE_BUILD = ["src", "public", "package.json", "next.config.ts"];

function newestModification(entry: string): number {
  if (!existsSync(entry)) return 0;
  const stats = statSync(entry);
  if (!stats.isDirectory()) return stats.mtimeMs;
  return readdirSync(entry)
    .filter((name) => !/\.test\.tsx?$/.test(name) && name !== "test")
    .reduce((newest, name) => Math.max(newest, newestModification(path.join(entry, name))), 0);
}

/** True when there is no production build or a source file is newer than it. */
function webBuildIsStale(): boolean {
  if (process.env.E2E_REBUILD === "1") return true;
  const builtAt = existsSync(".next/BUILD_ID") ? statSync(".next/BUILD_ID").mtimeMs : 0;
  return SOURCES_THAT_AFFECT_THE_BUILD.some((entry) => newestModification(entry) > builtAt);
}

type WebServers = Extract<NonNullable<PlaywrightTestConfig["webServer"]>, unknown[]>;

function localServers(): WebServers {
  const buildApi = `dotnet build ${API_PROJECT_DIR} -c Release --nologo -v q`;
  const runApi = `cd ${API_OUTPUT_DIR} && dotnet MaiaFlow.dll`;
  const startWeb = `npx next start -p ${WEB_PORT}`;
  return [
    {
      name: "api",
      command: `${buildApi} && ${runApi}`,
      // Any answer below 500 (the API replies 401 here) means it is up.
      url: `${API_URL}/api/tasks`,
      timeout: SERVER_START_TIMEOUT_MS,
      reuseExistingServer: !isCI,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ASPNETCORE_ENVIRONMENT: "Production",
        ASPNETCORE_URLS: API_URL,
        ConnectionStrings__DefaultConnection: resolveDbConnection(),
        Jwt__Key: randomJwtKey(),
        Database__MigrateOnStartup: "true",
        RateLimiting__Login__PermitLimit: "100000",
        RateLimiting__SignUp__PermitLimit: "100000",
        RateLimiting__LoginPerAccount__PermitLimit: "100000",
        RateLimiting__User__PermitLimit: "100000",
        AllowedHosts: "localhost;127.0.0.1",
        // Keep the piped output readable: only warnings and errors (no SQL per request).
        Logging__LogLevel__Default: "Warning",
      },
    },
    {
      name: "web",
      command: webBuildIsStale() ? `npx next build && ${startWeb}` : startWeb,
      url: WEB_URL,
      timeout: SERVER_START_TIMEOUT_MS,
      reuseExistingServer: !isCI,
      stdout: "pipe",
      stderr: "pipe",
      env: { API_URL },
    },
  ];
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [["html", { open: "never" }], ["github"]] : "list",
  outputDir: "test-results",
  expect: { timeout: 10_000 },
  use: {
    baseURL: externalBaseUrl || WEB_URL,
    locale: "pt-BR",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: externalBaseUrl ? undefined : localServers(),
});
