"use client";

import { useEffect, useState } from "react";
import { HAS_CURSOR_QUERY } from "@/data/media-queries";

/**
 * Whether this device has a cursor — a mouse or a trackpad, not a finger.
 *
 * The same question `_hasCursor` asks in Panda, asked from JS. Almost every
 * affordance that splits on it can be drawn by CSS alone and should be: a rule
 * costs nothing, needs no hydration guard, and cannot be a commit behind. This
 * exists for the ones a stylesheet cannot answer — whether a field takes focus
 * the moment a dialog opens, whether a control is in the tree to be tabbed to
 * at all.
 *
 * Starts at `false` and corrects itself a commit later, for the reason
 * `useCommandPalette`'s `mounted` flag does: the server has no device to ask,
 * so the first client render has to match the HTML it is hydrating. Touch is
 * the safer of the two starting answers — a keyboard hint that appears is a
 * smaller lie than an autofocus that has already opened a keyboard.
 */
export function useHasCursor(): boolean {
  const [hasCursor, setHasCursor] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.(HAS_CURSOR_QUERY);
    if (!query) return;
    // The deliberate one-commit-later correction described above: this syncs to
    // the device, which is not a render-derived value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasCursor(query.matches);
    // Live rather than read once — a tablet with a keyboard case attached
    // mid-session is the same device answering differently.
    const handleChange = (event: MediaQueryListEvent) =>
      setHasCursor(event.matches);
    query.addEventListener?.("change", handleChange);
    return () => query.removeEventListener?.("change", handleChange);
  }, []);

  return hasCursor;
}
