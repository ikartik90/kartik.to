import { describe, expect, it } from "vitest";
import { isPlainClick } from "../plain-click";

const click = (held: Partial<Parameters<typeof isPlainClick>[0]> = {}) => ({
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...held,
});

describe("isPlainClick", () => {
  it("is a primary click with no key held", () => {
    expect(isPlainClick(click())).toBe(true);
  });

  it("leaves a click with a key held to the browser: a new tab, a new window, a download", () => {
    for (const key of ["metaKey", "ctrlKey", "shiftKey", "altKey"] as const) {
      expect(isPlainClick(click({ [key]: true }))).toBe(false);
    }
  });

  it("leaves any other button to the browser", () => {
    expect(isPlainClick(click({ button: 1 }))).toBe(false);
  });
});
