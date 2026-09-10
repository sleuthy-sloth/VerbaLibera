import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

import { collectPortableContent } from "./content";

const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src blob: data:; media-src blob: data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

export async function buildPortableHtml(root: string): Promise<string> {
  const content = collectPortableContent(root);
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

async function main() {
  const root = process.cwd();
  const output = join(root, "dist/portable/VerbaLibera-Portable.html");
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, await buildPortableHtml(root));
  console.log(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
