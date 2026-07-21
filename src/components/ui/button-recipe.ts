import { cva } from "../../../styled-system/css";

export const buttonRecipe = cva({
  base: {
    cursor: "pointer",
    border: "none",
    transition: "transform 100ms ease",
    _active: { transform: "scale(0.97)" },
    _disabled: {
      opacity: 0.5,
      cursor: "not-allowed",
      pointerEvents: "none",
    },
  },
  variants: {
    variant: {
      secondary: {
        backgroundColor: "bg.button.secondary.default",
        color: "text.commandItem",
        textStyle: "bodySmall",
        paddingInline: "md",
        paddingBlock: "xs",
        borderRadius: "sm",
        _hover: { backgroundColor: "bg.button.secondary.hover" },
      },
      icon: {
        position: "relative",
        display: "inline-flex",
        padding: "sm",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "sm",
        color: "text.commandItem",
        backgroundColor: "transparent",
        "& svg path[stroke]": {
          stroke: "currentColor",
        },
        "& svg path[fill]": {
          fill: "currentColor",
        },
        _after: {
          content: '""',
          position: "absolute",
          width: "token(spacing.3xl)",
          height: "token(spacing.3xl)",
          top: "token(spacing.half)",
          left: "token(spacing.half)",
          transform:
            "translate(calc(-1 * token(spacing.half)), calc(-1 * token(spacing.half)))",
        },
      },
      link: {
        display: "inline",
        padding: "none",
        background: "none",
        color: { base: "brand.pink", _dark: "brand.orange" },
        textStyle: "bodySmall",
        textDecoration: "underline",
        textUnderlineOffset: "3px",
        verticalAlign: "baseline",
        _active: { transform: "none" },
      },
    },
  },
  defaultVariants: {
    variant: "secondary",
  },
});

export type ButtonVariant = "secondary" | "icon" | "link";
