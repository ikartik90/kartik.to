"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type PointerEvent,
} from "react";
import { cx } from "../../../styled-system/css";
import { action } from "../../../styled-system/recipes";
import {
  ActionText,
  useActionTooltip,
  type ActionVariant,
  type ActionEmphasis,
  type ActionShape,
  type ActionSize,
} from "./action";
import { Tooltip } from "./tooltip";
import { WireframeContent } from "./wireframe";
import { floatsOverContent } from "@/utils/floats-over-content";

export type { ActionVariant, ActionEmphasis, ActionShape, ActionSize };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Inferred when unset: a text label ⇒ `text`, an icon alone ⇒ `icon`. */
  variant?: ActionVariant;
  /** Defaults to `secondary` for text buttons, `tertiary` for icon buttons. */
  emphasis?: ActionEmphasis;
  /** Applies to the `text` variant only. */
  size?: ActionSize;
  /** Applies to the `icon` variant only. */
  shape?: ActionShape;
}

function ButtonRoot(
  {
    variant,
    emphasis,
    size = "md",
    shape = "square",
    className,
    type = "button",
    children,
    onPointerEnter,
    onPointerLeave,
    ...rest
  }: ButtonProps,
  ref: React.Ref<HTMLButtonElement>,
) {
  const { content, hasText, tooltipNode, visible, show, hide } =
    useActionTooltip(children);
  const resolvedVariant = variant ?? (hasText ? "text" : "icon");
  const resolvedEmphasis =
    emphasis ?? (resolvedVariant === "text" ? "secondary" : "tertiary");

  // Floating over content, its translucent fill would let the content show through: the recipe
  // blurs what's under it (`data-floating`).
  const own = useRef<HTMLButtonElement | null>(null);
  const setRef = useCallback(
    (node: HTMLButtonElement | null) => {
      own.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  useEffect(() => {
    const button = own.current;
    if (button) button.toggleAttribute("data-floating", floatsOverContent(button));
  }, []);

  return (
    <>
      <button
        ref={setRef}
        type={type}
        className={cx(
          action({
            variant: resolvedVariant,
            emphasis: resolvedEmphasis,
            size,
            shape,
          }),
          className,
        )}
        onPointerEnter={(event: PointerEvent<HTMLButtonElement>) => {
          onPointerEnter?.(event);
          show(event);
        }}
        onPointerLeave={(event: PointerEvent<HTMLButtonElement>) => {
          onPointerLeave?.(event);
          hide();
        }}
        // For anything drawn in the tooltip's place, which must key off this rather than `:hover`.
        data-tooltip-visible={visible || undefined}
        // Safari's default Tab order skips a <button> without an explicit tabindex.
        // Before `rest` so a caller's tabIndex still wins.
        tabIndex={0}
        {...rest}
      >
        <WireframeContent>{content}</WireframeContent>
      </button>
      {tooltipNode}
    </>
  );
}

export const Button = Object.assign(forwardRef(ButtonRoot), {
  Text: ActionText,
  Tooltip,
});
