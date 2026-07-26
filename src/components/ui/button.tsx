"use client";

import { forwardRef, type ButtonHTMLAttributes, type MouseEvent } from "react";
import { cx } from "../../../styled-system/css";
import { actionRecipe, type ActionVariant } from "./action-recipe";
import { ActionText, useActionTooltip } from "./action";
import { Tooltip } from "./tooltip";

export type { ActionVariant };

// ---------------------------------------------------------------------------
// Button — a <button> that ACTS, composed like OptionList.Option: a bare icon
// child, an optional `Button.Text` label, and an optional `Button.Tooltip` (the
// shared cursor-following tooltip) for icon buttons that want a hint.
//
//   <Button aria-label="Delete">          {/* icon button */}
//     <TrashIcon />
//     <Button.Tooltip>
//       <Tooltip.Text>Delete</Tooltip.Text>
//       <TrashIcon />
//     </Button.Tooltip>
//   </Button>
//
//   <Button onClick={save}>               {/* text button */}
//     <SaveIcon />
//     <Button.Text>Save changes</Button.Text>
//   </Button>
//
// The look comes from the shared `action` recipe: a `Button.Text` (or bare
// string) child ⇒ the 40px/8px `text` chip; an icon alone ⇒ the 28px `icon`
// chip that matches a toolbar button. Pass `variant` only to override that
// inference — notably `variant="link"` for the inline underlined affordance.
// The accessible name stays on the button (`aria-label`); the tooltip is
// decorative. Its sibling twin that navigates is `Link` (link.tsx).
// ---------------------------------------------------------------------------

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Override the look. Left unset it's inferred from the children: a `Button.Text`
   * (or bare string) label ⇒ `text`, an icon alone ⇒ `icon`. Set it for `link`.
   */
  variant?: ActionVariant;
}

function ButtonRoot(
  {
    variant,
    className,
    type = "button",
    children,
    onMouseEnter,
    onMouseLeave,
    ...rest
  }: ButtonProps,
  ref: React.Ref<HTMLButtonElement>,
) {
  const { content, hasText, tooltipNode, hasTooltip, show, hide } =
    useActionTooltip(children);
  const resolvedVariant = variant ?? (hasText ? "text" : "icon");

  return (
    <>
      <button
        ref={ref}
        type={type}
        className={cx(actionRecipe({ variant: resolvedVariant }), className)}
        onMouseEnter={(event: MouseEvent<HTMLButtonElement>) => {
          onMouseEnter?.(event);
          if (hasTooltip) show(event.clientX, event.clientY);
        }}
        onMouseLeave={(event: MouseEvent<HTMLButtonElement>) => {
          onMouseLeave?.(event);
          if (hasTooltip) hide();
        }}
        {...rest}
      >
        {content}
      </button>
      {tooltipNode}
    </>
  );
}

export const Button = Object.assign(forwardRef(ButtonRoot), {
  Text: ActionText,
  Tooltip,
});
