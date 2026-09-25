import { defineSlotRecipe } from "@pandacss/dev";

export const notice = defineSlotRecipe({
  className: "notice",
  description:
    "Notice — an inline informational callout: a leading status icon beside a short run of prose on a subtle neutral wash (bg.notice), composed as Notice > Notice.Icon + Notice.Label (Figma 684:1045 dark, 704:1710 light). The root owns the fill, the row layout, and the single `color` source (field.text.default — the field family's resting accent) that the icon and any emphasized runs inherit; the label dials its own body prose back to 75% so the emphasized dates/days it wraps in <strong> read as the salient bits. Purely presentational — no state, no variants — so it stays a Server Component.",
  slots: ["root", "icon", "label"],
  base: {
    root: {
      display: "flex",
      alignItems: "flex-start",
      gap: "sm",
      width: "token(spacing.full)",
      paddingInline: "md",
      paddingBlock: "md",
      borderRadius: "sm",
      backgroundColor: "bg.notice",
      color: "field.text.default",
    },
    icon: {
      flexShrink: 0,
      display: "block",
      width: "token(spacing.xxl)",
      height: "token(spacing.xxl)",
      "& svg": {
        width: "token(spacing.full)",
        height: "token(spacing.full)",
        display: "block",
      },
      "& svg path[stroke], & svg circle[stroke]": {
        stroke: "currentColor",
      },
      "& svg path[fill], & svg circle[fill]": { fill: "currentColor" },
    },
    label: {
      flex: "1 1 0",
      minWidth: 0,
      textStyle: "sidenote",
      color: "field.text.default/75",
      wordBreak: "break-word",
      "& :is(strong, b)": {
        color: "field.text.default",
        fontWeight: "bold",
      },
    },
  },
});
