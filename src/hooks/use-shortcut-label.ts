import { useSyncExternalStore } from "react";
import { shortcutLabel } from "@/utils/keyboard-shortcut";

/** The keyboard cannot change under a running page — nothing to subscribe to. */
function subscribe(): () => void {
  return () => {};
}

/**
 * A shortcut written for the keyboard it will be typed on — `⌘K` here, `Ctrl K`
 * on a PC. The server has no keyboard to read, so it renders the ⌘ form and the
 * client corrects it once hydrated; going through `useSyncExternalStore` is what
 * keeps that a re-render rather than a hydration mismatch.
 */
export function useShortcutLabel(key: string): string {
  return useSyncExternalStore(
    subscribe,
    () => shortcutLabel(key),
    () => shortcutLabel(key, true),
  );
}
