// ⌘ on Apple, Ctrl elsewhere, never both: Ctrl+K is a macOS text binding, and Meta is the OS's on Windows.

const APPLE = /mac|iphone|ipad|ipod/i;

/** Chromium-only, and not yet in TypeScript's lib. */
type NavigatorWithUAData = Navigator & {
  userAgentData?: { platform?: string };
};

/** `||` so an empty claim falls through. True on the server, matching the SSR ⌘ label. */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as NavigatorWithUAData;
  const claim = nav.userAgentData?.platform || nav.platform || nav.userAgent;
  return APPLE.test(claim);
}

export function hasShortcutModifier(
  event: Pick<KeyboardEvent, "metaKey" | "ctrlKey">,
): boolean {
  return isApplePlatform() ? event.metaKey : event.ctrlKey;
}

/** Pass `apple` explicitly where the platform can't be read (SSR). */
export function shortcutLabel(key: string, apple = isApplePlatform()): string {
  return apple ? `⌘${key}` : `Ctrl ${key}`;
}
