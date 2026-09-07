# VerbaLibera Electron macOS Edition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the complete VerbaLibera application as an unsigned Apple Silicon macOS DMG that runs with either a private bundled PostgreSQL database or a user-controlled remote PostgreSQL database.

**Architecture:** Electron owns setup, settings, secrets, PostgreSQL, migrations, the fixed-origin Next.js standalone server, and recovery. The sandboxed renderer loads only the local application origin and retains the existing full Next.js user experience. Native boundaries are dependency-injected so lifecycle, security, and failure branches can be unit tested without launching services.

**Tech Stack:** Electron 44.2.0, Electron Forge 7.11.2, Next.js 16 standalone output, Prisma 7, PostgreSQL 18.6 arm64, TypeScript 5, Vitest 4, Playwright Electron.

**Spec:** `docs/superpowers/specs/2026-09-06-macos-electron-and-portable-distribution-design.md`

## Global Constraints

- macOS Apple Silicon only; output is `dist/electron/VerbaLibera-mac-arm64.dmg` plus `.sha256`.
- Version one is unsigned and unnotarized, with no auto-updater.
- No Homebrew, Docker, separately installed Node/Python/PostgreSQL, speech models, generated speech, transcription, or semantic grading is required.
- Local mode binds PostgreSQL and Next.js only to loopback and makes no normal outbound request.
- Remote mode requires a dedicated database, TLS for non-loopback hosts, explicit migration approval, and encrypted credential storage.
- Renderer uses context isolation and sandboxing with Node integration disabled; remote code/navigation and broad IPC are prohibited.
- Storage-mode changes apply only after restart; local and remote data are never silently merged.
- Generated release artifacts and PostgreSQL build output remain untracked.

---

### Task 1: Standalone Server and Electron Forge Skeleton

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `next.config.ts`
- Create: `forge.config.ts`
- Create: `desktop/main.ts`
- Create: `desktop/preload.ts`
- Create: `desktop/tsconfig.json`
- Create: `scripts/desktop/stage-next.ts`
- Test: `tests/desktop-packaging.test.ts`

**Interfaces:**
- Consumes: Next.js standalone output and existing `public`/`.next/static` directories.
- Produces: `desktop:compile`, `desktop:stage-next`, `electron:dev`, and Forge `arm64` packaging configuration.

- [ ] **Step 1: Write a failing packaging-configuration test**

```ts
it("enables standalone Next output and arm64-only DMG packaging", async () => {
  expect(nextConfig.output).toBe("standalone");
  expect(forgeConfig.packagerConfig.asar).toBe(true);
  expect(JSON.stringify(forgeConfig.makers)).toMatch(/dmg/);
  expect(packageJson.devDependencies.electron).toBe("44.2.0");
});
```

- [ ] **Step 2: Run the test and confirm the missing Forge modules**

Run: `npx vitest run tests/desktop-packaging.test.ts`

Expected: FAIL because Forge and desktop configuration do not exist.

- [ ] **Step 3: Install exact packaging dependencies**

Run: `npm install --save-dev --save-exact electron@44.2.0 @electron-forge/cli@7.11.2 @electron-forge/maker-dmg@7.11.2 @electron-forge/plugin-auto-unpack-natives@7.11.2`

Expected: `package-lock.json` records exact versions and integrity hashes.

- [ ] **Step 4: Add standalone and Forge staging configuration**

```ts
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: { "/*": ["./prisma/migrations/**/*", "./prisma/seed.ts"] },
  // retain the existing redirect
};
```

Configure Forge with `asar: true`, `asar.unpack` for `resources/postgres/**` and the staged server, `arch: "arm64"`, one DMG maker, `executableName: "VerbaLibera"`, no signing/notarization fields, and `ignore` rules excluding source tests, `.git`, `.next/cache`, services, and generated `dist`.

- [ ] **Step 5: Compile and stage a minimal server**

