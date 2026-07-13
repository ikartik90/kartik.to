"use client";

import { useEffect, useRef } from "react";
import { selectionPopover } from "../../styled-system/recipes";

// Precompute both variants with static literals so Panda actually emits the
// CSS for each. Calling `selectionPopover({ align })` with a runtime variable
// leaves the extractor unable to see the "start" value, so only the default
// ("center") variant would be generated — the marker menus would then silently
// fall back to centred instead of left-aligned.
const popoverClass = {
  center: selectionPopover({ align: "center" }),
  start: selectionPopover({ align: "start" }),
} as const;

// ---------------------------------------------------------------------------
// SelectionPopover — the shared chrome behind every floating editor popover
// (text-selection toolbar, link actions, list numbering, bullet styles).
//
// It renders a zero-size fixed anchor at `rect` (so CSS anchor() can position
// the popover against it) plus the popover container, and owns the dismiss
// behaviour common to all of them: Escape, outside pointer-down, and — for the
// marker menus whose anchor rect is captured on click — scroll/resize.
//
// Only one selection popover is ever mounted at a time, so they all share the
// single `--selection-popover` anchor name (see globals.css).
// ---------------------------------------------------------------------------

export interface SelectionPopoverRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface SelectionPopoverProps {
  /** Viewport-relative rect the popover anchors to. */
  rect: SelectionPopoverRect;
  /** `center` over the target (text/link) or `start` (left-aligned marker menus). */
  align?: "center" | "start";
  ariaLabel: string;
  /** Dismiss on scroll/resize — for menus anchored to a click-captured rect. */
  dismissOnReflow?: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
}

/** Prevent a button press from collapsing the editor's text selection/caret. */
export const preserveSelection = (e: React.MouseEvent) => e.preventDefault();

export function SelectionPopover({
  rect,
  align = "center",
  ariaLabel,
  dismissOnReflow = false,
  onDismiss,
  children,
}: SelectionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Escape closes the popover from anywhere.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onDismiss();
      }
    }
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [onDismiss]);

  // Dismiss when pointer goes down outside the popover.
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (popoverRef.current && !popoverRef.current.contains(target)) {
        onDismiss();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown);
  }, [onDismiss]);

  // A click-captured anchor rect goes stale on scroll/resize — dismiss instead
  // of letting the popover drift away from its target.
  useEffect(() => {
    if (!dismissOnReflow) return;
    function handleReflow() {
      onDismiss();
    }
    window.addEventListener("scroll", handleReflow, true);
    window.addEventListener("resize", handleReflow);
    return () => {
      window.removeEventListener("scroll", handleReflow, true);
      window.removeEventListener("resize", handleReflow);
    };
  }, [dismissOnReflow, onDismiss]);

  return (
    <>
      <div
        data-selection-anchor=""
        aria-hidden
        style={{
          position: "fixed",
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          pointerEvents: "none",
        }}
      />
      <div
        ref={popoverRef}
        className={popoverClass[align]}
        role="toolbar"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </>
  );
}
