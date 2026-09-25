"use client";

import { css, cx } from "../../styled-system/css";
import { menuIcon, menuItem } from "../../styled-system/recipes";
import ReplaceIcon from "@/assets/icons/replace.svg";
import type { CalchemyQuery } from "@/hooks/use-calchemy-query";

const suggestionStyle = css({
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
  paddingBlock: "md",
  paddingInline: "sm",
  "&:not(:first-child)": {
    borderTopWidth: "token(spacing.3xs)",
    borderTopStyle: "solid",
    borderTopColor: "field.border.default",
  },
});

const offerStyle = css({
  cursor: "pointer",
  border: "none",
  textAlign: "left",
  _hover: { backgroundColor: "field.bg.hover" },
});

const leadStyle = css({ color: "field.text.placeholder" });

const iconStyle = menuIcon();
const offerItemStyle = menuItem();

export interface CalchemySuggestionProps {
  query: CalchemyQuery;
  onQueryChange?: (raw: string) => void;
  className?: string;
}

export function CalchemySuggestion({
  query,
  onQueryChange,
  className,
}: CalchemySuggestionProps) {
  const { suggestion } = query;
  if (suggestion === null) return null;

  return (
    <div className={cx(suggestionStyle, className)}>
      <button
        type="button"
        className={cx(offerItemStyle, offerStyle)}
        aria-label={`Search for ${suggestion} instead`}
        onClick={() => {
          query.setQuery(suggestion);
          onQueryChange?.(suggestion);
        }}
      >
        <ReplaceIcon className={iconStyle} aria-hidden />
        <span className={leadStyle}>Did you mean</span>
        {suggestion}
      </button>
    </div>
  );
}
