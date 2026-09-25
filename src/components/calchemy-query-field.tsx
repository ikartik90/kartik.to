"use client";

import { css, cx } from "../../styled-system/css";
import { menuIcon } from "../../styled-system/recipes";
import { Field } from "@/components/ui/input/field";
import SearchIcon from "@/assets/icons/search.svg";
import type { CalchemyQuery } from "@/hooks/use-calchemy-query";

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

export interface CalchemyQueryFieldProps {
  query: CalchemyQuery;
  placeholder: string;
  onQueryChange?: (raw: string) => void;
  className?: string;
}

export function CalchemyQueryField({
  query,
  placeholder,
  onQueryChange,
  className,
}: CalchemyQueryFieldProps) {
  return (
    <div className={cx(rowStyle, className)}>
      <SearchIcon className={iconStyle} aria-hidden />
      <Field.Search
        className={fieldStyle}
        value={query.query}
        onValueChange={(raw) => {
          query.setQuery(raw);
          onQueryChange?.(raw);
        }}
        onKeyDown={query.onKeyDown}
        placeholder={placeholder}
        aria-label="Natural language date query"
      />
    </div>
  );
}
