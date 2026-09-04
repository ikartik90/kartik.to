import { describe, it, expect } from "vitest";
import { getBackTarget } from "../back-target";

describe("getBackTarget", () => {
  it("has nowhere to go from the index itself", () => {
    expect(getBackTarget("/")).toBeNull();
  });

  it("sends a one-level-deep page back to the index", () => {
    expect(getBackTarget("/writing/my-post")).toEqual({
      href: "/",
      label: "index",
    });
    expect(getBackTarget("/work/my-project")).toEqual({
      href: "/",
      label: "index",
    });
  });

  // `/playground` is a prefix with no page behind it, so the climb finds no
  // real ancestor and lands on the floor — which is the right answer here, and
  // the case that would catch a blind parent offering `/playground` instead.
  it("sends the shader playground back to the index", () => {
    expect(getBackTarget("/playground/shader")).toEqual({
      href: "/",
      label: "index",
    });
  });

  // It used to climb: an article's editor answered to the article, and only a
  // page with no real ancestor fell through to the index. One destination now,
  // because the command is "go to the index" rather than "go up a level" —
  // somewhere to stand, not a step in a history nobody is tracking.
  it("sends a deep page to the index rather than to its parent", () => {
    expect(getBackTarget("/writing/my-post/edit")).toEqual({
      href: "/",
      label: "index",
    });
    expect(getBackTarget("/work/my-project/edit")).toEqual({
      href: "/",
      label: "index",
    });
  });

  it("sends a path with no real ancestor there too", () => {
    expect(getBackTarget("/edit/new")).toEqual({ href: "/", label: "index" });
  });

  it("reads a trailing slash as the same page", () => {
    expect(getBackTarget("/writing/my-post/")).toEqual({
      href: "/",
      label: "index",
    });
    expect(getBackTarget("")).toBeNull();
  });
});
