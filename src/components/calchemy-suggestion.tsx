"use client";

import { css, cx } from "../../styled-system/css";
import { menuIcon, menuItem } from "../../styled-system/recipes";
import ReplaceIcon from "@/assets/icons/replace.svg";
import type { CalchemyQuery } from "@/hooks/use-calchemy-query";

// ---------------------------------------------------------------------------
// The phrase the parser would have read instead, offered back as one press.
//
// 0.3.0 of the engine started saying not just that a phrase failed but what it
// was reaching for — a range missing the year that would make it run forwards,
// a numeric date written with spaces. That is worth far more as a button than
// as prose: the fix is a string, and retyping a string is the one thing a
// reader should never have to do by hand.
//
// It shares a slot with the readings, and it cannot collide with them: readings
// come from an AMBIGUOUS phrase and a rewrite from an INVALID one, so a phrase
// is only ever one or the other. Drawn as the same menu row for that reason —
// the same shape in the same place — and told apart by its glyph and by the
// words in front of it, because the two rows ask quite different things. A
// reading asks which of these you meant; this asks whether you meant something
// else entirely.
// ---------------------------------------------------------------------------

const suggestionStyle = css({
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
  paddingBlock: "md",
  paddingInline: "sm",
  // The rule between this row and whatever is above it, drawn only when there
  // IS something above it — the query field's own rule, and for the same
  // reason. The playground stands this under a kinds row and the article's demo
  // puts it first in a pill, where the line would land on the pill's own edge.
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

// Quiet, because it is not the part being offered — the phrase after it is.
const leadStyle = css({ color: "field.text.placeholder" });

const iconStyle = menuIcon();
const offerItemStyle = menuItem();

export interface CalchemySuggestionProps {
  /** The phrase's state — `suggestion`, and the `setQuery` that takes it. */
  query: CalchemyQuery;
  /**
   * Fired alongside the new phrase, for a consumer holding state the phrase
   * invalidates — the same callback the query field takes, because taking the
   * offer is a retype and should look like one from the outside.
   */
  onQueryChange?: (raw: string) => void;
  className?: string;
}

/**
 * Renders nothing when there is nothing to correct, so a consumer can hand it
 * the query unconditionally and let the phrase decide whether there is a row.
 */
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
        // The phrase alone is what the row SHOWS; what pressing it does is said
        // here, where a reader who cannot see the glyph still gets it.
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
