"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { css, cx } from "../../styled-system/css";
import { menuIcon } from "../../styled-system/recipes";
import { Field } from "@/components/ui/input/field";
import SearchIcon from "@/assets/icons/search.svg";

const rowStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "md",
  flexShrink: 0,
  height: "token(spacing.4xl)",
  paddingInline: "lg",
  "&:not(:first-child)": {
    borderTopWidth: "token(spacing.3xs)",
    borderTopStyle: "solid",
    borderTopColor: "field.border.default",
  },
});

const fieldStyle = css({
  flex: "1 0 0",
  minWidth: 0,
  height: "token(spacing.full)",
  padding: 0,
  border: "none",
  background: "transparent",
  color: "field.text.default",
  textStyle: "bodySmall",
  caretColor: "field.text.active",
  focusVisibleRing: "none",
  _focusVisible: { boxShadow: "none" },
  "&::placeholder": { color: "field.text.placeholder" },
  "&::-webkit-search-cancel-button": { display: "none" },
});

const iconStyle = menuIcon();

export interface SearchFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  /** A control at the row's end, after the box. */
  action?: ReactNode;
  /** Applied to the row. */
  className?: string;
}

export function SearchField({
  value,
  onValueChange,
  placeholder,
  ariaLabel,
  onKeyDown,
  action,
  className,
}: SearchFieldProps) {
  return (
    <div className={cx(rowStyle, className)}>
      <SearchIcon className={iconStyle} aria-hidden />
      <Field.Search
        className={fieldStyle}
        value={value}
        onValueChange={onValueChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      {action}
    </div>
  );
}
