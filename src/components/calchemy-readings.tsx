"use client";

import { css, cx } from "../../styled-system/css";
import { hotkey, menuIcon, menuItem } from "../../styled-system/recipes";
import CalendarIcon from "@/assets/icons/calendar.svg";
import type { CalchemyQuery } from "@/hooks/use-calchemy-query";

// ---------------------------------------------------------------------------
// The readings of an ambiguous phrase, offered as a list to walk.
//
// Drawn as menu rows because that is what they are — the same shape, hotkey
// chip and highlight the command palette gives its own — and shared by the
// playground and the article's demo, which ask the identical question of the
// identical parser.
//
// Two states, and they are different things. HIGHLIGHTED is where the arrows
// are: the row wash, the same one hovering gives it, because nothing has been
// decided yet. COMMITTED is what the calendar is drawing, and takes the accent
// a chosen day takes. One attribute holds both so the two can never paint over
// each other.
// ---------------------------------------------------------------------------

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

// The key that would take the highlighted reading, drawn as the key itself —
// the chip the palette wears, held against the far end of the row. Shown on the
// highlight ALONE: it is a statement about what Enter does right now, and three
// of them would be three offers where there is one.
const readingHotkeyStyle = cx(
  hotkey({ surface: "menu" }),
  css({ marginInlineStart: "auto" }),
);

/** U+23CE RETURN SYMBOL — the key's own character, set in the chip's type. */
const RETURN_SYMBOL = "⏎";

export interface CalchemyReadingsProps {
  /** The phrase's state — `candidates`, `activeId`, `committed` and the two acts. */
  query: CalchemyQuery;
  className?: string;
}

/**
 * Renders nothing when the phrase means one thing, so a consumer can hand it
 * the query unconditionally and let the phrase decide whether there is a row.
 */
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
          // Hover MOVES the highlight rather than painting a second one.
          // `menuItem` has no `:hover` of its own — the palette's rows look
          // hovered because cmdk moves its selection on pointer-move — and two
          // highlighted rows, one under the cursor and one under the arrows,
          // would be two answers to "which is this about". The calendar
          // follows, exactly as it does for the arrows.
          onPointerEnter={() => query.preview(candidate.id)}
          // A click is as explicit as Enter, so it does both.
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
