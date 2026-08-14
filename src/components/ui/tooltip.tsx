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

// ---------------------------------------------------------------------------
// Tooltip — the cursor-following hover tooltip, same chrome as the social links
// (a leading label ∣ hairline ∣ trailing 14px glyph). It carries no position or
// visibility of its own: a HOST (Button.Tooltip / Link.Tooltip, which ARE this
// component) supplies the element ref + `visible` through context, wiring it to
// the trigger's hover and the `useCursorTooltip` positioner. Because the box is
// `position: fixed` AND portalled, the host can render it as a plain sibling of
// the trigger and forget about it.
//
//   <Button aria-label="Delete">
//     <TrashIcon />
//     <Button.Tooltip>
//       <Tooltip.Text>Delete</Tooltip.Text>
//       <TrashIcon />
//     </Button.Tooltip>
//   </Button>
//
// PORTALLED TO THE BODY, always. `position: fixed` buys the right COORDINATES,
// never the right to be seen: an ancestor still clips its subtree at paint time,
// and the box is drawn at the VISITOR'S CURSOR — a point on the page at large,
// routinely outside whatever element it labels. A DemoFrame is the standing
// example: `overflow: hidden` over a `container-type`, and containment makes it
// the containing block for a fixed child, so its replay/reset rail's tooltips
// were positioned perfectly and painted nowhere. The tell is a box with a
// correct `getBoundingClientRect`, `opacity: 1`, and no pixels.
//
// The escape lives here rather than in each host because a host cannot know
// what it will be dropped inside — a frame, a popover, a clip-path'd surface —
// and every one of them wants the same answer.
// ---------------------------------------------------------------------------

/** Never changes after the first client render, so there is nothing to subscribe to. */
const subscribeNever = () => () => {};
const onClient = () => true;
const onServer = () => false;

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

export interface TooltipProps extends TooltipVariantProps {
  children: ReactNode;
  className?: string;
}

/**
 * The tooltip surface. A hairline is inserted automatically between the label
 * and any trailing content (an icon), matching the social `[label ∣ icon]`
 * shape; `aria-hidden` because it's decorative — screen readers get the
 * trigger's `aria-label`.
 */
function TooltipRoot({ children, className, ...variants }: TooltipProps) {
  const host = useContext(TooltipHostContext);
  // Portalled only from the second render on. There is no `document` to portal
  // into on the server, and simply branching on that is what CAUSES a mismatch:
  // React hydrates by walking the client tree against the server's markup, and
  // a first client render that differs from the server's — even to nothing in
  // place — is the thing it refuses. Rendering null on both passes and moving
  // in after is the fix, and it costs nothing: the box is decorative, hidden,
  // and wanted no earlier than the first hover. `useSyncExternalStore` with a
  // server snapshot of false is the house way of asking this (see
  // `usePageLoaded`) — false on the server AND through hydration, then true,
  // with no state write in an effect.
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
