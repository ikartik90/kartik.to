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
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Overrides the field's size for the track; unset follows `<Field size>`. */
  size?: "sm" | "md" | "lg";
  /** Applied to the track. */
  className?: string;
}

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

    // The field's md (the text default) coerces to lg.
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
        // WebKit's default Tab order skips a bare <button>.
        tabIndex={0}
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
