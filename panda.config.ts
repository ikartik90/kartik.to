import { defineConfig, defineRecipe } from "@pandacss/dev";

export default defineConfig({
  presets: [],
  preflight: true,

  include: ["./src/**/*.{js,jsx,ts,tsx}", "./pages/**/*.{js,jsx,ts,tsx}"],
  exclude: [],

  conditions: {
    extend: {
      // @starting-style is not a built-in Panda condition — defined here for transition entry states
      starting: "@starting-style",
      // Extend default `dark` to also respond to [data-theme="dark"] on <html>
      dark: '.dark &, [data-theme="dark"] &',
    },
  },

  theme: {
    // Replace default breakpoints with design system breakpoints (mobile-first)
    breakpoints: {
      md: "820px",
      lg: "1200px",
    },

    extend: {
      tokens: {
        sizes: {
          // Content column width — text elements inside <article> are capped here
          contentColumn: { value: "640px" },
          listingCardWidth: { value: "304px" },
          articleWidth: { value: "960px" },
        },

        colors: {
          neutral: {
            100: { value: "#EEF2F6" },
            200: { value: "#CFD9E2" },
            300: { value: "#A9BFD6" },
            600: { value: "#576675" },
            700: { value: "#414244" },
            800: { value: "#2E3338" },
            900: { value: "#1F2123" },
          },
          brand: {
            orange: { value: "#FFAB6F" },
            pink: { value: "#FF4D97" },
          },
        },

        fonts: {
          switzer: {
            value: "var(--font-switzer), Helvetica, sans-serif",
          },
        },

        fontWeights: {
          base: { value: "400" },
        },

        // Named spacing scale — used for padding, margin, gap, border-radius, border-width
        spacing: {
          none: { value: "0px" },
          "3xs": { value: "0.5px" },
          xxs: { value: "1px" },
          xs: { value: "2px" },
          sm: { value: "4px" },
          md: { value: "8px" },
          lg: { value: "12px" },
          xl: { value: "16px" },
          xxl: { value: "20px" },
          "3xl": { value: "32px" },
          "4xl": { value: "40px" },
          "5xl": { value: "80px" },
          full: { value: "100%" },
        },

        // Border-radius scale — values mirror spacing for concentric radius compliance
        radii: {
          sm: { value: "{spacing.sm}" },
          md: { value: "{spacing.md}" },
        },
      },

      semanticTokens: {
        colors: {
          bg: {
            canvas: {
              value: {
                base: "{colors.neutral.100}",
                _dark: "{colors.neutral.900}",
              },
            },
            itemHover: {
              value:
                "color-mix(in srgb, var(--colors-neutral-600) 25%, transparent)",
            },
            // One step elevated from canvas — used for dialog/surface backgrounds
            surface: {
              value: {
                base: "{colors.neutral.200}",
                _dark: "{colors.neutral.800}",
              },
            },
            selection: {
              value: {
                base: "{colors.brand.orange}",
                _dark: "{colors.brand.pink}",
              },
            },
            // Always a gradient — use with `background`, not `backgroundColor`
            brandedEmphasis: {
              value:
                "linear-gradient(135deg, {colors.brand.pink} 0%, {colors.brand.orange} 100%)",
            },
          },

          text: {
            default: {
              value: {
                base: "{colors.neutral.700}",
                _dark: "{colors.neutral.200}",
              },
            },
            title: {
              value: {
                base: "{colors.neutral.900}",
                _dark: "{colors.neutral.100}",
              },
            },
            paragraph: {
              value: {
                base: "{colors.neutral.600}",
                _dark: "{colors.neutral.300}",
              },
            },
            // Only readable over bg.brandedEmphasis (the gradient) — same in both themes
            brandedEmphasis: {
              value: "{colors.neutral.900}",
            },
            selection: {
              value: "{colors.neutral.900}",
            },
            // Command palette item labels — lighter than text.default in dark mode
            commandItem: {
              value: {
                base: "{colors.neutral.700}",
                _dark: "{colors.neutral.300}",
              },
            },
          },

          border: {
            divider: {
              value:
                "color-mix(in srgb, var(--colors-neutral-600) 25%, transparent)",
            },
            // 10% opacity inset outline for images (interface-design rule 11)
            imageOutline: {
              value: {
                base: "color-mix(in srgb, var(--colors-neutral-900) 10%, transparent)",
                _dark:
                  "color-mix(in srgb, var(--colors-neutral-100) 10%, transparent)",
              },
            },
          },

          logo: {
            default: {
              value: {
                base: "{colors.neutral.600}",
                _dark: "{colors.neutral.300}",
              },
            },
          },
        },
      },

      recipes: {
        inlineCode: defineRecipe({
          className: "inline-code",
          description: "Inline code mark inside article prose.",
          base: {
            textStyle: "inlineCode",
            background: "bg.surface",
            paddingInline: "sm",
            paddingBlock: "xs",
            borderRadius: "sm",
          },
        }),

        articleLink: defineRecipe({
          className: "article-link",
          description: "Hyperlink inside article prose.",
          base: {
            textStyle: "link",
            color: "text.default",
            transition: "color 150ms ease",
            _hover: { color: "text.title" },
          },
        }),

        codeBlock: defineRecipe({
          className: "code-block",
          description:
            "Code block container for article content. Inherited text styles cascade to <code> children; focus ring suppressed for contentEditable use.",
          base: {
            textStyle: "code",
            background: "bg.surface",
            borderRadius: "md",
            padding: "3xl",
            overflowX: "auto",
            color: "text.default",
            whiteSpace: "pre",
            _focusVisible: { outline: "none" },
          },
        }),

        articleFigure: defineRecipe({
          className: "article-figure",
          description: "Figure container for images inside article content.",
          base: {
            width: "token(spacing.full)",
            display: "flex",
            flexDirection: "column",
            gap: "md",
            alignItems: "center",
          },
        }),

        articleImg: defineRecipe({
          className: "article-img",
          description:
            "Image inside article content with inset outline (interface-design rule 11).",
          base: {
            width: "token(spacing.full)",
            borderRadius: "md",
            display: "block",
          },
        }),

        horizontalRule: defineRecipe({
          className: "horizontal-rule",
          description:
            "Horizontal rule rendered identically on both read-only and edit article surfaces.",
          base: {
            border: "none",
            height: "token(spacing.3xs)",
            backgroundColor: "border.divider",
            marginBlock: "3xl",
          },
        }),

        menuIcon: defineRecipe({
          className: "menu-icon",
          description:
            "Shared icon style for menu items — fixed 20px size, never shrinks.",
          base: {
            flexShrink: 0,
            width: "token(spacing.xxl)",
            height: "token(spacing.xxl)",
          },
        }),

        menuItem: defineRecipe({
          className: "menu-item",
          description:
            "Shared item row for the command palette (cmdk) and the slash menu.",
          base: {
            display: "flex",
            alignItems: "center",
            width: "100%",
            gap: "md",
            height: "token(spacing.3xl)",
            paddingInline: "md",
            borderRadius: "sm",
            cursor: "default",
            textStyle: "commandItem",
            color: "text.commandItem",
            // cmdk sets data-selected; slash-menu uses aria-selected on native buttons
            "&[data-selected='true'], &[aria-selected='true']": {
              backgroundColor: "bg.itemHover",
            },
          },
        }),
      },

      textStyles: {
        title: {
          value: {
            fontFamily: "{fonts.switzer}",
            fontWeight: "{fontWeights.base}",
            fontSize: "2rem",
            lineHeight: "1.5",
            letterSpacing: "-1.5%",
          },
        },
        subheading: {
          value: {
            fontFamily: "{fonts.switzer}",
            fontWeight: "{fontWeights.base}",
            fontSize: "1.25rem",
            lineHeight: "1.4",
          },
        },
        paragraph: {
          value: {
            fontFamily: "{fonts.switzer}",
            fontWeight: "{fontWeights.base}",
            fontSize: "1rem",
            lineHeight: "1.75",
          },
        },
        quote: {
          value: {
            fontFamily: "{fonts.switzer}",
            fontWeight: "{fontWeights.base}",
            fontSize: "1.25rem",
            lineHeight: "1.4",
            letterSpacing: "-1%",
          },
        },
        caption: {
          value: {
            fontFamily: "{fonts.switzer}",
            fontWeight: "{fontWeights.base}",
            fontSize: "0.75rem",
            lineHeight: "1.75",
            letterSpacing: "0.5%",
          },
        },
        sidenote: {
          value: {
            fontFamily: "{fonts.switzer}",
            fontWeight: "{fontWeights.base}",
            fontSize: "0.75rem",
            lineHeight: "1.67",
            letterSpacing: "0.5%",
          },
        },
        commandItem: {
          value: {
            fontFamily: "{fonts.switzer}",
            fontWeight: "{fontWeights.base}",
            fontSize: "0.875rem",
            lineHeight: "1.5rem",
          },
        },
        commandLabel: {
          value: {
            fontFamily: "{fonts.switzer}",
            fontWeight: "{fontWeights.base}",
            fontSize: "0.75rem",
            lineHeight: "1.25rem",
          },
        },
        inlineCode: {
          value: {
            fontFamily: "ui-monospace, monospace",
            fontSize: "0.875em",
          },
        },
        link: {
          value: {
            textDecoration: "underline",
            textUnderlineOffset: "3px",
          },
        },
        code: {
          value: {
            fontFamily: "ui-monospace, monospace",
            fontSize: "0.875rem",
            lineHeight: "1.7",
          },
        },
      },
    },
  },

  outdir: "styled-system",
});
