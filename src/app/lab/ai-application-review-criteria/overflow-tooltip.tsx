"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { css } from "../../../../styled-system/css";

// A popover, not the site's Tooltip, so it renders in the top layer above an open modal.

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
  transform: "translate(-50%, calc(-100% - 6px))",
  pointerEvents: "none",
});

export interface OverflowTooltipProps {
  label: string;
  /** Must truncate: `overflow: hidden` plus an ellipsis. */
  className: string;
  children: ReactNode;
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
