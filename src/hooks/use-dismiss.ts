"use client";

import { useEffect, useId, type RefObject } from "react";

// The open dismissable surfaces, in the order they opened. Escape closes ONE
// thing — the one on top — and every surface listens at the document, so
// without this a press meant for the combobox on a properties panel would take
// the panel with it. `stopPropagation` cannot sort them out: listeners on the
// SAME node in the same phase all run regardless, and the one registered first
// (the surface underneath) would win anyway.
//
// Opening order, not DOM nesting, because a portalled popover is a sibling of
// everything else under <body> — there is no containment left to read. The two
// agree wherever it matters: a surface opened FROM another one mounts second.
const layers: string[] = [];

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
  /**
   * Whether a pointer-down outside dismisses at all (default true).
   *
   * Off for a surface that is not transient — one opened deliberately and
   * closed deliberately, standing over the very thing it configures, where
   * every press on that thing would otherwise take it away. Escape and the
   * surface's own controls still close it; only the ambient press is withdrawn.
   */
  dismissOnOutsidePointer?: boolean;
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
  dismissOnOutsidePointer = true,
  enabled = true,
}: UseDismissOptions): void {
  // This surface's place in the stack above. An identity, nothing more, and
  // registered in an effect of its OWN so that a re-render (which re-runs the
  // Escape effect, `onDismiss` being an inline arrow at every call site) cannot
  // pop this surface and push it back on top of the ones opened after it.
  const layer = useId();
  useEffect(() => {
    if (!enabled) return;
    layers.push(layer);
    return () => {
      const at = layers.indexOf(layer);
      if (at !== -1) layers.splice(at, 1);
    };
  }, [enabled, layer]);

  // Escape closes the TOPMOST surface. Capture + stopPropagation so it
  // dismisses the popover rather than reaching an editor-level Escape handler
  // first, and preventDefault so the browser doesn't also run its own Escape
  // action — e.g. Safari leaving fullscreen when the menu is dismissed. Both
  // are the top surface's to do: a press swallowed by a surface underneath
  // would be one the surface on top never got.
  useEffect(() => {
    if (!enabled) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && layers[layers.length - 1] === layer) {
        e.preventDefault();
        e.stopPropagation();
        onDismiss();
      }
    }
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [enabled, onDismiss, layer]);

  // Dismiss when a pointer goes down outside the container.
  useEffect(() => {
    if (!enabled || !dismissOnOutsidePointer) return;
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
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [enabled, dismissOnOutsidePointer, onDismiss, ref, ignoreSelector]);

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
