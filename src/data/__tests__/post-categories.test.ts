import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PostCategorySchema } from "@/domain/post";
import { LISTED_CATEGORIES, POST_CATEGORIES } from "../post-categories";

describe("POST_CATEGORIES", () => {
  it("describes every category the schema allows", () => {
    expect(Object.keys(POST_CATEGORIES).sort()).toEqual(
      [...PostCategorySchema.options].sort(),
    );
  });

  it("lists the categories a post can be filed under, and not pages", () => {
    expect(LISTED_CATEGORIES).toEqual(["WORK", "ARTICLE", "PROTOTYPE"]);
  });

  it.each(LISTED_CATEGORIES)(
    "has a reading route for %s at its prefix",
    (category) => {
      const route = join(
        process.cwd(),
        "src/app",
        POST_CATEGORIES[category].path,
        "[slug]",
      );
      expect(existsSync(join(route, "page.tsx"))).toBe(true);
      expect(existsSync(join(route, "md", "route.ts"))).toBe(true);
      expect(existsSync(join(route, "opengraph-image.tsx"))).toBe(true);
    },
  );

  it("gives each listed category its own prefix", () => {
    const paths = LISTED_CATEGORIES.map((c) => POST_CATEGORIES[c].path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(path).toMatch(/^\/[a-z-]+$/);
  });

  it.each(LISTED_CATEGORIES)(
    "rewrites the Markdown copy of a %s to its handler",
    async (category) => {
      const { default: config } = await import("../../../next.config");
      const rewrites = (await config.rewrites!()) as {
        source: string;
        destination: string;
      }[];
      const { path } = POST_CATEGORIES[category];
      expect(rewrites).toContainEqual({
        source: `${path}/:slug.md`,
        destination: `${path}/:slug/md`,
      });
    },
  );
});
