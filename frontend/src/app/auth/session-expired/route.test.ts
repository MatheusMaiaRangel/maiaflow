// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /auth/session-expired", () => {
  it("clears the session cookie and redirects to the login page with a notice", () => {
    const response = GET(new NextRequest("http://localhost:3000/auth/session-expired"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?reason=expired");
    expect(response.headers.get("set-cookie")).toContain("maiaflow_token=;");
  });
});
