"use client";

import { useEffect, useId, type RefObject } from "react";

// Open surfaces in opening order (portals defeat DOM nesting). Escape closes only the top
// one, and a press inside a surface stacked above isn't "outside" this one.
const layers: { id: string; ref: RefObject<HTMLElement | null> }[] = [];

// The open <dialog> a keydown started in, read at window capture before React can close it:
// a modal over a surface takes that surface's Escape.
let dialogAtPress: Element | null = null;
let watching = false;
function watchPresses(): void {
  if (watching) return;
  watching = true;
  window.addEventListener(
    "keydown",
    (e) => {
      dialogAtPress =
        (e.target as Element | null)?.closest?.("dialog[open]") ?? null;
    },
    { capture: true },
  );
}

interface UseDismissOptions {
  /** The popover container — pointer-downs outside it dismiss. */
  ref: RefObject<HTMLElement | null>;
  onDismiss: () => void;
  /** Also dismiss on scroll/resize, for popovers placed from a stale click rect. */
  dismissOnReflow?: boolean;
  /** Selector for the trigger, so its toggle click isn't pre-empted by an outside dismiss. */
  ignoreSelector?: string;
  dismissOnOutsidePointer?: boolean;
  enabled?: boolean;
}

/** Escape (captured, ahead of editor keymaps), pointer-down outside, and optionally reflow. */
export function useDismiss({
  ref,
  onDismiss,
  dismissOnReflow = false,
  ignoreSelector,
  dismissOnOutsidePointer = true,
  enabled = true,
}: UseDismissOptions): void {
  // Registered in its own effect so a re-render (inline `onDismiss`) can't reorder the stack.
  const layer = useId();
  useEffect(() => {
    if (!enabled) return;
    layers.push({ id: layer, ref });
    return () => {
      const at = layers.findIndex((entry) => entry.id === layer);
      if (at !== -1) layers.splice(at, 1);
    };
  }, [enabled, layer, ref]);

  // Capture + stopPropagation beats editor keymaps; preventDefault stops Safari leaving full screen.
  useEffect(() => {
    if (!enabled) return;
    watchPresses();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || layers.at(-1)?.id !== layer) return;
      // A dialog over this surface owns the press, unless the surface is inside it.
      if (dialogAtPress && !dialogAtPress.contains(ref.current)) return;
      e.preventDefault();
      e.stopPropagation();
      onDismiss();
    }
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [enabled, onDismiss, layer, ref]);

  useEffect(() => {
    if (!enabled || !dismissOnOutsidePointer) return;
    function handlePointerDown(e: PointerEvent) {
      const el = ref.current;
      if (!el || el.contains(e.target as Node)) return;
      const target = e.target as Element | null;
      if (ignoreSelector && target?.closest?.(ignoreSelector)) return;
      const above = layers.slice(
        layers.findIndex((entry) => entry.id === layer) + 1,
      );
      if (above.some((entry) => entry.ref.current?.contains(target))) return;
      onDismiss();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [enabled, dismissOnOutsidePointer, onDismiss, ref, ignoreSelector, layer]);

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
