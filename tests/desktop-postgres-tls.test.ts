// @vitest-environment node
// TLS integration for the bundled PostgreSQL runtime (Task 9, Step 6).
// Gated: runs only with VERBALIBERA_TEST_TLS=1 (spawns real binaries,
// ~1 minute). The macOS release workflow sets the flag.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const RUN = process.env.VERBALIBERA_TEST_TLS === "1";
const BIN = path.join(process.cwd(), ".desktop-stage/postgres/bin");

function psql(url: string, sql: string): string {
  return execFileSync(path.join(BIN, "psql"), [url, "-tAc", sql], {
    encoding: "utf8",
    timeout: 15000,
  }).trim();
}

describe.runIf(RUN)("desktop PostgreSQL TLS", () => {
  it("serves a TLS-only loopback cluster from the staged runtime", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "vl-tls-"));
    const dataDir = path.join(root, "data");
    const pwFile = path.join(root, "pw");
    fs.writeFileSync(pwFile, "tls-test-password", { mode: 0o600 });
    execFileSync(
      path.join(BIN, "initdb"),
      ["-D", dataDir, "-U", "verbalibera", "-E", "UTF8", "--auth=scram-sha-256", `--pwfile=${pwFile}`],
      { encoding: "utf8", timeout: 60000 },
    );
    fs.rmSync(pwFile);
    execFileSync(
      "openssl",
      ["req", "-new", "-x509", "-days", "1", "-nodes", "-out", path.join(dataDir, "server.crt"), "-keyout", path.join(dataDir, "server.key"), "-subj", "/CN=127.0.0.1"],
      { timeout: 30000 },
    );
    fs.chmodSync(path.join(dataDir, "server.key"), 0o600);
    fs.appendFileSync(
      path.join(dataDir, "postgresql.conf"),
      "\nssl = on\nlisten_addresses = '127.0.0.1'\nport = 55499\n",
    );
    execFileSync(
      path.join(BIN, "pg_ctl"),
      ["start", "-D", dataDir, "-l", path.join(root, "log"), "-w", "-t", "30"],
      { timeout: 60000 },
    );
    try {
      const base = "postgresql://verbalibera:tls-test-password@127.0.0.1:55499/postgres";
      expect(psql(`${base}?sslmode=require`, "SELECT 1")).toBe("1");
      const ssl = psql(`${base}?sslmode=require`, "SHOW ssl");
      expect(ssl).toBe("on");
    } finally {
      execFileSync(path.join(BIN, "pg_ctl"), ["stop", "-D", dataDir, "-m", "fast"], {
        timeout: 30000,
      });
    }
  });
});
