import { css, cva } from "../../../../styled-system/css";
import type { KnownOutcome } from "./harness-data";

/** Label parts per outcome, shown joined by an arrow. */
export const OUTCOME_LABEL: Record<KnownOutcome, string[]> = {
  hired: ["Hired"],
  "archived-interview": ["Interview", "Archived"],
  "archived-application-review": ["Application Review", "Archived"],
};

// Inset shadows 1px in, not half-pixel offsets: WebKit rounds those to nothing.
// Keep each used in a style below: Panda extracts literals only from this file.
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

export const ruledStyle = css({ boxShadow: RULE_BELOW });
export const ruledBesideStyle = css({ boxShadow: RULE_BESIDE_AND_BELOW });
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
