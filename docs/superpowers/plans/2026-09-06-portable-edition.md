# VerbaLibera Portable Edition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single self-contained HTML file that runs all five foundation courses offline with deterministic grading, prerecorded media, durable progress when IndexedDB is available, and JSON import/export.

**Architecture:** Refactor the existing course workspace to consume an explicit `CourseEnvironment` boundary. The hosted adapter retains the current PWA/account behavior, while the portable adapter serves validated embedded packs and blob-backed media with a durable-or-memory practice store. A Node build script assembles and audits the single HTML artifact.

**Tech Stack:** React 19, TypeScript 5, esbuild 0.28, Zod 4, IndexedDB, Vitest 4, Playwright 1.62.

**Spec:** `docs/superpowers/specs/2026-09-06-macos-electron-and-portable-distribution-design.md`

## Global Constraints

- The artifact is `dist/portable/VerbaLibera-Portable.html` plus a conventional two-column `.sha256` file.
- It contains French, German, Italian, Portuguese, and Spanish foundation packs and every referenced prerecorded media asset.
- It performs no network request and loads no external executable script, stylesheet, font, image, audio, or API.
- Account, synchronization, hosted navigation, and service-worker installation capabilities are absent in portable mode.
- Deterministic answer evaluation and progress projection remain shared with hosted mode.
- IndexedDB success must be proven before claiming durability; failures fall back to memory with a persistent warning and working export.
- Generated release artifacts remain untracked.

---

### Task 1: Environment and Practice-Store Contracts

**Files:**
- Create: `src/features/course-pack/environment.ts`
- Create: `src/features/course-pack/hosted-environment.ts`
- Modify: `src/features/course-pack/storage.ts`
- Test: `tests/course-environment.test.ts`

**Interfaces:**
- Consumes: `CoursePack`, `PracticeEvent`, `readEvents`, `storeEvents`, `installPack`, `installedPack`.
- Produces: `PracticeStore`, `CourseCapabilities`, `CourseEnvironment`, and `createHostedEnvironment()`.

- [ ] **Step 1: Write a failing contract test**

```ts
import { describe, expect, it } from "vitest";
import { createHostedEnvironment } from "@/features/course-pack/hosted-environment";

describe("hosted course environment", () => {
  it("declares hosted-only capabilities", () => {
    expect(createHostedEnvironment().capabilities).toEqual({
      accounts: true,
      synchronization: true,
      offlineInstall: true,
      hostedNavigation: true,
    });
  });
});
```

- [ ] **Step 2: Run the test and confirm the missing module failure**

Run: `npx vitest run tests/course-environment.test.ts`

Expected: FAIL because `hosted-environment.ts` does not exist.

- [ ] **Step 3: Add the focused contracts and hosted adapter**

```ts
export interface PracticeStore {
  getDurability(): "durable" | "temporary";
  subscribeDurability(listener: (value: "durable" | "temporary") => void): () => void;
  read(scope?: string | null): Promise<PracticeEvent[]>;
  write(events: PracticeEvent[], scope?: string | null): Promise<void>;
}

export interface CourseCapabilities {
  accounts: boolean;
  synchronization: boolean;
  offlineInstall: boolean;
  hostedNavigation: boolean;
}

export interface CourseEnvironment {
  capabilities: CourseCapabilities;
  practice: PracticeStore;
  loadPack(language: string): Promise<CoursePack>;
  resolveMedia(url: string): string;
  install?(pack: CoursePack, language: string): Promise<void>;
  isInstalled?(language: string): Promise<boolean>;
}
```

Implement `createHostedEnvironment()` with `fetch('/packs/...')`, identity media URLs, the current IndexedDB functions, and existing cache installation functions. Keep the existing exported storage functions for compatibility.

- [ ] **Step 4: Run focused and existing storage tests**

Run: `npx vitest run tests/course-environment.test.ts tests/course-storage.test.ts tests/course-sync.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the contract boundary**

```bash
git add src/features/course-pack/environment.ts src/features/course-pack/hosted-environment.ts src/features/course-pack/storage.ts tests/course-environment.test.ts
git commit -m "refactor: add course environment boundary"
```

### Task 2: Course Workspace Capability Refactor

**Files:**
- Modify: `src/features/course-pack/CourseWorkspace.tsx`
- Modify: `src/features/course-pack/ExerciseView.tsx`
- Modify: `src/features/course-pack/offline-entry.tsx`
- Test: `tests/CourseExercise.test.tsx`
- Test: `tests/course-environment.test.ts`

**Interfaces:**
- Consumes: `CourseEnvironment` and `createHostedEnvironment()` from Task 1.
- Produces: `CourseWorkspaceProps` with `environment?: CourseEnvironment` and portable-safe rendering driven solely by capabilities.

- [ ] **Step 1: Add failing portable-capability tests**

```tsx
it("omits account, install, and hosted navigation controls", async () => {
  render(<CourseWorkspace environment={portableFixtureEnvironment} />);
  await screen.findByRole("heading", { name: /Italian foundations/i });
  expect(screen.queryByText(/Account practice/i)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Download/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /Daily path/i })).not.toBeInTheDocument();
});

