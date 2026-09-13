"use client";

import type { KeyboardEvent } from "react";
import { css, cx } from "../../styled-system/css";
import { menuIcon } from "../../styled-system/recipes";
import { Field } from "@/components/ui/input/field";
import SearchIcon from "@/assets/icons/search.svg";

// ---------------------------------------------------------------------------
// The row something is typed into: the glyph, the box, and the type they are
// set in.
//
// It is the calchemy query field's row, promoted on its second use — the icons
// playground filters its set through the same instrument, and the reason to
// share it is the reason that field's own note gives for existing: written out
// twice it drifts immediately, and what drifts first is the `bodySmall` and
// the 40px, so the copy comes out a size larger than the thing it is a copy
// of. One component, one set of numbers.
//
// What it deliberately does NOT own is the pill around it. The calchemy bar is
// two rows in a floating surface tracking a rail; the icons bar is one row in
// the same surface; a popover's type-ahead is neither. That box genuinely
// differs each time, and this is only the row that goes in it.
//
// Dumb, like the `Field.Search` at its heart: it emits the raw string and has
// no opinion about what matching means.
// ---------------------------------------------------------------------------

const rowStyle = css({
  display: "flex",
  alignItems: "center",
  // The gap the command palette puts between a glyph and its label.
  gap: "md",
  flexShrink: 0,
  height: "token(spacing.4xl)",
  paddingInline: "lg",
  // The rule between this row and whatever is above it — drawn only when there
  // IS something above it: first in its pill, the line would land on the
  // pill's own edge.
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
  /** Fired with the raw string on every keystroke. */
  onValueChange: (value: string) => void;
  placeholder: string;
  /** Names the box — there is no visible label, only the glyph beside it. */
  ariaLabel: string;
  /**
   * Keys taken while the box has focus, for a consumer that walks a list from
   * it — the palette's arrangement, which calchemy's readings follow.
   */
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  /** Applied to the ROW, which is what a pill positions and rules off. */
  className?: string;
}

export function SearchField({
  value,
  onValueChange,
  placeholder,
  ariaLabel,
  onKeyDown,
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
    </div>
  );
}
