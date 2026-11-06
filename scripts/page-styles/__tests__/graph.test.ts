// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { staticImports } from "../graph.ts";

let root: string;
const write = (file: string, code: string) => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), code);
};
const names = (files: string[]) => files.map((file) => file.slice(root.length + 1)).sort();

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "page-styles-graph-"));
  write(
    "src/page.tsx",
    [
      'import { Card } from "./card";',
      'import "./side-effect";',
      'export * from "./reexported";',
      'import type { Shape } from "./types-only";',
      'export type { Other } from "./types-reexported";',
      'const lazy = () => import("./lazy");',
      'import { useState } from "react";',
    ].join("\n"),
  );
  write("src/card.tsx", 'import { tone } from "./tone";\nexport const Card = () => tone;');
  write("src/tone.ts", 'import { Card } from "./card";\nexport const tone = "warm";');
  write("src/side-effect.ts", "");
  write("src/reexported.ts", "export const x = 1;");
  write("src/types-only.ts", "export type Shape = 1;");
  write("src/types-reexported.ts", "export type Other = 1;");
  write("src/lazy.tsx", 'import "./lazy-only";');
  write("src/lazy-only.ts", "");
  write("outside.ts", "");
  write("src/reaches-out.ts", 'import "../outside";');
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("staticImports", () => {
  it("follows the entry's static imports through every file they import, cycles included", () => {
    expect(names(staticImports([join(root, "src/page.tsx")], join(root, "src")))).toEqual([
      "src/card.tsx",
      "src/page.tsx",
      "src/reexported.ts",
      "src/side-effect.ts",
      "src/tone.ts",
    ]);
  });

  it("leaves out what is only imported lazily or for its types, and packages", () => {
    const files = names(staticImports([join(root, "src/page.tsx")], join(root, "src")));
    expect(files).not.toContain("src/lazy.tsx");
    expect(files).not.toContain("src/lazy-only.ts");
    expect(files).not.toContain("src/types-only.ts");
    expect(files).not.toContain("src/types-reexported.ts");
  });

  it("starts from every entry given, and keeps to the folder it is given", () => {
    expect(
      names(staticImports([join(root, "src/lazy.tsx"), join(root, "src/reaches-out.ts")], join(root, "src"))),
    ).toEqual(["src/lazy-only.ts", "src/lazy.tsx", "src/reaches-out.ts"]);
  });
});
