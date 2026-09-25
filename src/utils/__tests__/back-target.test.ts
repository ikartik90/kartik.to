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

  it("sends the shader playground back to the index", () => {
    expect(getBackTarget("/playground/shader")).toEqual({
      href: "/",
      label: "index",
    });
  });

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
