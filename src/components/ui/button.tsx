"use client";

import {
  forwardRef,
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
  type ActionSize,
} from "./action";
import { Tooltip } from "./tooltip";
import { WireframeContent } from "./wireframe";

export type { ActionVariant, ActionEmphasis, ActionSize };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Inferred when unset: a text label ⇒ `text`, an icon alone ⇒ `icon`. */
  variant?: ActionVariant;
  /** Defaults to `secondary` for text buttons, `tertiary` for icon buttons. */
  emphasis?: ActionEmphasis;
  /** Applies to the `text` variant only. */
  size?: ActionSize;
}

function ButtonRoot(
  {
    variant,
    emphasis,
    size = "md",
    className,
    type = "button",
    children,
    onPointerEnter,
    onPointerLeave,
    ...rest
  }: ButtonProps,
  ref: React.Ref<HTMLButtonElement>,
) {
  const { content, hasText, tooltipNode, hasTooltip, visible, show, hide } =
    useActionTooltip(children);
  const resolvedVariant = variant ?? (hasText ? "text" : "icon");
  const resolvedEmphasis =
    emphasis ?? (resolvedVariant === "text" ? "secondary" : "tertiary");

  return (
    <>
      <button
        ref={ref}
        type={type}
        className={cx(
          action({
            variant: resolvedVariant,
            emphasis: resolvedEmphasis,
            size,
          }),
          className,
        )}
        onPointerEnter={(event: PointerEvent<HTMLButtonElement>) => {
          onPointerEnter?.(event);
          if (hasTooltip) show(event);
        }}
        onPointerLeave={(event: PointerEvent<HTMLButtonElement>) => {
          onPointerLeave?.(event);
          if (hasTooltip) hide();
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
