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
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Applied to the 20px frame, not the box. */
  className?: string;
}

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
