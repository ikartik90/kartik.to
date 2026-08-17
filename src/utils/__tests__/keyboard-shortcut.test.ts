import { describe, it, expect, afterEach } from "vitest";
import {
  hasShortcutModifier,
  isApplePlatform,
  shortcutLabel,
} from "../keyboard-shortcut";

/** Claim the field the detection reads first; `afterEach` hands it back. */
function stubPlatform(platform: string) {
  Object.defineProperty(navigator, "userAgentData", {
    value: { platform },
    configurable: true,
  });
}

afterEach(() => {
  delete (navigator as { userAgentData?: unknown }).userAgentData;
});

describe("shortcutLabel", () => {
  it("joins the ⌘ glyph to the key, and spaces the Ctrl word from it", () => {
    expect(shortcutLabel("K", true)).toBe("⌘K");
    expect(shortcutLabel("K", false)).toBe("Ctrl K");
  });

  it("reads the platform when it is not told one", () => {
    stubPlatform("Windows");
    expect(shortcutLabel("K")).toBe("Ctrl K");
    stubPlatform("macOS");
    expect(shortcutLabel("K")).toBe("⌘K");
  });
});

describe("isApplePlatform", () => {
  it("recognises Apple hardware", () => {
    for (const platform of ["macOS", "MacIntel", "iPhone", "iPad"]) {
      stubPlatform(platform);
      expect(isApplePlatform()).toBe(true);
    }
  });

  it("recognises everything else", () => {
    for (const platform of ["Windows", "Win32", "Linux x86_64", "Android"]) {
      stubPlatform(platform);
      expect(isApplePlatform()).toBe(false);
    }
  });

  it("falls back to the user agent when no platform is claimed", () => {
    stubPlatform("");
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      configurable: true,
    });
    expect(isApplePlatform()).toBe(true);

    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      configurable: true,
    });
    expect(isApplePlatform()).toBe(false);

    delete (navigator as { userAgent?: unknown }).userAgent;
  });
});

describe("hasShortcutModifier", () => {
  it("is ⌘ on Apple hardware — and Ctrl there is someone else's shortcut", () => {
    stubPlatform("macOS");
    expect(hasShortcutModifier({ metaKey: true, ctrlKey: false })).toBe(true);
    expect(hasShortcutModifier({ metaKey: false, ctrlKey: true })).toBe(false);
  });

  it("is Ctrl everywhere else — where ⌘ is the OS's own key", () => {
    stubPlatform("Windows");
    expect(hasShortcutModifier({ metaKey: false, ctrlKey: true })).toBe(true);
    expect(hasShortcutModifier({ metaKey: true, ctrlKey: false })).toBe(false);
  });
});
