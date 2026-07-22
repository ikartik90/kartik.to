"use client";

import { useEffect, type RefObject } from "react";

interface UseDismissOptions {
  /** The popover container — pointer-downs outside it dismiss. */
  ref: RefObject<HTMLElement | null>;
  onDismiss: () => void;
  /**
   * Also dismiss on scroll/resize — for popovers anchored to a click-captured
   * rect that goes stale on reflow (the list-marker menus).
   */
  dismissOnReflow?: boolean;
  /** Turn all listeners off (default true). */
  enabled?: boolean;
}

/**
 * The dismiss behaviour shared by every floating menu: Escape (captured so it
 * beats the editor's keymaps), pointer-down outside the container, and —
 * optionally — scroll/resize. Extracted so the Popover shell and any menu that
 * manages its own container reuse one implementation.
 */
export function useDismiss({
  ref,
  onDismiss,
  dismissOnReflow = false,
  enabled = true,
}: UseDismissOptions): void {
  // Escape closes from anywhere. Capture + stopPropagation so it dismisses the
  // popover rather than reaching an editor-level Escape handler first.
  useEffect(() => {
    if (!enabled) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onDismiss();
      }
    }
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [enabled, onDismiss]);

  // Dismiss when a pointer goes down outside the container.
  useEffect(() => {
    if (!enabled) return;
    function handlePointerDown(e: PointerEvent) {
      const el = ref.current;
      if (el && !el.contains(e.target as Node)) onDismiss();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown);
  }, [enabled, onDismiss, ref]);

  // A click-captured anchor rect goes stale on scroll/resize — dismiss rather
  // than let the popover drift from its target.
  useEffect(() => {
    if (!enabled || !dismissOnReflow) return;
    function handleReflow() {
      onDismiss();
    }
    window.addEventListener("scroll", handleReflow, true);
    window.addEventListener("resize", handleReflow);
    return () => {
      window.removeEventListener("scroll", handleReflow, true);
      window.removeEventListener("resize", handleReflow);
    };
  }, [enabled, dismissOnReflow, onDismiss]);
}
