import { defineConfig, defineRecipe, defineSlotRecipe } from "@pandacss/dev";

/**
 * check-small.svg / cross-small.svg as masks, so the brand gradient can be
 * painted through them. A mask reads alpha: keep `fill='none'` or the glyph
 * masks as a filled blob instead of its stroke. Hand-synced with the .svg files.
 */
const CHECK_GLYPH_MASK =
  "url(\"data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M7.05994 10.1813L9.14253 12.6249L12.9396 7.62488' stroke='white' stroke-width='1.25' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

const CROSS_GLYPH_MASK =
  "url(\"data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.5 7.5L7.5 12.5M12.5 12.5L7.5 7.5' stroke='white' stroke-width='1.25' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

/**
 * blockquote.svg as two masks off the SAME path — `fill` gives the body,
 * `stroke` the contour — so the mark can be a translucent wash with a solid
 * edge inside it. Two layers, because one mask reveals one colour. The glyph's
 * lean is drawn into the artwork, not CSS.
 *
 * NOTE: a COPY of the .svg, not a reference — nothing imports that file.
 * Re-inline the path whenever the artwork changes or the two silently drift.
 */
const QUOTE_GLYPH_PATH =
  "M10.9494 8.65295C11.8225 8.41923 12.7194 8.93811 12.9533 9.81116C13.0483 10.1658 13.0219 10.5421 12.8772 10.8795C11.447 14.2114 11.3904 18.3371 12.7082 23.2555C15.3871 22.5377 18.0665 21.82 20.7453 21.1022C21.8548 20.8051 22.9949 21.4635 23.2922 22.5729L27.5989 38.6461C27.8962 39.7557 27.2378 40.8957 26.1282 41.193L12.0647 44.9615C10.9551 45.2589 9.81415 44.6005 9.51683 43.4908C8.26072 38.803 7.00438 34.1152 5.74827 29.4274C3.05655 19.3817 8.94032 9.1913 10.9494 8.65295ZM33.053 9.151C33.7647 8.96045 34.496 9.38266 34.6867 10.0944C34.7642 10.3835 34.7422 10.6903 34.6242 10.9655C33.4584 13.6815 33.4122 17.0449 34.4866 21.0543C36.6703 20.4692 38.8546 19.8836 41.0383 19.2985C41.9427 19.0564 42.8721 19.5934 43.1145 20.4977L46.6252 33.6002C46.8675 34.5047 46.3305 35.434 45.426 35.6764L33.9621 38.7487C33.0576 38.991 32.1274 38.454 31.885 37.5494C30.8611 33.7282 29.8376 29.9068 28.8137 26.0856C26.6195 17.8966 31.4152 9.58985 33.053 9.151Z";

const quoteGlyphMask = (paint: string) =>
  `url("data:image/svg+xml,%3Csvg width='52' height='52' viewBox='0 0 52 52' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='${QUOTE_GLYPH_PATH}' ${paint}/%3E%3C/svg%3E")`;

const QUOTE_GLYPH_FILL_MASK = quoteGlyphMask("fill='white'");

/**
 * Stroked at 2px — DOUBLE the 1px edge it draws. An SVG stroke straddles its
 * path, so intersecting with the body mask discards the outer half.
 */
const QUOTE_GLYPH_STROKE_MASK = quoteGlyphMask(
  "fill='none' stroke='white' stroke-width='2' stroke-linejoin='round'",
);

/**
 * The column every list marker occupies — a fixed 24px box centring whatever
 * ink the marker draws, on the first text line via `marginBlockStart` of
 * (28px bodyLarge line box - 24) / 2. Fixed so the prose column starts at the
 * same x for every list style, whatever size the ink inside happens to be.
 */
const markerAlignmentBox = {
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "token(sizes.listMarker)",
  minWidth: "token(sizes.listMarker)",
  marginBlockStart: "xs",
  userSelect: "none",
  pointerEvents: "none",
} as const;

