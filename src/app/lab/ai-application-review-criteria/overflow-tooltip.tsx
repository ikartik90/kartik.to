"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { css } from "../../../../styled-system/css";

// ---------------------------------------------------------------------------
// Text cut short with an ellipsis, and the whole of it in a tooltip while the
// pointer is over it — only when it IS cut short.
//
// The tooltip is a popover, so it goes to the top layer above the modal it is
// written inside — the site's `Tooltip` portals to the page, which a modal
// leaves inert and underneath. It is placed over the text it completes, from
// where that text is when the pointer arrives. The text is all there for a
// screen reader regardless; the cut is only drawn.
// ---------------------------------------------------------------------------

const tooltipStyle = css({
  position: "fixed",
  inset: "auto",
  margin: 0,
  maxWidth: "320px",
  paddingBlock: "2px",
  paddingInline: "8px",
  borderRadius: "6px",
  backgroundColor: "var(--cashby-ink)",
  color: "var(--cashby-surface)",
  font: "var(--cashby-text-small)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  // Centred over the text, its bottom edge 6px above it.
  transform: "translate(-50%, calc(-100% - 6px))",
  pointerEvents: "none",
});

export interface OverflowTooltipProps {
  /** The whole text, as the tooltip reads it. */
  label: string;
  /** The element that truncates: it needs `overflow: hidden` and an ellipsis. */
  className: string;
  children: ReactNode;
  /** Passed through to the truncating element. */
  "data-stage-tag"?: string;
}

export function OverflowTooltip({
  label,
  className,
  children,
  ...rest
}: OverflowTooltipProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    if (at) tipRef.current?.showPopover?.();
  }, [at]);

  function show() {
    const text = textRef.current;
    if (!text || text.scrollWidth <= text.clientWidth) return;
    const box = text.getBoundingClientRect();
    setAt({ x: box.left + box.width / 2, y: box.top });
  }

  return (
    <>
      <span
        ref={textRef}
        className={className}
        onPointerEnter={show}
        onPointerLeave={() => setAt(null)}
        {...rest}
      >
        {children}
      </span>
      {at && (
        <span
          ref={tipRef}
          popover="manual"
          role="tooltip"
          className={tooltipStyle}
          style={{ left: at.x, top: at.y }}
        >
          {label}
        </span>
      )}
    </>
  );
}