it("passes resolved blob media URLs to audio", async () => {
  render(<CourseWorkspace environment={portableFixtureEnvironment} />);
  const audio = await screen.findByLabelText("Model audio");
  expect(audio).toHaveAttribute("src", "blob:portable-model");
});
```

- [ ] **Step 2: Run the tests and confirm capability leaks**

Run: `npx vitest run tests/course-environment.test.ts tests/CourseExercise.test.tsx`

Expected: FAIL because `CourseWorkspace` does not accept an environment and still renders hosted controls.

- [ ] **Step 3: Inject the environment and gate capabilities**

```tsx
export type CourseWorkspaceProps = {
  initialLanguage?: string;
  environment?: CourseEnvironment;
};

export function CourseWorkspace({
  initialLanguage = "italian",
  environment = createHostedEnvironment(),
}: CourseWorkspaceProps) {
  return environment.capabilities.accounts
    ? <HostedScopedWorkspace initialLanguage={initialLanguage} environment={environment} />
    : <ScopedWorkspace initialLanguage={initialLanguage} scope={null} selectScope={() => {}} environment={environment} />;
}
```

Replace direct pack fetches, storage calls, install calls, and media URLs with environment methods. Render `AccountPractice`, dashboard links, synchronization, and download controls only when their corresponding capability is true. Preserve hosted copy and behavior exactly.

- [ ] **Step 4: Run course component and storage regression tests**

Run: `npx vitest run tests/course-environment.test.ts tests/CourseExercise.test.tsx tests/course-storage.test.ts tests/course-sync.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the workspace refactor**

```bash
git add src/features/course-pack/CourseWorkspace.tsx src/features/course-pack/ExerciseView.tsx src/features/course-pack/offline-entry.tsx tests/CourseExercise.test.tsx tests/course-environment.test.ts
git commit -m "refactor: make course workspace environment aware"
```

### Task 3: Portable Content Compiler

**Files:**
- Create: `scripts/portable/content.ts`
- Test: `tests/portable-builder.test.ts`

**Interfaces:**
- Consumes: the five `courses/*/manifest.json` files and files under `public/` referenced by pack media and banner mappings.
- Produces: `collectPortableContent(root): PortableContent` and `assertPortableAssetPath(value): void`.

- [ ] **Step 1: Write failing compiler validation tests**

```ts
it("collects exactly five unique validated packs", () => {
  const content = collectPortableContent(process.cwd());
  expect(Object.keys(content.packs).sort()).toEqual(["french", "german", "italian", "portuguese", "spanish"]);
});

it("rejects changed media bytes", () => {
  const fixture = portableFixture({ mediaSha256: "0".repeat(64) });
  expect(() => collectPortableContent(fixture.root)).toThrow(/digest/i);
});

it.each(["https://evil.example/a.js", "/Users/name/dev/a.wav", "../escape.wav"])(
  "rejects unsafe asset reference %s",
  (url) => expect(() => assertPortableAssetPath(url)).toThrow(),
);
```

- [ ] **Step 2: Run the compiler test and confirm missing exports**

Run: `npx vitest run tests/portable-builder.test.ts`

Expected: FAIL because the portable compiler does not exist.

- [ ] **Step 3: Implement deterministic content collection**

```ts
export type EmbeddedAsset = { mime: string; sha256: string; base64: string };
export type PortableContent = {
  packs: Record<string, CoursePack>;
  assets: Record<string, EmbeddedAsset>;
};

export function assertPortableAssetPath(value: string): void {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("..") || value.includes(":") || value.includes("\\")) {
    throw new Error(`Unsafe portable asset path: ${value}`);
  }
}
```

Sort languages and asset keys, validate every pack with `validatePack`, reject duplicate IDs, hash bytes with SHA-256, include all course banners referenced by the workspace, and fail on a manifest mismatch.

- [ ] **Step 4: Run content compiler tests**

