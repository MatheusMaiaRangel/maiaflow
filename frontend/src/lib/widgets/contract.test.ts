import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { dashboardErrors } from "./config";
import { DEFAULT_DASHBOARD } from "./default-dashboard";
import { parseDashboardConfig } from "./parse";

type Case = { name: string; valid: boolean; config: unknown };

/** Shared with the API's tests (D28): both validators must give the same answer for every case. */
const { cases } = JSON.parse(
  readFileSync(
    path.resolve(import.meta.dirname, "../../../../contracts/dashboard-validation-cases.json"),
    "utf8",
  ),
) as { cases: Case[] };

function isAccepted(config: unknown): boolean {
  const parsed = parseDashboardConfig(config);
  return parsed !== null && dashboardErrors(parsed).length === 0;
}

describe("shared dashboard validation cases", () => {
  it.each(cases.map((testCase) => [testCase.name, testCase] as const))("%s", (_, testCase) => {
    expect(isAccepted(testCase.config)).toBe(testCase.valid);
  });

  it("include the default dashboard as it is today", () => {
    expect(cases.find(({ name }) => name === "default dashboard")?.config).toEqual(
      DEFAULT_DASHBOARD,
    );
  });
});
