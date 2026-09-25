"use client";

import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import { css, cx } from "../../../styled-system/css";
import {
  tooltip,
  type TooltipVariantProps,
} from "../../../styled-system/recipes";

// Position and visibility come from the host (Button/Link) via context. Always portalled to the
// body: an ancestor with `overflow: hidden` or containment would clip a fixed box at the cursor.

const subscribeNever = () => () => {};
const onClient = () => true;
const onServer = () => false;

type TooltipHost = {
  ref: Ref<HTMLElement>;
  visible: boolean;
  /** For a device with no cursor: the recipe's `&[data-docked]` rule places it instead. */
  docked?: boolean;
};

/** Set by Button/Link so a Tooltip rendered as their sibling reads its ref + state. */
export const TooltipHostContext = createContext<TooltipHost | null>(null);

const dividerStyle = css({
  flexShrink: 0,
  width: 0,
  height: "token(spacing.xl)",
  borderLeftWidth: "token(spacing.3xs)",
  borderLeftStyle: "solid",
  borderLeftColor: "border.divider",
});

export interface TooltipTextProps {
  children: ReactNode;
  className?: string;
}

function TooltipText({ children, className }: TooltipTextProps) {
  return <span className={className}>{children}</span>;
}

function isTooltipText(node: ReactNode): node is ReactElement {
  return isValidElement(node) && node.type === TooltipText;
}

export interface TooltipProps extends TooltipVariantProps {
  children: ReactNode;
  className?: string;
}

/** Inserts a hairline between the label and trailing content. Decorative: the trigger carries the accessible name. */
function TooltipRoot({ children, className, ...variants }: TooltipProps) {
  const host = useContext(TooltipHostContext);
  // Portalled only after hydration: a first client render that differs from the server's is a mismatch.
  const hydrated = useSyncExternalStore(subscribeNever, onClient, onServer);
  const items = Children.toArray(children);
  const label = items.find(isTooltipText);
  const rest = items.filter((child) => !isTooltipText(child));

  if (!hydrated) return null;

  return createPortal(
    <div
      ref={host?.ref as Ref<HTMLDivElement>}
      className={cx(tooltip(variants), className)}
      data-visible={host?.visible ? "" : undefined}
      data-docked={host?.docked ? "" : undefined}
      aria-hidden
    >
      {label}
      {rest.length > 0 && <span className={dividerStyle} aria-hidden />}
      {rest}
    </div>,
    document.body,
  );
}

export const Tooltip = Object.assign(TooltipRoot, { Text: TooltipText });
