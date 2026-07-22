"use client";

import { useRef } from "react";
import { useDismiss } from "@/hooks/use-dismiss";

// ---------------------------------------------------------------------------
// Popover — the positioned, dismissable shell behind every floating menu.
//
// Two anchor modes:
//   • rect-anchored — pass `rect` + `anchorName`; Popover renders a zero-size
//     ABSOLUTELY positioned anchor at `rect`, exposing `anchorName` as its CSS
//     `anchor-name`, and the container (a `position: fixed` recipe whose
//     `position-anchor` matches `anchorName`) positions against it via `anchor()`.
//     The name is caller-supplied so the shell carries no domain identity. The
//     anchor is laid out in the flow of Popover's positioned ancestor — the
//     editor's `<article>` (`position: relative`) — so it scrolls WITH the article
//     content, exactly like the in-flow sidenote annotation its card anchors to.
//     The browser therefore tracks the popover to its target on scroll and
//     auto-hides it when the target leaves the viewport, natively, with no
//     per-scroll JS (so it never flutters). Consequently `rect` must be in
//     ARTICLE-relative coordinates (the callers convert). Used by the
//     selection/link/bullet/number toolbars.
//   • element-anchored — omit `rect`; the caller has already put the anchor-name
//     on its own node (e.g. the editor's `[data-slash-anchor]` → `--slash-menu`)
//     and the container's recipe positions against it. Used by the slash menu.
//
// Positioning + chrome + role live in `className`/`role` so the shell stays
// generic; dismiss (Escape / outside pointer / optional reflow) is shared via
// `useDismiss`.
// ---------------------------------------------------------------------------

export interface PopoverRect {
  /** Coordinates relative to the editor's `<article>` (Popover's positioned
   *  ancestor), so the absolute anchor scrolls with the article content. */
  left: number;
  top: number;
  width: number;
  height: number;
}

type PopoverProps = {
  /** Positioning + chrome for the container — a Panda recipe result. */
  className: string;
  role?: string;
  ariaLabel?: string;
  /** Dismiss on scroll/resize — for menus anchored to a click-captured rect. */
  dismissOnReflow?: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
} & (
  | {
      /** Article-relative rect to anchor against. */
      rect: PopoverRect;
      /** CSS anchor-name (a dashed-ident, e.g. `--selection-popover`) exposed on
       *  the synthesized anchor; must match the container recipe's
       *  `position-anchor`. Required with `rect` so the anchor always resolves. */
      anchorName: string;
    }
  | { rect?: undefined; anchorName?: undefined }
);

export function Popover({
  rect,
  anchorName,
  className,
  role,
  ariaLabel,
  dismissOnReflow = false,
  onDismiss,
  children,
}: PopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useDismiss({ ref: containerRef, onDismiss, dismissOnReflow });

  return (
    <>
      {rect && (
        <div
          data-popover-anchor=""
          aria-hidden
          style={{
            // Absolute (not fixed): the containing block is the editor's
            // `position: relative` <article>, so the anchor scrolls with the
            // article and the fixed container tracks/auto-hides against it
            // natively — no scroll listener, no flutter.
            anchorName,
            position: "absolute",
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            pointerEvents: "none",
          }}
        />
      )}
      <div ref={containerRef} className={className} role={role} aria-label={ariaLabel}>
        {children}
      </div>
    </>
  );
}
