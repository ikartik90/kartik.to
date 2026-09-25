import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Where a recipe lives is decided by who imports it, the same way the
// Two-Page rule decides it for components (AGENTS.md, "Where recipes live"):
//
//   - one component  → `<component>.recipe.ts` beside it
//   - two or more    → `src/components/ui/recipes/`
//   - panda.config.ts → never; it only imports the index
//
// Prose alone did not hold this line: the config grew to 9,700 lines because
// every pass that added a style found it the easiest place to put one. These
// read the source rather than the generated `styled-system/`, so they judge
// what a change actually wrote, not what the last codegen left behind.
// ---------------------------------------------------------------------------

const SHARED_DIR = "src/components/ui/recipes";

const read = (file: string) => readFileSync(file, "utf8");

const sourceFiles = readdirSync("src", { recursive: true, encoding: "utf8" })
  .filter((file) => /\.tsx?$/.test(file) && !file.includes("__tests__"))
  .map((file) => path.join("src", file));

/** Every recipe a file defines, as `name = defineRecipe(` or `name: defineRecipe(`. */
const definedIn = (file: string) =>
  [...read(file).matchAll(/(\w+)\s*[:=]\s*define(?:Slot)?Recipe\(/g)].map(
    ([, name]) => name,
  );

/** Recipe name → every file under `src/` that defines it. */
function definitions(): Map<string, string[]> {
  const defined = new Map<string, string[]>();
  for (const file of sourceFiles) {
    for (const name of definedIn(file)) {
      defined.set(name, [...(defined.get(name) ?? []), file]);
    }
  }
  return defined;
}

/** Recipe name → every non-test file that imports it from `styled-system/recipes`. */
function importers(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of sourceFiles) {
    for (const [, names] of read(file).matchAll(
      /import\s*\{([^}]*)\}\s*from\s*["'][^"']*styled-system\/recipes["']/g,
    )) {
      for (const entry of names.split(",")) {
        const name = entry.trim().split(/\s+as\s+/)[0];
        if (!name || name.startsWith("type ")) continue;
        found.set(name, [...(found.get(name) ?? []), file]);
      }
    }
  }
  return found;
}

/** `src/components/weather-graphic.tsx` → `src/components/weather-graphic.recipe.ts` */
const besideIt = (component: string) =>
  component.replace(/\.tsx?$/, ".recipe.ts");

describe("recipe placement", () => {
  const defined = definitions();
  const users = importers();

  it("panda.config.ts defines no recipes", () => {
    expect(definedIn("panda.config.ts")).toEqual([]);
  });

  it("defines each recipe once", () => {
    const twice = [...defined]
      .filter(([, files]) => files.length > 1)
      .map(([name, files]) => `${name}: in ${files.join(" and ")}`);

    expect(twice).toEqual([]);
  });

  it("puts a recipe one component uses beside that component", () => {
    const misplaced = [...defined]
      .filter(([name]) => users.get(name)?.length === 1)
      .map(([name, [file]]) => ({ name, file, want: besideIt(users.get(name)![0]) }))
      .filter(({ file, want }) => file !== want)
      .map(({ name, file, want }) => `${name}: in ${file}, belongs in ${want}`);

    expect(misplaced).toEqual([]);
  });

  it(`puts a recipe two or more components use in ${SHARED_DIR}/`, () => {
    const misplaced = [...defined]
      .filter(([name]) => (users.get(name)?.length ?? 0) >= 2)
      .filter(([, [file]]) => path.dirname(file) !== SHARED_DIR)
      .map(
        ([name, [file]]) =>
          `${name}: in ${file}, used by ${users.get(name)!.join(", ")}`,
      );

    expect(misplaced).toEqual([]);
  });

  it("has a component using every recipe", () => {
    const unused = [...defined.keys()].filter((name) => !users.has(name));

    expect(unused).toEqual([]);
  });
});
