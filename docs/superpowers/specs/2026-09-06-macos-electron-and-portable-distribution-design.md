# macOS Electron and Portable Distribution Design

## Status

Approved in conversation on 2026-09-06. This specification covers an Apple Silicon Electron edition with the full VerbaLibera experience and a single-file portable course edition.

## Goals

- Let a learner download one file and use VerbaLibera on a Mac without depending on VerbaLibera-hosted infrastructure.
- Produce an Apple Silicon Electron disk image containing the full application.
- Produce a single HTML file containing the self-contained course workspace.
- Keep deterministic typed grading and prerecorded audio; do not bundle Kokoro, faster-whisper, Argos Translate, or other runtime language models.
- Preserve one shared learning core rather than maintaining separate desktop and portable applications.
- Allow Electron users to keep data entirely on one Mac or connect the app to a dedicated PostgreSQL database they control.

## Non-goals

- Intel Mac, Windows, or Linux packages in the first release.
- Apple Developer ID signing, notarization, App Store distribution, or automatic updates in the first release.
- Microphone transcription, generated speech, or semantic answer judgment in either artifact.
- Accounts, passkeys, placement persistence, study-plan persistence, or cross-device synchronization in the portable HTML edition.
- Automatic merging between local Electron data and a remote PostgreSQL database.
- Direct compatibility with arbitrary existing PostgreSQL schemas; remote mode requires a dedicated VerbaLibera database.

## Deliverables

Release builds produce:

```text
dist/electron/VerbaLibera-mac-arm64.dmg
dist/electron/VerbaLibera-mac-arm64.dmg.sha256
dist/portable/VerbaLibera-Portable.html
dist/portable/VerbaLibera-Portable.html.sha256
```

Generated release artifacts are not committed to Git. CI uploads them as workflow artifacts, and a release workflow may attach the same verified files to a GitHub release.

## Shared learning core

The current course-pack workspace remains the shared learner interface. Packaging-specific behavior is expressed through explicit capabilities and asset/storage boundaries rather than forks of the component tree.

The shared core owns:

- Course, lesson, review, vocabulary, grammar, and dialogue views.
- Deterministic answer evaluation and spaced-review projection.
- Prerecorded audio playback.
- Practice-event import and export.
- Accessible keyboard, touch, and responsive behavior.

An environment adapter supplies:

- The course catalog and course-pack JSON.
- Media URLs or blob URLs.
- Practice-event storage.
- Capabilities such as accounts, synchronization, service-worker installation, and navigation to the full application.

The hosted application keeps its current network-backed adapter. Electron uses the full Next.js application and its existing APIs. Portable HTML uses an embedded-asset adapter and device-only practice storage. The core must not branch on Electron user-agent strings or `file://` directly.

## Portable edition

### Artifact construction

A build command bundles the portable entry point, React runtime, shared course workspace, and CSS. It reads every validated foundation pack and all media referenced by those packs, verifies the recorded SHA-256 hashes, and embeds the resulting bytes into the HTML artifact.

Pack JSON is embedded as structured data. Images and audio are embedded as encoded bytes and materialized as blob URLs at runtime. The builder rejects:

- Missing assets.
- Media whose digest differs from the course manifest.
- Duplicate course or media identifiers.
- Absolute development paths.
- External executable scripts, stylesheets, fonts, images, audio, or API endpoints.

The file contains a restrictive content-security policy compatible with its generated inline bootstrap. The checksum file uses the conventional two-column SHA-256 format.

### Runtime behavior

Double-clicking `VerbaLibera-Portable.html` opens the course workspace without a server or network request. It contains all five foundation courses available at build time.

Portable capabilities are explicit:

- Account and synchronization controls are hidden.
- Service-worker download/install controls are hidden.
- Links to dashboard, login, account, and server-backed routes are replaced with portable-safe navigation or omitted.
- Deterministic grading, review scheduling, audio, vocabulary, grammar, dialogues, import, and export remain available.

The app probes IndexedDB before presenting practice as durable. When IndexedDB works, practice events persist for that file origin. When it fails or becomes unavailable, the app uses an in-memory event store, displays a persistent warning that progress is temporary, and keeps export available. It never claims data was saved unless the storage transaction completed.

The portable artifact must open and complete a lesson in current macOS Safari and Chrome with networking disabled. Browser-specific `file://` persistence is treated as a tested capability, not assumed behavior.

## Electron edition

### Packaging

Electron Forge packages an Apple Silicon application and DMG. The package contains:

