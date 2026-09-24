import { css, cva } from "../../../../styled-system/css";
import UpToDateIcon from "./icons/question-mark-badge.svg";
import ChangedIcon from "./icons/changed-warning.svg";

// ---------------------------------------------------------------------------
// The product's pieces that the page and its edit drawer both draw — written
// once here so the two cannot drift apart.
// ---------------------------------------------------------------------------

/**
 * The titled card: a band over a white body, clipped to its corners, with the
 * outline drawn OVER the content as the source does — the white body runs to
 * the edge and would cover a border of the card's own. The page's card is
 * outlined a shade lighter than the drawer's.
 */
export const card = cva({
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    overflow: "hidden",
    borderRadius: "16px",
    backgroundColor: "var(--cashby-fill)",
    _after: {
      content: '""',
      position: "absolute",
      inset: 0,
      borderRadius: "inherit",
      pointerEvents: "none",
    },
  },
  variants: {
    outline: {
      hairline: {
        _after: {
          boxShadow: "inset 0 0 0 var(--cashby-rule) var(--cashby-hairline)",
        },
      },
      border: {
        _after: {
          boxShadow: "inset 0 0 0 var(--cashby-rule) var(--cashby-border)",
        },
      },
    },
  },
  defaultVariants: { outline: "border" },
});

// Ruled off from what it heads, and nowhere else: the card's own outline is
// its edge.
export const cardHeaderStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  height: "48px",
  paddingInline: "8px",
  borderBlockEndWidth: "var(--cashby-rule)",
  borderBlockEndStyle: "solid",
  borderBlockEndColor: "var(--cashby-border)",
});

export const cardTitleBoxStyle = css({
  display: "flex",
  alignItems: "center",
  minWidth: 0,
  height: "32px",
  paddingInline: "6px",
});

// Ends in an ellipsis rather than running under the actions on a narrow window.
export const cardTitleStyle = css({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  font: "var(--cashby-text-card-title)",
});

export const cardActionsStyle = css({
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
});

// A status pill: a tint laid over white, as drawn — not a paler colour. Up to
// date is drawn at a fixed width; the longer caution takes what it needs.
const statusBadge = cva({
  base: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    flexShrink: 0,
    height: "24px",
    paddingInlineStart: "2px",
    paddingInlineEnd: "8px",
    borderRadius: "16px",
    borderWidth: "var(--cashby-rule)",
    borderStyle: "solid",
    backgroundColor: "var(--cashby-surface)",
    font: "var(--cashby-text-label)",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  variants: {
    tone: {
      positive: {
        width: "95px",
        borderColor: "var(--cashby-positive-border)",
        backgroundImage:
          "linear-gradient(var(--cashby-positive-wash), var(--cashby-positive-wash))",
        color: "var(--cashby-positive-ink)",
      },
      caution: {
        borderColor: "var(--cashby-caution-border)",
        backgroundImage:
          "linear-gradient(var(--cashby-caution-wash), var(--cashby-caution-wash))",
        color: "var(--cashby-caution-ink)",
      },
    },
  },
});

export function UpToDate() {
  return (
    <span className={statusBadge({ tone: "positive" })}>
      <UpToDateIcon aria-hidden />
      Up to date
    </span>
  );
}

/** What the drawer says once its criteria are no longer the ones last tested. */
export function CriteriaChanged() {
  return (
    <span className={statusBadge({ tone: "caution" })}>
      <ChangedIcon aria-hidden />
      Criteria changed since last test
    </span>
  );
}

/**
 * The product's accent button: white, ringed in the accent, accent label. Its
 * padding depends on what flanks the label — a leading glyph, glyphs both
 * sides, or none.
 */
export const accentButton = cva({
  base: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    flexShrink: 0,
    height: "32px",
    borderRadius: "8px",
    backgroundColor: "var(--cashby-surface)",
    boxShadow: "inset 0 0 0 var(--cashby-rule) var(--cashby-accent-ring)",
    color: "var(--cashby-accent)",
    font: "var(--cashby-text-body-strong)",
    whiteSpace: "nowrap",
    // Keyboard focus only, as the site gates its own ring (`data-keyboard-focus`):
    // a native dialog hands focus back to what opened it, and a pointer user
    // would be left with a lit button. Written as a parent selector around
    // `_focusVisible` — an `&` mid-selector is not one Panda will emit.
    "html[data-keyboard-focus] &": {
      _focusVisible: {
        boxShadow:
          "inset 0 0 0 var(--cashby-rule) var(--cashby-accent-ring), var(--cashby-focus-ring)",
      },
    },
  },
  variants: {
    glyphs: {
      leading: { paddingInlineStart: "6px", paddingInlineEnd: "8px" },
      both: { paddingInline: "6px" },
      none: { paddingInline: "8px" },
    },
  },
});

export const accentButtonLabelStyle = css({
  minWidth: "32px",
  textAlign: "center",
});

/** The product's plain button: white, hairline border, ink label. */
export const plainButtonStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "4px",
  flexShrink: 0,
  height: "32px",
  borderRadius: "8px",
  borderWidth: "var(--cashby-rule)",
  borderStyle: "solid",
  borderColor: "var(--cashby-border)",
  backgroundColor: "var(--cashby-surface)",
  font: "var(--cashby-text-body-strong)",
  "html[data-keyboard-focus] &": {
    _focusVisible: { boxShadow: "var(--cashby-focus-ring)" },
  },
  _disabled: {
    // Washed rather than white: the bar it sits on shows through.
    backgroundColor: "var(--cashby-veil)",
    color: "var(--cashby-ink-disabled)",
  },
});

// The product's primary button: white on the accent — Retest criteria, Validate
// when it is the thing to do next, a dialog's Close. The ring sits off the
// button so it shows against the accent.
export const primaryButtonStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "4px",
  flexShrink: 0,
  height: "32px",
  paddingInline: "8px",
  borderRadius: "8px",
  backgroundColor: "var(--cashby-accent)",
  color: "var(--cashby-surface)",
  font: "var(--cashby-text-body-strong)",
  whiteSpace: "nowrap",
  "html[data-keyboard-focus] &": {
    _focusVisible: {
      boxShadow:
        "0 0 0 1.5px var(--cashby-surface), 0 0 0 3px var(--cashby-accent)",
    },
  },
});

export const plainButtonLabelStyle = css({
  maxWidth: "148px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
