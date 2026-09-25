"use client";

import { css, cx } from "../../styled-system/css";
import { hotkey, menuIcon, menuItem } from "../../styled-system/recipes";
import CalendarIcon from "@/assets/icons/calendar.svg";
import type { CalchemyQuery } from "@/hooks/use-calchemy-query";

const readingsStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "sm",
  flexShrink: 0,
  paddingBlock: "md",
  paddingInline: "sm",
  borderTopWidth: "token(spacing.3xs)",
  borderTopStyle: "solid",
  borderTopColor: "field.border.default",
});

const readingStyle = css({
  cursor: "pointer",
  border: "none",
  textAlign: "left",
  "&[data-state='active']": { backgroundColor: "field.bg.hover" },
  "&[data-state='committed']": {
    backgroundColor: "field.bg.active",
    color: "field.text.active",
  },
});

const iconStyle = menuIcon();
const readingItemStyle = menuItem();

const readingHotkeyStyle = cx(
  hotkey({ surface: "menu" }),
  css({ marginInlineStart: "auto" }),
);

const RETURN_SYMBOL = "⏎";

export interface CalchemyReadingsProps {
  query: CalchemyQuery;
  className?: string;
}

export function CalchemyReadings({ query, className }: CalchemyReadingsProps) {
  if (query.candidates.length === 0) return null;

  return (
    <div className={cx(readingsStyle, className)}>
      {query.candidates.map((candidate) => (
        <button
          key={candidate.id}
          type="button"
          className={cx(readingItemStyle, readingStyle)}
          data-state={
            candidate.id === query.committed
              ? "committed"
              : candidate.id === query.activeId
                ? "active"
                : undefined
          }
          aria-current={candidate.id === query.activeId ? "true" : undefined}
          aria-pressed={candidate.id === query.committed}
          // Hover moves the highlight: `menuItem` has no `:hover` of its own.
          onPointerEnter={() => query.preview(candidate.id)}
          onClick={() => {
            query.preview(candidate.id);
            query.commit(candidate.id);
          }}
        >
          <CalendarIcon className={iconStyle} aria-hidden />
          {candidate.label}
          {candidate.id === query.activeId && (
            <kbd className={readingHotkeyStyle} aria-label="Enter">
              {RETURN_SYMBOL}
            </kbd>
          )}
        </button>
      ))}
    </div>
  );
}
