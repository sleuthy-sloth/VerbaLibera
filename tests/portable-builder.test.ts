// @vitest-environment node

import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  assertPortableAssetPath,
  collectPortableContent,
} from "../scripts/portable/content";
import { buildPortableHtml } from "../scripts/portable/build";
import {
  auditPortableHtml,
  verifyPortableArtifact,
} from "../scripts/portable/verify";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("portable content collection", () => {
  it("collects the five validated foundation packs", () => {
    const content = collectPortableContent(process.cwd());

    expect(Object.keys(content.packs)).toEqual([
      "french",
      "german",
      "italian",
      "portuguese",
      "spanish",
    ]);
    expect(Object.keys(content.assets)).toHaveLength(60);
  });

  it.each([
    "https://evil.example/a.js",
    "//evil.example/a.wav",
    "/Users/name/dev/a.wav",
    "../escape.wav",
    "/audio/../escape.wav",
    "C:\\audio\\clip.wav",
  ])("rejects unsafe asset reference %s", (value) => {
    expect(() => assertPortableAssetPath(value)).toThrow(
      /Unsafe portable asset path/,
    );
  });

  it("rejects media whose bytes differ from its manifest digest", () => {
    const root = mkdtempSync(join(tmpdir(), "verbalibera-portable-"));
    temporaryRoots.push(root);
    const manifest = JSON.parse(
      readFileSync("courses/italian/manifest.json", "utf8"),
    );
    const manifestPath = join(root, "courses/italian/manifest.json");
    mkdirSync(dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify(manifest));
    for (const media of manifest.media) {
      const target = join(root, "public", media.url.slice(1));
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(process.cwd(), "public", media.url.slice(1)), target);
    }
    writeFileSync(
      join(root, "public", manifest.media[0].url.slice(1)),
      "changed bytes",
    );

    expect(() => collectPortableContent(root)).toThrow(/digest/i);
  });
});

describe("portable HTML build", () => {
  it("inlines code, styles, five courses, and restrictive network policy", async () => {
    const html = await buildPortableHtml(process.cwd());

    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("Italian foundations");
    expect(html).toContain("German foundations");
    expect(html).toContain(".lesson-player");
    expect(html).toContain(".lp-layout");
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+href=/i);
    expect(html).not.toContain("/api/course-progress");
    expect(() => auditPortableHtml(html)).not.toThrow();
  });

  it("rejects executable external resources", () => {
    expect(() =>
      auditPortableHtml(
        '<!doctype html><meta http-equiv="Content-Security-Policy" content="connect-src \'none\'"><script src="https://evil.example/app.js"></script>',
      ),
    ).toThrow(/external/i);
  });

  it("writes a conventional checksum for the exact artifact bytes", () => {
    const root = mkdtempSync(join(tmpdir(), "verbalibera-checksum-"));
    temporaryRoots.push(root);
    const artifact = join(root, "VerbaLibera-Portable.html");
    writeFileSync(artifact, "portable bytes");

    const digest = verifyPortableArtifact(artifact, { audit: false });

    expect(
      readFileSync(`${artifact}.sha256`, "utf8"),
    ).toBe(`${digest}  VerbaLibera-Portable.html\n`);
  });
});
