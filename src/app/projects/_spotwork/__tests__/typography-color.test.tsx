import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Typography, glyph } from "../ui";

afterEach(cleanup);

const DIR = join(__dirname, "..");

/** Each `<Typography …>` opening tag in `source`, braces and arrows inside it kept whole. */
function typographyTags(source: string) {
  return [...source.matchAll(/<Typography\b/g)].map(({ index }) => {
    let depth = 0;
    let at = index!;
    for (; at < source.length; at++) {
      const char = source[at];
      if (char === "{") depth++;
      else if (char === "}") depth--;
      else if (char === ">" && depth === 0 && source[at - 1] !== "=") break;
    }
    return source.slice(index, at + 1);
  });
}

describe("Typography's color", () => {
  it("colours its text in the glyph colour it names, and Default's in none", () => {
    render(
      <>
        <Typography variant="body" color="subdued">
          Subdued
        </Typography>
        <Typography variant="body">Default</Typography>
      </>,
    );
    const subdued = screen.getByText("Subdued");
    expect(subdued.className).toContain(glyph.subdued);
    expect(subdued.getAttribute("color")).toBeNull();
    for (const className of Object.values(glyph)) expect(screen.getByText("Default").className).not.toContain(className);
  });

  it("is how the app and its design system colour a Typography: none does through its className", () => {
    const sources = readdirSync(DIR).filter((file) => file.endsWith(".tsx"));
    const strays = sources.flatMap((file) =>
      typographyTags(readFileSync(join(DIR, file), "utf8"))
        .filter((tag) => /className=\{[^}]*glyph\./.test(tag))
        .map((tag) => `${file}: ${tag.slice(0, 80)}`),
    );
    expect(strays).toEqual([]);
  });
});