`stage-next.ts` copies `.next/standalone`, `.next/static`, `public`, Prisma migrations/client runtime, and content assets into `.desktop-stage/server`, then rejects symlinks and paths outside the repository.

Run: `npm run build && npm run desktop:compile && npm run desktop:stage-next`

Expected: `.desktop-stage/server/server.js` exists and contains no `/Users/` path.

- [ ] **Step 6: Run focused tests and commit**

Run: `npx vitest run tests/desktop-packaging.test.ts && npm run typecheck`

```bash
git add package.json package-lock.json next.config.ts forge.config.ts desktop scripts/desktop/stage-next.ts tests/desktop-packaging.test.ts
git commit -m "build: add Electron Forge desktop skeleton"
```

### Task 2: Desktop Settings, Validation, and Secret Redaction

**Files:**
- Create: `desktop/settings/schema.ts`
- Create: `desktop/settings/store.ts`
- Create: `desktop/security/redact.ts`
- Create: `desktop/security/urls.ts`
- Test: `tests/desktop-settings.test.ts`
- Test: `tests/desktop-security.test.ts`

**Interfaces:**
- Produces: `DesktopSettings`, `loadSettings(path)`, `saveSettings(path, settings)`, `validateRemoteDatabaseUrl(value)`, `redactLogLine(value)`, `APP_ORIGIN`, and `isAllowedRendererUrl(value)`.
- Consumes: injected filesystem operations and Electron `safeStorage` through an explicit interface.

- [ ] **Step 1: Write failing settings and URL-policy tests**

```ts
it("rejects cleartext remote PostgreSQL", () => {
  expect(() => validateRemoteDatabaseUrl("postgresql://u:p@db.example.com/app?sslmode=disable")).toThrow(/TLS/i);
  expect(validateRemoteDatabaseUrl("postgresql://u:p@127.0.0.1:5432/app").hostname).toBe("127.0.0.1");
});

it("allows only the fixed local application origin", () => {
  expect(isAllowedRendererUrl(`${APP_ORIGIN}/dashboard`)).toBe(true);
  expect(isAllowedRendererUrl("https://example.com/")).toBe(false);
  expect(isAllowedRendererUrl("javascript:alert(1)")).toBe(false);
});

it("redacts database URLs and bearer/session secrets", () => {
  expect(redactLogLine("postgresql://user:secret@db/app token=abc")).not.toMatch(/secret|abc/);
});
```

- [ ] **Step 2: Run the tests and confirm missing modules**

Run: `npx vitest run tests/desktop-settings.test.ts tests/desktop-security.test.ts`

Expected: FAIL because desktop settings/security modules do not exist.

- [ ] **Step 3: Implement versioned non-secret settings**

