import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RAMPS_BY_USAGE, PALETTE, SYSTEM, variableOf } from "../ds-tokens";

// The app's own pages and parts: everything but the design system's.
const DIR = join(__dirname, "..");
const APP = readdirSync(DIR).filter((file) => /\.tsx?$/.test(file) && !file.startsWith("ds-"));
const read = (file: string) => readFileSync(join(DIR, file), "utf8");

describe("what the foundation pages hatch", () => {
  it("never takes an icon the app imports", () => {
    const icons = read("ds-icons.ts");
    const paths = new Map(
      [...icons.matchAll(/import (\w+) from "\.\/(assets\/[^"]+\.svg)"/g)].map((match) => [match[1], match[2]]),
    );
    const hatched = icons.slice(icons.indexOf("UNUSED_ICONS")).match(/\b[A-Z]\w+(?=,)/g)!;
    const imported = APP.map(read).join("\n");
    expect(hatched.length).toBeGreaterThan(0);
    for (const name of hatched) expect(imported.includes(`"./${paths.get(name)}"`), name).toBe(false);
  });
});

describe("the palette's order", () => {
  it("is by how often the app reads each ramp's colours, most first", () => {
    const text = APP.filter((file) => file !== "theme.ts").map(read).join("\n");
    const count = (variable: string) => text.match(new RegExp(`${variable}(?![a-z0-9-])`, "g"))?.length ?? 0;
    const uses = (ramp: string) =>
      SYSTEM.flatMap((group) => group.tokens)
        .filter((token) => token.alias.startsWith(`Colors/${ramp}/`))
        .reduce((sum, token) => sum + count(variableOf(token.name)), 0) +
      (text.match(new RegExp(`${variableOf(`Colors/${ramp}`)}-`, "g"))?.length ?? 0);
    const ramps = PALETTE.map((ramp) => ramp.name).sort((a, b) => uses(b) - uses(a));
    expect(RAMPS_BY_USAGE).toEqual(ramps);
  });
});
