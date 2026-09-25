"use client";

import {
  Children,
  isValidElement,
  useCallback,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useCursorTooltip } from "@/hooks/use-cursor-tooltip";
import { Tooltip, TooltipHostContext } from "./tooltip";
import { WireframeText } from "./wireframe";

export type ActionVariant = "text" | "icon" | "link";

/** `secondary` is filled, `tertiary` unfilled, `glass` sits on a picture, `accent` is brand-tinted. */
export type ActionEmphasis = "secondary" | "tertiary" | "glass" | "accent";

/** `md` is the 40px chip, `sm` the 32px one; only the `text` variant has both. */
export type ActionSize = "md" | "sm";

export interface ActionTextProps {
  children: ReactNode;
  className?: string;
}

export function ActionText({ children, className }: ActionTextProps) {
  return (
    <span className={className}>
      <WireframeText>{children}</WireframeText>
    </span>
  );
}

const isActionText = (node: ReactNode) =>
  (isValidElement(node) && node.type === ActionText) ||
  typeof node === "string" ||
  typeof node === "number";

const isActionTooltip = (node: ReactNode) =>
  isValidElement(node) && node.type === Tooltip;

/** Splits children into content and an optional `.Tooltip` wired to a cursor-following hover. */
export function useActionTooltip(children: ReactNode) {
  const items = Children.toArray(children);
  const tooltip = items.find(isActionTooltip);
  const content = items.filter((child) => !isActionTooltip(child));
  const hasText = content.some(isActionText);

  const [hovered, setHovered] = useState(false);
  const { ref, seed } = useCursorTooltip(hovered);

  // Touch never opens the label. Checked per event, not per device: touchscreen laptops also hover.
  const show = useCallback(
    (event: ReactPointerEvent) => {
      if (event.pointerType === "touch") return;
      seed(event.clientX, event.clientY);
      setHovered(true);
    },
    [seed],
  );
  const hide = useCallback(() => setHovered(false), []);

  const tooltipNode = tooltip ? (
    <TooltipHostContext.Provider value={{ ref, visible: hovered }}>
      {tooltip}
    </TooltipHostContext.Provider>
  ) : null;

  return {
    content,
    hasText,
    tooltipNode,
    hasTooltip: Boolean(tooltip),
    /** Drive anything drawn instead of the tooltip off this, not `:hover`; the two drift apart. */
    visible: hovered,
    show,
    hide,
  };
}