```ts
export type StorageChoice =
  | { mode: "local"; schemaVersion: string }
  | { mode: "remote"; encryptedDatabaseUrl: string; schemaVersion: string };
export type DesktopSettings = {
  version: 1;
  active: StorageChoice;
  pending?: StorageChoice;
};
export const APP_PORT = 43127;
export const APP_ORIGIN = `http://127.0.0.1:${APP_PORT}`;
```

Write atomically to `settings.json.tmp`, chmod `0o600`, rename, and reject unknown keys/corrupt JSON through Zod. Encrypt/decrypt only through an injected `{ isEncryptionAvailable, encryptString, decryptString }` adapter; remote setup stops if unavailable.

- [ ] **Step 4: Implement strict URL and log policies**

Require `postgresql:`/`postgres:`, a database pathname other than `/`, credentials, and `sslmode=require|verify-ca|verify-full` for non-loopback hosts. Redact URL userinfo, `DATABASE_URL`, bootstrap/JWT/session values, and learner-answer fields before log output.

- [ ] **Step 5: Run focused tests and commit**

Run: `npx vitest run tests/desktop-settings.test.ts tests/desktop-security.test.ts`

```bash
git add desktop/settings desktop/security tests/desktop-settings.test.ts tests/desktop-security.test.ts
git commit -m "feat: validate desktop configuration securely"
```

### Task 3: Reproducible PostgreSQL 18.6 Runtime

**Files:**
- Create: `desktop/release-manifest.json`
- Create: `scripts/desktop/prepare-postgres.sh`
- Create: `scripts/desktop/verify-postgres.ts`
- Modify: `package.json`
- Modify: `.gitignore`
- Test: `tests/postgres-runtime.test.ts`

**Interfaces:**
- Produces: `.desktop-stage/postgres/{bin,lib,share}`, `postgres:prepare`, and `postgres:verify`.
- Consumes: official PostgreSQL 18.6 source archive.

- [ ] **Step 1: Write a failing release-manifest test**

```ts
expect(manifest.postgresql).toEqual({
  version: "18.6",
  url: "https://ftp.postgresql.org/pub/source/v18.6/postgresql-18.6.tar.bz2",
  sha256: "555610c24d53e4316da5b7d3fc25c279d96856d5e0e23ee308c328c5fa881d9f",
  arch: "arm64",
});
```

- [ ] **Step 2: Run the test and confirm the manifest is missing**

Run: `npx vitest run tests/postgres-runtime.test.ts`

Expected: FAIL because `desktop/release-manifest.json` does not exist.

- [ ] **Step 3: Add the pinned manifest and preparation script**

The shell script must require `uname -s` = `Darwin` and `uname -m` = `arm64`, download to a `mktemp -d` directory, verify with `shasum -a 256`, configure with `--without-readline --without-zlib --without-icu --disable-nls`, build/install, and stage only runtime executables (`postgres`, `initdb`, `pg_ctl`, `createdb`, `psql`), required libraries, timezone data, extension control/SQL files, license, and server catalog files.

- [ ] **Step 4: Verify runtime closure and provenance**

`verify-postgres.ts` checks each Mach-O with `otool -L`, rejects Homebrew/MacPorts/developer paths and non-system dependencies outside the staged runtime, checks `lipo -archs` equals `arm64`, runs `postgres --version`, and requires PostgreSQL's COPYRIGHT file.

- [ ] **Step 5: Build and verify PostgreSQL on Apple Silicon**

Run: `npm run postgres:prepare && npm run postgres:verify`

Expected: version `18.6`, arm64-only binaries, and no unresolved non-system dylibs. If the current host is not arm64 macOS, run the unit test locally and defer this command to the macOS arm64 CI job without claiming runtime verification.

- [ ] **Step 6: Commit reproducible runtime preparation**

```bash
git add desktop/release-manifest.json scripts/desktop/prepare-postgres.sh scripts/desktop/verify-postgres.ts package.json package-lock.json .gitignore tests/postgres-runtime.test.ts
git commit -m "build: prepare pinned PostgreSQL runtime"
```

### Task 4: Local PostgreSQL Lifecycle and Migration Gate

**Files:**
- Create: `desktop/runtime/contracts.ts`
- Create: `desktop/runtime/postgres.ts`
- Create: `desktop/runtime/migrations.ts`
- Create: `desktop/runtime/process-identity.ts`
- Test: `tests/desktop-postgres.test.ts`
- Test: `tests/desktop-migrations.test.ts`

**Interfaces:**
- Produces: `startLocalPostgres(context): Promise<OwnedProcess>`, `stopOwnedProcess(process)`, `inspectSchema(databaseUrl)`, `migrateDatabase(options)`, and `assertCompatibleSchema(appVersion, schemaVersion)`.
- Consumes: injected spawn, port allocation, filesystem, entropy, clock, and Prisma CLI paths.

- [ ] **Step 1: Write failing lifecycle tests**

```ts
it("initializes local data with generated credentials and loopback only", async () => {
  const result = await startLocalPostgres(fakeContext);
  expect(result.databaseUrl).toMatch(/^postgresql:\/\/verbalibera:/);
  expect(fakeSpawn.args.join(" ")).toContain("listen_addresses=127.0.0.1");
  expect(fakeFs.mode(dataDir)).toBe(0o700);
});

