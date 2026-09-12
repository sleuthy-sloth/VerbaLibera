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
import { SCENE_URLS } from "@/features/course-pack/scenes";
import { PLAYER_ART_URLS } from "@/features/listen/player-art";

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
    // Every bundle asset is either a pack's own media, one course banner per pack,
    // or one picture per situation. Stated as that relationship rather than a bare
    // total: the offline edition is a single file under `img-src blob: data:`, so a
    // banner the collector forgets cannot load at all — German was missing from the
    // hand-written banner list and a bare count could not tell you which.
    for (const slug of Object.keys(content.packs))
      expect(content.assets[`/brand/courses/${slug}.jpg`]).toBeDefined();
    const mediaCount = Object.values(content.packs).reduce(
      (total, pack) => total + pack.media.length,
      0,
    );
    // The scenes are derived from `SCENE_URLS`, not counted by hand, so this stays
    // true when one is added to the app.
    for (const url of SCENE_URLS) expect(content.assets[url]).toBeDefined();
    // The player's own artwork travels for the same reason and is derived the same
    // way: the Listen view renders in the single file, so the cover it draws has to
    // be in there too.
    for (const url of PLAYER_ART_URLS) expect(content.assets[url]).toBeDefined();
    expect(Object.keys(content.assets)).toHaveLength(
      mediaCount +
        Object.keys(content.packs).length +
        SCENE_URLS.length +
        PLAYER_ART_URLS.length,
    );
    // No audio lessons by default: one track is ~5 MB and base64 adds a third,
    // so embedding is a decision the builder makes, not a default it inherits.
    expect(content.listen).toEqual([]);
  });

  it("embeds a course's audio lessons only when the build asks for them", () => {
    const defaultContent = collectPortableContent(process.cwd());
    const content = collectPortableContent(process.cwd(), { withListen: ["french"] });

    expect(content.listen).toHaveLength(1);
    const track = content.listen[0];
    expect(track.courseSlug).toBe("french");
    const embedded = content.assets[track.audioUrl];
    expect(embedded).toBeDefined();
    expect(embedded.sha256).toBe(track.sha256);
    expect(embedded.mime).toBe("audio/mpeg");
    // The embedded bytes are the file that ships, to the byte.
    const measured = readFileSync(join(process.cwd(), "public", track.audioUrl.slice(1)));
    expect(Buffer.from(embedded.base64, "base64").equals(measured)).toBe(true);
    // And nothing else came along: the other four courses' tracks stay out.
    expect(Object.keys(content.assets)).toHaveLength(
      Object.keys(defaultContent.assets).length + 1,
    );
  });

  it("the audio build is bigger by exactly the encoded track, and both artifacts still pass the audit", async () => {
    const silent = await buildPortableHtml(process.cwd());
    const withAudio = await buildPortableHtml(process.cwd(), { withListen: ["french"] });
    const track = collectPortableContent(process.cwd(), { withListen: ["french"] }).listen[0];
    // Base64 is 4 bytes per 3, so the artifact grows by about a third of the mp3.
    const delta = Buffer.byteLength(withAudio) - Buffer.byteLength(silent);
    expect(delta).toBeGreaterThan(track.bytes);
    expect(delta).toBeLessThan(track.bytes * 1.4);
    auditPortableHtml(withAudio);
    auditPortableHtml(silent);
    // The point of the choice: the default file does not carry the audio at all.
    // Checked on the payload, not the digest — the catalog of measurements is
    // bundled into both files (it is what lets Listen say what exists and what
    // this file cannot play), but only the audio build carries the recording.
    const measured = readFileSync(join(process.cwd(), "public", track.audioUrl.slice(1)));
    const payload = measured.toString("base64").slice(0, 400);
    expect(silent).not.toContain(payload);
    expect(withAudio).toContain(payload);
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
