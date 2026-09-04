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
// inference — notably `variant="link"` for the inline underlined affordance;
// `size="sm"` takes that text chip down to 32px / `bodySmall`.
// The accessible name stays on the button (`aria-label`); the tooltip is
// decorative. Its sibling twin that navigates is `Link` (link.tsx).
// ---------------------------------------------------------------------------

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Override the look. Left unset it's inferred from the children: a `Button.Text`
   * (or bare string) label ⇒ `text`, an icon alone ⇒ `icon`. Set it for `link`.
   */
  variant?: ActionVariant;
  /**
   * Fill prominence, independent of `variant` (the shape). `secondary` is the
   * filled chip; `tertiary` has no resting fill and a subtler hover wash. Left
   * unset it defaults to `secondary` for text buttons and `tertiary` for icon
   * buttons.
   */
  emphasis?: ActionEmphasis;
  /**
   * The chip's scale, independent of both axes above. `md` (default) is the
   * 40px `bodyLarge` chip; `sm` is the 32px `bodySmall` one. Applies to the
   * `text` shape — an icon button is always the toolbar chip.
   */
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
        // Says the tooltip is up, for anything drawn INSTEAD of it — see
        // `MenuButton`'s shortcut chip. A sibling keying off `:hover` would be
        // answering a different question from the tooltip's own, and the two
        // drift apart on any event the browser and React see differently.
        data-tooltip-visible={visible || undefined}
        // WebKit's default sequential focus order — Safari with "Press Tab to
        // highlight each item on a webpage" off, which is how it ships — reaches
        // form fields and anything carrying an EXPLICIT tabindex, and nothing
        // else. A bare <button> is skipped, so on Safari the keyboard tabs
        // straight past every button on the page: out of a form's first text
        // field and into whatever comes after its last one.
        //
        // Written down, the button is in the order in both engines. It changes
        // nothing anywhere else — an explicit 0 puts an element exactly where
        // its DOM position already put it — and it is BEFORE the spread, so a
        // caller taking the button out of the order (`tabIndex={-1}`, a roving
        // toolbar) still wins.
        //
        // Switch, DatePicker and Combobox draw their own <button> and say the
        // same thing for the same reason.
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
