"use client";

import {
  Children,
  isValidElement,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import { useCursorTooltip } from "@/hooks/use-cursor-tooltip";
import { Tooltip, TooltipHostContext } from "./tooltip";

// ---------------------------------------------------------------------------
// The parts shared by the two actionable primitives — Button (a <button> that
// ACTS) and Link (an <a>/next-link that NAVIGATES). They render identically and
// share the `action` recipe (in panda.config.ts); only the root element and its
// semantics differ, so the shared TYPES + label + cursor-following tooltip host
// live here once, next to the recipe they pair with.
// ---------------------------------------------------------------------------

/** The look a Button/Link takes — mirrors the `action` recipe's `variant`. */
export type ActionVariant = "text" | "icon" | "link";

/**
 * The fill prominence a Button/Link takes — mirrors the recipe's `emphasis`,
 * orthogonal to `variant` (the shape). `secondary` is the filled chip;
 * `tertiary` has no resting fill and its own subtler hover wash. `primary` is
 * intentionally absent until its look is designed.
 */
export type ActionEmphasis = "secondary" | "tertiary";

export interface ActionTextProps {
  children: ReactNode;
  className?: string;
}

/** The visible label of a text Button/Link (`Button.Text` / `Link.Text`). */
export function ActionText({ children, className }: ActionTextProps) {
  return <span className={className}>{children}</span>;
}

const isActionText = (node: ReactNode) =>
  (isValidElement(node) && node.type === ActionText) ||
  typeof node === "string" ||
  typeof node === "number";

const isActionTooltip = (node: ReactNode) =>
  isValidElement(node) && node.type === Tooltip;

/**
 * Splits an action's children into the rendered CONTENT (icon + label) and its
 * optional `.Tooltip`, and wires that tooltip to a cursor-following hover. The
 * returned `tooltipNode` renders as a sibling of the trigger (the box is
 * `position: fixed`, so it needs no positioned ancestor); `show`/`hide` drive
 * its visibility. `hasText` feeds the text-vs-icon variant inference.
 */
export function useActionTooltip(children: ReactNode) {
  const items = Children.toArray(children);
  const tooltip = items.find(isActionTooltip);
  const content = items.filter((child) => !isActionTooltip(child));
  const hasText = content.some(isActionText);

  const [hovered, setHovered] = useState(false);
  const { ref, seed } = useCursorTooltip(hovered);

  const show = useCallback(
    (x: number, y: number) => {
      seed(x, y);
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
    show,
    hide,
  };
}
