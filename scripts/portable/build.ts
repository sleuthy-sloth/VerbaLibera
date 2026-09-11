import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

import { collectPortableContent, type PortableBuildOptions } from "./content";

const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob: data:; media-src blob: data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

/** Where the default artifact lives; the audio build gets its own name. */
export const DEFAULT_PORTABLE_OUTPUT = "dist/portable/VerbaLibera-Portable.html";
export const AUDIO_PORTABLE_OUTPUT = "dist/portable/VerbaLibera-Portable-audio.html";

export async function buildPortableHtml(
  root: string,
  options: PortableBuildOptions = {},
): Promise<string> {
  const content = collectPortableContent(root, options);
  const result = await build({
    absWorkingDir: root,
    entryPoints: ["src/features/course-pack/portable-entry.tsx"],
    bundle: true,
    minify: true,
    write: false,
    outfile: "portable.js",
    platform: "browser",
    format: "iife",
    target: ["safari15"],
    // Same reason as the offline bundle: the Listen components import through
    // the app's `@/` alias and this bundle has no Next resolver.
    alias: { "@": join(root, "src") },
    define: { "process.env.NODE_ENV": '"production"' },
    legalComments: "eof",
    plugins: [
      {
        name: "portable-content",
        setup(pluginBuild) {
          pluginBuild.onResolve(
            { filter: /^virtual:portable-content$/ },
            () => ({ path: "portable-content", namespace: "portable" }),
          );
          pluginBuild.onLoad(
            { filter: /.*/, namespace: "portable" },
            () => ({
              contents: `export default ${JSON.stringify(content)};`,
              loader: "js",
            }),
          );
        },
      },
    ],
  });
  const script = result.outputFiles.find(file => file.path.endsWith(".js"))!.text.replace(/<\/script/gi, "<\\/script");
  const style = (readFileSync(
    join(root, "src/features/course-pack/study.css"),
    "utf8",
  ) + "\n" + result.outputFiles.filter(file => file.path.endsWith(".css")).map(file => file.text).join("\n")).replace(/<\/style/gi, "<\\/style");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#fbf4e6"><meta http-equiv="Content-Security-Policy" content="${CSP}"><title>VerbaLibera Portable</title><style>${style}</style></head><body><div id="study-root"><p>Opening your courses…</p></div><script>${script}</script></body></html>`;
}

/**
 * `--with-listen` embeds the long-form audio lessons (one course per slug, or
 * every course when the flag is bare). It is off by default because a track is
 * about 5-6 MB and base64 adds a third on top: the audio in a five-course file
 * is bigger than everything else in it. Without it the Listen view still lists
 * the tracks and says which ones this file cannot play.
 */
function parseArgs(argv: readonly string[]): { withListen: readonly string[] | "all"; output: string } {
  const flag = argv.find((arg) => arg === "--with-listen" || arg.startsWith("--with-listen="));
  if (!flag) return { withListen: [], output: DEFAULT_PORTABLE_OUTPUT };
  const value = flag.includes("=") ? flag.slice(flag.indexOf("=") + 1) : "";
  const slugs = value
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);
  return {
    withListen: slugs.length > 0 ? slugs : "all",
    output: AUDIO_PORTABLE_OUTPUT,
  };
}

async function main() {
  const root = process.cwd();
  const { withListen, output } = parseArgs(process.argv.slice(2));
  const coursesRoot = join(root, "courses");
  const resolved: PortableBuildOptions =
    withListen === "all"
      ? {
          withListen: readdirSync(coursesRoot, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name),
        }
      : { withListen };
  const html = await buildPortableHtml(root, resolved);
  const target = join(root, output);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
  const mb = (Buffer.byteLength(html) / (1024 * 1024)).toFixed(1);
  console.log(`${target} (${mb} MB${resolved.withListen?.length ? `, audio: ${resolved.withListen.join(", ")}` : ", no audio lessons"})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
