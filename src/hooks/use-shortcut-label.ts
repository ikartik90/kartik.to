import { useSyncExternalStore } from "react";
import { shortcutLabel } from "@/utils/keyboard-shortcut";

/** The keyboard cannot change under a running page — nothing to subscribe to. */
function subscribe(): () => void {
  return () => {};
}

/** `⌘K` on a Mac, `Ctrl K` elsewhere; the server renders ⌘ and the client corrects it. */
export function useShortcutLabel(key: string): string {
  return useSyncExternalStore(
    subscribe,
    () => shortcutLabel(key),
    () => shortcutLabel(key, true),
  );
}
