"use client";

import {
  Children,
  createContext,
  isValidElement,
  useContext,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { css, cx } from "../../../styled-system/css";
import { tooltip } from "../../../styled-system/recipes";

// ---------------------------------------------------------------------------
// Tooltip — the cursor-following hover tooltip, same chrome as the social links
// (a leading label ∣ hairline ∣ trailing 14px glyph). It carries no position or
// visibility of its own: a HOST (Button.Tooltip / Link.Tooltip, which ARE this
// component) supplies the element ref + `visible` through context, wiring it to
// the trigger's hover and the `useCursorTooltip` positioner. Because the box is
// `position: fixed`, the host can render it as a plain sibling of the trigger.
//
//   <Button aria-label="Delete">
//     <TrashIcon />
//     <Button.Tooltip>
//       <Tooltip.Text>Delete</Tooltip.Text>
//       <TrashIcon />
//     </Button.Tooltip>
//   </Button>
// ---------------------------------------------------------------------------

type TooltipHost = {
  ref: Ref<HTMLElement>;
  visible: boolean;
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

/** The tooltip's leading label — the accessible name still lives on the trigger. */
function TooltipText({ children, className }: TooltipTextProps) {
  return <span className={className}>{children}</span>;
}

function isTooltipText(node: ReactNode): node is ReactElement {
  return isValidElement(node) && node.type === TooltipText;
}

export interface TooltipProps {
  children: ReactNode;
  className?: string;
}

/**
 * The tooltip surface. A hairline is inserted automatically between the label
 * and any trailing content (an icon), matching the social `[label ∣ icon]`
 * shape; `aria-hidden` because it's decorative — screen readers get the
 * trigger's `aria-label`.
 */
function TooltipRoot({ children, className }: TooltipProps) {
  const host = useContext(TooltipHostContext);
  const items = Children.toArray(children);
  const label = items.find(isTooltipText);
  const rest = items.filter((child) => !isTooltipText(child));

  return (
    <div
      ref={host?.ref as Ref<HTMLDivElement>}
      className={cx(tooltip(), className)}
      data-visible={host?.visible ? "" : undefined}
      aria-hidden
    >
      {label}
      {rest.length > 0 && <span className={dividerStyle} aria-hidden />}
      {rest}
    </div>
  );
}

export const Tooltip = Object.assign(TooltipRoot, { Text: TooltipText });
