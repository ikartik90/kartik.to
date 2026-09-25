import { defineSlotRecipe } from "@pandacss/dev";

export const notice = defineSlotRecipe({
  className: "notice",
  description:
    "An inline notice: a status icon beside a short message on a tinted background.",
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
