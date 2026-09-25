"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";
import { useDismiss } from "@/hooks/use-dismiss";
import { scrollBoundary } from "@/hooks/use-scroll-handoff";

export interface PopoverRect {
  /** Relative to the editor's `<article>`, so the anchor scrolls with its content. */
  left: number;
  top: number;
  width: number;
  height: number;
}

type PopoverProps = {
  /** Positioning and chrome: a recipe result. */
  className: string;
  role?: string;
  ariaLabel?: string;
  /** Dismiss on scroll/resize — for menus anchored to a click-captured rect. */
  dismissOnReflow?: boolean;
  /** Exempt from the outside-press dismiss, so a toggling trigger can close it. */
  ignoreSelector?: string;
  /** Default true; off for a surface that is only closed deliberately. */
  dismissOnOutsidePointer?: boolean;
  /** Escape ancestor clipping via a body portal. Element-anchored only; ignored with `rect`. */
  portal?: boolean;
  /** For a position measured at open time, which a recipe can't state. */
  style?: React.CSSProperties;
  containerRef?: (node: HTMLDivElement | null) => void;
  onDismiss: () => void;
  children: React.ReactNode;
} & (
  | {
      rect: PopoverRect;
      /** Must match the container recipe's `position-anchor`. */
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
  dismissOnOutsidePointer,
  portal = false,
  style,
  containerRef: onContainer,
  onDismiss,
  children,
}: PopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useDismiss({
    ref: containerRef,
    onDismiss,
    dismissOnReflow,
    ignoreSelector,
    dismissOnOutsidePointer,
  });

  // A scroll boundary: the popover clips rather than scrolls, so the wheel stops here.
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
            // Absolute: it scrolls with the <article>, so the fixed container tracks it with no JS.
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
