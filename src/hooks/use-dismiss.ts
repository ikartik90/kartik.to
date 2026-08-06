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
  /**
   * A CSS selector for the control that OPENED this popover, so a press on it
   * is not treated as a press outside.
   *
   * Without it a trigger that toggles cannot close: the outside-pointerdown
   * dismiss lands first, and the click that follows finds the popover already
   * gone and re-opens it. Matched with `closest`, so marking the trigger
   * itself is enough however it wraps its icon.
   */
  ignoreSelector?: string;
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
  ignoreSelector,
  enabled = true,
}: UseDismissOptions): void {
  // Escape closes from anywhere. Capture + stopPropagation so it dismisses the
  // popover rather than reaching an editor-level Escape handler first, and
  // preventDefault so the browser doesn't also run its own Escape action —
  // e.g. Safari leaving fullscreen when the menu is dismissed.
  useEffect(() => {
    if (!enabled) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
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
      if (!el || el.contains(e.target as Node)) return;
      // The trigger closes by TOGGLING, so it must reach its own click with
      // the popover still open — see `ignoreSelector`.
      const target = e.target as Element | null;
      if (ignoreSelector && target?.closest?.(ignoreSelector)) return;
      onDismiss();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown);
  }, [enabled, onDismiss, ref, ignoreSelector]);

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
