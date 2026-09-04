"use client";

import { css, cx } from "../../styled-system/css";
import { menuIcon } from "../../styled-system/recipes";
import { Field } from "@/components/ui/input/field";
import SearchIcon from "@/assets/icons/search.svg";
import type { CalchemyQuery } from "@/hooks/use-calchemy-query";

// ---------------------------------------------------------------------------
// The row a phrase is typed into — the glyph and the box, and the type they are
// set in.
//
// Shared, and that is the whole point of it. The playground and the article's
// demo are the same instrument, so the field cannot be two fields: written out
// twice it drifted immediately, the demo's copy losing the `bodySmall` the
// playground's had and coming out a size larger than the thing it is a demo of.
// One component, one recipe, no way for that to happen again.
//
// The pill AROUND it still belongs to each of them — the playground's is fixed
// to the foot of a page and tracks a rail, the demo's sits at the foot of a
// frame — because that is the part which genuinely differs.
// ---------------------------------------------------------------------------

const rowStyle = css({
  display: "flex",
  alignItems: "center",
  // The gap the command palette puts between a glyph and its label.
  gap: "md",
  flexShrink: 0,
  height: "token(spacing.4xl)",
  paddingInline: "lg",
  // The rule between this row and whatever is above it — the kinds control, or
  // the readings of an ambiguous phrase. Drawn only when there IS something
  // above it: first in its pill, the line would land on the pill's own edge.
  "&:not(:first-child)": {
    borderTopWidth: "token(spacing.3xs)",
    borderTopStyle: "solid",
    borderTopColor: "field.border.default",
  },
});

const fieldStyle = css({
  flex: "1 0 0",
  minWidth: 0,
  height: "full",
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
  /** The phrase's state — the box reads `query` and reports every keystroke. */
  query: CalchemyQuery;
  placeholder: string;
  /**
   * Fired alongside the phrase, for a consumer holding state the phrase
   * invalidates — the playground's hand-made selection, which a new phrase
   * takes the grid back from.
   */
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
        // Enter settles on the reading being previewed, and the arrows walk them
        // while the field keeps focus — the palette's arrangement, and why they
        // are taken here rather than on the rows themselves.
        onKeyDown={query.onKeyDown}
        placeholder={placeholder}
        aria-label="Natural language date query"
      />
    </div>
  );
}