it("does not trust a stale PID that belongs to another executable", async () => {
  expect(await ownsRecordedProcess(staleRecord, fakeInspector)).toBe(false);
});
```

- [ ] **Step 2: Run the tests and confirm missing lifecycle code**

Run: `npx vitest run tests/desktop-postgres.test.ts tests/desktop-migrations.test.ts`

Expected: FAIL because runtime modules do not exist.

- [ ] **Step 3: Implement local database initialization/startup**

Generate 32-byte base64url credentials with `randomBytes`, reserve an ephemeral loopback database port, create/chmod user-data paths, invoke packaged `initdb --auth=scram-sha-256`, write loopback-only configuration, and start packaged `pg_ctl`. Verify readiness using a credentialed `SELECT 1`; verify an unrelated credential is rejected in integration coverage.

- [ ] **Step 4: Implement migration, seed, backup, and downgrade rules**

Before migration, record application/schema versions and copy configuration/control metadata into `backups/<timestamp>/`. Run `prisma migrate deploy` then the idempotent seed with `DATABASE_URL` only in the child environment. Remote mode returns the pending migration names and requires `approved: true`. Reject a stored schema version newer than the packaged compatibility version.

- [ ] **Step 5: Run focused tests and commit**

Run: `npx vitest run tests/desktop-postgres.test.ts tests/desktop-migrations.test.ts`

```bash
git add desktop/runtime tests/desktop-postgres.test.ts tests/desktop-migrations.test.ts
git commit -m "feat: supervise desktop PostgreSQL and migrations"
```

### Task 5: Fixed-Origin Next.js Supervisor and Recovery Codes

**Files:**
- Create: `desktop/runtime/server.ts`
- Create: `desktop/runtime/health.ts`
- Create: `desktop/runtime/errors.ts`
- Create: `desktop/runtime/logger.ts`
- Modify: `desktop/main.ts`
- Test: `tests/desktop-server.test.ts`
- Test: `tests/desktop-logger.test.ts`

**Interfaces:**
- Produces: `startApplicationServer(context)`, `waitForHealth(options)`, `DesktopFailure`, rotating redacted logs, and deterministic shutdown.
- Consumes: `APP_PORT`, database URL, per-install bootstrap identity, key paths, and an injected Electron utility-process adapter.

- [ ] **Step 1: Write failing server-supervision tests**

```ts
it("rejects an occupied port with the wrong installation identity", async () => {
  await expect(startApplicationServer(contextWithForeignHealthResponse)).rejects.toMatchObject({ code: "APP_PORT_OCCUPIED" });
});

