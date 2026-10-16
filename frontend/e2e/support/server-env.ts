import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

/** Repository root (this file is at frontend/e2e/support). */
export const REPO_ROOT = path.resolve(__dirname, "../../..");

export const E2E_DATABASE = "maiaflow_e2e";

/**
 * Npgsql connection string for the throwaway E2E database: `E2E_DB_CONNECTION`, or built from the
 * POSTGRES_USER / POSTGRES_PASSWORD of the root `.env`. The value is secret: never log it.
 */
export function resolveDbConnection(): string {
  const fromEnv = process.env.E2E_DB_CONNECTION?.trim();
  if (fromEnv) return fromEnv;

  const envFile = path.join(REPO_ROOT, ".env");
  if (existsSync(envFile)) {
    const values = parseEnv(readFileSync(envFile, "utf8"));
    const user = values.POSTGRES_USER;
    const password = values.POSTGRES_PASSWORD;
    if (user && password) {
      return `Host=localhost;Port=5432;Database=${E2E_DATABASE};Username=${user};Password=${password}`;
    }
  }

  throw new Error(
    "E2E database is not configured. Set E2E_DB_CONNECTION (an Npgsql connection string) or define " +
      "POSTGRES_USER and POSTGRES_PASSWORD in the .env file at the repository root.",
  );
}

/** A random signing key for this run only (the API requires at least 32 characters). */
export function randomJwtKey(): string {
  return randomBytes(48).toString("base64url");
}
