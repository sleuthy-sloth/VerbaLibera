// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "desktop/release-manifest.json");

interface ReleaseManifest {
  postgresql: {
    version: string;
    url: string;
    sha256: string;
    arch: string;
  };
  openssl: {
    version: string;
    url: string;
    sha256: string;
    note: string;
  };
}

function readManifest(): ReleaseManifest {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Release manifest not found at ${MANIFEST_PATH}`);
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as ReleaseManifest;
}

describe("desktop PostgreSQL runtime", () => {
  it("pins an exact reproducible PostgreSQL source", () => {
    const manifest = readManifest();
    expect(manifest.postgresql).toEqual({
      version: "18.6",
      url: "https://ftp.postgresql.org/pub/source/v18.6/postgresql-18.6.tar.bz2",
      sha256:
        "555610c24d53e4316da5b7d3fc25c279d96856d5e0e23ee308c328c5fa881d9f",
      arch: "arm64",
    });
    expect(manifest.openssl).toEqual({
      version: "3.5.7",
      url: "https://github.com/openssl/openssl/releases/download/openssl-3.5.7/openssl-3.5.7.tar.gz",
      sha256:
        "a8c0d28a529ca480f9f36cf5792e2cd21984552a3c8e4aa11a24aa31aeac98e8",
      note: expect.any(String),
    });
  });

  it("stages runtime executables, libraries, and catalog files", () => {
    const bin = path.join(ROOT, ".desktop-stage/postgres/bin");
    for (const exe of ["postgres", "initdb", "pg_ctl", "psql"]) {
      const file = path.join(bin, exe);
      expect(fs.existsSync(file), `expected staged runtime file ${exe}`).toBe(
        true,
      );
      expect(fs.statSync(file).mode & 0o111, `${exe} must be executable`).toBeGreaterThan(
        0,
      );
    }
    const copyright = path.join(ROOT, ".desktop-stage/postgres/COPYRIGHT");
    expect(fs.existsSync(copyright), "expected PostgreSQL COPYRIGHT").toBe(
      true,
    );
  });

  it("documents the reproducible preparation scripts", () => {
    expect(
      fs.existsSync(path.join(ROOT, "scripts/desktop/prepare-postgres.sh")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(ROOT, "scripts/desktop/verify-postgres.ts")),
    ).toBe(true);
  });
});
