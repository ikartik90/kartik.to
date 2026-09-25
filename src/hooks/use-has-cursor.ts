"use client";

import { useEffect, useState } from "react";
import { HAS_CURSOR_QUERY } from "@/data/media-queries";

/**
 * Whether the device has a cursor. Starts `false` to match the server HTML and
 * corrects a commit later; prefer the `_hasCursor` CSS condition where it can do.
 */
export function useHasCursor(): boolean {
  const [hasCursor, setHasCursor] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.(HAS_CURSOR_QUERY);
    if (!query) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasCursor(query.matches);
    const handleChange = (event: MediaQueryListEvent) =>
      setHasCursor(event.matches);
    query.addEventListener?.("change", handleChange);
    return () => query.removeEventListener?.("change", handleChange);
  }, []);

  return hasCursor;
}
