import { css, cva } from "../../../../styled-system/css";
import UpToDateIcon from "./icons/question-mark-badge.svg";
import ChangedIcon from "./icons/changed-warning.svg";

// The outline is an ::after overlay: the white body runs to the edge and would cover a border.
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

// The tint is a gradient over white, not a paler colour, as drawn.
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

export function CriteriaChanged() {
  return (
    <span className={statusBadge({ tone: "caution" })}>
      <ChangedIcon aria-hidden />
      Criteria changed since last test
    </span>
  );
}

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
    // Keyboard focus only: a dialog hands focus back here, lighting it for pointer
    // users. A parent selector because Panda won't emit an `&` mid-selector.
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
    backgroundColor: "var(--cashby-veil)",
    color: "var(--cashby-ink-disabled)",
  },
});

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
