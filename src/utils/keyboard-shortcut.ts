// ---------------------------------------------------------------------------
// Which key a shortcut is typed with, and how it is written down.
//
// The same shortcut is ⌘K on Apple hardware and Ctrl K on a PC keyboard — one
// gesture wearing each platform's own modifier. Both halves have to agree: a
// chip that says Ctrl K over a listener watching for ⌘ is a label that lies,
// so the label and the listener are read from the one answer here.
//
// The modifiers are NOT accepted interchangeably. On macOS Ctrl+K is a text
// binding (kill to end of line) the page has no business claiming, and on
// Windows the Meta key belongs to the OS.
// ---------------------------------------------------------------------------

const APPLE = /mac|iphone|ipad|ipod/i;

/** `navigator.userAgentData` — Chromium-only, and not yet in TypeScript's lib. */
type NavigatorWithUAData = Navigator & {
  userAgentData?: { platform?: string };
};

/**
 * Is this an Apple keyboard? The high-entropy `userAgentData.platform` first,
 * then the deprecated-but-universal `navigator.platform`, then the user agent —
 * `||` rather than `??` so an empty claim falls through to the next one.
 *
 * True when there is no navigator at all: that is the server, and SSR renders
 * the ⌘ label (see `useShortcutLabel`), so agreeing with it keeps the one
 * unknowable case consistent.
 */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as NavigatorWithUAData;
  const claim = nav.userAgentData?.platform || nav.platform || nav.userAgent;
  return APPLE.test(claim);
}

/** Was the platform's shortcut modifier held for this key press? */
export function hasShortcutModifier(
  event: Pick<KeyboardEvent, "metaKey" | "ctrlKey">,
): boolean {
  return isApplePlatform() ? event.metaKey : event.ctrlKey;
}

/**
 * A shortcut written the way its keyboard reads it — `⌘K`, `Ctrl K`. The glyph
 * sits against the key it modifies; the word needs a space to stay a word.
 *
 * `apple` is the platform to write it for, and defaults to the one underneath.
 * Pass it explicitly where the platform is not the caller's to read (SSR).
 */
export function shortcutLabel(key: string, apple = isApplePlatform()): string {
  return apple ? `⌘${key}` : `Ctrl ${key}`;
}
