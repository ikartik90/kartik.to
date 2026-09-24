import { css, cva } from "../../../../styled-system/css";
import type { KnownOutcome } from "./harness-data";

// ---------------------------------------------------------------------------
// The candidate tables' shared parts — the benchmark's results and its
// suggested candidates (Figma 73:2989, 57:846) are the same table in the
// source: a grey header row, a row of 64px per candidate striped every other
// row, a checkbox column, and rules drawn inside each cell.
// ---------------------------------------------------------------------------

/** How each known outcome is written, part by part — joined by an arrow. */
export const OUTCOME_LABEL: Record<KnownOutcome, string[]> = {
  hired: ["Hired"],
  "archived-interview": ["Interview", "Archived"],
  "archived-application-review": ["Application Review", "Archived"],
};

// A one-sided rule is an inset shadow pushed 1px in from that side and shrunk
// by 1px less the rule, leaving a strip the rule's width. Not an offset of the
// rule's own half pixel: WebKit rounds that to nothing and draws no rule.
// Literal, and each written into a style below: Panda reads a value only in the
// file that writes it, not through an import, so a rule is in the stylesheet
// for the other files that use it only because it is drawn here.
export const RULE_ABOVE =
  "inset 0 1px 0 calc(var(--cashby-rule) - 1px) var(--cashby-border)";
export const RULE_BELOW =
  "inset 0 -1px 0 calc(var(--cashby-rule) - 1px) var(--cashby-border)";
export const RULE_BESIDE_AND_BELOW =
  "inset 1px 0 0 calc(var(--cashby-rule) - 1px) var(--cashby-border), inset 0 -1px 0 calc(var(--cashby-rule) - 1px) var(--cashby-border)";

export const tableScrollStyle = css({ overflowX: "auto" });

export const tableStyle = css({
  width: "100%",
  tableLayout: "fixed",
  borderCollapse: "separate",
  borderSpacing: 0,
});

export const headCellStyle = css({
  height: "40px",
  paddingInline: "8px",
  verticalAlign: "middle",
  backgroundColor: "var(--cashby-fill)",
  font: "var(--cashby-text-body-strong)",
  textAlign: "start",
  whiteSpace: "nowrap",
});

export const nameHeadStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});

export const sortStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "28px",
  height: "28px",
  borderRadius: "4px",
});

export const rowTone = cva({
  base: {},
  variants: {
    tone: {
      plain: {},
      striped: { backgroundColor: "var(--cashby-stripe)" },
      mismatch: { backgroundColor: "var(--cashby-caution-tint)" },
    },
  },
});

export const cellStyle = css({
  position: "relative",
  padding: "8px",
  verticalAlign: "top",
  textAlign: "start",
});

// Every cell is ruled off below; every column after the name, on its left.
export const ruledStyle = css({ boxShadow: RULE_BELOW });
export const ruledBesideStyle = css({ boxShadow: RULE_BESIDE_AND_BELOW });
// No cell is ruled off above, but the footers and the intro's text are.
export const ruledAboveStyle = css({ boxShadow: RULE_ABOVE });

export const checkboxCellStyle = css({ paddingBlock: "10px" });

export const nameCellStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "4px",
});

export const nameStyle = css({
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  font: "var(--cashby-text-body)",
});
