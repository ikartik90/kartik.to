"use client";

import { forwardRef, useState, type ButtonHTMLAttributes } from "react";
import { cx } from "../../../../styled-system/css";
import { switchField } from "../../../../styled-system/recipes";
import { useField } from "./field";

export interface SwitchProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "onChange" | "type" | "role" | "aria-checked" | "children"
  > {
  /** Controlled on/off state. */
  checked?: boolean;
  /** Initial state when uncontrolled. */
  defaultChecked?: boolean;
  /** Fired with the next state whenever the switch toggles. */
  onCheckedChange?: (checked: boolean) => void;
  /**
   * Override the track/thumb geometry, independent of the field `size` — e.g. a
   * large switch beside a caption-sized label. Unset → follows `<Field size>`.
   */
  size?: "sm" | "lg";
  /** Applied to the control (track). */
  className?: string;
}

/**
 * Toggle switch — the control slot of a `<Field>`. It reads the field context
 * for its id, label association and `aria-describedby` wiring, so `Field.Label`
 * and `Field.Hint` work with it exactly as they do for a text input; it
 * contributes only what is switch-specific: the on/off state and the track +
 * thumb visuals. Its `role="switch"` is what flips the field into the
 * control ∣ label/hint layout. Size comes from the field root (`<Field size>`),
 * so the label typography and the track geometry scale together as a set. State
 * can be controlled (`checked`) or uncontrolled (`defaultChecked`).
 *
 * @example
 * <Field size="lg">
 *   <Switch defaultChecked />
 *   <Field.Label>Wi-Fi</Field.Label>
 *   <Field.Hint>Connect automatically</Field.Hint>
 * </Field>
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  function Switch(
    {
      checked: checkedProp,
      defaultChecked,
      onCheckedChange,
      size: sizeProp,
      className,
      onClick,
      ...rest
    },
    ref,
  ) {
    const { controlId, hintId, hasHint, size } = useField("Switch");

    const isControlled = checkedProp !== undefined;
    const [internal, setInternal] = useState(defaultChecked ?? false);
    const checked = isControlled ? checkedProp : internal;

    // An explicit `size` prop overrides the field default; otherwise follow the
    // field. The switch is designed at sm and lg, so the field's text default
    // (md) coerces to lg — a size-less switch still renders full geometry.
    const resolvedSize = sizeProp ?? (size === "sm" ? "sm" : "lg");
    const styles = switchField({ size: resolvedSize });

    return (
      <button
        ref={ref}
        id={controlId}
        type="button"
        role="switch"
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
        <span aria-hidden className={styles.thumb} />
      </button>
    );
  },
);
