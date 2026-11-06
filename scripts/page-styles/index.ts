// Writes each page's stylesheet beside it (`page.styles.css`, `not-found.styles.css`), which it imports.
//   node scripts/page-styles/index.ts        For a build: each holds only what its first load uses, and the whole
//                                            site's goes to public/styles, for what loads later.
//   node scripts/page-styles/index.ts --dev  For dev and tests: all empty, as Panda's PostCSS plugin fills
//                                            globals.css with the whole stylesheet.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { segmentEntries } from "./entries.ts";
import { staticImports } from "./graph.ts";
import { loadSheets } from "./sheets.ts";

const cwd = process.cwd();
const app = join(cwd, "src/app");
const publicDir = join(cwd, "public/styles");
const manifest = join(cwd, "styled-system/site-styles.json");
const entries = segmentEntries(app);

const unimported = entries.filter(({ entry, sheet }) => !readFileSync(entry, "utf8").includes(`import "./${basename(sheet)}";`));
if (unimported.length) {
  const list = unimported.map(({ entry, sheet }) => `  ${relative(cwd, entry)}: import "./${basename(sheet)}";`);
  throw new Error(`Each page imports its stylesheet:\n${list.join("\n")}`);
}

rmSync(publicDir, { recursive: true, force: true });
rmSync(manifest, { force: true });

if (process.argv.includes("--dev")) {
  for (const { sheet } of entries) writeFileSync(sheet, "");
} else {
  const sheets = await loadSheets(cwd);
  for (const { files, sheet } of entries) writeFileSync(sheet, sheets.css(staticImports(files, join(cwd, "src"))));

  const site = sheets.css(sheets.files, { minify: true });
  const name = `site.${createHash("sha256").update(site).digest("hex").slice(0, 12)}.css`;
  mkdirSync(publicDir, { recursive: true });
  writeFileSync(join(publicDir, name), site);
  writeFileSync(manifest, JSON.stringify({ href: `/styles/${name}` }));
}
