import { test, expect, _electron as electron } from "@playwright/test";
import { createServer } from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = process.cwd();
const ELECTRON_BIN = path.join(
  REPO,
  "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron",
);

async function launchApp(userDataDir: string) {
  return electron.launch({
    executablePath: ELECTRON_BIN,
    args: [".", `--user-data-dir=${userDataDir}`],
    cwd: REPO,
    timeout: 120_000,
  });
}

test("occupied application port opens recovery, not a second server", async () => {
  // Foreign occupant answers the health endpoint with another identity.
  const occupant = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ identity: "someone-else", version: "0.1.0" }));
  });
  await new Promise<void>((done) => occupant.listen(43127, "127.0.0.1", done));
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vl-e2e-rec-"));
  // Pretend a previous local setup so startup goes straight to the server.
  fs.writeFileSync(
    path.join(userDataDir, "settings.json"),
    JSON.stringify({ version: 1, active: { mode: "local", schemaVersion: "x" } }),
  );
  const app = await launchApp(userDataDir);
  try {
    const recovery = await app.firstWindow();
    await recovery.waitForSelector("#detail", { timeout: 120_000 });
    const detail = await recovery.textContent("#detail");
    expect(detail ?? "").toMatch(/already in use|occupied/i);
    const summary = await recovery.textContent("#summary");
    expect(summary ?? "").toMatch(/APP_PORT_OCCUPIED/);
  } finally {
    await app.close();
    occupant.close();
  }
});

test("corrupt settings open recovery instead of crashing", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vl-e2e-bad-"));
  fs.writeFileSync(path.join(userDataDir, "settings.json"), "{not json");
  const app = await launchApp(userDataDir);
  try {
    const recovery = await app.firstWindow();
    await recovery.waitForSelector("#detail", { timeout: 60_000 });
    const summary = await recovery.textContent("#summary");
    expect(summary ?? "").toMatch(/SETTINGS_CORRUPT/);
  } finally {
    await app.close();
  }
});
