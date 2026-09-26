"use client";

import { forwardRef, useState, type ButtonHTMLAttributes } from "react";
import { css, cx } from "../../../../styled-system/css";
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

const checkboxControlStyle = css({
  position: "relative",
  flexShrink: 0,
  display: "block",
  width: "token(spacing.xxl)",
  height: "token(spacing.xxl)",
  padding: "none",
  margin: "none",
  border: "none",
  background: "none",
  appearance: "none",
  _disabled: { opacity: 0.5 },
});

const checkboxBoxStyle = css({
  position: "absolute",
  top: "token(spacing.xs)",
  left: "token(spacing.xs)",
  width: "token(spacing.xl)",
  height: "token(spacing.xl)",
  borderRadius: "sm",
  backgroundColor: "field.bg.default",
  // Inset box-shadow, not a border, which would shrink the box's interior.
  boxShadow:
    "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-default)",
  color: "field.text.active",
  transition: "background-color 150ms ease, box-shadow 150ms ease",
  "[aria-checked='true'] &": {
    backgroundColor: "field.bg.active",
    boxShadow:
      "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-active)",
    "& > svg": { opacity: 1 },
  },
  // SVGR sets the stroke to currentColor, so `color` above tints it.
  "& > svg": {
    position: "absolute",
    top: "calc(token(spacing.xs) * -1)",
    left: "calc(token(spacing.xs) * -1)",
    width: "token(spacing.xxl)",
    height: "token(spacing.xxl)",
    display: "block",
    pointerEvents: "none",
    opacity: 0,
    transition: "opacity 150ms ease",
  },
});

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

    return (
      <button
        ref={ref}
        id={controlId}
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-describedby={hasHint ? hintId : undefined}
        className={cx(checkboxControlStyle, className)}
        onClick={(e) => {
          onClick?.(e);
          if (e.defaultPrevented) return;
          const next = !checked;
          if (!isControlled) setInternal(next);
          onCheckedChange?.(next);
        }}
        {...rest}
      >
        <span aria-hidden className={checkboxBoxStyle}>
          <CheckSmallIcon />
        </span>
      </button>
    );
  },
);