Run: `npx vitest run tests/portable-builder.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the compiler**

```bash
git add scripts/portable/content.ts tests/portable-builder.test.ts
git commit -m "build: compile portable course content"
```

### Task 4: Portable Runtime and Storage Fallback

**Files:**
- Create: `src/features/course-pack/portable-environment.ts`
- Create: `src/features/course-pack/portable-entry.tsx`
- Create: `src/features/course-pack/portable-content.d.ts`
- Create: `scripts/portable/build.ts`
- Modify: `src/features/course-pack/CourseWorkspace.tsx`
- Modify: `package.json`
- Modify: `.gitignore`
- Test: `tests/portable-environment.test.ts`
- Test: `tests/course-storage.test.ts`

**Interfaces:**
- Consumes: `PortableContent`, `CourseEnvironment`, and `PracticeStore`.
- Produces: `createPortableEnvironment(content)`, blob URL materialization, `probePortableStore()`, and a durable/temporary status surfaced in the workspace.

- [ ] **Step 1: Write failing durable and temporary storage tests**

```ts
it("falls back to memory when the IndexedDB probe fails", async () => {
  const store = await probePortableStore({ indexedDB: failingIndexedDb });
  expect(store.getDurability()).toBe("temporary");
  await store.write([event]);
  expect(await store.read()).toEqual([event]);
});

it("reports writes only after the transaction completes", async () => {
  const store = await probePortableStore({ indexedDB: quotaFailingIndexedDb });
  await expect(store.write([event])).rejects.toThrow(/not saved/i);
});
```

- [ ] **Step 2: Run the tests and confirm the runtime is absent**

Run: `npx vitest run tests/portable-environment.test.ts tests/course-storage.test.ts`

Expected: FAIL because `portable-environment.ts` does not exist.

- [ ] **Step 3: Implement portable pack/media and storage behavior**

```ts
export async function createPortableEnvironment(content: PortableContent): Promise<CourseEnvironment> {
  const practice = await probePortableStore({ indexedDB: globalThis.indexedDB });
  const urls = new Map(Object.entries(content.assets).map(([path, asset]) => [
    path,
    URL.createObjectURL(new Blob([decodeBase64(asset.base64)], { type: asset.mime })),
  ]));
  return {
    capabilities: { accounts: false, synchronization: false, offlineInstall: false, hostedNavigation: false },
    practice,
    loadPack: async language => validatePack(structuredClone(content.packs[language])),
    resolveMedia: path => urls.get(path) ?? (() => { throw new Error(`Missing embedded asset: ${path}`); })(),
  };
}
```

The IndexedDB probe must create, write, read, and delete a sentinel in one dedicated database before returning `durable`. On open or transaction failure return a memory-backed store. If a later durable write fails, merge the previously readable events into memory, publish `temporary` to durability subscribers, reject that attempted save as unsaved, and keep export enabled.

- [ ] **Step 4: Mount the portable environment and warning**

In `portable-entry.tsx`, import `virtual:portable-content`, await `createPortableEnvironment`, choose a catalog-valid language from the query string, and mount `CourseWorkspace`. Add `role="alert"` copy: `Progress is temporary in this browser. Export a backup before closing this file.` whenever durability is temporary.

- [ ] **Step 5: Assemble the single CSP-protected artifact**

Use an esbuild virtual module named `virtual:portable-content`, bundle `portable-entry.tsx` to memory, inline `study.css`, and embed both into this document shape:

```html
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob: data:; media-src blob: data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><title>VerbaLibera Portable</title><style>/* bundled CSS */</style></head><body><div id="study-root"><p>Opening your courses…</p></div><script>/* bundled JS */</script></body></html>
```

Add `portable:build` to `package.json`, ignore `dist/`, and build `dist/portable/VerbaLibera-Portable.html` deterministically.

- [ ] **Step 6: Run runtime, workspace, grading, and artifact regressions**

Run: `npx vitest run tests/portable-environment.test.ts tests/course-environment.test.ts tests/course-storage.test.ts tests/course-pack.test.ts tests/answer-checking.test.ts tests/portable-builder.test.ts && npm run portable:build`

Expected: PASS and `dist/portable/VerbaLibera-Portable.html` exists.

- [ ] **Step 7: Commit the portable runtime**

```bash
git add src/features/course-pack/portable-environment.ts src/features/course-pack/portable-entry.tsx src/features/course-pack/portable-content.d.ts src/features/course-pack/CourseWorkspace.tsx scripts/portable/build.ts package.json package-lock.json .gitignore tests/portable-environment.test.ts tests/course-storage.test.ts
git commit -m "feat: run course workspace from one portable file"
```

### Task 5: Artifact Audit and Offline Browser Smoke Tests

**Files:**
- Create: `scripts/portable/verify.ts`
- Create: `playwright.portable.config.ts`
- Create: `tests/e2e/portable.spec.ts`
- Modify: `package.json`
- Test: `tests/portable-builder.test.ts`

**Interfaces:**
- Consumes: the built portable HTML artifact.
- Produces: `verifyPortableArtifact(path)`, the `.sha256` file, and Chromium/WebKit `file://` smoke coverage.

