"use client";

import { forwardRef, type TextareaHTMLAttributes, type ReactNode } from "react";
import { Field, type FieldProps } from "./field";

export interface TextAreaProps
  extends Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    "children" | "size"
  > {
  size?: FieldProps["size"];
  label?: ReactNode;
  hint?: ReactNode;
  /** Applied to the field root. */
  className?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea(
    { label, hint, className, size, rows = 4, ...textareaProps },
    ref,
  ) {
    return (
      <Field className={className} size={size}>
        {label != null && <Field.Label>{label}</Field.Label>}
        <Field.Frame>
          <Field.TextArea ref={ref} rows={rows} {...textareaProps} />
        </Field.Frame>
        {hint != null && <Field.Hint>{hint}</Field.Hint>}
      </Field>
    );
  },
);
