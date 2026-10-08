import { css } from "../../../styled-system/css";

// What the UX gaps draw with: their legend's marks, and the legend beside its diagram.

export const eyebrowStyle = css({ textStyle: "caption", color: "text.body" });

export const markerStyle = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: "listMarker",
  height: "listMarker",
  borderRadius: "full",
  // The brand colour on its own 15% tint, laid on the sheet's ground so nothing under the mark shows through.
  backgroundColor: "var(--sheet-ground, token(colors.bg.surface))",
  backgroundImage: "linear-gradient(token(colors.bg.highlight), token(colors.bg.highlight))",
  textStyle: "caption",
  color: "text.highlight",
  fontVariantNumeric: "tabular-nums",
});

export const legendAndDiagramStyle = css({
  display: "grid",
  gridTemplateColumns: "1fr 2fr",
  gap: "4xl",
  alignItems: "center",
  "&[data-align=start]": { alignItems: "start" },
  // 40 / 60, the diagram the wider.
  "&[data-columns=wide-diagram]": { md: { gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)" } },
  mdDown: { gridTemplateColumns: "1fr", gap: "3xl" },
});
