import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_OPT_OUT_KEY,
  isAnalyticsOptedOut,
  setAnalyticsOptOut,
} from "../analytics-opt-out";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("the analytics opt-out mark", () => {
  it("is absent by default, so a visitor is counted", () => {
    expect(isAnalyticsOptedOut()).toBe(false);
  });

  it("is set and read back under a stable key", () => {
    setAnalyticsOptOut(true);
    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).not.toBeNull();
    expect(isAnalyticsOptedOut()).toBe(true);
  });

  it("survives the tab, which is the whole point of storing it", () => {
    setAnalyticsOptOut(true);
    expect(isAnalyticsOptedOut()).toBe(true);
    expect(isAnalyticsOptedOut()).toBe(true);
  });

  it("opting back in removes the key rather than storing a falsy string", () => {
    setAnalyticsOptOut(true);
    setAnalyticsOptOut(false);
    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBeNull();
    expect(isAnalyticsOptedOut()).toBe(false);
  });

  it("takes any value a hand-typed mark might have", () => {
    for (const value of ["1", "true", "yes", "0"]) {
      localStorage.setItem(ANALYTICS_OPT_OUT_KEY, value);
      expect(isAnalyticsOptedOut()).toBe(true);
    }
  });

  it("reads an empty string as no mark at all", () => {
    localStorage.setItem(ANALYTICS_OPT_OUT_KEY, "");
    expect(isAnalyticsOptedOut()).toBe(false);
  });

  it("says 'not opted out' when storage cannot be read, and does not throw", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => isAnalyticsOptedOut()).not.toThrow();
    expect(isAnalyticsOptedOut()).toBe(false);
  });

  it("swallows a storage that cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => setAnalyticsOptOut(true)).not.toThrow();
  });
});