it("times out and reaps a server that never becomes healthy", async () => {
  await expect(waitForHealth({ timeoutMs: 15_000, pollMs: 100, ...fake })).rejects.toMatchObject({ code: "SERVER_HEALTH_TIMEOUT" });
  expect(fakeProcess.kill).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run tests and confirm missing supervisor modules**

Run: `npx vitest run tests/desktop-server.test.ts tests/desktop-logger.test.ts`

Expected: FAIL because server/health/logger modules do not exist.

- [ ] **Step 3: Implement fixed-origin startup and health identity**

Start staged `server.js` with `HOSTNAME=127.0.0.1`, `PORT=43127`, database URL, file-backed JWT key paths, `VERBALIBERA_DESKTOP_MODE`, and a per-install health identity. Poll `/api/desktop/health` for at most 15 seconds; accept only the matching identity and app version. Never fall back to a different application port.

- [ ] **Step 4: Implement bounded logs and shutdown**

Rotate `desktop.log` at 2 MiB with three retained files, redact each line before writing, never log child environments, and tag stages `setup`, `database`, `migration`, `server`, `renderer`, and `shutdown`. On `before-quit`, close windows, terminate the utility process, wait five seconds, force reap if owned, then stop owned PostgreSQL.

- [ ] **Step 5: Run focused tests and commit**

Run: `npx vitest run tests/desktop-server.test.ts tests/desktop-logger.test.ts tests/desktop-security.test.ts`

```bash
git add desktop/runtime desktop/main.ts tests/desktop-server.test.ts tests/desktop-logger.test.ts
git commit -m "feat: supervise fixed-origin desktop server"
```

### Task 6: Desktop Setup, Recovery, and Restricted Preload API

**Files:**
- Create: `desktop/ui/setup.html`
- Create: `desktop/ui/setup.ts`
- Create: `desktop/ui/recovery.html`
- Create: `desktop/ui/recovery.ts`
- Create: `desktop/ipc.ts`
- Modify: `desktop/preload.ts`
- Modify: `desktop/main.ts`
- Test: `tests/desktop-ipc.test.ts`
- Test: `tests/desktop-setup.test.ts`

**Interfaces:**
- Produces: preload API methods `chooseLocal()`, `inspectRemote(url)`, `approveRemoteMigration(token)`, `revealLog()`, and `restart()` only.
- Consumes: validated settings, `safeStorage`, migration inspection, and recovery failures from Tasks 2–5.

- [ ] **Step 1: Write failing IPC and setup-state tests**

```ts
expect(Object.keys(exposedApi).sort()).toEqual(["approveRemoteMigration", "chooseLocal", "inspectRemote", "restart", "revealLog"]);
await expect(invokeFromWrongSender("chooseLocal")).rejects.toThrow(/sender/i);
await expect(inspectRemote("postgresql://u:p@db.example.com/app?sslmode=disable")).rejects.toMatchObject({ code: "REMOTE_TLS_REQUIRED" });
```

- [ ] **Step 2: Run tests and confirm setup API is missing**

Run: `npx vitest run tests/desktop-ipc.test.ts tests/desktop-setup.test.ts`

Expected: FAIL because restricted IPC/setup modules do not exist.

- [ ] **Step 3: Implement sandboxed setup and recovery windows**

Use local packaged HTML only, `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, a narrow preload, denied permissions, denied `window.open`, and blocked navigation. Validate every IPC argument with Zod and verify `event.senderFrame.url` equals the expected packaged setup/recovery document.

- [ ] **Step 4: Implement the two setup choices**

Local choice saves `{ version: 1, active: { mode: "local", schemaVersion } }` only after database initialization/migration succeeds. Remote inspection validates TLS, encrypts nothing yet, tests `SELECT 1`, returns exact pending migration names, and issues a one-use approval token held in main-process memory for five minutes. Approval reruns validation/connectivity, migrates, encrypts the URL with `safeStorage`, saves it as `active`, and clears the plaintext/token.

- [ ] **Step 5: Run focused tests and commit**

Run: `npx vitest run tests/desktop-ipc.test.ts tests/desktop-setup.test.ts tests/desktop-settings.test.ts tests/desktop-security.test.ts`

```bash
git add desktop/ui desktop/ipc.ts desktop/preload.ts desktop/main.ts tests/desktop-ipc.test.ts tests/desktop-setup.test.ts
git commit -m "feat: add secure desktop setup and recovery"
```

### Task 7: Local Profiles and Desktop Bootstrap Session

**Files:**
- Create: `src/lib/desktop/config.ts`
- Create: `src/lib/desktop/bootstrap.ts`
- Create: `src/app/api/desktop/health/route.ts`
- Create: `src/app/api/desktop/profiles/route.ts`
- Create: `src/app/api/desktop/bootstrap/route.ts`
- Create: `src/app/desktop/profiles/page.tsx`
- Create: `src/components/desktop/DesktopProfilePicker.tsx`
- Modify: `proxy.ts`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260906000002_desktop_local_profiles/migration.sql`
- Test: `tests/desktop-bootstrap.test.ts`
- Test: `tests/proxy-guard.test.ts`

**Interfaces:**
- Produces: loopback-only health, local-profile CRUD, and profile-to-HTTP-only-session exchange routes available only when `VERBALIBERA_DESKTOP_MODE=local`.
- Consumes: per-launch bootstrap secret from server-only environment and existing `issueSessionToken()` cookie machinery.

- [ ] **Step 1: Write failing desktop-boundary tests**

```ts
it("returns 404 outside local desktop mode", async () => {
  delete process.env.VERBALIBERA_DESKTOP_MODE;
  expect((await POST(desktopRequest)).status).toBe(404);
});

it("rejects non-loopback, bad origin, and bad bootstrap secret", async () => {
  expect((await POST(requestFrom("10.0.0.2"))).status).toBe(403);
  expect((await POST(requestWithOrigin("https://evil.example"))).status).toBe(403);
  expect((await POST(requestWithSecret("wrong"))).status).toBe(403);
});

it("issues the existing HTTP-only session cookie for a selected local profile", async () => {
  const response = await POST(validRequest);
  expect(response.headers.get("set-cookie")).toMatch(/verbalibera_session=.*HttpOnly/);
});
```

- [ ] **Step 2: Run tests and confirm routes are absent**

Run: `npx vitest run tests/desktop-bootstrap.test.ts tests/proxy-guard.test.ts`

Expected: FAIL because desktop server boundaries do not exist.

- [ ] **Step 3: Add local profile persistence**

Add `isDesktopLocal Boolean @default(false)` to `User` and enforce that local profile creation generates an internal `desktop-local:<uuid>` account identifier. The profile API returns only `{ id, displayName }`; store display name in a new `DesktopProfile` model keyed one-to-one to `User` so hosted account identifiers are unchanged.

- [ ] **Step 4: Implement bootstrap session protection**

Require local desktop mode, remote address `127.0.0.1`/`::1`, exact `Origin: http://127.0.0.1:43127`, CSRF cookie/header agreement, and a constant-time comparison of the per-launch secret supplied in an HTTP-only bootstrap cookie created by the main window's first local request. Rotate/consume the secret after profile selection and redirect to `/dashboard` with the normal session cookie.

- [ ] **Step 5: Read the installed Next.js proxy/route docs and update guards**

Read the relevant files under `node_modules/next/dist/docs/` before editing `proxy.ts`. Allow `/desktop/profiles` only in local desktop mode and keep all desktop APIs unreachable in hosted and remote modes.

- [ ] **Step 6: Run auth, route, and Prisma checks**

Run: `npx prisma format && npx prisma validate && npx prisma generate && npx vitest run tests/desktop-bootstrap.test.ts tests/proxy-guard.test.ts tests/auth-session.test.ts tests/csrf.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit local profiles**

```bash
git add src/lib/desktop src/app/api/desktop src/app/desktop src/components/desktop proxy.ts prisma/schema.prisma prisma/migrations/20260906000002_desktop_local_profiles tests/desktop-bootstrap.test.ts tests/proxy-guard.test.ts
git commit -m "feat: add desktop-local profile sessions"
```

### Task 8: Storage-Mode Settings, Export, and Recoverable Reset

**Files:**
- Create: `src/app/desktop/settings/page.tsx`
- Create: `src/components/desktop/DesktopSettings.tsx`
- Extend: `desktop/ipc.ts`
- Extend: `desktop/preload.ts`
- Create: `desktop/runtime/reset.ts`
- Test: `tests/desktop-reset.test.ts`
- Test: `tests/desktop-ipc.test.ts`

**Interfaces:**
- Produces: `inspectStorageChange`, `scheduleStorageChange`, `resetLocalData`, progress-export prompt, and restart-required status.
- Consumes: course-practice JSON export, safe settings store, database shutdown, and Finder reveal APIs.

- [ ] **Step 1: Write failing reset and mode-switch tests**

```ts
it("does not apply a storage-mode change until restart", async () => {
  await scheduleStorageChange(remoteSettings, context);
  expect(context.runningDatabaseUrl).toBe(localUrl);
  expect(context.savedSettings.pending?.mode).toBe("remote");
});

it("requires the exact reset phrase and moves data to a backup", async () => {
  await expect(resetLocalData("reset", context)).rejects.toThrow(/RESET LOCAL DATA/);
  await resetLocalData("RESET LOCAL DATA", context);
  expect(context.fs.moves[0].to).toMatch(/backups\/local-data-/);
  expect(context.fs.deleted).toEqual([]);
});
```

- [ ] **Step 2: Run tests and confirm mode/reset functions are missing**

Run: `npx vitest run tests/desktop-reset.test.ts tests/desktop-ipc.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement explicit restart-only switching**

Validate new storage exactly as first-launch setup does, persist it under `pending`, show `Restart to apply`, and promote it to `active` only during the next main-process startup. Do not copy or merge rows. When leaving local mode, present a practice export action before restart.

- [ ] **Step 4: Implement recoverable local reset**

Require typed phrase `RESET LOCAL DATA`, stop the owned database, rename the complete data directory to `backups/local-data-<ISO timestamp>`, initialize a fresh directory, and reveal the backup path. Never recursively delete the prior data.

- [ ] **Step 5: Run focused tests and commit**

Run: `npx vitest run tests/desktop-reset.test.ts tests/desktop-ipc.test.ts tests/course-storage.test.ts`

```bash
git add src/app/desktop/settings src/components/desktop/DesktopSettings.tsx desktop/ipc.ts desktop/preload.ts desktop/runtime/reset.ts tests/desktop-reset.test.ts tests/desktop-ipc.test.ts
git commit -m "feat: manage desktop storage modes safely"
```

### Task 9: Packaged Electron End-to-End Flow and DMG Audit

**Files:**
- Create: `playwright.electron.config.ts`
- Create: `tests/e2e/electron-first-run.spec.ts`
- Create: `tests/e2e/electron-recovery.spec.ts`
- Create: `scripts/desktop/verify-artifact.ts`
- Modify: `forge.config.ts`
- Modify: `package.json`
- Test: `tests/desktop-packaging.test.ts`

**Interfaces:**
- Produces: `electron:package`, `electron:make`, `electron:verify`, local first-run/relaunch coverage, and DMG checksum.
- Consumes: staged Next server and PostgreSQL runtime.

- [ ] **Step 1: Add failing packaged-security assertions**

```ts
expect(mainWindow.webContents.getLastWebPreferences()).toMatchObject({
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  webSecurity: true,
});
expect(audit.paths).not.toContainEqual(expect.stringMatching(/services\/voice|\.env|\/Users\//));
```

- [ ] **Step 2: Run the packaging test and confirm missing audit behavior**

Run: `npx vitest run tests/desktop-packaging.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement artifact assembly and audit**

Build only `arm64`; copy staged server and PostgreSQL as unpacked resources; include licenses/notices; reject Intel or universal Mach-O files, `.env`, source maps, voice-model/runtime files, developer paths, secrets, unexpected external URLs, and missing sandbox preferences. Normalize the Forge DMG name to `dist/electron/VerbaLibera-mac-arm64.dmg` and write a conventional checksum file.

- [ ] **Step 4: Add full local first-run coverage**

Use a temporary Electron user-data directory. Choose Local, create two profiles, select one, complete placement and a study-plan flow, complete a course lesson, quit, relaunch, select the same profile, and verify progress persists. Assert the database listener is loopback-only and an unrelated credential cannot authenticate.

- [ ] **Step 5: Add failure and recovery coverage**

Occupy port 43127 with a foreign health identity and expect `APP_PORT_OCCUPIED`; crash the server child and expect the recovery window; verify owned children are reaped; make `safeStorage.isEncryptionAvailable()` false and confirm remote setup stops without writing settings.

- [ ] **Step 6: Add remote, upgrade, and offline integration coverage**

Start a disposable PostgreSQL database with TLS, inspect its pending migrations, prove no schema change occurs before approval, approve, create and authenticate a passkey account against the fixed origin, complete practice, restart, and recover the account progress. Migrate a copied previous-version local fixture and verify progress survives; reject a fixture whose schema version is newer than the app. In local mode, block all non-loopback sockets during the complete first-run/relaunch flow and assert no outbound attempt occurs. Assert the application contains no auto-updater package, feed URL, or update IPC.

- [ ] **Step 7: Build and verify the DMG on Apple Silicon**

Run: `npm run build && npm run postgres:verify && npm run electron:make && npm run electron:verify && npx playwright test --config playwright.electron.config.ts`

Expected: all tests PASS and both Electron deliverable files exist. On non-arm64/non-macOS hosts, the command must fail with a clear unsupported-build message rather than emit a substitute artifact.

- [ ] **Step 8: Commit packaged acceptance coverage**

```bash
git add playwright.electron.config.ts tests/e2e/electron-first-run.spec.ts tests/e2e/electron-recovery.spec.ts scripts/desktop/verify-artifact.ts forge.config.ts package.json package-lock.json tests/desktop-packaging.test.ts
git commit -m "build: package and verify macOS Electron edition"
```

### Task 10: macOS Release Workflow and Learner Documentation

**Files:**
- Create: `.github/workflows/macos-release.yml`
- Modify: `README.md`
- Modify: `THIRD_PARTY_NOTICES.md`
- Modify: `tests/ci-workflow.test.ts`
- Create: `tests/macos-release-workflow.test.ts`

**Interfaces:**
- Produces: manual/tagged macOS release job and complete install/recovery/privacy documentation.
- Consumes: portable and Electron build/verify commands from both implementation plans.

- [ ] **Step 1: Write failing release-workflow assertions**

```ts
expect(workflow).toMatch(/runs-on:\s*macos-15/);
expect(workflow).toMatch(/npm ci/);
expect(workflow).toMatch(/npm run postgres:prepare/);
expect(workflow).toMatch(/npm run portable:verify/);
expect(workflow).toMatch(/npm run electron:verify/);
expect(workflow).not.toMatch(/APPLE_ID|CSC_LINK|notar/i);
```

- [ ] **Step 2: Run tests and confirm the workflow is missing**

Run: `npx vitest run tests/macos-release-workflow.test.ts tests/ci-workflow.test.ts`

Expected: FAIL because `.github/workflows/macos-release.yml` does not exist.

- [ ] **Step 3: Add deterministic macOS release automation**

Use `macos-15`, Node 22, `npm ci`, all existing lint/type/unit/content/build gates, PostgreSQL preparation/verification, portable build/verification, Electron make/verification, and both Playwright smoke suites. Upload exactly four deliverables from `dist/portable` and `dist/electron`. Permit `workflow_dispatch` and `v*` tags; attach files to a GitHub release only for a tag. Do not configure signing secrets.

- [ ] **Step 4: Complete learner/operator documentation**

Document Apple Silicon requirement, unsigned right-click → Open flow, local versus remote choice, local data and logs, remote TLS/dedicated-role/migration approval, passkeys in remote mode, no silent merge, export/import, recoverable reset, manual upgrades, downgrade rejection, uninstall data behavior, no bundled speech/AI models, checksum commands, and absence of VerbaLibera-hosted dependencies.

- [ ] **Step 5: Run the complete release gate**

Run: `npm run lint && npm run typecheck && npm test && npm run content:validate && npm run build && npm run portable:build && npm run portable:verify && npm run postgres:verify && npm run electron:make && npm run electron:verify`

Expected: zero command failures, four verified deliverables, no tracked files under `dist/` or `.desktop-stage/`, and no secrets/developer paths in artifacts.

- [ ] **Step 6: Commit the release workflow**

```bash
git add .github/workflows/macos-release.yml README.md THIRD_PARTY_NOTICES.md tests/ci-workflow.test.ts tests/macos-release-workflow.test.ts
git commit -m "ci: publish self-contained macOS editions"
```
