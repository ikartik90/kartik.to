// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { PALETTE_INTENT_SCRIPT, takePaletteIntent } from "../palette-intent";

type IntentWindow = Window & {
  __takePaletteIntent?: () => boolean;
  __paletteIntent?: number;
};

/**
 * Run the head script the way the browser would, before anything else loads —
 * on the keyboard named. The script reads the platform once, at install.
 */
function installScript(platform = "MacIntel") {
  Object.defineProperty(window.navigator, "platform", {
    value: platform,
    configurable: true,
  });
  window.eval(PALETTE_INTENT_SCRIPT);
}

function press(key: string, modifiers: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key,
    cancelable: true,
    ...modifiers,
  });
  window.dispatchEvent(event);
  return event;
}

afterEach(() => {
  const w = window as IntentWindow;
  w.__takePaletteIntent?.();
  delete w.__takePaletteIntent;
  delete w.__paletteIntent;
});

describe("palette intent", () => {
  it("remembers a shortcut pressed before the palette is alive", () => {
    installScript();
    press("k", { metaKey: true });
    expect(takePaletteIntent()).toBe(true);
  });

  it("hands the press over exactly once", () => {
    installScript();
    press("k", { metaKey: true });
    expect(takePaletteIntent()).toBe(true);
    expect(takePaletteIntent()).toBe(false);
  });

  it("stops listening once the palette has taken over", () => {
    installScript();
    takePaletteIntent();
    // From here the palette's own listener answers; a second recorder would
    // mean the next ⌘K opens the palette twice over.
    press("k", { metaKey: true });
    expect(takePaletteIntent()).toBe(false);
  });

  it("ignores a bare k, and anything that is not the shortcut", () => {
    installScript();
    press("k");
    press("j", { metaKey: true });
    expect(takePaletteIntent()).toBe(false);
  });

  it("swallows the browser's own handling of the press it records", () => {
    installScript();
    const event = press("k", { metaKey: true });
    expect(event.defaultPrevented).toBe(true);
  });

  it("watches for Ctrl K on a PC keyboard", () => {
    installScript("Win32");
    press("k", { ctrlKey: true });
    expect(takePaletteIntent()).toBe(true);
  });

  it("leaves ⌘K alone on a PC, where Meta belongs to the OS", () => {
    installScript("Win32");
    press("k", { metaKey: true });
    expect(takePaletteIntent()).toBe(false);
  });

  it("leaves ⌃K alone on a Mac, where the OS has its own use for it", () => {
    installScript("MacIntel");
    press("k", { ctrlKey: true });
    expect(takePaletteIntent()).toBe(false);
  });

  it("reports no intent when the script never ran", () => {
    expect(takePaletteIntent()).toBe(false);
  });
});
