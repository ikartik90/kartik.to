import { defineRecipe } from "@pandacss/dev";

export const demoLoggerSection = defineRecipe({
  className: "demo-logger-section",
  description: "Footer region for demo logger with inset padding.",
  base: {
    width: "token(spacing.full)",
    flexShrink: 0,
    padding: "md",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
});

export const demoLoggerPanel = defineRecipe({
  className: "demo-logger-panel",
  description:
    "Logger shell; height transitions drive expand/collapse layout.",
  base: {
    width: "token(spacing.full)",
    borderRadius: "md",
    backgroundColor: "bg.surface",
    "--colors-field-bg-default":
      "var(--colors-field-bg-default-on-surface)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    height: "token(spacing.4xl)",
    transitionProperty: "height",
    transitionDuration: "200ms",
    transitionTimingFunction: "ease-out",
  },
  variants: {
    expanded: {
      true: {
        height: "calc(320px - 2 * token(spacing.md))",
        _starting: {
          height: "token(spacing.4xl)",
        },
      },
      false: {},
    },
  },
  defaultVariants: {
    expanded: true,
  },
});

export const demoLoggerHeader = defineRecipe({
  className: "demo-logger-header",
  description:
    "Output log panel header with title and collapse toggle.",
  base: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: "md",
    height: "token(spacing.4xl)",
    paddingInline: "lg",
  },
  variants: {
    expanded: {
      true: {
        borderBottomWidth: "token(spacing.3xs)",
        borderBottomStyle: "solid",
        borderBottomColor: "border.divider",
      },
      false: {
        borderBottom: "none",
      },
    },
  },
  defaultVariants: {
    expanded: true,
  },
});

export const demoLoggerBody = defineRecipe({
  className: "demo-logger-body",
  description:
    "Scrollable logger output; fades inside the transitioning panel.",
  base: {
    flex: "1 1 auto",
    flexDirection: "column",
    gap: "xs",
    minHeight: 0,
    display: "flex",
    opacity: 0,
    transform: "translateY(-12px)",
    padding: "none",
    overflow: "hidden",
    pointerEvents: "none",
    transitionProperty: "opacity, transform",
    transitionDuration: "200ms",
    transitionTimingFunction: "ease-out",
  },
  variants: {
    expanded: {
      true: {
        opacity: 1,
        transform: "translateY(0)",
        padding: "md",
        overflow: "auto",
        pointerEvents: "auto",
        _starting: {
          opacity: 0,
          transform: "translateY(-12px)",
        },
      },
      false: {},
    },
  },
  defaultVariants: {
    expanded: true,
  },
});

export const demoLoggerLine = defineRecipe({
  className: "demo-logger-line",
  description: "Single logger output line with level-based color.",
  base: {
    textStyle: "code",
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  variants: {
    level: {
      log: { color: "text.body" },
      info: { color: "text.body" },
      warn: { color: "bg.brandedEmphasis" },
      error: { color: "bg.brandedEmphasis" },
    },
  },
  defaultVariants: {
    level: "log",
  },
});
