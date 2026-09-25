import { describe, expect, it } from "vitest";
import { SITE_PATHS } from "@/data/site-paths";

describe("lab prototypes", () => {
  it("are never listed without the article that frames them", () => {
    expect(SITE_PATHS.filter((page) => page.path.startsWith("/lab"))).toEqual(
      [],
    );
  });
});
