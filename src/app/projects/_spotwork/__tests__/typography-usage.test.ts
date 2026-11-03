import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIR = join(__dirname, "..");
const SOURCES = readdirSync(DIR).filter((file) => /\.tsx?$/.test(file) && file !== "theme.ts");

describe("Typography", () => {
  it("is the only place the app and its design system set a text style", () => {
    const strays = SOURCES.flatMap((file) =>
      readFileSync(join(DIR, file), "utf8")
        .split("\n")
        .map((line, i) => ({ at: `${file}:${i + 1}`, line }))
        .filter(({ line }) => /var\(--sw-text-/.test(line))
        // Typography's own styles, and the code view's mono face at Body's size.
        .filter(({ at, line }) => !(at.startsWith("ui.tsx:") && line.includes("[data-typography=")))
        .filter(({ at, line }) => !(at.startsWith("ds-story.tsx:") && line.trim() === 'font: "var(--sw-text-style-3)",'))
        .map(({ at }) => at),
    );
    expect(strays).toEqual([]);
  });
});
