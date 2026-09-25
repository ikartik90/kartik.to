import { defineRecipe } from "@pandacss/dev";

export const dialogPanel = defineRecipe({
  className: "dialog-panel",
  description: "Shared dialog panel shell.",
  base: {
    backgroundColor: "bg.surface",
    "--colors-field-bg-default":
      "var(--colors-field-bg-default-on-surface)",
    // Owns the glyph hue: the dialog's icon buttons are `color: inherit`.
    color: "text.body",
    borderRadius: "md",
    borderWidth: "token(spacing.3xs)",
    borderStyle: "solid",
    borderColor: "border.divider",
    overflow: "hidden",
    alignItems: "stretch",
    justifyContent: "flex-start",
    padding: "none",
  },
  variants: {
    size: {
      xs: {
        width:
          "min(token(sizes.dialogXs), calc(100vw - token(spacing.xl) * 2))",
      },
      sm: {
        width:
          "min(token(sizes.dialogSm), calc(100vw - token(spacing.xl) * 2))",
      },
      md: {
        width:
          "min(token(sizes.articleContent), calc(100vw - token(spacing.xl) * 2))",
        height: "token(sizes.insertDialogHeight)",
      },
    },
  },
  defaultVariants: {
    size: "sm",
  },
});

export const dialogHeader = defineRecipe({
  className: "dialog-header",
  description:
    "Dialog title row with bottom divider. Insets its contents 8px — the panel's own `md` corner — so the trailing close chip and the leading title sit on the same margin the shell curves at.",
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    height: "token(spacing.4xl)",
    paddingInline: "md",
    borderBottomWidth: "token(spacing.3xs)",
    borderBottomStyle: "solid",
    borderColor: "border.divider",
    flexShrink: 0,
  },
});

export const dialogTitle = defineRecipe({
  className: "dialog-title",
  description: "Insert-image dialog heading.",
  base: {
    margin: "none",
    padding: "none",
    textStyle: "bodySmall",
    color: "text.body",
    fontWeight: "inherit",
    textWrap: "balance",
  },
});

export const dialogFooter = defineRecipe({
  className: "dialog-footer",
  description:
    "Dialog action row with top divider. Insets its buttons 8px, the same margin the header keeps, so the two rows bracketing the body agree.",
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    height: "token(sizes.dialogFooter)",
    paddingInline: "md",
    borderTopWidth: "token(spacing.3xs)",
    borderTopStyle: "solid",
    borderColor: "border.divider",
    flexShrink: 0,
    marginTop: "auto",
  },
});
