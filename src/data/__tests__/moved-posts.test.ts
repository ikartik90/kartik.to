import { describe, expect, it } from "vitest";
import { movedPostPath } from "../moved-posts";

describe("movedPostPath", () => {
  it("sends a project's old slug to its new address", () => {
    expect(movedPostPath("WORK", "scheduling-extensions")).toBe(
      "/work/redesigning-shift-scheduling",
    );
  });

  it("is null for a slug that never moved", () => {
    expect(movedPostPath("WORK", "redesigning-shift-scheduling")).toBeNull();
  });

  it("only moves a slug within its own kind of post", () => {
    expect(movedPostPath("ARTICLE", "scheduling-extensions")).toBeNull();
  });
});