export default defineConfig({
  presets: [],
  preflight: true,

  include: ["./src/**/*.{js,jsx,ts,tsx}", "./pages/**/*.{js,jsx,ts,tsx}"],
  exclude: [],

  conditions: {
    extend: {
      starting: "@starting-style",
      dark: '.dark &, [data-theme="dark"] &',
      demoFrameNarrow: "@container demoFrame (max-width: 760px)",
      demoFrameCompact: "@container demoFrame (max-width: 535px)",
    },
  },

  theme: {
    breakpoints: {
      md: "820px",
      lg: "1200px",
    },

    extend: {
      tokens: {
        sizes: {
          articleContent: { value: "640px" },
          dialogSm: { value: "480px" },
          listingCardWidth: { value: "304px" },
          articleShowcase: { value: "960px" },
          calchemyDemo: { value: "720px" },
          librarySidebar: { value: "200px" },
          imagePreviewMax: { value: "280px" },
          insertDialogHeight: { value: "480px" },
          dialogFooter: { value: "52px" },
          quoteMark: { value: "52px" },
          tooltipIcon: { value: "14px" },
          // Square at a single digit, pill beyond (Figma 413:684/688).
          listMarker: { value: "24px" },
          // Also the weekday header cell and the month chevrons, so the whole
          // grid keeps one column pitch (Figma 563:3377).
          calendarDay: { value: "24px" },
          // Three day columns (3 × 24), so the fade spans the clipped column
          // plus enough of its neighbours to read as a gradient (Figma 723:2265).
          calendarNavZone: { value: "72px" },
          // Fixed like the calendar's 208px pitch, so a select popover and a
          // date popover read as siblings (Figma 647:2383, 629:1416).
          optionListWidth: { value: "208px" },
          // Option row hit target: 24px line + 2×4 inset (Figma 647:2387).
          optionRow: { value: "32px" },
          listBullet: { value: "8px" },
          // Larger than the 16px chip it sits in, so it overhangs the way the
          // source icons do.
          listBulletGlyph: { value: "20px" },
          toolbarButton: { value: "28px" },
          sidenoteWidth: { value: "320px" },
          // Per spec: 100px right of the text content.
          sidenoteOffset: { value: "100px" },
          // Centred (stacked) fallback: content-column width minus this inset.
          sidenoteStackedInset: { value: "80px" },
          sidenoteMinWidth: { value: "320px" },
          sidenoteMaxWidth: { value: "480px" },
        },

        colors: {
          neutral: {
            100: { value: "#EEF2F6" },
            200: { value: "#D8DDE3" },
            300: { value: "#C3CDD7" },
            400: { value: "#A9BFD6" },
            500: { value: "#576675" },
            600: { value: "#414244" },
            700: { value: "#384047" },
            800: { value: "#2E3338" },
            900: { value: "#1F2123" },
          },
          brand: {
            rust: { value: "#41362E" },
            orange: { value: "#FFAB6F" },
            rosemilk: { value: "#F2C9DE" },
            pink: { value: "#FF4D97" },
          },
        },

        fonts: {
          switzer: {
            value: "var(--font-switzer), Helvetica, sans-serif",
          },
          jetbrainsMono: {
            value: "var(--font-jetbrains-mono), ui-monospace, monospace",
          },
        },

        fontWeights: {
          base: { value: "400" },
          medium: { value: "500" },
          bold: { value: "550" },
        },

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
          half: { value: "50%" },
          full: { value: "100%" },
        },

        // Mirrors spacing, for concentric radius compliance.
        radii: {
          sm: { value: "{spacing.sm}" },
          md: { value: "{spacing.md}" },
          lg: { value: "{spacing.lg}" },
          xl: { value: "{spacing.xl}" },
          // Pill. `spacing.half` (50%) is the CIRCLE radius — on an oblong box
          // it draws an ellipse, not a stadium — so anything that can widen
          // needs a large absolute radius the box's half-height clamps down.
          full: { value: "9999px" },
        },
      },

      containerNames: ["demoFrame"],

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
                "color-mix(in srgb, var(--colors-neutral-500) 25%, transparent)",
            },
            // A touch lighter than itemHover, so the message reads as inset
            // without competing with the fields around it (Figma 684:1045 dark
            // 20% / 704:1710 light 15%).
            notice: {
              value: {
                base: "color-mix(in srgb, var(--colors-neutral-500) 15%, transparent)",
                _dark:
                  "color-mix(in srgb, var(--colors-neutral-500) 20%, transparent)",
              },
            },
            button: {
              secondary: {
                // Lighter in light UI — on a pale canvas the chip needs far
                // less alpha to read as a filled surface.
                default: {
                  value: {
                    base: "color-mix(in srgb, var(--colors-neutral-500) 15%, transparent)",
                    _dark:
                      "color-mix(in srgb, var(--colors-neutral-500) 25%, transparent)",
                  },
                },
                hover: {
                  value: {
                    base: "color-mix(in srgb, var(--colors-neutral-500) 25%, transparent)",
                    _dark:
                      "color-mix(in srgb, var(--colors-neutral-500) 50%, transparent)",
                  },
                },
              },
            },
            // The chip behind a list marker's ink. Matches `surface` today but
            // kept separate: a dialog-surface retune should not resize the
            // contrast a 16px marker depends on.
            listMarker: {
              value: {
                base: "{colors.neutral.200}",
                _dark: "{colors.neutral.800}",
              },
            },
            surface: {
              value: {
                base: "{colors.neutral.200}",
                _dark: "{colors.neutral.800}",
              },
            },
            // `field.bg.default` composited over `surface` — the calendar's own
            // surface as ONE opaque colour, which the edge scrims need as a
            // solid gradient stop. Written as the composite rather than the hex
            // so it tracks either half: dark is 25% #576675 over #2E3338 =
            // #384047, the Figma value (723:2265).
            calendarScrim: {
              value: {
                base: "color-mix(in srgb, var(--colors-neutral-500) 15%, var(--colors-neutral-200))",
                _dark:
                  "color-mix(in srgb, var(--colors-neutral-500) 25%, var(--colors-neutral-800))",
              },
            },
            // The marquee drag band's fill — 5%, not the selected chip's 15%,
            // because it is laid OVER cells already painting their selection.
            calendarMarquee: {
              value: {
                base: "color-mix(in srgb, var(--colors-brand-pink) 5%, transparent)",
                _dark:
                  "color-mix(in srgb, var(--colors-brand-orange) 5%, transparent)",
              },
            },
            selection: {
              value: {
                base: "{colors.brand.orange}",
                _dark: "{colors.brand.pink}",
              },
            },
            // Prose highlight (<mark>) fill, paired with `text.highlight`.
            highlight: {
              value: {
                base: "color-mix(in srgb, var(--colors-brand-pink) 15%, transparent)",
                _dark:
                  "color-mix(in srgb, var(--colors-brand-orange) 15%, transparent)",
              },
            },
            // Always a gradient — use with `background`, not `backgroundColor`
            brandedEmphasis: {
              value: {
                base: "linear-gradient(135deg, {colors.brand.orange} 0%, {colors.brand.pink} 60%)",
                _dark:
                  "linear-gradient(135deg, {colors.brand.pink} 40%, {colors.brand.orange} 100%)",
              },
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
            body: {
              value: {
                base: "{colors.neutral.500}",
                _dark: "{colors.neutral.400}",
              },
            },
            // Only readable over bg.brandedEmphasis (the gradient) — same in both themes
            brandedEmphasis: {
              value: "{colors.neutral.900}",
            },
            selection: {
              value: "{colors.neutral.900}",
            },
            highlight: {
              value: {
                base: "{colors.brand.pink}",
                _dark: "{colors.brand.orange}",
              },
            },
          },

          border: {
            divider: {
              value:
                "color-mix(in srgb, var(--colors-neutral-500) 25%, transparent)",
            },
            // 10% opacity inset outline for images (interface-design rule 11)
            imageOutline: {
              value: {
                base: "color-mix(in srgb, var(--colors-neutral-900) 10%, transparent)",
                _dark:
                  "color-mix(in srgb, var(--colors-neutral-100) 10%, transparent)",
              },
            },
            focusRing: {
              value: {
                base: "{colors.brand.pink}",
                _dark: "{colors.brand.orange}",
              },
            },
          },

          logo: {
            default: {
              value: {
                base: "{colors.neutral.500}",
                _dark: "{colors.neutral.400}",
              },
            },
          },

          // The text-input family, shared by every input that uses the same
          // frame. `active` is the brand hue, matching border.focusRing;
          // bg/border are translucent mixes so the frame reads as a subtle
          // fill (Figma 586:876).
          field: {
            bg: {
              default: {
                value: {
                  base: "color-mix(in srgb, var(--colors-neutral-500) 15%, transparent)",
                  _dark:
                    "color-mix(in srgb, var(--colors-neutral-500) 25%, transparent)",
                },
              },
              active: {
                value: {
                  base: "color-mix(in srgb, var(--colors-brand-pink) 15%, transparent)",
                  _dark:
                    "color-mix(in srgb, var(--colors-brand-orange) 15%, transparent)",
                },
              },
              // Opaque, because the popover COVERS the field it belongs to and
              // so can't be translucent like `active` (Figma 631:894/631:898).
              popover: {
                value: {
                  base: "{colors.brand.rosemilk}",
                  _dark: "{colors.brand.rust}",
                },
              },
              // Selected chip inside that popover — neutral, so it reads
              // against the brand-tinted surface (Figma 563:2726/563:2767).
              selected: {
                value: {
                  base: "color-mix(in srgb, var(--colors-neutral-600) 15%, transparent)",
                  _dark:
                    "color-mix(in srgb, var(--colors-neutral-400) 15%, transparent)",
                },
              },
              // The low-emphasis hover wash — option rows, icon buttons and
              // tertiary buttons all take it (`hoverBrand` is its onBrand twin;
              // Figma 647:2389, 629:1419). Deliberately the SAME value as
              // `bg.default` and `bg.button.secondary.default`, so a tertiary
              // hover lands exactly on the secondary chip; over a field surface
              // the two translucent layers stack and the row still lifts.
              hover: {
                value: {
                  base: "color-mix(in srgb, var(--colors-neutral-500) 15%, transparent)",
                  _dark:
                    "color-mix(in srgb, var(--colors-neutral-500) 25%, transparent)",
                },
              },
              hoverBrand: {
                value: {
                  base: "color-mix(in srgb, var(--colors-brand-pink) 10%, transparent)",
                  _dark:
                    "color-mix(in srgb, var(--colors-brand-orange) 5%, transparent)",
                },
              },
            },
            border: {
              default: {
                value: {
                  base: "color-mix(in srgb, var(--colors-neutral-500) 25%, transparent)",
                  _dark:
                    "color-mix(in srgb, var(--colors-neutral-500) 50%, transparent)",
                },
              },
              active: {
                value: {
                  base: "color-mix(in srgb, var(--colors-brand-pink) 25%, transparent)",
                  _dark:
                    "color-mix(in srgb, var(--colors-brand-orange) 25%, transparent)",
                },
              },
            },
            text: {
              // Resting value + leading icon.
              default: {
                value: {
                  base: "{colors.neutral.600}",
                  _dark: "{colors.neutral.400}",
                },
              },
              // Resting label + hint (value @ 50%).
              muted: {
                value: {
                  base: "color-mix(in srgb, var(--colors-neutral-600) 50%, var(--colors-neutral-200))",
                  _dark:
                    "color-mix(in srgb, var(--colors-neutral-400) 50%, var(--colors-neutral-800))",
                },
              },
              // One step fainter than `muted`, so an empty field reads as
              // unfilled without dragging labels/hints down with it.
              placeholder: {
                value: {
                  base: "color-mix(in srgb, var(--colors-neutral-600) 25%, transparent)",
                  _dark:
                    "color-mix(in srgb, var(--colors-neutral-400) 25%, transparent)",
                },
              },
              // Active label / value / leading icon accent.
              active: {
                value: {
                  base: "{colors.brand.pink}",
                  _dark: "{colors.brand.orange}",
                },
              },
              // `placeholder`'s counterpart on a brand-tinted surface.
              activeMuted: {
                value: {
                  base: "color-mix(in srgb, var(--colors-brand-pink) 25%, transparent)",
                  _dark:
                    "color-mix(in srgb, var(--colors-brand-orange) 25%, transparent)",
                },
              },
            },
          },
        },
      },

      keyframes: {
        // Driven by background-position on an over-wide gradient (see the
        // `skeleton` recipe) so it composites on the GPU and never reflows.
        wireframeShimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },

      recipes: {
        // The wireframe scope — the provider's root element. Turning text into
        // bars is the primitives' job (only the component knows WHICH of its
        // parts are text); this owns what is genuinely scope-wide — the
        // dimming, the shimmer switch, the pointer suppression.
        wireframe: defineRecipe({
          className: "wireframe",
          description:
            "The wireframe/skeleton scope. Wraps any subtree; the text-bearing primitives inside it read the matching React context and swap their text for a `skeleton` bar of the same line box. `mode` picks the intent: `placeholder` dims the block to 25% for demo layouts that present a shape rather than content (Figma 745:4375 / 745:4080), `loading` keeps it at full strength and shimmers while real content is pending. Interactivity and the aria semantics are set by the component, not here — a non-interactive scope is `inert`, a placeholder is `aria-hidden`, a loading scope is `aria-busy`.",
          base: {
            // The same box the scope renders when disabled, so flipping
            // `enabled` never shifts the layout around it. Bars draw from each
            // text node's own `currentColor`, so this needs no colour.
            display: "block",
          },
          variants: {
            // Four deliberate depths (background furniture → foreground
            // subject), not a free dial. 25 is the Figma's recessed demo block
            // (745:4383); 100 is for when the wireframe IS the subject.
            opacity: {
              25: { opacity: 0.25 },
              50: { opacity: 0.5 },
              75: { opacity: 0.75 },
              100: { opacity: 1 },
            },
            mode: {
              placeholder: {
                // A placeholder never advertises a hit target, even when the
                // scope stays interactive.
                cursor: "default",
                "& *": { cursor: "default" },
              },
              loading: {
                "& [data-skeleton]::after": {
                  // The highlight is a translucent DIP in currentColor, not a
                  // blend toward a named surface, so it reads correctly
                  // wherever the bar sits. The flat fill has to go, or it would
                  // back the dip and defeat it.
                  backgroundColor: "transparent",
                  backgroundImage:
                    "linear-gradient(90deg, currentColor 0%, currentColor 35%, color-mix(in srgb, currentColor 30%, transparent) 50%, currentColor 65%, currentColor 100%)",
                  backgroundSize: "200% 100%",
                  animation: "wireframeShimmer 1.6s ease-in-out infinite",
                },
                "@media (prefers-reduced-motion: reduce)": {
                  "& [data-skeleton]::after": { animation: "none" },
                },
              },
            },
          },
          defaultVariants: { mode: "placeholder", opacity: 50 },
          // Runtime variant values — force every branch to be emitted.
          staticCss: [{ mode: ["*"], opacity: ["*"] }],
        }),

        action: defineRecipe({
          className: "action",
          description:
            "The one look shared by the two actionable primitives — Button (a <button> that ACTS) and Link (an <a>/next-link that NAVIGATES) — so their skin lives in the design system once and both consume it. `text` = the standalone CTA (filled secondary chip, 8px radius, fixed 40px height, hugs content with an 80px floor); `icon` = the compact 28px toolbar chip (`color: inherit` so the surface owns the glyph hue — the calendar chevrons and their onBrand retint); `link` = an inline underlined text link. Orthogonal to that shape axis, `emphasis` sets the fill prominence: `secondary` (the filled chip drawn above) or `tertiary` (no fill at rest, the neutral `field.bg.hover` on hover — the same wash icon buttons use). Icon buttons are tertiary by nature.",
          base: {
            cursor: "pointer",
            border: "none",
            appearance: "none",
            textDecoration: "none",
            // Hug the content. A flex item's display is blockified, so a
            // flex-column / grid parent's `stretch` would otherwise pull the
            // control across the cross axis; `fit-content` opts out.
            width: "fit-content",
            transition:
              "transform 100ms ease, background-color 150ms ease, color 150ms ease",
            _active: { transform: "scale(0.97)" },
            _disabled: {
              opacity: 0.5,
              cursor: "not-allowed",
              pointerEvents: "none",
            },
            // Composed icons track the resolved text colour and hold a 20px box.
            "& svg": {
              width: "token(spacing.xxl)",
              height: "token(spacing.xxl)",
              flexShrink: 0,
              display: "block",
            },
            "& svg path[stroke]": { stroke: "currentColor" },
            "& svg path[fill]": { fill: "currentColor" },
          },
          variants: {
            variant: {
              text: {
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                // Space a leading icon from the label when both compose.
                gap: "md",
                height: "token(spacing.4xl)",
                // Floor a short label (Cancel / OK) to a substantial chip.
                minWidth: "token(spacing.5xl)",
                paddingInline: "lg",
                borderRadius: "md",
                backgroundColor: "bg.button.secondary.default",
                color: "text.body",
                textStyle: "bodyLarge",
                _hover: { backgroundColor: "bg.button.secondary.hover" },
              },
              icon: {
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                // Space icon ∣ optional label (the ← Home link).
                gap: "sm",
                padding: "sm",
                borderRadius: "sm",
                color: "inherit",
                // For the icon+label case; harmless for the icon-only majority.
                textStyle: "bodySmall",
                backgroundColor: "transparent",
                _hover: { backgroundColor: "field.bg.hover" },
                "html[data-keyboard-focus] &:focus-visible": {
                  boxShadow:
                    "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
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
            // Fill prominence — orthogonal to `variant` (the shape). Both are
            // empty here: `secondary` is what `text` already draws, and
            // `tertiary` is applied by the compound below. Inert for `icon`,
            // which is tertiary by nature.
            emphasis: {
              secondary: {},
              tertiary: {},
            },
          },
          compoundVariants: [
            {
              variant: "text",
              emphasis: "tertiary",
              // Overrides the secondary fill/hover the `text` variant supplies:
              // both land as atomic utilities (later cascade layer), so they win.
              css: {
                backgroundColor: "transparent",
                _hover: { backgroundColor: "field.bg.hover" },
              },
            },
          ],
          defaultVariants: { variant: "text", emphasis: "secondary" },
          // Runtime variant values — force every branch to be emitted.
          staticCss: [{ variant: ["*"], emphasis: ["*"] }],
        }),

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
          description:
            "Hyperlink inside article prose. The underline is drawn as two stacked background bars, not text-decoration, so the hover state can be the brand gradient (text-decoration-color can't be a gradient): a neutral color-mix bar (text.body @ 50%) with the brandedEmphasis gradient layered on top, hidden at rest and grown in on hover. box-decoration-break:clone repeats the bars on each line of a wrapped link.",
          base: {
            // The underline is the background bars below, so suppress the UA's.
            textDecorationLine: "none",
            color: "text.default",
            paddingBottom: "xs",
            backgroundImage:
              "token(colors.bg.brandedEmphasis), linear-gradient(color-mix(in srgb, var(--colors-text-body) 50%, transparent), color-mix(in srgb, var(--colors-text-body) 50%, transparent))",
            backgroundRepeat: "no-repeat",
            // Bottom-anchored, so the gradient grows upward to exactly cover
            // the neutral bar on hover.
            backgroundPosition: "0 100%",
            backgroundSize: "100% 0, 100% token(spacing.xxs)",
            WebkitBoxDecorationBreak: "clone",
            boxDecorationBreak: "clone",
            transition: "color 150ms ease, background-size 150ms ease",
            _hover: {
              color: "text.title",
              backgroundSize:
                "100% token(spacing.xxs), 100% token(spacing.xxs)",
            },
          },
        }),

        articleUnderline: defineRecipe({
          className: "article-underline",
          description: "Solid underline mark inside article prose.",
          base: {
            textDecorationLine: "underline",
            textDecorationStyle: "solid",
            textUnderlineOffset: "0.15em",
          },
        }),

        articleStrikethrough: defineRecipe({
          className: "article-strikethrough",
          description: "Strikethrough mark inside article prose.",
          base: {
            textDecorationLine: "line-through",
          },
        }),

        articleHighlight: defineRecipe({
          className: "article-highlight",
          description:
            "Highlight mark (<mark>) inside article prose — the brand accent at 15% behind the accent at full strength (pink in light, orange in dark). Flat colour, not the brand gradient, so the marked text stays legible as prose rather than reading as a badge.",
          base: {
            backgroundColor: "bg.highlight",
            color: "text.highlight",
            paddingInline: "xxs",
            paddingBlock: "xxs",
            boxDecorationBreak: "clone",
            WebkitBoxDecorationBreak: "clone",
            // Keep nested marks on the highlight's own colour (see self-improvement.md).
            "& :is(strong, b, em, i, u, s, code, a)": {
              color: "inherit",
            },
          },
        }),

        articleSidenote: defineRecipe({
          className: "article-sidenote",
          description:
            "Sidenote annotation mark — wraps the annotated run of prose plus its ordinal superscript. Carries an `anchor-name` (set inline, per note) the aside card positions against; the dotted underline lives on the inner articleSidenoteText span.",
          base: {
            cursor: "default",
            // Nested marks keep their own colour; only the underline is added.
            "& :is(strong, b, em, i, u, s, code, a)": { color: "inherit" },
          },
        }),

        articleSidenoteText: defineRecipe({
          className: "article-sidenote-text",
          description:
            "The annotated prose inside a sidenote mark — a dotted underline signals the margin note. The underline sits HERE rather than on the wrapper so it never runs beneath the ordinal superscript, which is a sibling of this span (see articleSidenoteRef).",
          base: {
            textDecorationLine: "underline",
            textDecorationStyle: "dotted",
            textDecorationColor:
              "color-mix(in srgb, var(--colors-text-body) 50%, transparent)",
            textDecorationThickness: "token(spacing.xxs)",
            textUnderlineOffset: "token(spacing.xs)",
          },
        }),

        articleSidenoteRef: defineRecipe({
          className: "article-sidenote-ref",
          description:
            "Superscript ordinal after an annotated run. The digit is read from the `data-sidenote-number` attribute — assigned from the AST-derived ordinal (see collectSidenotes / SidenoteLayer + the reader). A CSS counter was avoided because Chromium doesn't re-resolve `counter()` generated content when a preceding counter-incrementing element is removed, so ordinals wouldn't decrement live. Painted in the brand gradient.",
          base: {
            verticalAlign: "super",
            marginInlineStart: "3xs",
            fontSize: "0.7em",
            fontWeight: "medium",
            userSelect: "none",
            // A PLAIN inline, deliberately: an atomic inline (inline-block)
            // carries an unconditional soft-wrap opportunity before it, so the
            // ordinal could be orphaned onto a line of its own. Non-atomic, it
            // travels with the last annotated word.
            display: "inline",
            _after: {
              content: "attr(data-sidenote-number)",
              background: "bg.brandedEmphasis",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              WebkitTextFillColor: "transparent",
            },
          },
        }),

        sidenoteCard: defineRecipe({
          className: "sidenote-card",
          description:
            "Margin note, CSS-anchored via anchor() and revealed only when its annotation is active (caret in the editor; hover/click in the reader). `side` (default): 100px right of the text-content column (via the --sidenote-rail anchor) and 2px above the annotated line. `stacked` (no room): centred on the content column, 4px below/above the line with flip-block — like the slash menu. Vertical/default anchor is the annotation's --sn-<id> (set inline via --sn-anchor).",
          base: {
            // Fixed (not absolute) so anchor()'s flip-block fallback measures
            // overflow against the VIEWPORT. Absolute would measure against the
            // tall <article> — always room below — and never flip above.
            position: "fixed",
            zIndex: 40,
            positionAnchor: "var(--sn-anchor)",
            maxWidth: "token(sizes.sidenoteMaxWidth)",
            display: "flex",
            flexDirection: "column",
            gap: "sm",
            padding: "md",
            backgroundColor: "bg.surface",
            borderRadius: "md",
            borderWidth: "token(spacing.3xs)",
            borderStyle: "solid",
            borderColor: "border.divider",
            boxShadow:
              "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
            color: "text.default",
            // Hidden until its annotation is active.
            opacity: 0,
            visibility: "hidden",
            pointerEvents: "none",
            transitionProperty: "opacity, visibility",
            transitionDuration: "120ms",
            transitionTimingFunction: "ease-out",
            // allow-discrete so `visibility` flips at the START of the reveal —
            // otherwise the card is unfocusable and Edit auto-focus lands on
            // nothing.
            transitionBehavior: "allow-discrete",
            "&[data-active='true']": {
              opacity: 1,
              visibility: "visible",
              pointerEvents: "auto",
            },
          },
          variants: {
            // Horizontal geometry (`left`/`width`) comes from inline styles
            // SidenoteLayer computes: it is scroll-invariant, and it avoids a
            // SECOND named-anchor query, which WebKit silently fails (only the
            // default `position-anchor` resolves there). Vertical stays
            // CSS-anchored to `--sn-anchor` so it tracks scroll.
            placement: {
              side: {
                top: "anchor(top)",
                marginTop: "calc(-1 * token(spacing.md))",
              },
              // Centred on the content column (left computed inline).
              stacked: {
                translate: "-50% 0",
                top: "anchor(bottom)",
                marginTop: "sm",
                positionTryFallbacks: "flip-block",
              },
            },
          },
          defaultVariants: { placement: "side" },
        }),

        sidenoteCardContent: defineRecipe({
          className: "sidenote-card-content",
          description:
            "Text row of a margin-note card — the ordinal marker followed by the note body.",
          base: {
            display: "flex",
            gap: "xs",
            flex: "1 0 0",
            minWidth: 0,
            textStyle: "sidenote",
            color: "text.default",
          },
        }),

        sidenoteCardMarker: defineRecipe({
          className: "sidenote-card-marker",
          description:
            "Leading ordinal in a margin-note card (matches the annotation's superscript), painted in the brand gradient.",
          base: {
            fontWeight: "medium",
            background: "bg.brandedEmphasis",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            color: "transparent",
            WebkitTextFillColor: "transparent",
            userSelect: "none",
          },
        }),

        sidenoteCardBody: defineRecipe({
          className: "sidenote-card-body",
          description:
            "Editable/read note body inside a margin-note card. Paragraphs are block children separated by 4px (Shift+Enter in the editor). Shows a placeholder while empty and unfocused.",
          base: {
            // inline-block + a min width gives an EMPTY contentEditable a line
            // box, so the caret is placeable on click.
            display: "inline-block",
            minWidth: "token(spacing.md)",
            caretColor: "text.default",
            focusVisibleRing: "none",
            "& > * + *": { marginTop: "sm" },
            "&[data-placeholder]:empty::after": {
              content: "attr(data-placeholder)",
              color: "text.default/40",
            },
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
            _focusVisible: { focusVisibleRing: "none" },
          },
        }),

        articleShowcase: defineRecipe({
          className: "article-showcase",
          description:
            "Wide showcase container for figures and embeddable components inside article content.",
          base: {
            width: "token(spacing.full)",
            display: "flex",
            flexDirection: "column",
            gap: "md",
            alignItems: "center",
          },
        }),

        demoFrame: defineRecipe({
          className: "demo-frame",
          description:
            "Column shell that hugs demo-area and optional logger footer.",
          base: {
            width: "token(spacing.full)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            overflow: "hidden",
            borderRadius: "xl",
            backgroundColor: "bg.canvas",
            borderWidth: "token(spacing.3xs)",
            borderStyle: "solid",
            borderColor: "border.divider",
            containerType: "inline-size",
            containerName: "demoFrame",
            "& > *": {
              flexShrink: 0,
              maxWidth: "token(spacing.full)",
              width: "fit-content",
            },
          },
          variants: {
            logger: {
              true: {
                "& > *": {
                  width: "token(spacing.full)",
                },
              },
            },
          },
        }),

        demoFrameDemoArea: defineRecipe({
          className: "demo-frame__demo-area",
          description:
            "Demo region with aspect ratio; sizes from ratio and content.",
          base: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "token(spacing.full)",
            maxWidth: "token(spacing.full)",
            flexShrink: 0,
            paddingBlockStart: "xxl",
            paddingBlockEnd: "lg",
          },
          variants: {
            aspectRatio: {
              sm: { aspectRatio: "2 / 1" },
              md: { aspectRatio: "3 / 2" },
              lg: { aspectRatio: "5 / 6" },
            },
            logger: {
              true: {
                height: "auto",
                aspectRatio: "unset",
                "& > *": {
                  width: "token(spacing.full)",
                  maxWidth: "token(spacing.full)",
                },
              },
            },
          },
          // A logger frame drops `aspect-ratio`, so reserve that height as a
          // floor in container-query units — full height from SSR, no
          // client-measured jump. cqw factor = ratioHeight / ratioWidth.
          compoundVariants: [
            {
              logger: true,
              aspectRatio: "sm",
              css: { minHeight: "50cqw" },
            },
            {
              logger: true,
              aspectRatio: "md",
              css: { minHeight: "calc(200cqw / 3)" },
            },
            {
              logger: true,
              aspectRatio: "lg",
              css: { minHeight: "120cqw" },
            },
          ],
          defaultVariants: {
            aspectRatio: "sm",
          },
          // Runtime variant values — force every branch, compounds included, or
          // the area silently falls back to its content-height min-height.
          staticCss: [
            { aspectRatio: ["*"] },
            { aspectRatio: ["*"], logger: ["*"] },
          ],
        }),

        demoFrameDemoMeasure: defineRecipe({
          className: "demo-frame__demo-measure",
          description:
            "Intrinsic-size wrapper used to measure demo content without flex stretch.",
          base: {
            width: "fit-content",
            maxWidth: "token(spacing.full)",
            flexShrink: 0,
          },
        }),

        demoLoggerSection: defineRecipe({
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
        }),

        demoLoggerPanel: defineRecipe({
          className: "demo-logger-panel",
          description:
            "Logger shell; height transitions drive expand/collapse layout.",
          base: {
            width: "token(spacing.full)",
            borderRadius: "md",
            backgroundColor: "bg.surface",
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
        }),

        demoLoggerHeader: defineRecipe({
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
        }),

        demoLoggerBody: defineRecipe({
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
        }),

        demoLoggerLine: defineRecipe({
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
        }),

        articleImg: defineRecipe({
          className: "article-img",
          description:
            "Image inside article content with divider border matching demo showcase shells.",
          base: {
            width: "token(spacing.full)",
            borderRadius: "xl",
            display: "block",
            borderWidth: "token(spacing.3xs)",
            borderStyle: "solid",
            borderColor: "border.divider",
          },
        }),

        dialogPanel: defineRecipe({
          className: "dialog-panel",
          description: "Shared dialog panel shell.",
          base: {
            backgroundColor: "bg.surface",
            // The surface owns the glyph hue: the header/body icon buttons are
            // `color: inherit` and would otherwise fall through to the app body.
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
        }),

        dialogHeader: defineRecipe({
          className: "dialog-header",
          description: "Dialog title row with bottom divider.",
          base: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            height: "token(spacing.4xl)",
            paddingInline: "lg",
            borderBottomWidth: "token(spacing.3xs)",
            borderBottomStyle: "solid",
            borderColor: "border.divider",
            flexShrink: 0,
          },
        }),

        dialogTitle: defineRecipe({
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
        }),

        libraryBody: defineRecipe({
          className: "library-body",
          description: "Two-column library layout between header and footer.",
          base: {
            display: "flex",
            flex: "1 1 auto",
            alignItems: "stretch",
            width: "100%",
            minHeight: 0,
          },
        }),

        dialogFooter: defineRecipe({
          className: "dialog-footer",
          description: "Dialog action row with top divider.",
          base: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            height: "token(sizes.dialogFooter)",
            paddingInline: "lg",
            borderTopWidth: "token(spacing.3xs)",
            borderTopStyle: "solid",
            borderColor: "border.divider",
            flexShrink: 0,
            marginTop: "auto",
          },
        }),

        dialogFooterGroup: defineRecipe({
          className: "dialog-footer-group",
          description: "Left-aligned button cluster in dialog footer.",
          base: {
            display: "flex",
            alignItems: "center",
            gap: "md",
          },
        }),

        uploadBodySlot: defineRecipe({
          className: "upload-body-slot",
          description:
            "Flex-grow region that centers the upload block in the dialog content area (Figma y=156 in 480px shell).",
          base: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: "1 1 0%",
            width: "100%",
            minHeight: 0,
          },
        }),

        uploadBody: defineRecipe({
          className: "upload-body",
          description:
            "Upload / uploading content block (Figma Frame 25: 280×160).",
          base: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "xs",
            width: "token(sizes.imagePreviewMax)",
            height: "160px",
            flexShrink: 0,
            cursor: "pointer",
            textAlign: "center",
          },
          variants: {
            dragOver: {
              true: {
                backgroundColor: "bg.itemHover",
                borderRadius: "sm",
              },
              false: {},
            },
          },
          defaultVariants: {
            dragOver: false,
          },
        }),

        uploadProgress: defineRecipe({
          className: "upload-progress",
          description:
            "Shared progress-bar track (upload dialog + demo preloader).",
          base: {
            position: "relative",
            width: "token(sizes.imagePreviewMax)",
            maxWidth: "token(spacing.full)",
            height: "token(spacing.xxs)",
            borderRadius: "xs",
            backgroundColor: "border.divider",
            overflow: "hidden",
          },
        }),

        progressBarFill: defineRecipe({
          className: "progress-bar-fill",
          description: "Animated fill inside the shared progress-bar track.",
          base: {
            position: "absolute",
            top: 0,
            left: 0,
            height: "token(spacing.full)",
            borderRadius: "xs",
            transition: "width linear 100ms",
            backgroundColor: { base: "brand.pink", _dark: "brand.orange" },
          },
        }),

        demoPreloader: defineRecipe({
          className: "demo-preloader",
          description:
            "Centers the shared progress bar while a component demo loads.",
          base: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "md",
            width: "token(sizes.imagePreviewMax)",
            maxWidth: "token(spacing.full)",
            minHeight: "token(spacing.5xl)",
            paddingInline: "lg",
          },
        }),

        mediaLibrarySidebar: defineRecipe({
          className: "media-library-sidebar",
          description:
            "Library sidebar column in the insert dialogs — the frame around an OptionList.Listbox (component list / image list). Owns the width, divider and inset; the listbox inside owns the scrolling, since it keeps its own active row in view by nudging its scrollTop.",
          base: {
            width: "token(sizes.librarySidebar)",
            flexShrink: 0,
            alignSelf: "stretch",
            borderRightWidth: "token(spacing.3xs)",
            borderRightStyle: "solid",
            borderColor: "border.divider",
            paddingBlock: "md",
            paddingInline: "sm",
            display: "flex",
            flexDirection: "column",
            gap: "none",
            minHeight: 0,
            overflow: "hidden",
          },
        }),

        mediaPreview: defineRecipe({
          className: "media-preview",
          description:
            "Large image preview in insert-image library view. HEIGHT is the only fixed dimension (280px) — the width hugs the image's own aspect ratio and stretches at most to the pane's content box (`maxWidth: 100%` resolves against the flex container's content box, so the pane's padding is excluded). Fixed rather than max height so the metadata rows below hold their position as you switch images; `object-fit: contain` letterboxes anything the width clamp squeezes.",
          base: {
            height: "token(sizes.imagePreviewMax)",
            width: "auto",
            maxWidth: "token(spacing.full)",
            flexShrink: 0,
            margin: "none",
            "& img": {
              height: "100%",
              width: "auto",
              maxWidth: "token(spacing.full)",
              objectFit: "contain",
              display: "block",
              borderRadius: "sm",
              outline: "[none]",
            },
          },
        }),

        mediaPreviewPane: defineRecipe({
          className: "media-preview-pane",
          description:
            "Right column of library view with preview and metadata.",
          base: {
            flex: "1 1 auto",
            alignSelf: "stretch",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "xs",
            paddingBlock: "md",
            paddingInline: "md",
            minWidth: 0,
            minHeight: 0,
            overflowY: "auto",
          },
        }),

        mediaMetadataRow: defineRecipe({
          className: "media-metadata-row",
          description: "Filename and file-size row below preview.",
          base: {
            display: "flex",
            alignItems: "center",
            gap: "xl",
            width: "100%",
            maxWidth: "token(sizes.imagePreviewMax)",
            minWidth: 0,
            textStyle: "caption",
          },
        }),

        mediaAltRow: defineRecipe({
          className: "media-alt-row",
          description: "Alt-text field row below metadata.",
          base: {
            width: "100%",
            maxWidth: "token(sizes.imagePreviewMax)",
            minWidth: 0,
            alignSelf: "center",
          },
        }),

        mediaDeleteRow: defineRecipe({
          className: "media-delete-row",
          description: "Delete action row below alt text in media preview.",
          base: {
            display: "flex",
            justifyContent: "center",
            width: "100%",
            maxWidth: "token(sizes.imagePreviewMax)",
            minWidth: 0,
            alignSelf: "center",
          },
        }),

        mediaThumbnail: defineRecipe({
          className: "media-thumbnail",
          description: "Small thumbnail in image library sidebar.",
          base: {
            position: "relative",
            flexShrink: 0,
            width: "token(spacing.xxl)",
            height: "token(spacing.xxl)",
            borderRadius: "xs",
            borderWidth: "token(spacing.3xs)",
            borderStyle: "solid",
            borderColor: "border.divider",
            overflow: "hidden",
            "& img": {
              position: "absolute",
              inset: "0",
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            },
          },
        }),

        articleBlockquoteShell: defineRecipe({
          className: "article-blockquote-shell",
          description:
            "Blockquote layout shell — quote mark and text in normal flow (Figma 358:20 light, 358:26 dark).",
          base: {
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            gap: "sm",
          },
        }),

        articleBlockquoteMark: defineRecipe({
          className: "article-blockquote-mark",
          description:
            "Quote mark (52×52) — a `bg.brandedEmphasis` body at 15% with a 1px full-strength inner edge of that same gradient running inside its contour, each a mask off the same blockquote glyph path. Two layers because one mask can only reveal one colour, and both are PSEUDO-ELEMENTS rather than one being the element itself: a mask clips its element's descendants too, so a fill mask on the box would have cut away the outer half of the stroke drawn inside it. As siblings they clip independently, and ::after paints over ::before, putting the outline on top of the body. The glyph's lean is drawn into the artwork, so no CSS rotation here.",
          base: {
            position: "relative",
            width: "token(sizes.quoteMark)",
            height: "token(sizes.quoteMark)",
            flexShrink: 0,
            pointerEvents: "none",
            "&::before, &::after": {
              content: '""',
              position: "absolute",
              inset: "0",
              maskSize: "contain",
              maskRepeat: "no-repeat",
              maskPosition: "center",
              WebkitMaskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
            },
            // Both layers paint the SAME gradient over the same box, so the
            // edge is the full-strength version of the ramp the body is washing
            // out — the two stay in register at every point of the glyph.
            // `opacity` rather than a second 15% gradient token: duplicating
            // the stops would let the copy drift if `bg.brandedEmphasis` is
            // retuned, and multiplying a fully opaque layer by 0.15 is the same
            // result as authoring the stops at 15% alpha.
            "&::before": {
              background: "bg.brandedEmphasis",
              opacity: 0.15,
              maskImage: QUOTE_GLYPH_FILL_MASK,
              WebkitMaskImage: QUOTE_GLYPH_FILL_MASK,
            },
            // The 2px stroke INTERSECTED with the body, keeping only the half
            // inside the glyph. An inset `box-shadow` can't do this: it draws
            // on the element's BOX, not along the masked contour.
            "&::after": {
              background: "bg.brandedEmphasis",
              maskImage: `${QUOTE_GLYPH_STROKE_MASK}, ${QUOTE_GLYPH_FILL_MASK}`,
              maskComposite: "intersect",
              WebkitMaskImage: `${QUOTE_GLYPH_STROKE_MASK}, ${QUOTE_GLYPH_FILL_MASK}`,
              WebkitMaskComposite: "source-in",
            },
          },
        }),

        articleBlockquote: defineRecipe({
          className: "article-blockquote",
          description: "Blockquote typography inside article prose.",
          base: {
            textStyle: "quote",
            color: "text.default",
            wordBreak: "break-word",
            paddingBlockStart: "lg",
          },
        }),

        articleHeadingShell: defineRecipe({
          className: "article-heading-shell",
          description:
            "Column that stacks an optional eyebrow caption above a subheading.",
          base: {
            display: "flex",
            flexDirection: "column",
            gap: "sm",
          },
        }),

        articleSubheadingCaption: defineRecipe({
          className: "article-subheading-caption",
          description:
            "Eyebrow caption above a subheading — brand gradient text (same gradient as numbered-list ordinals) revealed via background-clip once populated.",
          base: {
            textStyle: "caption",
            width: "fit-content",
            wordBreak: "break-word",
            // Only clip once there is text, or an empty editor field turns its
            // own placeholder transparent.
            "&:not(:empty):not([data-empty])": {
              background: "bg.brandedEmphasis",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            },
          },
        }),

        articleBlockquoteBody: defineRecipe({
          className: "article-blockquote-body",
          description:
            "Column beside the quote mark that stacks the quote text and an optional citation.",
          base: {
            flex: "1 1 auto",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: "sm",
          },
        }),

        articleBlockquoteCite: defineRecipe({
          className: "article-blockquote-cite",
          description:
            "Citation line beneath a blockquote — caption typography, upright (not italic).",
          base: {
            textStyle: "caption",
            fontStyle: "normal",
            color: "text.body/50",
            wordBreak: "break-word",
          },
        }),

        articleList: defineRecipe({
          className: "article-list",
          description:
            "Ordered-list wrapper for read-only article prose — resets native list styling and stacks items with the same rhythm as sibling blocks. No width: inherits the `article > *` content-column width so the list aligns with prose, not showcase blocks.",
          base: {
            listStyle: "none",
            margin: "none",
            padding: "none",
            display: "flex",
            flexDirection: "column",
            gap: "xl",
          },
        }),

        articleListItemShell: defineRecipe({
          className: "article-list-item-shell",
          description:
            "Numbered-list item row — ordinal badge and text content in a flex row (Figma 413:684 light, 413:688 dark). No width: inherits the `article > *` content-column width (a recipe-layer width would beat the base-layer rule and align the marker with showcase blocks).",
          base: {
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            gap: "md",
          },
        }),

        listMarkerBox: defineRecipe({
          className: "list-marker-box",
          description:
            "Alignment box for a numbered-list ordinal — the shared 24px marker column centring the `listMarker` pill inside it, exactly as `listBulletIcon` centres a `listBulletCircle`. The pill is narrower than the column and grows with its digit count, so it needs a fixed box around it or a numbered list's prose column would sit left of a bulleted one's. `width` is PINNED rather than left to `minWidth`: a 3+ digit pill outgrows 24px, and on min-width alone only that one item's column would widen, leaving the prose ragged down its own list. Pinned, such a pill overhangs the column instead — symmetrically, since it is centred — eating into the 8px gap rather than moving the text.",
          base: {
            ...markerAlignmentBox,
            width: "token(sizes.listMarker)",
          },
        }),

        listMarker: defineRecipe({
          className: "list-marker",
          description:
            "Numbered-list ordinal badge — 16px gradient pill with theme-flipped caption digits; circular at a single digit, widening for zero-padded multi-digit ordinals. Sized off `spacing.xl` to match the 16px check/cross disc. Vertical placement belongs to its `listMarkerBox` wrapper, not here.",
          base: {
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: "token(spacing.xl)",
            minWidth: "token(spacing.xl)",
            paddingInline: "xs",
            // Optical centring: flex centring aligns the font's CONTENT AREA,
            // but digits have no descender, so their ink sits low by 0.642px in
            // Switzer at 12px = 0.0535em. Doubled here, since a centred flex
            // item shifts up by HALF its padding. Re-measure only if the
            // typeface changes.
            paddingBlockEnd: "0.107em",
            borderRadius: "lg",
            // TWO layers on ONE element: the gradient clipped to the glyphs,
            // the chip clipped to the padding box. A pseudo-element can't
            // supply the chip — `background-clip: text` paints the digits in
            // the BACKGROUND layer, which any child would cover.
            backgroundImage:
              "token(colors.bg.brandedEmphasis), linear-gradient(token(colors.bg.listMarker) 0 0)",
            backgroundClip: "text, padding-box",
            WebkitBackgroundClip: "text, padding-box",
            WebkitTextFillColor: "transparent",
            textStyle: "caption",
            fontWeight: "medium",
            textAlign: "center",
            whiteSpace: "nowrap",
            userSelect: "none",
            pointerEvents: "none",
          },
        }),

        listBullet: defineRecipe({
          className: "list-bullet",
          description:
            "Bulleted-list marker — 10px circular gradient dot centered on the first text line, within the shared `markerAlignmentBox` footprint every list style uses.",
          base: {
            ...markerAlignmentBox,
            "&::before": {
              content: '""',
              display: "block",
              width: "token(sizes.listBullet)",
              height: "token(sizes.listBullet)",
              borderRadius: "token(spacing.half)",
              background: "bg.brandedEmphasis",
            },
          },
        }),

        listBulletIcon: defineRecipe({
          className: "list-bullet-icon",
          description:
            "Check/cross bulleted-list marker — the shared `markerAlignmentBox` (matching the dot and the numbered ordinal, so content stays aligned across list styles) centring a `listBulletCircle` glyph.",
          base: { ...markerAlignmentBox },
        }),

        listBulletCircle: defineRecipe({
          className: "list-bullet-circle",
          description:
            "The 16×16 circle inside a check/cross bullet marker (Figma 476:278 check, 474:38 cross) — a flat `bg.listMarker` chip holding a brand-gradient glyph, which overflows it slightly. The glyph is a masked pseudo-element rather than an inline SVG: those icons paint with `stroke=\"currentColor\"`, and currentColor can only ever be a flat colour, so a gradient has to arrive the way the blockquote mark's does — filling a box that the glyph's alpha masks to shape. Pick the shape with the `glyph` variant; the renderer and editor pass it instead of a child icon.",
          base: {
            position: "relative",
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "token(spacing.xl)",
            height: "token(spacing.xl)",
            borderRadius: "token(spacing.half)",
            backgroundColor: "bg.listMarker",
            "&::after": {
              content: '""',
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "token(sizes.listBulletGlyph)",
              height: "token(sizes.listBulletGlyph)",
              transform: "translate(-50%, -50%)",
              background: "bg.brandedEmphasis",
              maskSize: "contain",
              maskRepeat: "no-repeat",
              maskPosition: "center",
              WebkitMaskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              pointerEvents: "none",
            },
          },
          variants: {
            glyph: {
              check: {
                "&::after": {
                  maskImage: CHECK_GLYPH_MASK,
                  WebkitMaskImage: CHECK_GLYPH_MASK,
                },
              },
              cross: {
                "&::after": {
                  maskImage: CROSS_GLYPH_MASK,
                  WebkitMaskImage: CROSS_GLYPH_MASK,
                },
              },
            },
          },
        }),

        articleListItemContent: defineRecipe({
          className: "article-list-item-content",
          description:
            "List item text column beside the ordinal badge or bullet dot.",
          base: {
            flex: "1 1 auto",
            minWidth: 0,
            textStyle: "bodyLarge",
            color: "text.body",
            wordBreak: "break-word",
          },
        }),

        articleMetric: defineRecipe({
          className: "article-metric",
          description:
            "Metric callout — a large brand-gradient value stacked over a descriptive label (Figma 456:979 light / 456:968 dark). No width: inherits the `article > *` content-column width so it aligns with prose.",
          base: {
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "sm",
            wordBreak: "break-word",
          },
        }),

        articleMetricCaption: defineRecipe({
          className: "article-metric-caption",
          description:
            "Metric caption — optional eyebrow above the value; same style as an image caption but left-aligned (the metric column is flush-left).",
          base: {
            textStyle: "caption",
            color: "text.default",
            textAlign: "left",
            wordBreak: "break-word",
          },
        }),

        articleMetricValue: defineRecipe({
          className: "article-metric-value",
          description:
            "Metric value — brand gradient display text (theme-directional gradient) revealed via background-clip once populated, mirroring the subheading eyebrow.",
          base: {
            textStyle: "title",
            width: "fit-content",
            maxWidth: "full",
            wordBreak: "break-word",
            // Only clip once there is text (see articleSubheadingCaption).
            "&:not(:empty):not([data-empty])": {
              background: "bg.brandedEmphasis",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            },
          },
        }),

        articleMetricLabel: defineRecipe({
          className: "article-metric-label",
          description:
            "Metric label — descriptive line beneath the value; paragraph text style, standard text colour (neutral.600 light / neutral.200 dark per Figma).",
          base: {
            textStyle: "bodyLarge",
            color: "text.default",
            wordBreak: "break-word",
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

        menuPopover: defineRecipe({
          className: "menu-popover",
          description:
            "Floating menu shell — collapsed (default resting state) shows one item; expanded shows a list.",
          base: {
            position: "fixed",
            zIndex: 50,
            width: "200px",
            backgroundColor: "bg.surface",
            borderRadius: "md",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          },
          variants: {
            state: {
              collapsed: {
                alignItems: "flex-start",
                justifyContent: "center",
                padding: "sm",
              },
              expanded: {
                paddingBlock: "md",
                paddingInline: "sm",
                gap: "xs",
                boxShadow:
                  "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
              },
            },
          },
          defaultVariants: {
            state: "collapsed",
          },
        }),

        slashMenuPopover: defineRecipe({
          className: "slash-menu-popover",
          description:
            "Slash menu — positioned with CSS anchor() against the active block's anchor-name. Fixed (not absolute) so position-try-fallbacks measures overflow against the viewport — otherwise flip-block never fires (the containing block is taller than the viewport, so there's always 'room below').",
          base: {
            position: "fixed",
            zIndex: 50,
            width: "200px",
            positionAnchor: "--slash-menu",
            top: "anchor(bottom)",
            left: "anchor(left)",
            marginTop: "xs",
            positionTryFallbacks: "flip-block",
            backgroundColor: "bg.surface",
            borderRadius: "md",
            borderWidth: "token(spacing.3xs)",
            borderStyle: "solid",
            borderColor: "border.divider",
            display: "flex",
            flexDirection: "column",
            overflow: "visible",
            // No internal padding — the listbox's own 4px inset is the only gap
            // to the rows (its root collapses via the `plain` tone).
            boxShadow:
              "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
          },
        }),

        // Anchor-name `--date-popover` is set on the frame only while open, so
        // exactly one element ever carries it (Figma 563:2486).
        datePopover: defineRecipe({
          className: "date-popover",
          description:
            "Covering calendar popover for the Date input: anchored over the trigger frame (top/left, ≥ its width) with an opaque brand-tinted surface + brand inset border. Distinct from the below-anchored menu popovers.",
          base: {
            position: "fixed",
            zIndex: 50,
            positionAnchor: "--date-popover",
            top: "anchor(top)",
            left: "anchor(left)",
            minWidth: "anchor-size(width)",
            backgroundColor: "field.bg.popover",
            borderRadius: "sm",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            boxShadow:
              "inset 0 0 0 0.5px var(--colors-field-border-active), 0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
          },
        }),

        // The Select counterpart to datePopover, sized to the option list
        // (Figma 629:1416 dark / 630:1702 light).
        comboboxPopover: defineRecipe({
          className: "combobox-popover",
          description:
            "Covering option-list popover for the Combobox input: anchored over the trigger frame (top/left) with an opaque brand-tinted surface + brand inset border, ≥ the option-list width and ≥ the trigger width. The Select sibling of datePopover.",
          base: {
            position: "fixed",
            zIndex: 50,
            positionAnchor: "--combobox-popover",
            top: "anchor(top)",
            left: "anchor(left)",
            width: "token(sizes.optionListWidth)",
            minWidth: "anchor-size(width)",
            backgroundColor: "field.bg.popover",
            borderRadius: "sm",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            boxShadow:
              "inset 0 0 0 0.5px var(--colors-field-border-active), 0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
          },
        }),

        selectionPopover: defineRecipe({
          className: "selection-popover",
          description:
            "Shared floating popover for the text-selection / link / numbering / bullet menus — anchored above the target via CSS anchor() and flipped below when there's no room (Figma 422:833 selection, 474:74 numbering, 475:204 bullet). `align=center` centres on the target (text selection / link); `align=start` left-aligns to it (list-marker menus).",
          base: {
            position: "fixed",
            zIndex: 50,
            positionAnchor: "--selection-popover",
            // Default above the target; flip below when there is no room.
            bottom: "anchor(top)",
            marginBottom: "sm",
            positionTryFallbacks: "flip-block",
            display: "flex",
            alignItems: "center",
            gap: "sm",
            // Hug the options — also overrides the `article > *` width rule
            // (@layer base) that would stretch it to the text column.
            width: "max-content",
            maxWidth: "min(100vw, token(sizes.articleContent))",
            height: "token(spacing.4xl)",
            paddingInline: "md",
            backgroundColor: "bg.surface",
            borderRadius: "md",
            borderWidth: "token(spacing.3xs)",
            borderStyle: "solid",
            borderColor: "border.divider",
            overflow: "hidden",
            boxShadow:
              "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
          },
          variants: {
            align: {
              center: { left: "anchor(center)", translate: "-50% 0" },
              start: { left: "anchor(left)" },
            },
          },
          defaultVariants: { align: "center" },
        }),

        tooltip: defineRecipe({
          className: "tooltip",
          description:
            "Cursor-following hover tooltip shared by the social links, Button and Link — Figma node 389:318 (20px tall, 4px padding/gap, a leading label ∣ hairline ∣ trailing 14px glyph). Positioned imperatively (fixed + a ref that tracks the pointer), so it carries no anchor of its own.",
          base: {
            position: "fixed",
            zIndex: 50,
            top: 0,
            left: 0,
            display: "flex",
            alignItems: "center",
            gap: "sm",
            height: "token(spacing.xxl)",
            paddingInline: "sm",
            paddingBlock: "none",
            overflow: "hidden",
            borderRadius: "sm",
            borderWidth: "token(spacing.3xs)",
            borderStyle: "solid",
            borderColor: "border.divider",
            backgroundColor: { base: "neutral.200", _dark: "neutral.800" },
            color: "text.body",
            textStyle: "caption",
            whiteSpace: "nowrap",
            opacity: 0,
            visibility: "hidden",
            pointerEvents: "none",
            filter: "blur(1px)",
            transitionProperty: "opacity, filter, visibility",
            transitionDuration: "150ms",
            transitionTimingFunction: "ease-out",
            transitionBehavior: "allow-discrete",
            _starting: {
              opacity: 0,
              filter: "blur(1px)",
            },
            // Shown by its host toggling `data-visible`. The cursor trails the
            // box by its offset, so `pointer-events: auto` never intercepts the
            // pointer yet still lets an interactive tooltip be hit.
            "&[data-visible]": {
              opacity: 1,
              visibility: "visible",
              pointerEvents: "auto",
              filter: "blur(0)",
            },
            // A composed trailing glyph, sized and tinted with no className.
            "& svg": {
              flexShrink: 0,
              width: "token(sizes.tooltipIcon)",
              height: "token(sizes.tooltipIcon)",
            },
            "& svg path[stroke]": { stroke: "currentColor" },
            "& svg path[fill]": { fill: "currentColor" },
          },
        }),

        tooltipIcon: defineRecipe({
          className: "tooltip-icon",
          description:
            "Icons inside tooltips — fixed 14px size, never shrinks. For icons that need an explicit class (the social copy/check crossfade layers); a bare tooltip glyph is already sized by the `tooltip` recipe's `& svg`.",
          base: {
            flexShrink: 0,
            width: "token(sizes.tooltipIcon)",
            height: "token(sizes.tooltipIcon)",
            "& path[stroke]": { stroke: "currentColor" },
            "& path[fill]": { fill: "currentColor" },
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
            textStyle: "bodySmall",
            color: "text.body",
            // cmdk sets data-selected; the slash menu uses aria-selected.
            //
            // `field.bg.hover`, not `bg.itemHover`: the two match in dark, but
            // itemHover stays a flat 25% in light where the field wash drops to
            // 15%, which read as a heavy grey band beside every other option
            // list. A menu row and a listbox row are the same gesture.
            "&[data-selected='true'], &[aria-selected='true']": {
              backgroundColor: "field.bg.hover",
            },
          },
        }),
      },

      slotRecipes: {
        // One skeleton bar — what a text node becomes inside a `wireframe`
        // scope. The Figma "Line Height Wrapper" (745:4385/4389/4393) draws it
        // at the font's CAP HEIGHT in every text style, which is one rule
        // rather than a per-textStyle table: `height: 1cap`. Box and width both
        // come from the real text, so swapping live ↔ wireframed shifts nothing.
        skeleton: defineSlotRecipe({
          className: "skeleton",
          description:
            "A single skeleton bar standing in for a run of text. `root` reproduces the replaced text's line box (the string stays in the DOM under `text`, hidden with `visibility` so it still measures) and paints the bar as an ::after at `1cap` — the font's cap height, matching the Figma bars at every text style without a lookup table. The fill is `currentColor`, so the bar inherits the tone of the text it replaced: a muted `field.label` bar and a default-toned value bar come out two-tone exactly as drawn, in both themes, with no tokens of its own. `lines` stacks several for copy that has no text yet.",
          slots: ["root", "text", "lines"],
          base: {
            root: {
              position: "relative",
              // Hugs the string it replaced, which is what gives the bar the
              // width of the real text.
              display: "inline-block",
              maxWidth: "token(spacing.full)",
              verticalAlign: "top",
              "&::after": {
                content: '""',
                position: "absolute",
                insetInline: 0,
                top: "50%",
                transform: "translateY(-50%)",
                // The em fallback is the same ratio for the sans in use.
                height: "0.7em",
                borderRadius: "token(radii.full)",
                backgroundColor: "currentcolor",
                pointerEvents: "none",
              },
              "@supports (height: 1cap)": {
                "&::after": { height: "1cap" },
              },
            },
            text: {
              // `visibility`, not `color: transparent`: it keeps the box
              // measuring, drops the string from the a11y tree, and leaves the
              // root's `currentColor` intact for the bar to paint with.
              visibility: "hidden",
              userSelect: "none",
            },
            lines: {
              display: "flex",
              flexDirection: "column",
              width: "token(spacing.full)",
              "& > [data-skeleton]": { display: "block", width: "100%" },
              // The ragged last line every real paragraph has.
              "& > [data-skeleton]:last-child:not(:only-child)": {
                width: "65%",
              },
            },
          },
        }),

        field: defineSlotRecipe({
          className: "field",
          description:
            'Text-input family field — a label, a framed input shell (leading icon + control + optional trailing), and a hint. The presentational frame owns no behavior; the assembly fills the control slot. The \'Active\' state is CSS-driven off the control\'s focus (`[data-control]:focus-visible`) rather than a prop, so label, frame bg/border, control text and the leading icon all shift to the brand accent (pink in light, orange in dark) on focus while the hint stays muted (Figma 586:876). Built to be shared by the forthcoming Select/Date inputs. A `role="switch"` or `role="checkbox"` control flips the same root into a control ∣ label/hint grid (the toggle archetype, shared by Switch and Checkbox), detected via `:has` — no prop. Scope: default + active only.',
          slots: ["root", "label", "frame", "control", "hint"],
          base: {
            root: {
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              width: "token(spacing.full)",
              // A toggle control flips the field from a vertical stack into the
              // control ∣ label/hint grid — detected structurally, no prop, the
              // way the active state keys off :focus-visible.
              "&:has([role='switch'], [role='checkbox'])": {
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                alignItems: "center",
                rowGap: "xs",
                columnGap: "md",
                width: "fit-content",
              },
            },
            label: {
              color: "field.text.muted",
              width: "token(spacing.full)",
              wordBreak: "break-word",
              cursor: "default",
              transition: "color 150ms ease",
              // Tracked from the field ROOT, so the label recolors even though
              // it sits outside the frame.
              "[data-field]:has([data-control]:focus-visible, [data-control][aria-expanded='true']) &":
                {
                  color: "field.text.active",
                },
              // Toggle archetype: the label is a full statement beside the
              // control, so it reads as resting field text rather than a muted
              // label, and clicking it toggles (Figma 684:1133).
              "[data-field]:has([role='switch'], [role='checkbox']) &": {
                gridColumn: 2,
                gridRow: 1,
                width: "auto",
                color: "field.text.default",
                cursor: "pointer",
              },
            },
            frame: {
              display: "flex",
              alignItems: "center",
              gap: "md",
              width: "token(spacing.full)",
              paddingInline: "md",
              borderRadius: "sm",
              borderWidth: "token(spacing.3xs)",
              borderStyle: "solid",
              overflow: "hidden",
              // Clicking the frame's dead padding focuses the control.
              cursor: "text",
              backgroundColor: "field.bg.default",
              borderColor: "field.border.default",
              // The single source for the leading icon and the control (both
              // `color: inherit`); the active selector flips all three at once.
              color: "field.text.default",
              transition:
                "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
              "[data-field]:has([data-control]:focus-visible, [data-control][aria-expanded='true']) &":
                {
                  backgroundColor: "field.bg.active",
                  borderColor: "field.border.active",
                  color: "field.text.active",
                },
              // The ring goes on the shell so it hugs the whole field, icon
              // included. Inset, so the frame's overflow:hidden can't clip it;
              // width/colour match the app-wide ring in globals.css.
              "html[data-keyboard-focus] [data-field]:has([data-control]:focus-visible) &":
                {
                  boxShadow:
                    "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
                },
              // Icons compose straight into the frame, leading or trailing:
              // fixed box, frame colour, non-interactive so clicks fall through
              // to the frame. `> svg` keeps this off icons inside the control.
              "& > svg": {
                flexShrink: 0,
                width: "token(spacing.xxl)",
                height: "token(spacing.xxl)",
                display: "block",
                pointerEvents: "none",
                transition: "color 150ms ease",
              },
              "& > svg path[stroke]": { stroke: "currentColor" },
              "& > svg path[fill]": { fill: "currentColor" },
            },
            control: {
              flex: "1 1 0",
              minWidth: 0,
              width: "token(spacing.full)",
              margin: "none",
              padding: "none",
              border: "none",
              background: "transparent",
              appearance: "none",
              color: "inherit",
              transition: "color 150ms ease",
              caretColor: "field.text.active",
              // The native `::placeholder` and the Select/Date trigger's
              // `[data-placeholder]` sentinel share one rule. On active it
              // follows the rest of the field into the accent, rather than
              // staying stranded in grey on a brand-tinted frame.
              "&::placeholder, &[data-placeholder]": {
                color: "field.text.placeholder",
              },
              "[data-field]:has([data-control]:focus-visible, [data-control][aria-expanded='true']) &::placeholder, [data-field]:has([data-control]:focus-visible, [data-control][aria-expanded='true']) &[data-placeholder]":
                { color: "field.text.activeMuted" },
              // The app-wide keyboard ring targets the raw <input>, which this
              // frame's overflow:hidden clips into an awkward inner rectangle.
              // Suppress it; the frame carries the ring instead.
              "html[data-keyboard-focus] &:focus-visible": {
                boxShadow: "none",
              },
            },
            hint: {
              color: "field.text.muted",
              width: "token(spacing.full)",
              wordBreak: "break-word",
              marginTop: "sm",
              // Toggle archetype: the hint drops under the label, aligned to it
              // rather than stacked with its own top margin.
              "[data-field]:has([role='switch'], [role='checkbox']) &": {
                gridColumn: 2,
                gridRow: 2,
                width: "auto",
                marginTop: "none",
              },
            },
          },
          // Label, value, hint and frame height move together, so you get a
          // "small field" rather than a mismatched label over a normal input.
          // `md` is the Figma default (586:876); `lg` steps each part up one
          // text style and the frame up 8px, holding the same 6px vertical
          // inset. `sm` is the compact step the toggle archetype uses.
          variants: {
            size: {
              sm: {
                label: { textStyle: "caption" },
                hint: { textStyle: "caption" },
                root: {
                  "&:has([role='switch'], [role='checkbox'])": {
                    columnGap: "sm",
                  },
                },
              },
              md: {
                label: { textStyle: "bodySmall" },
                control: { textStyle: "bodyLarge" },
                hint: { textStyle: "sidenote" },
                frame: { height: "token(spacing.4xl)" },
              },
              lg: {
                label: { textStyle: "bodyLarge" },
                control: { textStyle: "subheading" },
                hint: { textStyle: "bodySmall" },
                frame: {
                  height: "calc(token(spacing.4xl) + token(spacing.md))",
                },
              },
            },
          },
          defaultVariants: { size: "md" },
          // Runtime variant values — force every branch to be emitted.
          staticCss: [{ size: ["*"] }],
        }),

        // Named `switchField`, not `switch` — a reserved word breaks the
        // generated `export const switch`. Owns only the track + thumb; the
        // surrounding grid and the label/hint come from `field`, which the
        // Switch plugs into as its control (Figma 607:1166).
        switchField: defineSlotRecipe({
          className: "switch-field",
          description:
            "The track + thumb of a toggle switch — the control slot of a `field`. Off = neutral, on = brand accent (keyed off `aria-checked` on the <button role=switch>), reusing the field tokens the text input uses. `size` scales the track geometry and thumb travel (sm/lg); the label/hint and the control ∣ text layout come from the `field` recipe. Geometry derives from spacing tokens — track height = thumb + 2·inset, travel = width − 2·inset − thumb — so nothing is arbitrary.",
          slots: ["control", "thumb"],
          base: {
            control: {
              // First column of the grid `field` sets up for a toggle.
              gridColumn: 1,
              gridRow: 1,
              position: "relative",
              flexShrink: 0,
              display: "inline-block",
              padding: "none",
              margin: "none",
              appearance: "none",
              cursor: "pointer",
              // 12px ≥ half of either track height, so both sizes read as pills.
              borderRadius: "lg",
              backgroundColor: "field.bg.default",
              // An inset box-shadow, NOT a `border`: a real border is
              // subtracted from the interior (24→23px) and the thumb is offset
              // from the padding edge, so top:4 would land 4.5px above / 3.5px
              // below. A shadow takes no layout, so 4+16+4 centres exactly.
              boxShadow:
                "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-default)",
              transition: "background-color 150ms ease, box-shadow 150ms ease",
              "&[aria-checked='true']": {
                backgroundColor: "field.bg.active",
                boxShadow:
                  "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-active)",
              },
              _disabled: { cursor: "not-allowed", opacity: 0.5 },
            },
            thumb: {
              position: "absolute",
              borderRadius: "token(spacing.half)",
              backgroundColor: "field.text.default",
              transition: "transform 150ms ease, background-color 150ms ease",
              "[aria-checked='true'] &": {
                backgroundColor: "field.text.active",
              },
            },
          },
          variants: {
            size: {
              lg: {
                control: {
                  width: "token(spacing.4xl)",
                  height: "calc(token(spacing.xl) + 2 * token(spacing.sm))",
                },
                thumb: {
                  width: "token(spacing.xl)",
                  height: "token(spacing.xl)",
                  top: "token(spacing.sm)",
                  left: "token(spacing.sm)",
                  "[aria-checked='true'] &": {
                    transform: "translateX(token(spacing.xl))",
                  },
                },
              },
              sm: {
                control: {
                  width: "token(spacing.xxl)",
                  height: "calc(token(spacing.md) + 2 * token(spacing.xs))",
                },
                thumb: {
                  width: "token(spacing.md)",
                  height: "token(spacing.md)",
                  top: "token(spacing.xs)",
                  left: "token(spacing.xs)",
                  "[aria-checked='true'] &": {
                    transform: "translateX(token(spacing.md))",
                  },
                },
              },
            },
          },
          defaultVariants: { size: "lg" },
          // Runtime variant values — force every branch to be emitted.
          staticCss: [{ size: ["*"] }],
        }),

        // The other toggle control of the field family (see `switchField`).
        // Structural difference: no `size` — the checkbox is drawn at a single
        // geometry (Figma 757:4635), so the field's `size` scales only the
        // label/hint beside it.
        checkboxField: defineSlotRecipe({
          className: "checkbox-field",
          description:
            "The box + check of a checkbox — the control slot of a `field`. Off = neutral, on = brand accent (keyed off `aria-checked` on the <button role=checkbox>), reusing the exact tokens the text input and the switch use. Unlike the switch it has no `size`: one geometry — a 20px hit frame around a 16px visual box, the 2px surround keeping the box optically centred on the label's cap-height. The check glyph is the shared 20px `check-small` icon overhanging the box by 2px a side (as drawn), revealed by opacity so it fades rather than pops.",
          slots: ["control", "box"],
          base: {
            control: {
              // First column of the grid `field` sets up for a toggle.
              gridColumn: 1,
              gridRow: 1,
              position: "relative",
              flexShrink: 0,
              display: "block",
              // The full 20px frame — hit target and layout box; the `box` slot
              // draws the 16px square centred inside it.
              width: "token(spacing.xxl)",
              height: "token(spacing.xxl)",
              padding: "none",
              margin: "none",
              border: "none",
              background: "none",
              appearance: "none",
              cursor: "pointer",
              _disabled: { cursor: "not-allowed", opacity: 0.5 },
            },
            box: {
              position: "absolute",
              top: "token(spacing.xs)",
              left: "token(spacing.xs)",
              width: "token(spacing.xl)",
              height: "token(spacing.xl)",
              borderRadius: "sm",
              backgroundColor: "field.bg.default",
              // Inset box-shadow, not a `border` — same reasoning as the switch
              // track.
              boxShadow:
                "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-default)",
              // The glyph is invisible until checked, so it needs no off tone.
              color: "field.text.active",
              transition: "background-color 150ms ease, box-shadow 150ms ease",
              "[aria-checked='true'] &": {
                backgroundColor: "field.bg.active",
                boxShadow:
                  "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-active)",
              },
              // A 20px icon on a 16px box, so it hangs 2px off every side —
              // drawn at its own size rather than scaled down to fit. SVGR
              // rewrites its stroke to currentColor, so `color` above tints it.
              "& > svg": {
                position: "absolute",
                top: "calc(token(spacing.xs) * -1)",
                left: "calc(token(spacing.xs) * -1)",
                width: "token(spacing.xxl)",
                height: "token(spacing.xxl)",
                display: "block",
                pointerEvents: "none",
                opacity: 0,
                transition: "opacity 150ms ease",
              },
              "[aria-checked='true'] & > svg": { opacity: 1 },
            },
          },
        }),

        // Presentation only — the month math (Temporal) and selection live in
        // `calendar.tsx`. Slots map 1:1 to the compound parts.
        calendar: defineSlotRecipe({
          className: "calendar",
          description:
            "Calendar grid: a search field above a period list — one or more month columns, each a ‹ month year › label, the weekday header row and the day grid on a 24px cell / 4px gutter pitch (7 × 24 + 6 × 4 + 2 × 8 padding = 208px per month). The pair of nav chevrons is absolutely placed at the list's top corners, so they flank the whole range rather than a single month, and the list pages a full range at a time (Figma 715:912 — three months at 624px). Day cells carry their state as attributes (aria-selected / data-state=today / data-outside / :disabled) plus data-weekday/data-weekend identity, so the look is fully re-skinnable off selectors. `tone` swaps which half of the palette reads brand: `default` is a self-framed neutral surface with a brand today/selection (Figma 644:1678/644:1681); `onBrand` is the Date popover's inverse (Figma 631:893/631:897).",
          slots: [
            "root",
            "search",
            "periodList",
            "period",
            "nav",
            "month",
            "week",
            "weekday",
            "grid",
            "date",
            "marquee",
          ],
          base: {
            root: {
              display: "flex",
              flexDirection: "column",
              width: "fit-content",
              // No padding: the search row is flush and each `period` carries
              // its own inset, so a 3-month list has no seam (Figma 715:916).
            },
            search: {
              width: "token(spacing.full)",
              height: "token(spacing.4xl)",
              paddingInline: "md",
              paddingBlock: "none",
              border: "none",
              borderBottomWidth: "token(spacing.3xs)",
              borderBottomStyle: "solid",
              borderBottomColor: "field.border.default",
              background: "transparent",
              appearance: "none",
              color: "field.text.default",
              textStyle: "bodyLarge",
              caretColor: "field.text.active",
              "&::placeholder": { color: "field.text.placeholder" },
              "&::-webkit-search-cancel-button": { display: "none" },
            },
            periodList: {
              display: "flex",
              alignItems: "flex-start",
              // Only bites when the consumer constrains the calendar NARROWER
              // than its months add up to: the range then overflows
              // symmetrically and the root's `overflow: hidden` crops both
              // outer columns evenly, rather than all on the right. (`safe
              // center` would undo exactly that — the start-side crop is the
              // point.)
              justifyContent: "center",
              // Anchors the nav chevrons below.
              position: "relative",
              // A `multiple`-selection drag starting on a day cell would
              // otherwise run on and highlight the month labels it passes.
              userSelect: "none",
              // The chevrons are `color: inherit`, so the list owns their hue.
              color: "field.text.default",
              // Pin a nav dropped DIRECTLY in here to the matching edge, so one
              // pair flanks the whole range however many months it holds (Figma
              // 715:921 / 716:1116). Scoped to direct children, so the same
              // part nested in a consumer's own chrome stays in the flow.
              // `navPlacement` decides how it meets that edge.
              "& > [data-nav]": { position: "absolute" },
              "& > [data-nav='prev']": { left: "md" },
              "& > [data-nav='next']": { right: "md" },
            },
            period: {
              display: "flex",
              flexDirection: "column",
              gap: "sm",
              padding: "md",
              // Hold the 208px pitch when the list is narrower than its months:
              // a flex row would otherwise shrink the columns and break the
              // grid arithmetic rather than letting them overflow and crop.
              flexShrink: 0,
            },
            // The chevron's WRAPPER, not the chevron itself. Panda emits plain
            // recipes into `@layer recipes` but slot recipes into its
            // `recipes.slots` sublayer, and a parent layer always beats its
            // sublayers — so no slot style can override the button's own
            // `action` styles at any specificity. Wrapping sidesteps the
            // cascade. Placement is `periodList`'s business, not this slot's.
            nav: {
              display: "flex",
              flexShrink: 0,
              // The glyph alone is halved, so the hover chip underneath stays
              // at full strength.
              "& svg": { opacity: 0.5, transition: "opacity 150ms ease" },
              "&:hover svg": { opacity: 1 },
            },
            month: {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              // Matches the chevrons it sits between, so the label row is one
              // consistent band across the list.
              height: "token(sizes.toolbarButton)",
              textAlign: "center",
              textStyle: "bodyLarge",
              color: "field.text.default",
            },
            week: {
              display: "grid",
              gridTemplateColumns: "repeat(7, token(sizes.calendarDay))",
              gap: "sm",
              // The header row hangs 4px below the period row (Figma 563:2722).
              paddingTop: "sm",
            },
            weekday: {
              display: "grid",
              placeItems: "center",
              width: "token(sizes.calendarDay)",
              textStyle: "bodySmall",
              color: "field.text.default",
              userSelect: "none",
              // The header's half of the rule the weekend day cells carry.
              "&[data-weekend]": { opacity: 0.5 },
            },
            grid: {
              display: "grid",
              gridTemplateColumns: "repeat(7, token(sizes.calendarDay))",
              gap: "sm",
            },
            // The drag band, positioned by `Calendar.PeriodList` in
            // list-relative pixels; this slot owns only the look. Square
            // corners are deliberate — rounding reads as a UI chip rather than
            // a geometric tool. The stroke draws the extent; the fill stays
            // faint so it can't compete with the cells it is selecting.
            marquee: {
              position: "absolute",
              pointerEvents: "none",
              zIndex: 1,
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor:
                "color-mix(in srgb, var(--colors-field-text-active) 50%, transparent)",
              backgroundColor: "bg.calendarMarquee",
            },
            date: {
              display: "grid",
              placeItems: "center",
              width: "token(sizes.calendarDay)",
              height: "token(sizes.calendarDay)",
              borderRadius: "sm",
              textStyle: "bodySmall",
              color: "field.text.default",
              cursor: "pointer",
              userSelect: "none",
              transition:
                "background-color 150ms ease, color 150ms ease, box-shadow 150ms ease",
              // `data-query` is the search's pending target — Enter's date — and
              // shares the hover declaration verbatim, so previewing a typed
              // date reads exactly like pointing at it.
              //
              // Selected cells opt OUT rather than being overridden: both are
              // single-attribute rules on one slot, so the winner came down to
              // Panda's emission order, and the wash landed last — greying out
              // the accent chip the moment you hovered a selected date.
              "&:is(:hover, [data-query]):not([aria-selected='true'])": {
                backgroundColor: "bg.itemHover",
              },
              // Weekend columns recede, matching their header — unless the cell
              // already carries today or the selection.
              "&[data-weekend]:not([aria-selected='true'], [data-state='today'], [data-outside])":
                { opacity: 0.5 },
              // Spill-over days hold the column and show their number, but the
              // month that owns the date carries all of its state — so a spill
              // cell never draws a chip and never takes the tabstop (see
              // `Calendar.Date`), and needs nothing to compose against.
              "&[data-outside]": { opacity: 0.15 },
              // Today — the accent as text only, no chip.
              "&[data-state='today']": { color: "field.text.active" },
              // Selected — today's colour survives underneath, so a selected
              // today composes without a special case.
              "&[aria-selected='true']": {
                backgroundColor: "field.bg.active",
                color: "field.text.active",
              },
              "&:disabled": {
                color: "field.text.muted",
                opacity: 0.4,
                cursor: "not-allowed",
                "&:hover, &[data-query]": { backgroundColor: "transparent" },
              },
              "html[data-keyboard-focus] &:focus-visible": {
                boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
              },
            },
          },
          variants: {
            // How the flanking chevrons meet the list's left/right edges.
            // `label` is a bare chevron level with the month label row — right
            // for ONE month, where nothing is clipped (Figma 715:921). `edge`
            // is a full-height scrim pinned to each edge (Figma 723:2265 /
            // 716:1116), for a range wider than its frame: the gradient
            // dissolves the half-cut outer columns instead of letting them end
            // on a hard crop. Centring comes WITH it — across a range the label
            // row belongs to the months, so a chevron parked up there reads as
            // paging the first month alone.
            navPlacement: {
              label: { periodList: { "& > [data-nav]": { top: "md" } } },
              edge: {
                periodList: {
                  "& > [data-nav]": {
                    top: 0,
                    height: "token(spacing.full)",
                    width: "token(sizes.calendarNavZone)",
                    alignItems: "center",
                    paddingInline: "sm",
                    // Being positioned is NOT enough to sit above the grid: the
                    // weekend and spill-over cells carry `opacity < 1`, making
                    // each a stacking context painted at level 0 — the same as
                    // `z-index: auto` — so DOM order decided, and the navs come
                    // first. Precisely the outermost column this scrim exists
                    // to fade was punching through it, sharp and unwashed.
                    //
                    // Explicit layer order across the calendar, since `auto`
                    // ties with those cells: marquee 1 ▸ scrim 2 ▸ ring 3.
                    zIndex: 2,
                    // The scrim lies OVER the outer columns, so without this it
                    // would swallow clicks on the dates it is merely fading.
                    // The chevron takes its own events back below.
                    pointerEvents: "none",
                    "& > *": { pointerEvents: "auto", zIndex: 1 },
                    // ── Progressive blur ────────────────────────────────
                    // CSS has no variable-radius blur, so the ramp is two
                    // stacked backdrop layers, each masked out over a different
                    // distance. Gaussian blurs compose in quadrature: where
                    // both are opaque the pair reads as √(1.4² + 1.4²) ≈ 2px
                    // (the Figma value), and where only the longer one survives
                    // it drops toward 1px. That is a real change in blur
                    // RADIUS; one layer behind an alpha ramp would only fade a
                    // constant-radius smear in and out.
                    "&::before, &::after": {
                      content: '""',
                      position: "absolute",
                      inset: 0,
                      pointerEvents: "none",
                      // Panda's `backdropFilter` utility emits ONLY
                      // `-webkit-backdrop-filter`, which Chromium does not
                      // recognise — so the utility alone leaves the blur
                      // silently absent. The raw key is the one that lands;
                      // the prefixed spelling stays for older WebKit.
                      backdropFilter: "blur(1.4px)",
                      "-webkit-backdrop-filter": "blur(1.4px)",
                      "backdrop-filter": "blur(1.4px)",
                    },
                  },
                  // Mirrored sides: opaque wash and heaviest blur on each one's
                  // OWN outer edge, running out to nothing inward. The short
                  // mask (55%) carries the near half, the long one the tail.
                  // `transparent` is safe as the far stop even though it means
                  // transparent BLACK — gradients interpolate in PREMULTIPLIED
                  // alpha, so no grey cast enters the ramp.
                  "& > [data-nav='prev']": {
                    left: 0,
                    justifyContent: "flex-start",
                    backgroundImage:
                      "linear-gradient(to right, token(colors.bg.calendarScrim), transparent)",
                    "&::before": {
                      maskImage:
                        "linear-gradient(to right, #000, transparent 55%)",
                      "-webkit-mask-image":
                        "linear-gradient(to right, #000, transparent 55%)",
                      "mask-image":
                        "linear-gradient(to right, #000, transparent 55%)",
                    },
                    "&::after": {
                      maskImage: "linear-gradient(to right, #000, transparent)",
                      "-webkit-mask-image":
                        "linear-gradient(to right, #000, transparent)",
                      "mask-image":
                        "linear-gradient(to right, #000, transparent)",
                    },
                  },
                  "& > [data-nav='next']": {
                    right: 0,
                    justifyContent: "flex-end",
                    backgroundImage:
                      "linear-gradient(to left, token(colors.bg.calendarScrim), transparent)",
                    "&::before": {
                      maskImage:
                        "linear-gradient(to left, #000, transparent 55%)",
                      "-webkit-mask-image":
                        "linear-gradient(to left, #000, transparent 55%)",
                      "mask-image":
                        "linear-gradient(to left, #000, transparent 55%)",
                    },
                    "&::after": {
                      maskImage: "linear-gradient(to left, #000, transparent)",
                      "-webkit-mask-image":
                        "linear-gradient(to left, #000, transparent)",
                      "mask-image":
                        "linear-gradient(to left, #000, transparent)",
                    },
                  },
                },
              },
            },
            // Which half of the calendar reads brand, and who owns the surface.
            // `default` is self-framed, dates neutral and today/selected brand
            // (Figma 644:1678/644:1681); `onBrand` drops into the Date popover,
            // which owns the surface, and inverts (Figma 631:893/631:897).
            tone: {
              default: {
                // Self-contained field surface: its own fill + inset ring. Edge
                // as box-shadow, not border, so it takes no layout and the
                // 208px arithmetic still holds.
                root: {
                  backgroundColor: "field.bg.default",
                  borderRadius: "sm",
                  overflow: "hidden",
                  position: "relative",
                  // The frame ring in its OWN layer above the grid, not an
                  // `inset` box-shadow on the root: an inset shadow paints
                  // between the background and the children, so the `edge` nav
                  // scrims erased the frame along the 72px they span.
                  "&::after": {
                    content: '""',
                    position: "absolute",
                    inset: 0,
                    borderRadius: "inherit",
                    boxShadow:
                      "inset 0 0 0 0.5px var(--colors-field-border-default)",
                    pointerEvents: "none",
                    zIndex: 3,
                  },
                },
              },
              onBrand: {
                search: {
                  color: "field.text.active",
                  borderBottomColor: "field.border.active",
                  "&::placeholder": { color: "field.text.activeMuted" },
                },
                // Retints the chevrons, which inherit from the list (Figma
                // 563:2715/563:2719).
                periodList: { color: "field.text.active" },
                month: { color: "field.text.active" },
                weekday: { color: "field.text.active" },
                date: {
                  color: "field.text.active",
                  // Today reads neutral — on this surface the accent IS the
                  // background.
                  "&[data-state='today']": { color: "field.text.default" },
                  "&[aria-selected='true']": {
                    backgroundColor: "field.bg.selected",
                    color: "field.text.default",
                  },
                },
              },
            },
          },
          defaultVariants: { tone: "default", navPlacement: "label" },
          // Runtime variant values — force every branch to be emitted.
          staticCss: [{ tone: ["*"], navPlacement: ["*"] }],
        }),

        // The option list behind a Combobox, and a stand-alone always-open
        // select on its own. Presentation only; filtering and selection live in
        // `option-list.tsx`. `tone` mirrors the calendar's (Figma
        // 647:1947/2045 default, 629:1416/630:1702 onBrand).
        optionList: defineSlotRecipe({
          className: "option-list",
          description:
            "Option list: an optional search/filter row above a scrollable listbox of option buttons on a 28px row pitch. Options carry their state as attributes (aria-selected / data-active / :disabled), so the look is fully re-skinnable off selectors. `tone` swaps which half of the palette reads brand: `default` is a self-framed neutral surface with a brand selected chip; `onBrand` drops into the Combobox popover (which owns the surface) and inverts — options brand, selected chip neutral.",
          slots: ["root", "search", "list", "option", "empty", "divider"],
          base: {
            root: {
              display: "flex",
              flexDirection: "column",
              width: "token(sizes.optionListWidth)",
              borderRadius: "sm",
              overflow: "hidden",
            },
            // A full-width Field.Search dressed as the filter row — the same
            // look as the calendar's search slot.
            search: {
              flexShrink: 0,
              width: "token(spacing.full)",
              height: "token(spacing.4xl)",
              paddingInline: "md",
              paddingBlock: "none",
              border: "none",
              borderBottomWidth: "token(spacing.3xs)",
              borderBottomStyle: "solid",
              borderBottomColor: "field.border.default",
              background: "transparent",
              appearance: "none",
              color: "field.text.default",
              textStyle: "bodyLarge",
              caretColor: "field.text.active",
              "&::placeholder": { color: "field.text.placeholder" },
              "&::-webkit-search-cancel-button": { display: "none" },
            },
            list: {
              display: "flex",
              flexDirection: "column",
              // Rows abut directly — each is its own hit target.
              gap: "none",
              padding: "sm",
              overflowX: "hidden",
              overflowY: "auto",
              // 7 full rows + a ~12px peek, so the half-row signals there is
              // more to scroll (Figma 647:2386).
              maxHeight:
                "calc(7 * token(sizes.optionRow) + 2 * token(spacing.sm) + token(spacing.lg))",
            },
            option: {
              display: "flex",
              alignItems: "center",
              // Space a leading icon from the label when an option composes both.
              gap: "md",
              width: "token(spacing.full)",
              flexShrink: 0,
              // The inset alone defines the row/chip box (Figma 647:2387) — no
              // fixed height, so an icon-only toolbar chip comes out 28px and a
              // text row its line-box + 8px, rather than all forced to 32px.
              padding: "sm",
              borderRadius: "sm",
              border: "none",
              background: "transparent",
              appearance: "none",
              textAlign: "left",
              textStyle: "bodySmall",
              color: "field.text.default",
              cursor: "pointer",
              userSelect: "none",
              // Single line, truncated with an ellipsis.
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              // A composed leading icon, tracking the row colour.
              "& svg": {
                width: "token(spacing.xxl)",
                height: "token(spacing.xxl)",
                flexShrink: 0,
                display: "block",
              },
              "& svg path[stroke]": { stroke: "currentColor" },
              "& svg path[fill]": { fill: "currentColor" },
              transition:
                "background-color 150ms ease, color 150ms ease, box-shadow 150ms ease",
              // `data-active` is the roving/keyboard highlight, sharing the
              // hover declaration so arrowing onto a row reads like pointing at
              // it. The `:not` guards the selected row, which is the default
              // roving target and so carries BOTH attributes — without it the
              // neutral hover tint wins over the brand chip (equal specificity
              // → atomic-CSS order decides) and selection reads grey.
              "&:hover:not([aria-selected='true']):not([aria-pressed='true']), &[data-active]:not([aria-selected='true']):not([aria-pressed='true'])":
                { backgroundColor: "field.bg.hover" },
              // One "on" state: a selected row and a pressed toggle share the
              // brand chip.
              "&[aria-selected='true'], &[aria-pressed='true']": {
                backgroundColor: "field.bg.active",
                color: "field.text.active",
              },
              "&:disabled": {
                color: "field.text.muted",
                opacity: 0.4,
                cursor: "not-allowed",
                "&:hover, &[data-active]": { backgroundColor: "transparent" },
              },
              "html[data-keyboard-focus] &:focus-visible": {
                boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
              },
            },
            empty: {
              display: "flex",
              alignItems: "center",
              height: "token(sizes.optionRow)",
              paddingInline: "sm",
              textStyle: "bodySmall",
              color: "field.text.muted",
              userSelect: "none",
            },
            // Separates option groups; the inline variant flips it vertical.
            divider: {
              flexShrink: 0,
              backgroundColor: "border.divider",
              width: "token(spacing.full)",
              height: "token(spacing.xxs)",
            },
          },
          variants: {
            tone: {
              default: {
                // Self-contained field surface, like the calendar's default
                // tone — edge as a box-shadow so the width arithmetic holds.
                root: {
                  backgroundColor: "field.bg.default",
                  boxShadow:
                    "inset 0 0 0 0.5px var(--colors-field-border-default)",
                },
              },
              onBrand: {
                // The Combobox popover owns the surface, so the root just
                // fills it and the palette inverts.
                root: { width: "token(spacing.full)" },
                search: {
                  color: "field.text.active",
                  borderBottomColor: "field.border.active",
                  "&::placeholder": { color: "field.text.activeMuted" },
                },
                option: {
                  color: "field.text.active",
                  // Same selected-row guard as the base tone (see there).
                  "&:hover:not([aria-selected='true']):not([aria-pressed='true']), &[data-active]:not([aria-selected='true']):not([aria-pressed='true'])":
                    { backgroundColor: "field.bg.hoverBrand" },
                  // Neutral chip against the brand surface.
                  "&[aria-selected='true'], &[aria-pressed='true']": {
                    backgroundColor: "field.bg.selected",
                    color: "field.text.default",
                  },
                  "&:disabled": {
                    "&:hover, &[data-active]": {
                      backgroundColor: "transparent",
                    },
                  },
                },
                empty: { color: "field.text.activeMuted" },
              },
              plain: {
                // For a menu whose Popover already owns the surface (the slash
                // menu): the neutral sibling of onBrand, but the root also
                // COLLAPSES, so the listbox sits directly in the popover and
                // the list's own padding is the only gap.
                root: { display: "contents" },
              },
            },
            direction: {
              // The vertical list is already encoded in the base.
              block: {},
              // A row — toolbars and horizontal single-selects. The root
              // collapses so the options sit directly in the consumer's frame
              // (e.g. selectionPopover), which owns the pill surface.
              inline: {
                root: { display: "contents" },
                list: {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: "xs",
                  maxHeight: "none",
                  overflow: "visible",
                  width: "max-content",
                  padding: "none",
                },
                option: { width: "auto" },
                divider: {
                  width: "token(spacing.xxs)",
                  height: "auto",
                  alignSelf: "stretch",
                },
              },
            },
          },
          defaultVariants: { tone: "default", direction: "block" },
          // Runtime variant values — force every branch to be emitted.
          staticCss: [{ tone: ["*"], direction: ["*"] }],
        }),

        notice: defineSlotRecipe({
          className: "notice",
          description:
            "Notice — an inline informational callout: a leading status icon beside a short run of prose on a subtle neutral wash (bg.notice), composed as Notice > Notice.Icon + Notice.Label (Figma 684:1045 dark, 704:1710 light). The root owns the fill, the row layout, and the single `color` source (field.text.default — the field family's resting accent) that the icon and any emphasized runs inherit; the label dials its own body prose back to 75% so the emphasized dates/days it wraps in <strong> read as the salient bits. Purely presentational — no state, no variants — so it stays a Server Component.",
          slots: ["root", "icon", "label"],
          base: {
            root: {
              display: "flex",
              alignItems: "flex-start",
              gap: "xs",
              width: "token(spacing.full)",
              paddingInline: "sm",
              paddingBlock: "md",
              borderRadius: "sm",
              backgroundColor: "bg.notice",
              // One source for the icon + emphasized runs; the label dials its
              // own body prose back off this so the <strong> bits pop.
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
              // Body prose sits a step below the accent; the emphasized runs
              // step back up to full colour and weight (the Figma's Regular →
              // Semibold shift).
              color: "field.text.default/75",
              wordBreak: "break-word",
              "& :is(strong, b)": {
                color: "field.text.default",
                fontWeight: "bold",
              },
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
            lineHeight: "1.8",
          },
        },
        bodyLarge: {
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
            lineHeight: "1.8",
            letterSpacing: "-1%",
          },
        },
        caption: {
          value: {
            fontFamily: "{fonts.switzer}",
            fontWeight: "{fontWeights.base}",
            fontSize: "0.75rem",
            lineHeight: "2",
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
        bodySmall: {
          value: {
            fontFamily: "{fonts.switzer}",
            fontWeight: "{fontWeights.base}",
            fontSize: "0.875rem",
            lineHeight: "1.72",
          },
        },
        inlineCode: {
          value: {
            fontFamily: "{fonts.jetbrainsMono}",
            fontSize: "0.875em",
          },
        },
        code: {
          value: {
            fontFamily: "{fonts.jetbrainsMono}",
            fontSize: "0.875rem",
            lineHeight: "1.72",
          },
        },
      },
    },
  },

  outdir: "styled-system",
});
