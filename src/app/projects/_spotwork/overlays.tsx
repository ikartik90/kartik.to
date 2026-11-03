"use client";

import type { ReactNode } from "react";
import { css, cx } from "../../../../styled-system/css";
import { valuesStyle } from "./timecard";

// SW Curie's Overlay page (3683:4750): the parts the app's overlays don't already draw. Figma's "Spotter" is "worker".

// Its icon beside its content, its action bar under both.
const submittedStyle = css({
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  alignItems: "flex-start",
  columnGap: "var(--sw-gap-md)",
  rowGap: "var(--sw-gap-xl)",
  padding: "var(--sw-padding-xl)",
  borderRadius: "var(--sw-radius-md)",
  backgroundColor: "var(--sw-surface-warning)",
  boxShadow: "var(--sw-overlay-shadow)",
  color: "var(--sw-glyph-warning)",
  textAlign: "start",
  "& > svg": { flexShrink: 0 },
  "& > [data-action-bar]": {
    gridColumn: "1 / -1",
    padding: "var(--sw-padding-none)",
    paddingBlockStart: "var(--sw-padding-xl)",
    backgroundColor: "transparent",
    boxShadow: "inset 0 1px 0 var(--sw-border-inverted-warning)",
  },
});

const contentStyle = css({ display: "flex", flexDirection: "column", gap: "var(--sw-gap-md)" });

const hoursStyle = css({
  "& > div > span:first-child": { color: "var(--sw-glyph-inverted-subdued)" },
  "& > div > span:nth-child(2)": { color: "var(--sw-glyph-warning)" },
});

/**
 * Molecules/Dialog/Spotter Submitted Hours, as Worker Hours Dialog: the hours the worker sent, to approve or not, named
 * by `label`. Its icon sits beside its `Content`, and its `Dialog.ActionBar` goes under both.
 */
function WorkerHoursDialogRoot({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={submittedStyle} role="dialog" aria-label={label}>
      {children}
    </div>
  );
}
WorkerHoursDialogRoot.displayName = "WorkerHoursDialog";

/** Its title, its text, its `Hours` and their notes. */
function Content({ children }: { children: ReactNode }) {
  return <div className={contentStyle}>{children}</div>;
}
Content.displayName = "WorkerHoursDialog.Content";

/** The hours the worker sent: their Label-value Pairs in a row. */
function Hours({ children }: { children: ReactNode }) {
  return <div className={cx(valuesStyle, hoursStyle)}>{children}</div>;
}
Hours.displayName = "WorkerHoursDialog.Hours";

export const WorkerHoursDialog = Object.assign(WorkerHoursDialogRoot, { Content, Hours });
