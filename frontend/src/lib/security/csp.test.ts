// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, generateNonce } from "./csp";

describe("generateNonce", () => {
  it("is different on every call and valid base64", () => {
    const first = generateNonce();
    const second = generateNonce();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(first.length).toBeGreaterThanOrEqual(32);
  });
});

describe("buildContentSecurityPolicy", () => {
  const directive = (policy: string, name: string) =>
    policy.split("; ").find((part) => part.startsWith(`${name} `));

  it("only runs scripts that carry the nonce and never allows inline or eval in production", () => {
    const policy = buildContentSecurityPolicy("abc123", false);

    expect(directive(policy, "script-src")).toBe(
      "script-src 'self' 'nonce-abc123' 'strict-dynamic'",
    );
  });

  it("allows eval in development only", () => {
    expect(buildContentSecurityPolicy("n", true)).toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy("n", false)).not.toContain("'unsafe-eval'");
  });

  it("locks down framing, plugins, base URL and form targets", () => {
    const policy = buildContentSecurityPolicy("n", false);

    expect(directive(policy, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(policy, "object-src")).toBe("object-src 'none'");
    expect(directive(policy, "base-uri")).toBe("base-uri 'self'");
    expect(directive(policy, "form-action")).toBe("form-action 'self'");
    expect(directive(policy, "connect-src")).toBe("connect-src 'self'");
  });

  it("does not allow third-party origins anywhere", () => {
    expect(buildContentSecurityPolicy("n", false)).not.toMatch(/https?:|\*/);
  });
});
