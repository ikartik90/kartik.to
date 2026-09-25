"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { Field, type FieldProps } from "./field";

export interface TextInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "children" | "size"> {
  size?: FieldProps["size"];
  label?: ReactNode;
  hint?: ReactNode;
  /** A bare icon, sized and tinted by the frame; mark it `aria-hidden` if decorative. */
  iconBefore?: ReactNode;
  /** Applied to the field root. */
  className?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput(
    { label, hint, iconBefore, className, size, ...inputProps },
    ref,
  ) {
    return (
      <Field className={className} size={size}>
        {label != null && <Field.Label>{label}</Field.Label>}
        <Field.Frame>
          {iconBefore}
          <Field.Control ref={ref} {...inputProps} />
        </Field.Frame>
        {hint != null && <Field.Hint>{hint}</Field.Hint>}
      </Field>
    );
  },
);