- Electron/Chromium/Node.
- A Next.js standalone production server plus copied `public` and `.next/static` assets.
- Prisma client and migrations.
- A pinned Apple Silicon PostgreSQL runtime built from verified PostgreSQL source during release preparation.
- Course content, prerecorded audio, artwork, licenses, and third-party notices.
- Setup, recovery, server-launcher, database-launcher, and migration code.

PostgreSQL source version and archive checksum are pinned in a machine-readable release manifest. The preparation command builds only the required client/server runtime for macOS arm64 and stages it as unpacked Electron resources. No Homebrew, Docker, Node, Python, or separately installed PostgreSQL is required on the learner's Mac.

The first release is unsigned. Documentation explains macOS right-click → Open and makes no claim that Gatekeeper warnings are avoided. Forge configuration reserves later Developer ID signing and notarization fields for CI secrets without changing runtime code.

### Process model

Electron's main process owns application lifecycle. It acquires the single-instance lock, starts the selected database, runs migration/setup, starts the Next.js standalone server in an Electron utility process, waits for a bounded health check, and only then creates the main window.

The application server binds to `127.0.0.1` on a fixed, reserved port. A fixed origin keeps cookie and WebAuthn behavior stable across launches. If the port is occupied by a process that does not present the expected per-installation bootstrap identity, Electron shows a recovery screen instead of selecting another origin.

The renderer has Node integration disabled, context isolation enabled, sandboxing enabled, and no broad preload bridge. It may load only the fixed local application origin. Navigation, new-window creation, downloads, permission requests, and external-link opening are denied by default and allowed only through narrow validated policies.

Electron shuts down the application utility process and locally owned PostgreSQL process on quit. On startup it detects stale PID/lock state by verifying process identity rather than trusting a PID file alone.

### First-launch setup

Before the application server starts, a packaged local setup window asks the user to select one storage mode.

#### Local on this Mac

- Electron creates a PostgreSQL data directory under `app.getPath("userData")`.
- It generates database and bootstrap credentials with operating-system entropy.
- PostgreSQL binds only to loopback, uses a dynamically selected private database port, and accepts only the generated credentials.
- The data directory and settings are user-readable only.
- Migrations and idempotent content seed run automatically.
- The full application uses a desktop-local profile flow instead of requiring passkeys for data that never leaves the Mac.
- Multiple local profiles may be created and selected. Each profile has independent progress, placement, and study-plan records in the same local database.

Local profile selection is implemented as a desktop-only authentication boundary. The main process passes a per-launch bootstrap secret only to the server process. A narrowly scoped desktop bootstrap endpoint exchanges a validated profile selection for the existing HTTP-only session cookie. The bootstrap endpoint is absent in hosted and remote-account modes, rejects non-loopback requests, applies CSRF/origin checks, and never exposes the bootstrap secret to page JavaScript.

#### My PostgreSQL server

- The setup screen requires a PostgreSQL connection string for a dedicated VerbaLibera database.
- Non-loopback connections require TLS. The UI recommends a least-privilege database role and never accepts a server-wide administrator credential as a requirement.
- The app tests connectivity and shows the migration set before asking for explicit permission to initialize or upgrade the database.
- After approval, it runs the same Prisma migrations and idempotent seed used by hosted deployment.
- The existing passkey account and synchronized-progress behavior remains active.
- The connection string is encrypted with Electron `safeStorage` when encryption is available. If secure storage is unavailable, setup stops and explains the problem rather than saving plaintext credentials.

The connection string is available only to Electron's main/server processes. It is never sent to renderer JavaScript, rendered into HTML, included in diagnostic output, or written into build artifacts.

### Changing storage modes

Storage mode may be changed from a desktop settings surface. A change is validated, saved, and applied only after restart. Local and remote stores are never silently merged.

Before leaving local mode, the app offers a progress export. Import remains the explicit transfer mechanism. Resetting local data creates a timestamped backup, requires the user to type a confirmation phrase, stops the database, and moves the old data directory to a recoverable backup location before creating a new one.

### Upgrades

There is no automatic updater. Installing a newer application bundle preserves `userData`. On first launch of a newer version, Electron backs up local database metadata, applies forward migrations, and starts the app only after migration success. Failed migrations leave the previous data directory and backup intact and show recovery instructions.

Downgrading across a database schema version is unsupported and detected before startup. The app reports the minimum compatible application version rather than attempting a reverse migration.

## Failure handling

Setup and recovery pages use stable error codes with plain-language guidance. They cover:

