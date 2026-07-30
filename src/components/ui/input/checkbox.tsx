"use client";

import { forwardRef, useState, type ButtonHTMLAttributes } from "react";
import { cx } from "../../../../styled-system/css";
import { checkboxField } from "../../../../styled-system/recipes";
import { useField } from "./field";
import CheckSmallIcon from "@/assets/icons/check-small.svg";

export interface CheckboxProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "onChange" | "type" | "role" | "aria-checked" | "children"
  > {
  /** Controlled on/off state. */
  checked?: boolean;
  /** Initial state when uncontrolled. */
  defaultChecked?: boolean;
  /** Fired with the next state whenever the checkbox toggles. */
  onCheckedChange?: (checked: boolean) => void;
  /** Applied to the control (the 20px frame around the box). */
  className?: string;
}

/**
 * Checkbox — the control slot of a `<Field>`, and the Switch's sibling. It reads
 * the field context for its id, label association and `aria-describedby` wiring,
 * so `Field.Label` and `Field.Hint` work with it exactly as they do for a text
 * input; it contributes only what is checkbox-specific: the on/off state and the
 * box + check visuals. Its `role="checkbox"` is what flips the field into the
 * control ∣ label/hint layout. Unlike the Switch it takes no `size` — the box is
 * drawn at one geometry, so `<Field size>` scales the label and hint around a
 * fixed control. State can be controlled (`checked`) or uncontrolled
 * (`defaultChecked`).
 *
 * @example
 * <Field>
 *   <Checkbox defaultChecked />
 *   <Field.Label>Remember me</Field.Label>
 *   <Field.Hint>Stay signed in on this device</Field.Hint>
 * </Field>
 */
export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  function Checkbox(
    {
      checked: checkedProp,
      defaultChecked,
      onCheckedChange,
      className,
      onClick,
      ...rest
    },
    ref,
  ) {
    const { controlId, hintId, hasHint } = useField("Checkbox");

    const isControlled = checkedProp !== undefined;
    const [internal, setInternal] = useState(defaultChecked ?? false);
    const checked = isControlled ? checkedProp : internal;

    const styles = checkboxField();

    return (
      <button
        ref={ref}
        id={controlId}
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-describedby={hasHint ? hintId : undefined}
        className={cx(styles.control, className)}
        onClick={(e) => {
          onClick?.(e);
          if (e.defaultPrevented) return;
          const next = !checked;
          if (!isControlled) setInternal(next);
          onCheckedChange?.(next);
        }}
        {...rest}
      >
        <span aria-hidden className={styles.box}>
          <CheckSmallIcon />
        </span>
      </button>
    );
  },
);
