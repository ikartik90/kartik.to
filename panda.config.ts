import { defineConfig } from "@pandacss/dev";

export default defineConfig({
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
          "3xl": { value: "40px" },
          "4xl": { value: "100px" },
          full: { value: "100%" },
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
          },

          border: {
            divider: {
              value: {
                base: "{colors.neutral.200}",
                _dark: "{colors.neutral.800}",
              },
            },
          },
        },
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
          },
        },
      },
    },
  },

  outdir: "styled-system",
});