- Missing or damaged bundled resources.
- PostgreSQL initialization, startup, authentication, or migration failure.
- Invalid, unreachable, non-TLS, or incompatible remote PostgreSQL.
- Occupied fixed application port.
- Corrupt or unreadable settings.
- Interrupted shutdown and stale state.
- Next.js server crash or failed health check.
- Unavailable secure credential storage.
- Portable IndexedDB denial, quota failure, or transaction failure.

Logs live under the Electron user-data directory, rotate by size, omit secrets and learner answers, and identify the failing lifecycle stage. The recovery UI offers a button to reveal the log file in Finder but does not expose arbitrary filesystem access to the renderer.

## Security and privacy

- Electron displays only bundled application code from its fixed loopback origin.
- Renderer sandboxing, context isolation, normal web security, a restrictive CSP, and permission denial remain enabled.
- IPC/preload APIs use explicit methods with schema-validated arguments and verify the sender.
- Remote navigation and code execution are prohibited.
- External links, if enabled, require an `https:` URL from an explicit hostname allowlist and open in the system browser.
- Database URLs, generated secrets, session material, and learner answers are redacted from logs.
- Local mode opens no listener beyond loopback and makes no outbound network request during normal use.
- Remote mode connects only to the user-configured PostgreSQL endpoint; no VerbaLibera-hosted service is required.
- Portable mode makes no network request and contains no privileged native bridge.

## Build and release workflow

The root package scripts expose separate reproducible entry points for portable building, Electron development, PostgreSQL runtime preparation, Electron packaging, artifact verification, and the combined macOS release.

A macOS arm64 GitHub Actions workflow:

1. Installs locked JavaScript dependencies.
2. Runs existing tests, content validation, lint, type-check, and production build.
3. Downloads the pinned PostgreSQL source archive and verifies its SHA-256 checksum.
4. Builds and stages the arm64 PostgreSQL runtime.
5. Builds the portable HTML and Electron DMG.
6. Runs artifact verification and smoke tests.
7. Generates checksums.
8. Uploads the four deliverables as workflow artifacts.

The workflow has no signing credentials in version one. A later signing job may consume Developer ID and notarization secrets without altering artifact contents before the signing/package stage.

## Testing and acceptance criteria

### Shared core

- Hosted course-workspace tests remain green.
- Capability tests prove portable mode cannot render or call account, synchronization, service-worker, or hosted navigation features.
- Deterministic grading and progress projections produce identical results across hosted, Electron, and portable adapters.

### Portable artifact

- Builder tests reject missing, modified, duplicated, absolute-path, and external assets.
- The generated file contains no unresolved file references or development paths.
- Chromium and WebKit open the file with all network access blocked.
- Each browser can select a course, start a lesson, play embedded audio, record a result, reload, and recover that result when IndexedDB is supported.
- Forced storage failure produces the temporary-progress warning and a valid export.
- Export/import round-trips practice events.
- The artifact checksum matches its bytes.

### Electron lifecycle

- Unit tests cover configuration parsing, secret redaction, fixed-origin enforcement, URL/window filtering, process supervision, health-check timeouts, stale-state detection, and storage-mode switching.
- Main-process tests use injected process and filesystem boundaries; they do not launch real services for branch-level error tests.
- Playwright's Electron support launches the packaged application with renderer sandboxing enabled.
- The app completes first launch, local profile creation, placement, study-plan creation, lesson completion, quit, relaunch, and progress recovery.
- Local PostgreSQL accepts the generated credential on loopback and rejects an unrelated credential.
- Remote-mode integration tests run against a disposable PostgreSQL database, require explicit migration approval, and verify existing passkey/account APIs.
- Upgrade tests migrate a copy of the previous fixture database and preserve progress.
- A server crash produces the recovery UI and cleanly reaps locally owned processes.
- The DMG installs and launches on a clean Apple Silicon Mac after the documented unsigned-app override.
- The packaged app runs with networking disabled in local mode.
- Neither artifact contains secrets, developer-machine absolute paths, unexpected external URLs, or unlicensed runtime files.
- DMG and HTML checksum files match their artifacts.

## Documentation

The README gains a learner-focused installation section covering:

- Portable HTML download and limitations.
- Electron DMG installation and the unsigned Gatekeeper override.
- Local versus remote storage choice.
- Remote database TLS, dedicated-role, migration, and backup expectations.
- Manual upgrades, local-data location, export/import, reset recovery, and uninstall behavior.
- The absence of bundled speech recognition and semantic grading.

Third-party notices identify Electron, Chromium, Node, PostgreSQL, and all packaged dependencies and media under their applicable licenses.
