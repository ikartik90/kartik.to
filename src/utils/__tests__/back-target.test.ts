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

  it("climbs to the nearest ancestor that is a real page", () => {
    expect(getBackTarget("/writing/my-post/edit")).toEqual({
      href: "/writing/my-post",
      label: "My Post",
    });
    expect(getBackTarget("/work/my-project/edit")).toEqual({
      href: "/work/my-project",
      label: "My Project",
    });
  });

  it("falls back to the index when no ancestor is a page of its own", () => {
    // `/writing` and `/work` are section prefixes, not routes — walking one
    // segment up blindly would offer a link to a 404.
    expect(getBackTarget("/dev/button")).toEqual({ href: "/", label: "index" });
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
