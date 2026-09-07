// @vitest-environment node
import { describe, it, expect } from "vitest";
import { validateRemoteDatabaseUrl } from "../desktop/settings/schema";
import { APP_ORIGIN, isAllowedRendererUrl } from "../desktop/security/urls";
import { redactLogLine } from "../desktop/security/redact";

describe("desktop remote database validation", () => {
  it("rejects cleartext remote PostgreSQL", () => {
    expect(() =>
      validateRemoteDatabaseUrl(
        "postgresql://u:pw@db.example.com/app?sslmode=disable",
      ),
    ).toThrow(/TLS/i);
    expect(() =>
      validateRemoteDatabaseUrl("postgresql://u:pw@db.example.com/app"),
    ).toThrow(/TLS/i);
    expect(
      validateRemoteDatabaseUrl("postgresql://u:pw@127.0.0.1:5432/app")
        .hostname,
    ).toBe("127.0.0.1");
  });

  it("requires credentials and a database name", () => {
    expect(() =>
      validateRemoteDatabaseUrl(
        "postgresql://db.example.com/app?sslmode=require",
      ),
    ).toThrow(/credential/i);
    expect(() =>
      validateRemoteDatabaseUrl(
        "postgresql://u:pw@db.example.com/?sslmode=require",
      ),
    ).toThrow(/database/i);
    expect(() => validateRemoteDatabaseUrl("https://example.com/app")).toThrow(
      /postgres/i,
    );
  });
});

describe("desktop renderer URL policy", () => {
  it("allows only the fixed local application origin", () => {
    expect(isAllowedRendererUrl(`${APP_ORIGIN}/dashboard`)).toBe(true);
    expect(isAllowedRendererUrl(`${APP_ORIGIN}/desktop/profiles`)).toBe(true);
    expect(isAllowedRendererUrl("https://example.com/")).toBe(false);
    expect(isAllowedRendererUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedRendererUrl("file:///etc/passwd")).toBe(false);
  });
});

describe("desktop log redaction", () => {
  it("redacts database URLs and bearer/session secrets", () => {
    expect(
      redactLogLine("postgresql://user:s3cret@db/app token=abc"),
    ).not.toMatch(/s3cret|abc/);
    expect(redactLogLine("DATABASE_URL=postgresql://u:pw@h/db ok")).not.toMatch(
      /u:pw@/,
    );
    expect(redactLogLine("verbalibera_session=deadbeef done")).not.toMatch(
      /deadbeef/,
    );
  });
});
