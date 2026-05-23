import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateSlug } from "../slug";

describe("generateSlug", () => {
  describe("with a title", () => {
    it("lowercases the title", () => {
      expect(generateSlug("Hello World")).toBe("hello-world");
    });

    it("replaces spaces with hyphens", () => {
      expect(generateSlug("my new article")).toBe("my-new-article");
    });

    it("strips special characters", () => {
      expect(generateSlug("CSS: The Good Parts!")).toBe("css-the-good-parts");
    });

    it("collapses multiple spaces to a single hyphen", () => {
      expect(generateSlug("foo   bar")).toBe("foo-bar");
    });

    it("strips leading and trailing hyphens", () => {
      expect(generateSlug("  ---hello---  ")).toBe("hello");
    });

    it("truncates to 80 characters", () => {
      const long = "a".repeat(100);
      expect(generateSlug(long).length).toBeLessThanOrEqual(80);
    });

    it("handles a title with only special characters by falling back to timestamp", () => {
      vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
      expect(generateSlug("!!!")).toBe("untitled-1700000000000");
      vi.restoreAllMocks();
    });
  });

  describe("without a title", () => {
    beforeEach(() => {
      vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("returns an untitled slug when title is undefined", () => {
      expect(generateSlug(undefined)).toBe("untitled-1700000000000");
    });

    it("returns an untitled slug when title is an empty string", () => {
      expect(generateSlug("")).toBe("untitled-1700000000000");
    });

    it("returns an untitled slug when title is only whitespace", () => {
      expect(generateSlug("   ")).toBe("untitled-1700000000000");
    });
  });
});
