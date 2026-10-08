import { describe, expect, it } from "vitest";
import { REVIEW_BASE, reviewBase } from "../review-path";

describe("reviewBase", () => {
  it("is the review copy's base on its pages", () => {
    expect(REVIEW_BASE).toBe("/dive");
    expect(reviewBase("/dive")).toBe("/dive");
    expect(reviewBase("/dive/")).toBe("/dive");
    expect(reviewBase("/dive/projects/onboarding")).toBe("/dive");
  });

  it("is empty everywhere else, a path that only starts with its letters included", () => {
    expect(reviewBase("/")).toBe("");
    expect(reviewBase("")).toBe("");
    expect(reviewBase("/projects/onboarding")).toBe("");
    expect(reviewBase("/diver")).toBe("");
    expect(reviewBase("/writing/dive")).toBe("");
  });
});
