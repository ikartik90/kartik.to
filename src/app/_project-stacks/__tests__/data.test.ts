import { describe, expect, it } from "vitest";
import { canonicalPath } from "../data";

describe("canonicalPath", () => {
  it("is the project's address for a post a project's sheet replaces", () => {
    expect(canonicalPath("/work/redesigning-shift-scheduling")).toBe("/projects/shift-scheduling");
  });

  it("is a post's own address otherwise", () => {
    expect(canonicalPath("/writing/on-craft")).toBe("/writing/on-craft");
  });
});
