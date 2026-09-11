"use client";

import { forwardRef, type TextareaHTMLAttributes, type ReactNode } from "react";
import { Field, type FieldProps } from "./field";

export interface TextAreaProps
  extends Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    "children" | "size"
  > {
  /**
   * Scales label, value and hint as a set — `sm` through `lg`. Forwarded
   * straight to the field root; see {@link FieldProps.size}.
   */
  size?: FieldProps["size"];
  /** Label rendered above the control and associated with it. */
  label?: ReactNode;
  /** Helper text below the control, linked via aria-describedby. */
  hint?: ReactNode;
  /** Applied to the field root — use it to size or place the whole field. */
  className?: string;
}

/**
 * Flat-prop MULTI-LINE text field — {@link TextInput}'s sibling, assembled from
 * the same {@link Field} primitives so a paragraph and a single line wear one
 * frame, one label treatment and one focus state.
 *
 * Reach for it whenever the value WRAPS. An input hides everything past its
 * right edge, which is survivable for a name and dishonest for prose: the
 * writer cannot see what they have written, so they cannot edit it.
 *
 * Four rows by default — enough to hold a couple of sentences without the box
 * looking like it is asking for an essay. Set `rows` to say otherwise.
 */
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
