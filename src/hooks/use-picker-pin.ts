"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

// Pinned, not anchor-positioned: an anchor is tracked and would drag the picker as the
// rail scrolls. Clamped in a layout effect so the first paint is already corrected.

/** Matches `spacing.lg`. */
const VIEWPORT_INSET = 12;

export interface PickerPin {
  /** Viewport px; `undefined` when closed. */
  top: number | undefined;
  pin: (trigger: HTMLElement | null) => void;
  unpin: () => void;
  /** Attach to the picker; lifts it clear of the viewport's foot. */
  ref: (node: HTMLElement | null) => void;
}

export function usePickerPin(): PickerPin {
  const [top, setTop] = useState<number | undefined>(undefined);
  // The position read at pin time; clamps re-run from this, never from the applied value.
  const wanted = useRef<number | undefined>(undefined);
  const node = useRef<HTMLElement | null>(null);

  const clamp = useCallback(() => {
    const el = node.current;
    const from = wanted.current;
    if (!el || from === undefined) return;
    const room = window.innerHeight - el.offsetHeight - VIEWPORT_INSET;
    setTop(Math.max(VIEWPORT_INSET, Math.min(from, room)));
  }, []);

  const ref = useCallback(
    (next: HTMLElement | null) => {
      node.current = next;
      if (next) clamp();
    },
    [clamp],
  );

  useLayoutEffect(() => {
    if (top === undefined) return;
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [top, clamp]);

  return {
    top,
    pin: useCallback((trigger: HTMLElement | null) => {
      const from = trigger?.getBoundingClientRect().top;
      wanted.current = from;
      setTop(from);
    }, []),
    unpin: useCallback(() => {
      wanted.current = undefined;
      setTop(undefined);
    }, []),
    ref,
  };
}
