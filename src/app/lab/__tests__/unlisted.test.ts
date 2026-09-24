import { describe, expect, it } from "vitest";
import { SITE_PATHS } from "@/data/site-paths";

// A lab prototype is an argument, and the argument is the post that frames it.
// So none is ever listed on its own: not in the sitemap, `llms.txt` or the
// link-card picker — all three of which read `SITE_PATHS`. The ⌘K palette is
// the one exception, reading `LAB_PAGES` for now; otherwise the way in is the
// link from its prototype article. An absence looks like an
// omission to whoever next tidies the registry, which is what this is for.
describe("lab prototypes", () => {
  it("are never listed without the article that frames them", () => {
    expect(SITE_PATHS.filter((page) => page.path.startsWith("/lab"))).toEqual(
      [],
    );
  });
});
