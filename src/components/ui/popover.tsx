"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";
import { useDismiss } from "@/hooks/use-dismiss";
import { scrollBoundary } from "@/hooks/use-scroll-handoff";

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
  /**
   * CSS selector for the trigger that opened this popover, exempted from the
   * outside-pointerdown dismiss so a toggling trigger can close it. See
   * {@link useDismiss}.
   */
  ignoreSelector?: string;
  /**
   * Render the container in a `document.body` portal so it renders in the true
   * top stacking context and escapes ancestor clipping/containment — e.g. a
   * `DemoFrame`, whose `container-type` makes it the containing block for a
   * positioned child (absolute as well as fixed — `container-type` implies
   * `contain: layout`) and whose `overflow: hidden` would otherwise crop the
   * popover. Only for element-anchored popovers (no `rect`): the anchor-name
   * lives on an external trigger, so CSS anchor positioning still pins the
   * popover to it across the portal. A `rect`-anchored popover must stay in flow
   * (its synthesized anchor is article-relative), so this is ignored there.
   */
  portal?: boolean;
  /**
   * Inline styles for the container — for a position the RECIPE cannot state
   * because it is measured at open time. The colour picker's pinned `top` is
   * the case that introduced it; see `usePickerPin`.
   */
  style?: React.CSSProperties;
  /**
   * The container element, handed out as it mounts. For a caller that has to
   * MEASURE the popover — again, the picker's clamp. The dismiss logic keeps
   * its own ref regardless, so this cannot take the shell's away.
   */
  containerRef?: (node: HTMLDivElement | null) => void;
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
  ignoreSelector,
  portal = false,
  style,
  containerRef: onContainer,
  onDismiss,
  children,
}: PopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useDismiss({ ref: containerRef, onDismiss, dismissOnReflow, ignoreSelector });

  // Where a wheel stops. A popover is anchored to something on the page, so
  // scrolling the page out from under a list that has run out would drag the
  // menu off its trigger (and, with `dismissOnReflow`, close it) — the reason
  // a floating surface contains its scroll. It CLIPS rather than scrolls, so
  // `overscroll-behavior` has nothing to apply to and the edge is marked with
  // the attribute `useScrollHandoff` looks for.
  const container = (
    <div
      ref={(node) => {
        containerRef.current = node;
        onContainer?.(node);
      }}
      className={className}
      style={style}
      role={role}
      aria-label={ariaLabel}
      {...scrollBoundary}
    >
      {children}
    </div>
  );

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
      {portal && !rect && typeof document !== "undefined"
        ? createPortal(container, document.body)
        : container}
    </>
  );
}