- [ ] **Step 1: Add failing artifact-audit tests**

```ts
it("rejects network-bearing portable output", () => {
  expect(() => auditPortableHtml('<script src="https://example.com/x.js"></script>')).toThrow(/external/i);
});

it("accepts a single inline document with no developer paths", () => {
  expect(() => auditPortableHtml(builtHtml)).not.toThrow();
  expect(builtHtml).not.toMatch(/\/Users\/|localhost|127\.0\.0\.1|<link[^>]+href=/);
});
```

- [ ] **Step 2: Run the audit test and confirm the missing verifier**

Run: `npx vitest run tests/portable-builder.test.ts`

Expected: FAIL because `auditPortableHtml` is not implemented.

- [ ] **Step 3: Implement byte-level verification and checksums**

Reject external URLs, absolute developer paths, unresolved `/packs/`, `/audio/`, `/brand/`, script `src`, stylesheet `href`, duplicate pack IDs, and missing CSP directives. Hash the final bytes and write:

```text
<64 lowercase hex characters>  VerbaLibera-Portable.html
```

- [ ] **Step 4: Add a real `file://` lesson flow**

```ts
test("completes and reloads portable practice without network", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));
  await page.goto(pathToFileURL(artifact).href);
  await page.getByRole("button", { name: /Open next lesson/i }).click();
  await page.getByRole("button", { name: /Begin practice/i }).click();
  await answerFirstAuthoredExercise(page);
  await page.reload();
  await expect(page.getByText(/1 practice result/i)).toBeVisible();
  expect(requests.filter(url => /^https?:/.test(url))).toEqual([]);
});
```

Run the same spec in Chromium and WebKit. Add a second test that forces IndexedDB failure, verifies the warning, saves in memory, and downloads a valid format-1 export.

- [ ] **Step 5: Run portable verification**

Run: `npm run portable:build && npm run portable:verify && npx playwright test --config playwright.portable.config.ts`

Expected: both projects PASS and the checksum matches `shasum -a 256`.

- [ ] **Step 6: Commit portable acceptance coverage**

```bash
git add scripts/portable/verify.ts playwright.portable.config.ts tests/e2e/portable.spec.ts tests/portable-builder.test.ts package.json package-lock.json
git commit -m "test: verify portable offline artifact"
```

### Task 6: Portable Documentation and Full Regression Gate

**Files:**
- Modify: `README.md`
- Create: `THIRD_PARTY_NOTICES.md`
- Modify: `.github/workflows/ci.yml`
- Modify: `tests/ci-workflow.test.ts`
- Test: `tests/runtime-model-independence.test.ts`

**Interfaces:**
- Consumes: `npm run portable:build`, `portable:verify`, and portable Playwright config.
- Produces: learner installation guidance and CI enforcement for the portable deliverable.

- [ ] **Step 1: Add failing documentation/workflow assertions**

```ts
expect(readme).toMatch(/VerbaLibera-Portable\.html/);
expect(readme).toMatch(/progress is stored by the browser/i);
expect(workflow).toMatch(/npm run portable:verify/);
expect(notices).toMatch(/Electron|React|PostgreSQL/);
```

- [ ] **Step 2: Run the focused tests and confirm missing documentation**

Run: `npx vitest run tests/ci-workflow.test.ts tests/runtime-model-independence.test.ts`

Expected: FAIL on portable workflow and notice assertions.

- [ ] **Step 3: Document the portable download accurately**

Explain double-click launch, five included courses, no server/account/sync/voice model, browser-owned progress, the temporary-storage warning, export/import, checksum verification with `shasum -a 256 -c VerbaLibera-Portable.html.sha256`, and that clearing browser data can remove progress.

- [ ] **Step 4: Add portable build verification to CI**

After unit/type/content checks, run portable build and verify; install Chromium and WebKit for the portable config; upload only the generated HTML and checksum from `dist/portable/`.

- [ ] **Step 5: Run the complete portable gate**

Run: `npm run lint && npm run typecheck && npm test && npm run content:validate && npm run portable:build && npm run portable:verify && npx playwright test --config playwright.portable.config.ts`

Expected: zero command failures; existing lint warnings may remain but no lint errors.

- [ ] **Step 6: Commit the portable release surface**

```bash
git add README.md THIRD_PARTY_NOTICES.md .github/workflows/ci.yml tests/ci-workflow.test.ts tests/runtime-model-independence.test.ts
git commit -m "docs: publish portable edition workflow"
```
