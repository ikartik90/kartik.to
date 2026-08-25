import { defineConfig, defineRecipe, defineSlotRecipe } from "@pandacss/dev";
import {
  BOTTOM_SHEET_QUERY,
  HAS_CURSOR_QUERY,
  NARROW_RAIL_QUERY,
} from "./src/data/media-queries";
import { ASPECT_RATIOS } from "./src/utils/demo-frame-sizing";

/**
 * check-small.svg / cross-small.svg as masks, so the brand gradient can be
 * painted through them. A mask reads alpha: keep `fill='none'` or the glyph
 * masks as a filled blob instead of its stroke. Hand-synced with the .svg files.
 */
const CHECK_GLYPH_MASK =
  "url(\"data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M7.05994 10.1813L9.14253 12.6249L12.9396 7.62488' stroke='white' stroke-width='1.25' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

const CROSS_GLYPH_MASK =
  "url(\"data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.5 7.5L7.5 12.5M12.5 12.5L7.5 7.5' stroke='white' stroke-width='1.25' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

// Every CSS shape any recipe needs the app's aspect ratios in, all generated
// from the single `[W, H]` map in src/utils/demo-frame-sizing.ts. Two of them
// are the demo frame's, and they read as unrelated values in the output —
// `aspect-ratio: 3 / 2` against a min-height of `calc(200cqw / 3)` — which is
// exactly why they were allowed to drift apart by hand: the floor states the
// ratio INVERTED, so the two never look like copies of each other and a careful
// reader can correct one and leave the other sitting at the old value. Deriving
// them from the same tuple is the only thing that makes them impossible to
// disagree.
//
// The entries are named for the RATIOS, not for the demo frame, because a
// second consumer has arrived: `linkCard` shapes its box off the same map. The
// map itself is deliberately not renamed — see the note over `ASPECT_RATIOS`
// for what its keys cost the last time they were named something other than
// the answer.
const aspectRatioEntries = Object.entries(ASPECT_RATIOS);

const demoFrameAspectRatioVariants = Object.fromEntries(
  aspectRatioEntries.map(([tier, [w, h]]) => [
    tier,
    { aspectRatio: `${w} / ${h}` },
  ]),
);

// `cqw` is a percentage of the container's WIDTH, so reserving a height from it
// needs the ratio the other way up: h / w, written as `calc(h * 100 / w)` so it
// stays exact for tiers like 3:2 that no decimal expresses cleanly.
const demoFrameAspectRatioFloors = aspectRatioEntries.map(([tier, [w, h]]) => ({
  logger: true,
  aspectRatio: tier,
  css: {
    // Dropping the ratio has to happen HERE, in the compound, rather than in
    // the `logger` variant that reads like it does it. Both variants are a
    // single class, so neither outranks the other and source order decides —
    // and Panda emits `aspectRatio` after `logger`, so the variant's
    // `aspect-ratio: unset` lost every time. That went unnoticed for exactly
    // one reason: the floor below is derived from the same ratio and resolves
    // to the same pixel, so a logger frame measured correct while the ratio
    // sat on it as a CEILING. It is what capped the Calchemy demo at 232px in
    // a 296px demo and left it to hide its own calendar. Compounds are emitted
    // last, so this one wins.
    aspectRatio: "auto",
    minHeight: `calc(${h * 100}cqw / ${w})`,
  },
}));

// The same ratios again, wrapped for a SLOT recipe: a slot recipe's variant is
// a map of slot → styles, not styles, so `linkCard` cannot share the object
// `demoFrameDemoArea` takes even though the declaration inside it is identical.
// Derived a third time rather than copied for the reason the whole map exists:
// a twelfth ratio should be one line in one file, not a line here as well.
const linkCardAspectVariants = Object.fromEntries(
  aspectRatioEntries.map(([ratio, [w, h]]) => [
    ratio,
    { root: { aspectRatio: `${w} / ${h}` } },
  ]),
);

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
 * The transparency checkerboard — the ground under a picture that has an alpha
 * channel and no background effect of its own.
 *
 * Painted as the PICTURE'S OWN background rather than as a layer behind it,
 * which the gradient has to be. A background box is the one ground that cannot
 * come apart from the thing standing on it: it clips to the same corners, and
 * it takes the editor's press scale and tilt for free, where the shader needed
 * its own transform rules stated to keep up. It is also why the drag clone gets
 * this for nothing — the clone IS the <img>, so the checkerboard travels with
 * it exactly as the gradient's snapshot does.
 *
 * Two 8px squares in a 16px tile, from the app's own surfaces rather than the
 * usual white/grey: on a dark theme a grey checkerboard is a light box behind a
 * dark picture. `canvas` and `surface` are one neutral step apart in either
 * theme, which is enough to read as a pattern and not enough to compete with
 * the artwork it is holding up.
 */
const transparencyCheckerboard = {
  backgroundColor: "bg.canvas",
  backgroundImage:
    "conic-gradient(token(colors.bg.surface) 25%, transparent 0 50%, token(colors.bg.surface) 0 75%, transparent 0)",
  backgroundSize: "token(spacing.xl) token(spacing.xl)",
} as const;

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

/**
 * The numeric value at the end of a field frame — the slider's readout and the
 * colour input's opacity are ONE box wearing ONE set of rules, so a column of
 * slider rows and colour rows lines its hairlines and its numbers up. They were
 * two numbers before (a 60px `sizes.effectColorOpacity` beside the slider's
 * 28px), which is how two things that have to match stop matching.
 *
 * The box is an <input>, so it also wears the `field` recipe's `control` reset
 * — and has to beat that slot's `flex: 1 1 0` / `width: 100%`, which would grow
 * the number across the ruler beside it. One stated width instead, for every
 * one of them: a column of rows lines up because the boxes are the same size,
 * not because their contents happen to be. It was content-sized over a 28px
 * floor before, which drew a different width per row and moved the hairline
 * beside it as a value counted past 9.
 *
 * It also takes the frame's dead space with it. The flex gap on its left and
 * the frame's own inline padding on its right would otherwise fall through to
 * the frame, whose mousedown forwards focus to the field's CONTROL — so a click
 * a few pixels off the number moves a slider's thumb instead of placing a caret
 * in the box. A negative margin pulls the box out over each side, an equal
 * padding puts the number back on exactly the pixel it is drawn on, and
 * `alignSelf` claims the frame's full height the way a slider track does. Each
 * side is scoped to the arrangement that has the space to reclaim, so a
 * re-composed frame cannot pull the box out over a sibling.
 *
 * The stated width is the DRAWN box, reclaimed space included — that space was
 * already the frame's own padding, so the number keeps sitting on the pixel it
 * always sat on and only the room in front of it changes.
 */
const fieldValueBox = {
  // Doubled class, and this is load-bearing: the box wears the `field` recipe's
  // `control` reset as well as its own slot, and Panda emits slot recipes
  // ALPHABETICALLY inside `@layer recipes.slots` — `.field__control` lands
  // after `.color-field__opacity`, so at equal specificity the reset's
  // `flex: 1 1 0` / `width: 100%` / `min-width: 0` won on source order and the
  // opacity box's stated width had simply never applied. `&&` puts every
  // declaration that overlaps the reset a specificity step above it, wherever
  // the box is used and whatever the slot is called.
  "&&": {
    flex: "0 0 auto",
    width: "token(sizes.fieldValue)",
    alignSelf: "stretch",
    textAlign: "right",
    // The number changes on every drag frame and every keystroke; proportional
    // digits would make it shuffle horizontally as it counts.
    fontVariantNumeric: "tabular-nums",
    "&:not(:first-child)": {
      marginInlineStart: "calc(token(spacing.md) * -1)",
      paddingInlineStart: "md",
    },
    "&:last-child": {
      marginInlineEnd: "calc(token(spacing.md) * -1)",
      paddingInlineEnd: "md",
    },
  },
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
      // There is a cursor on this device — a mouse or a trackpad, not a finger.
      // The site's affordances split on it: hover chrome and keyboard-shortcut
      // hints are an offer to a visitor who has the hardware to take them up,
      // and are noise on a touch-first device, where there is no pointer to
      // reveal them with and no key to press. Same query the custom cursor is
      // gated on in globals.css — one definition of "cursor-first" for both.
      //
      // Imported rather than written out, for the reason `bottomSheet` below
      // is: the command palette has to ask this one in JS too (`useHasCursor`),
      // and a stylesheet and a script disagreeing about what a cursor is would
      // draw a keyboard hint on a device that cannot press it.
      hasCursor: `@media ${HAS_CURSOR_QUERY}`,
      // The properties panel as a BOTTOM SHEET — see `BOTTOM_SHEET_QUERY` for
      // what the query says and why. Imported rather than written out, because
      // a pointer handler has to ask the browser the same question at press
      // time and the two must not drift.
      bottomSheet: `@media ${BOTTOM_SHEET_QUERY}`,
      // A rail on a viewport the page does not inset for — see
      // `NARROW_RAIL_QUERY`.
      narrowRail: `@media ${NARROW_RAIL_QUERY}`,
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
          // The confirm dialog (Figma 979:2025) — narrow enough that a
          // yes/no question does not arrive looking like a form.
          dialogXs: { value: "320px" },
          dialogSm: { value: "480px" },
          // The pitch the projects listing counts its tiers in, and the ONLY
          // number that grid is built from: it goes two-up at 2 × this and
          // three-up at 3 × this. Those are FLOORS, not widths — under the
          // three-up ceiling a grid spreads to whatever room it has, so a tier
          // says the least a grid of that many columns may be rather than what
          // it is held to. The gutter comes out of the pitch rather than being
          // added to it, so a column runs its share of one under 320 at the
          // very bottom of a tier and grows past it the rest of the way up.
          listingColumn: { value: "320px" },
          listingGrid3Up: { value: "calc(3 * {sizes.listingColumn})" },
          articleShowcase: { value: "960px" },
          calchemyDemo: { value: "720px" },
          librarySidebar: { value: "200px" },
          imagePreviewMax: { value: "280px" },
          insertDialogHeight: { value: "480px" },
          // A 32px `sm` action chip on a 6px inset — the row hugs its buttons
          // rather than framing the taller 40px chip it used to hold.
          dialogFooter: { value: "44px" },
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
          // The number at the end of a field frame — the slider's readout and
          // the colour input's opacity, which are one box (see
          // `fieldValueBox`) and so are one width.
          fieldValue: { value: "60px" },
          // Option row hit target: 24px line + 2×4 inset (Figma 647:2387).
          optionRow: { value: "32px" },
          // The small list's two heights (Figma 1027:2276), each written as the
          // relation it actually is rather than as the number it comes out at.
          // The row loses the inset the line above describes and IS the 14/24
          // line box, so rows are separated by a 2px gap instead of by padding;
          // the search strip above them is that same line box on a 2px inset.
          optionRowSm: { value: "calc({sizes.optionRow} - 2 * {spacing.sm})" },
          optionSearchSm: {
            value: "calc({sizes.optionRowSm} + 2 * {spacing.xs})",
          },
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
          // Properties-panel geometry (Figma 845:7223). A control row is
          // label ∣ field, and the panel's WIDTH is derived from it below —
          // one row, one panel, so the two can never drift out of agreement.
          propertyRowLabel: { value: "80px" },
          propertyRowField: { value: "220px" },
          // 12 + 80 + 8 + 220 + 12 — the row plus the control panel's own
          // inset on both sides. Written out rather than hard-coded at 332px
          // so widening a field widens the panel with it.
          propertiesPanelWidth: {
            value:
              "calc({sizes.propertyRowLabel} + {sizes.propertyRowField} + {spacing.md} + 2 * {spacing.lg})",
          },
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
          // Chips large enough that a pill would be too round — the collection's
          // surplus badge, which sits in a quadrant of a tile and has to read
          // as a plate rather than as a button. The cards it sits on round at
          // `xl`, with the demo frames they share a column with.
          xxl: { value: "{spacing.xxl}" },
          // Pill. `spacing.half` (50%) is the CIRCLE radius — on an oblong box
          // it draws an ellipse, not a stadium — so anything that can widen
          // needs a large absolute radius the box's half-height clamps down.
          full: { value: "9999px" },
        },
      },

      containerNames: ["demoFrame", "projectsGrid"],

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
            // `surface` at 75%, for a chip that floats ON an image rather than
            // on the app's own background — the collection's surplus badge. It
            // pairs with a backdrop blur: the translucency is what lets the
            // photo read through, and the blur is what keeps the label legible
            // over whatever happens to be under it (Figma 829:6913 light
            // rgba(216,221,227,.75) / 831:6972 dark rgba(46,51,56,.75) — the
            // same two neutrals `surface` resolves to).
            surfaceGlass: {
              value: {
                base: "color-mix(in srgb, var(--colors-neutral-200) 75%, transparent)",
                _dark:
                  "color-mix(in srgb, var(--colors-neutral-800) 75%, transparent)",
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
                  "linear-gradient(135deg, {colors.brand.pink} 0%, {colors.brand.orange} 60%)",
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
            // A hairline needs more alpha to read on a dark ground than on a
            // light one, so it steps 25% → 50% exactly as `field.border.default`
            // does. Held to the SAME pair on purpose: the two are indistinguishable
            // in light UI, and a divider that stayed at 25% while every input
            // frame beside it went to 50% would read as a fainter class of rule
            // in dark only.
            divider: {
              value: {
                base: "color-mix(in srgb, var(--colors-neutral-500) 25%, transparent)",
                _dark:
                  "color-mix(in srgb, var(--colors-neutral-500) 50%, transparent)",
              },
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
        // The photo displaced by a reorder, appearing in the slot the dragged
        // one just left. It has no journey to show — it was never picked up —
        // so it resolves in place rather than sliding in from somewhere it
        // never was.
        collectionArrive: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        // The properties panel arriving from the edge it is docked to. It
        // travels by its OWN width (`100%`, not a viewport unit), so the panel
        // starts exactly off-screen whatever it happens to be that wide — and
        // `translate` rather than `transform` leaves the transform property
        // free for anything the panel's contents want to do.
        //
        // Opacity rides along so the shadow doesn't sweep across the page
        // ahead of the panel; the global `prefers-reduced-motion` reset in
        // globals.css collapses the whole thing to a cut.
        propertiesPanelIn: {
          from: { translate: "100% 0", opacity: 0 },
          to: { translate: "0 0", opacity: 1 },
        },
        // ...and leaving the same way it came. A panel that slides in and then
        // simply vanishes reads as two different objects; the return journey
        // is what makes the edge it went back to legible.
        propertiesPanelOut: {
          from: { translate: "0 0", opacity: 1 },
          to: { translate: "100% 0", opacity: 0 },
        },
        // The same panel as a bottom sheet, arriving from the edge THAT is
        // docked to. Same distance in its own units, same 200ms, same opacity
        // ride — one object with two edges to come from, not two animations.
        bottomSheetIn: {
          from: { translate: "0 100%", opacity: 0 },
          to: { translate: "0 0", opacity: 1 },
        },
        bottomSheetOut: {
          from: { translate: "0 0", opacity: 1 },
          to: { translate: "0 100%", opacity: 0 },
        },
        // The calendar's page turn. A chevron replaces every month on screen at
        // once, so the arriving page enters from the side the range is
        // travelling toward and the leaving one is pushed out by the same
        // distance — the pair reads as one strip being moved along rather than
        // a blink between two months.
        //
        // `--calendar-push` IS that distance, set by `Calendar.PeriodList` as a
        // percentage of one month column (a turn moves by `step` columns,
        // whatever the range's width) and signed by the direction of travel.
        // One variable for both halves is what keeps them in lockstep: where a
        // walking range repeats a month, the two copies sit at exactly the same
        // x for the whole slide instead of drifting past each other.
        calendarPageIn: {
          from: { translate: "var(--calendar-push) 0" },
          to: { translate: "0 0" },
        },
        calendarPageOut: {
          from: { translate: "0 0" },
          to: { translate: "calc(var(--calendar-push) * -1) 0" },
        },
        // The ring a demo's stand-in cursor leaves where it clicked. A real
        // cursor makes no such mark — this one has to, because the pointer is
        // the only thing on screen that ISN'T under the visitor's hand, and a
        // press that only dips the arrow by a few pixels reads as a glitch
        // rather than as a click. It opens from under the cursor's tip and is
        // gone before the next stop.
        demoCursorTap: {
          from: { opacity: 0.6, transform: "scale(0.35)" },
          to: { opacity: 0, transform: "scale(1)" },
        },
      },

      recipes: {
        // -------------------------------------------------------------------
        // Masonry, done as arithmetic rather than as a layout mode.
        //
        // `display: grid-lanes` is the real answer, and this upgrades to it
        // wherever it exists (Safari 26.4+ as of writing; Chrome and Firefox
        // still behind a flag). Everywhere else the same picture is built from
        // a grid whose rows are 1px tall, with every card spanning as many of
        // them as its own height comes to. A card's height is a function of the
        // width it lands at and the shape it declares, and BOTH are knowable in
        // CSS, so the span can be computed rather than measured.
        //
        // The division is the awkward part: `calc()` will not divide a length
        // by a length and hand back a number. `tan(atan2(A, B))` will — atan2
        // takes two same-unit values and returns an angle, and the tangent of
        // that angle is A/B as a bare number. It is a trigonometric identity
        // pressed into service as a type cast, it is ugly, and it is the only
        // thing in CSS that does this. BOTH divisions have to route through it,
        // the gutter term included; a bare `calc(20px / 1px)` is invalid and
        // takes the whole declaration down with it.
        //
        // Rejected: `column-count`, which is what this replaces. It packs
        // beautifully and cannot span — a card two columns wide is not
        // expressible in a column box at all — and spanning is the entire point
        // of the grid this feeds. Rejected: measuring heights in JS and writing
        // spans back, which is a layout pass per card per resize and a frame of
        // wrong on each one. An observer still has a job here, but as a
        // correction for content that outgrows its declared shape, not as the
        // mechanism.
        //
        // The `@supports` guard is load-bearing rather than polite. Without it
        // an engine lacking `atan2` drops the `grid-row` declaration and KEEPS
        // `grid-auto-rows: 1px`, collapsing every card to a single pixel. It
        // tests the exact construction it protects, not a proxy for it.
        //
        // Two nested containers, deliberately. The grid is its own unnamed
        // `inline-size` container so a child's `100cqw` is the GRID's width and
        // the arithmetic is exact; the tier queries name `projectsGrid` and so
        // skip it for the section outside. Capping the grid's width while
        // measuring against a wider ancestor is precisely the drift this
        // arrangement rules out.
        // -------------------------------------------------------------------
        masonryGrid: defineRecipe({
          className: "masonry-grid",
          description:
            "A masonry grid that supports column spans. Upgrades to `display: grid-lanes` where it exists; elsewhere it packs cards into 1px row tracks and computes each card's row span from its declared aspect and the width it lands at. Children drive it with three custom properties — `--span` (columns, clamped to what the grid has), `--aspect-w` and `--aspect-h` (the shape as a pair, kept as integers so ratios like 3:2 stay exact) — and may publish a fourth, `--card-height`, when they have measured themselves taller than their shape; the span reserves the larger of the two. The grid hands `--aspect-height` back to each child, which is the shape's height at the width that child landed at, so the child can take its shape as a floor. `data-columns` is the CEILING on the column count from `listingColumnsFor`; the tier queries hand out the smaller of that and what fits.",
          base: {
            // The gap, once, as a length the arithmetic can read back. It has
            // to be a custom property rather than `columnGap` alone, because the
            // span calc needs the same quantity as an operand and a recipe
            // cannot read back what it set.
            //
            // 20px, the gutter the `column-count` masonry used. Note that it
            // is narrower than the 28px button `GridInsertRail` centres in it,
            // so in edit mode that button overhangs the cards either side by
            // 4px. Deliberate, and only visible while editing.
            "--grid-gap": "token(spacing.xxl)",
            "--columns": "1",

            containerType: "inline-size",
            display: "grid",
            gridTemplateColumns: "repeat(var(--columns), minmax(0, 1fr))",
            columnGap: "var(--grid-gap)",
            rowGap: "var(--grid-gap)",
            width: "token(spacing.full)",
            marginInline: "auto",

            "& > *": {
              // Clamped in CSS, not by the caller: the column count is a
              // function of the space available and changes under the caller's
              // feet, so a card asking for three columns in a one-column grid
              // has to be cut down HERE. Left unclamped it does not overflow —
              // it silently mints two implicit columns and takes the layout
              // with it.
              gridColumn: "span min(var(--span, 1), var(--columns))",
              minWidth: "0",

              "--span-clamped": "min(var(--span, 1), var(--columns))",
              "--col-width":
                "calc((100cqw - (var(--columns) - 1) * var(--grid-gap)) / var(--columns))",
              // A spanning card is not N columns wide — it is N columns plus
              // the N-1 gutters it swallows.
              "--cell-width":
                "calc(var(--col-width) * var(--span-clamped) + (var(--span-clamped) - 1) * var(--grid-gap))",
              // The height the declared shape asks for at the width the card
              // landed at. Published to the cell rather than kept for the span
              // arithmetic, because the cell takes it as a `min-height` — see
              // `--card-height` below for why it cannot be an `aspect-ratio`.
              "--aspect-height":
                "calc(var(--cell-width) * var(--aspect-h, 9) / var(--aspect-w, 16))",
            },

            "@supports (grid-row: span calc(tan(atan2(1px, 1px))))": {
              gridAutoRows: "1px",
              rowGap: "0",
              "& > *": {
                // Height, then the gutter, both as counts of 1px rows. `row-gap`
                // is zero above precisely so the second term can be the gap —
                // a real row-gap would apply between every 1px track and turn a
                // 20px gutter into 20px times the height of the card.
                //
                // The height is the LARGER of the shape's and the card's own.
                // The shape is a floor, not a fixed height: a demo frame stops
                // shrinking with its width at its content's height plus its
                // padding, so a card too narrow for its shape to hold its
                // contents is taller than its shape — which is every card at
                // one column, and most of them at two. Reserving the shape's
                // height there packed the next card into rows this one was
                // still drawing in, and the card, told to fill a cell shorter
                // than its contents, simply clipped them.
                //
                // `--card-height` is measured and published by the cell itself
                // (`GridItem`), because a rendered height is not a quantity CSS
                // can be asked for. Absent — before the first measurement, and
                // on the server — this falls back to the shape's height alone,
                // which is what the grid reserved before any of this existed.
                gridRow:
                  "span calc(tan(atan2(max(var(--aspect-height), var(--card-height, 0px)), 1px)) + tan(atan2(var(--grid-gap), 1px)))",
                // `start`, not the default `stretch`. Stretched, a card grows
                // to fill the rows it was given INCLUDING the gutter rows, and
                // the gap closes to nothing. It is also what keeps the
                // measurement above from chasing its own tail: the card's
                // height decides the span, and the span must not decide the
                // card's height back.
                alignSelf: "start",
              },
            },

            // Last, so it wins on source order where both are supported.
            "@supports (display: grid-lanes)": {
              display: "grid-lanes",
              gridAutoRows: "auto",
              rowGap: "var(--grid-gap)",
              "& > *": {
                gridRow: "auto",
                alignSelf: "auto",
              },
            },

            // Narrow to wide: the tiers OVERLAP, so the wider one has to be the
            // later of the two.
            "@container projectsGrid (min-width: 640px)": {
              "&[data-columns='2'], &[data-columns='3']": { "--columns": "2" },
            },
            "@container projectsGrid (min-width: 960px)": {
              width: "min(100%, token(sizes.listingGrid3Up))",
              "&[data-columns='3']": { "--columns": "3" },
            },
          },
        }),
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
            "The one look shared by the two actionable primitives — Button (a <button> that ACTS) and Link (an <a>/next-link that NAVIGATES) — so their skin lives in the design system once and both consume it. `text` = the standalone CTA (filled secondary chip, 8px radius, fixed 40px height, hugs content with an 80px floor); `icon` = the compact 28px toolbar chip (`color: inherit` so the surface owns the glyph hue — the calendar chevrons and their onBrand retint); `link` = an inline underlined text link. Orthogonal to that shape axis, `emphasis` sets the fill prominence: `secondary` (the filled chip drawn above) or `tertiary` (no fill at rest, the neutral `field.bg.hover` on hover — the same wash icon buttons use). Icon buttons are tertiary by nature. `size` is the third axis, and applies to the `text` chip: `md` is the 40px/`bodyLarge` default, `sm` a 32px/`bodySmall` chip on an 8px inline inset (the option row's pitch).",
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
                // Space icon ∣ optional label. No app surface composes the pair
                // any more — an icon button names itself on hover instead — but
                // the recipe still supports it (see /dev/button).
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
            // Fill prominence — orthogonal to `variant` (the shape). All three
            // are empty here: `secondary` is what `text` already draws, and the
            // other two are applied by the compounds below. `tertiary` is inert
            // for `icon`, which is tertiary by nature.
            emphasis: {
              secondary: {},
              tertiary: {},
              glass: {},
            },
            // The chip's scale — the third axis, orthogonal to both of the
            // above. Empty for the same reason `emphasis` is: `md` is what
            // `text` already draws, and `sm` is applied by the compound below.
            // Inert for `icon` (one toolbar size) and `link` (inline text that
            // takes the surrounding line box, not a box of its own).
            size: {
              md: {},
              sm: {},
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
            {
              variant: "icon",
              emphasis: "glass",
              // The one icon chip that floats ON a picture rather than on a
              // surface of the app's own, so it cannot rest transparent: the
              // `icon` variant's `color: inherit` and bare glyph are legible
              // because a surface behind them holds them down, and over a video
              // frame there is no such surface — a pale still swallows the
              // glyph outright.
              //
              // The material is the one every other chip over an image already
              // uses (the collection's surplus badge): `surfaceGlass` is
              // `surface` at 75%, and the blur is what keeps the glyph legible
              // over whatever happens to be moving underneath it. Same override
              // mechanic as the compounds around it — a compound's declarations
              // land in a later layer than the variant's, so the transparent
              // fill and inherited colour they replace are the ones that lose.
              css: {
                backgroundColor: "bg.surfaceGlass",
                // Panda's `backdropFilter` utility emits only the -webkit-
                // form, which Chromium does not recognise, so the raw key is
                // the one that lands; the prefixed spelling stays for older
                // WebKit. The 8px radius is the app's one blur strength.
                backdropFilter: "blur(token(spacing.md))",
                "-webkit-backdrop-filter": "blur(token(spacing.md))",
                "backdrop-filter": "blur(token(spacing.md))",
                color: "text.body",
                // Opaque on hover — the chip comes forward as you reach for it,
                // and `surface` is exactly what `surfaceGlass` is 75% of.
                _hover: { backgroundColor: "bg.surface" },
              },
            },
            {
              variant: "text",
              size: "sm",
              // Same override mechanic as the tertiary compound above — atomic
              // utilities in a later layer beat the `text` variant's own height
              // and text style.
              css: {
                height: "token(spacing.3xl)",
                // Tightened from the 40px chip's 12px: at 32px the wider inset
                // reads as a stretched pill rather than a smaller button. The
                // 8px gap between a leading icon and the label is ALREADY what
                // `text` sets (`gap: md`) and deliberately does not shrink —
                // one inset all the way round the content.
                paddingInline: "md",
                textStyle: "bodySmall",
              },
            },
          ],
          defaultVariants: {
            variant: "text",
            emphasis: "secondary",
            size: "md",
          },
          // Runtime variant values — force every branch to be emitted.
          staticCss: [{ variant: ["*"], emphasis: ["*"], size: ["*"] }],
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
            "Wide showcase container for figures and embeddable components inside article content. The block itself spans the article's full 960 column; its caption wraps at the 640 text column, since a caption is prose and reads at the measure the paragraphs around it do.",
          base: {
            width: "token(spacing.full)",
            display: "flex",
            flexDirection: "column",
            gap: "md",
            alignItems: "center",
            // The picture is 960 wide; the words under it are not. A caption
            // set to the block's width would run to a measure no other prose
            // in the article uses, so it takes the text column's — centred
            // under the block by the `alignItems` above, exactly as a shorter
            // caption already sits. `textAlign` centres the LINES too, so a
            // caption that wraps still reads as centred rather than as a
            // ragged left column — the same alignment the editor's own
            // caption has always had.
            // (The caption's `text-wrap` cannot be set here — `Typography`'s
            // own `pretty` is an atomic utility, a later layer than this one,
            // so the balance is a `wrap` variant on the type itself.)
            "& > figcaption": {
              maxWidth: "token(sizes.articleContent)",
              textAlign: "center",
            },
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
            // The containing block for `demoFrameControls` — a demo that
            // performs itself pins its replay/reset rail to the FRAME's corner,
            // not to wherever its own content happens to end.
            position: "relative",
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
            // Even 20px top and bottom — the 40px `getDemoFrameMinHeight`
            // reserves for a frame, split in two. The logger variant is the one
            // case that trims the foot, and it says why.
            paddingBlock: "xxl",
            // The same 20px at the sides, but where the block padding is always
            // spent, this is only ever FELT when the demo is too wide for the
            // frame. A demo that fits is centred and never reaches the inset:
            // `demoFrameDemoMeasure` is `fit-content`, and a logger frame's
            // stretched child is still held by its own max-width. Below that
            // point the inset is what the demo is clamped to, so a narrow frame
            // gives it a gutter instead of running it into the edge.
            //
            // It costs the height arithmetic nothing: `aspect-ratio` sizes the
            // BORDER box, and `getDemoFrameMinHeight` counts only the 40px of
            // block padding, so the ratio-vs-content floor resolves exactly as
            // before — a squeezed demo simply measures taller, which is the
            // input that floor already takes.
            paddingInline: "xxl",
          },
          variants: {
            aspectRatio: demoFrameAspectRatioVariants,
            logger: {
              true: {
                height: "auto",
                // A logger footer follows, and `demoLoggerSection` carries an
                // 8px inset of its own. Trimming the area's foot to 12 lets the
                // two add back up to 20, so the demo still sits evenly between
                // the frame's top edge and the logger panel.
                paddingBlockEnd: "lg",
                "& > *": {
                  width: "token(spacing.full)",
                  maxWidth: "token(spacing.full)",
                  // The floor below is a `min-height`, and a floor is only a
                  // floor if the demo can push past it. This column's items
                  // shrink by default, so a demo taller than the floor was
                  // squashed down to it instead of raising it — and a demo
                  // that hides its own overflow (Calchemy does) then quietly
                  // cut its calendar off rather than showing it clipped. The
                  // demo keeps its height and the AREA gives way, which is
                  // exactly what `demoFrameDemoMeasure` guarantees the
                  // non-logger path; a logger frame has no such wrapper, so
                  // the guarantee has to be made here.
                  flexShrink: 0,
                },
              },
            },
          },
          // A logger frame drops `aspect-ratio` (here, in the compound — see
          // `demoFrameAspectRatioFloors` for why it cannot be done in the
          // variant), so reserve that height as a floor in container-query
          // units — full height from SSR, no client-measured jump. A FLOOR,
          // which is the point: the ratio it replaces was a fixed height, and
          // a demo taller than it at the width it landed at raises the frame
          // instead of being cut off by it. cqw factor = ratioHeight / ratioWidth, which
          // is why these read as different numbers from the variant above even
          // though they are the same ratios; both are derived from the one map
          // in src/utils/demo-frame-sizing.ts rather than written out here.
          compoundVariants: demoFrameAspectRatioFloors,
          defaultVariants: {
            aspectRatio: "2/1",
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

        demoFrameControls: defineRecipe({
          className: "demo-frame__controls",
          description:
            "The frame's controls for a demo that performs itself (replay / reset) — the bare pair of icon buttons in its bottom-right corner, with no rail under them. Deliberately NOT the shared `toolbar` chrome it used to compose: these sit on the frame's own surface, which is already a bounded box, and a second bordered box inside it was one frame too many. What is left is the row itself, and each button draws its own chip on hover. It belongs to the frame rather than to the demo's own layout, which is why it is placed here: the demo is centred inside the area's 20px padding band and so never reaches this corner. Out of flow, so it costs the frame's content measurement nothing.",
          base: {
            position: "absolute",
            // 12px in, because it is now the BUTTON that sits in the corner
            // rather than a rail around it: the frame's own corner is
            // `radii.xl` and the icon chip's is `radii.sm`, and 16 − 12 = 4
            // makes those two curves concentric. The rail this replaces was
            // inset 8px on exactly the same arithmetic against its own 8px
            // corner.
            right: "lg",
            bottom: "lg",
            // The demo below can carry stacking contexts of its own (any
            // element with opacity < 1 makes one at level 0), so `auto` would
            // leave the row's order to the DOM.
            zIndex: 1,
            // The row, which is all the chrome there is now. 4px apart, the
            // spacing the rail used to hold them at — at zero the two hover
            // chips would meet and read as one lozenge, which is the frame
            // coming back in by the side door.
            display: "flex",
            alignItems: "center",
            gap: "sm",
            // The `icon` action is `color: inherit` — its SURFACE owns the
            // glyph hue — so a row that sets nothing inherits `text.default`
            // off the body. That is prose colour, and prose runs to the far end
            // of the ramp in dark (neutral.200) while merely sitting heavy in
            // light (neutral.700): the same omission reads as fine in one theme
            // and as two glaring white glyphs in the other. It matters more
            // now that there is no surface behind the glyphs to hold them
            // down. This is the pair the calendar's own chevrons take, so the
            // frame's controls and the demo's read as one class of control in
            // both themes.
            color: "field.text.default",
            // Down until the visitor is actually in the frame. The demo plays
            // itself the moment it comes on screen, so for most of an article
            // these are controls nobody is reaching for, sitting in the corner
            // of a picture — the same call the clip's transport makes, and the
            // same terms: a fade, and up for as long as focus is inside, so a
            // keyboard can reach them at all.
            opacity: 0,
            transition: "opacity 150ms ease",
            "[data-demo-frame]:hover &, [data-demo-frame]:focus-within &": {
              opacity: 1,
            },
            // No pointer to hover with, so no reveal to wait for.
            "@media (hover: none)": { opacity: 1 },
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
            // No corner: an article image, like a collection tile, wears the
            // radius its own properties state and nothing else — see
            // `DEFAULT_MEDIA_RADIUS`.
            display: "block",
            borderWidth: "token(spacing.3xs)",
            borderStyle: "solid",
            borderColor: "border.divider",
          },
        }),

        articleMediaFrame: defineRecipe({
          className: "article-media-frame",
          description:
            "The box around a single media block in article prose — the picture's own, NOT the figure's, which also holds the caption. It exists to be the positioned parent a clip's transport pins to, so the chip lands in the corner of the picture rather than down beside the words under it. The width is load-bearing, not a default: `articleShowcase` is a centred flex column, so a box that did not state one would shrink-wrap, and the media's own frame inside it — a query container, whose inline size may not come from its contents — would then collapse to nothing at all. `flex` rather than `block` so no line box puts a descender gap under the picture.",
          base: {
            position: "relative",
            display: "flex",
            width: "token(spacing.full)",
            minWidth: 0,
          },
        }),

        mediaTransport: defineRecipe({
          className: "media-transport",
          description:
            "The box that holds a clip's own transport — the single play/pause chip in the bottom-right corner of the surface showing it, for the places a visitor should be able to stop a loop without the browser's full control strip laid across the foot of the picture. Positioned exactly like `demoFrameControls`, and on the same terms: it is absolute against whatever positioned box the SURFACE provides (the lightbox's frame), so it costs that box's measurement nothing and nothing enters the media's own flow. It is a box around the button rather than the button's own class for the same reason the frame's controls are: `action`'s `icon` variant is itself `position: relative`, and one recipe cannot out-rank another recipe's variant. The chip inside wears the `glass` emphasis rather than the frame controls' bare glyph, because this one floats on a picture rather than on a surface of the app's own.",
          base: {
            position: "absolute",
            // The same 12px the frame's controls take, so the two read as one
            // class of control wherever they turn up. Anchored to the FRAME,
            // like every other control in this app that sits in a corner —
            // never to the picture inside it, which moves as its inset changes.
            right: "lg",
            bottom: "lg",
            // Above the clip, which is itself raised over the ground behind it
            // (the lightbox's `image` slot sits at 1 to clear its gradient).
            zIndex: 2,
            // Down until you reach for the picture. A clip is shown to be
            // WATCHED, and a chip parked in the corner of every one of them is
            // permanent chrome over content that has none — the same call the
            // collection cell's controls make. It fades rather than snapping,
            // and it stays up for as long as focus is inside the surface, so a
            // keyboard can reach it at all.
            opacity: 0,
            transition: "opacity 150ms ease",
            "[data-media-surface]:hover &, [data-media-surface]:focus-within &":
              { opacity: 1 },
            // Where there is no pointer to hover with, there is no reveal to
            // wait for — a touch visitor would otherwise have no way to stop a
            // clip at all.
            "@media (hover: none)": { opacity: 1 },
          },
        }),

        // The "Add Image" call to action filling an unused collection slot. A
        // real button, so it takes the OptionList row's state ladder — the same
        // gesture (pick this thing) should look the same whether it's a 32px
        // row or a 312px cell. Two differences from that slot, both deliberate:
        //
        //   • It has a RESTING fill (`bg.itemHover`, Figma 828:6860/827:6511 —
        //     the same 25% neutral in both themes). An option row can rest
        //     transparent because the list around it frames it; an empty cell
        //     has nothing to sit in, so the fill IS what makes the slot legible
        //     as a slot. Hover then lifts to the secondary button's hover wash,
        //     which is the only neutral above it in both themes.
        //   • No `:not([aria-selected])` guards on the hover rule. Those exist
        //     in `optionList` because a selected row is ALSO the roving
        //     highlight and the two states collide on one element; nothing here
        //     is ever selected or pressed, so there is nothing to guard against.
        collectionEmptyCell: defineRecipe({
          className: "collection-empty-cell",
          description:
            "Add Image CTA occupying an empty collection slot in the editor — OptionList's state ladder (rest ▸ hover ▸ active ▸ keyboard focus) scaled up to a grid cell (Figma 828:6860 light / 827:6511 dark).",
          base: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "sm",
            width: "token(spacing.full)",
            height: "token(spacing.full)",
            // The filled cell's corner — an empty slot is the same card with
            // nothing in it, and the two sit side by side in one grid.
            borderRadius: "xl",
            borderWidth: "token(spacing.3xs)",
            borderStyle: "solid",
            borderColor: "border.divider",
            backgroundColor: "bg.itemHover",
            appearance: "none",
            color: "field.text.default",
            textStyle: "bodySmall",
            cursor: "pointer",
            userSelect: "none",
            transition:
              "background-color 150ms ease, color 150ms ease, box-shadow 150ms ease",
            "& svg": {
              width: "token(spacing.xxl)",
              height: "token(spacing.xxl)",
              flexShrink: 0,
              display: "block",
            },
            "& svg path[stroke]": { stroke: "currentColor" },
            "& svg path[fill]": { fill: "currentColor" },
            "&:hover": { backgroundColor: "bg.button.secondary.hover" },
            "&:active": {
              backgroundColor: "field.bg.active",
              color: "field.text.active",
            },
            "html[data-keyboard-focus] &:focus-visible": {
              boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
            },
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
        }),

        dialogHeader: defineRecipe({
          className: "dialog-header",
          description:
            "Dialog title row with bottom divider. Insets its contents 8px — the panel's own `md` corner — so the trailing close chip and the leading title sit on the same margin the shell curves at.",
          base: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            height: "token(spacing.4xl)",
            // 8px, matching the footer below and the panel's `md` radius. Set
            // on the recipe rather than per dialog: the header row is the one
            // thing every dialog in the app draws identically, and an inset
            // that differed between the image and component dialogs would be
            // visible the moment you opened one after the other.
            paddingInline: "md",
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
          description:
            "Dialog action row with top divider. Insets its buttons 8px, the same margin the header keeps, so the two rows bracketing the body agree.",
          base: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            height: "token(sizes.dialogFooter)",
            // Deliberately the same 8px as the header — these two rows frame
            // the dialog and any difference between them reads as a slip.
            paddingInline: "md",
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
            "Large image preview in insert-image library view. HEIGHT is the only fixed dimension (280px) — the width hugs the image's own aspect ratio and stretches at most to the pane's content box (`maxWidth: 100%` resolves against the flex container's content box, so the pane's padding is excluded). Fixed rather than max height so the metadata rows below hold their position as you switch images; `object-fit: contain` letterboxes anything the width clamp squeezes. The library holds clips as well as pictures, so the inner rule names both elements — a <video> is a replaced element with the same box model, and the rule is about the BOX, not about what fills it.",
          base: {
            height: "token(sizes.imagePreviewMax)",
            width: "auto",
            maxWidth: "token(spacing.full)",
            flexShrink: 0,
            margin: "none",
            "& :is(img, video)": {
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
          description:
            "Small thumbnail in image library sidebar. Names <video> alongside <img> — a clip's row shows a live thumbnail of itself, filling the same square.",
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
            "& :is(img, video)": {
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
            "Covering calendar popover for the Date input: anchored over the trigger frame (top/left, ≥ its width) with an opaque brand-tinted surface + brand inset border. Distinct from the below-anchored menu popovers. Absolute (not fixed) so it scrolls WITH the page rather than being re-offset against it each frame.",
          base: {
            // ABSOLUTE, not fixed — the difference is everything on scroll. A
            // fixed anchored element is positioned against the viewport, so the
            // browser has to push it back by the scroller's offset every frame,
            // and that offset is a once-per-frame SNAPSHOT: set `scrollTop` and
            // read both boxes in the same tick and the popover is still exactly
            // where it was, the full scroll delta away from its anchor. Under a
            // real (compositor-driven) scroll that lag is the flutter. Absolute
            // against the `position: relative` <body> — which is the app's
            // scroll container (see globals.css) — puts the popover in the same
            // scrolled space as its trigger, so the two move together in one
            // pass and the delta is 0 at every offset. `anchor()` resolves the
            // same either way: the anchor is a descendant of the containing
            // block. The menu popovers below stay fixed on purpose — they need
            // `position-try-fallbacks` measured against the viewport.
            position: "absolute",
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
            // Absolute for the same reason as datePopover — same shell, same
            // covering geometry, same scroll flutter if it were fixed.
            position: "absolute",
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

        // The app's shared toolbar chrome: the box a row of icon controls sits
        // in — a hugging horizontal rail on `bg.surface` with a concentric
        // corner. Three surfaces drew this and each wrote the metrics out
        // again (the editor's floating `selectionPopover`, the demo frame's
        // `demoFrameControls` rail, the collection cell's hover pill); they now
        // compose this and keep only what is actually theirs — where the rail
        // is positioned, and whether it is bordered, elevated or clipped. Those
        // three genuinely differ (one floats on a CSS anchor, one is furniture
        // in a frame's corner, one fades in over a photo's scrim), which is why
        // the shared part stops at the box and does not try to be the skin.
        //
        // `size` is the whole variant axis, because the numbers that make a
        // toolbar only ever move together:
        //   md — the default rail. 40px tall, controls 4px apart on a 6px
        //        inset. 6 + 28px button + 6 = 40 was already the block-axis
        //        arithmetic, and the inline inset now agrees with it, so the
        //        buttons sit in a band of one thickness instead of 8 from the
        //        ends and 6 from the edges. There is no 6px token and a single
        //        inset does not earn one, so it is spelled as the 4 + 2 it is
        //        made of. The corner stays `md` (8px): strict concentricity
        //        would now want 4 + 6 = 10, which is not on the radius scale,
        //        and 8 is what the rest of the floating chrome curves at.
        //   sm — the rail shrink-wrapped onto its buttons: 28px tall (exactly
        //        `sizes.toolbarButton`, so the box IS one button), no inset, no
        //        gap, and the ITEMS go square so the rail is the only thing in
        //        the box with a corner. With no inset and no gap there is
        //        nothing left for a per-item radius to round against — the
        //        chips abut each other and reach the rail's edge, so rounding
        //        them would just notch four bites of surface out of every
        //        seam. One 4px corner on the outside, and the rail clips the
        //        square ends of the row to it.
        toolbar: defineRecipe({
          className: "toolbar",
          description:
            "The app's shared toolbar chrome — the horizontal rail a row of controls sits in, with a corner concentric to the buttons inside it. Owns the box only (layout, height, inset, gap, radius, surface); positioning and whether the rail is bordered, elevated or clipped stay with the consumer, since the surfaces that draw it differ on exactly those. `size=md` is the default 40px rail (6px inset, 4px gap, 8px radius) whose buttons keep their own 4px corners; `size=sm` shrink-wraps it onto the buttons at 28px with no inset and no gap, squares the items, and keeps a single 4px corner on the rail itself — which it clips the row to. `tone` picks the ground: `surface` for free-standing chrome, `field` for a rail that is one row of a form (the segmented control). `fit` picks hug-your-contents or fill-your-slot.",
          base: {
            display: "flex",
            alignItems: "center",
          },
          variants: {
            // WHAT the rail is drawn on. `surface` is the free-standing chrome
            // every floating/furniture toolbar wears; `field` drops it into a
            // form row as one of the field family's own controls, taking that
            // family's fill and hairline so a segmented control lines up with
            // the text inputs and sliders stacked above and below it
            // (Figma 885:1963).
            tone: {
              surface: { backgroundColor: "bg.surface" },
              field: {
                backgroundColor: "field.bg.default",
                // An inset ring rather than a `border`, exactly as the `field`
                // frame draws its own edge: a real border would eat into the
                // 28px and leave the rail a pixel shorter than the slider
                // beside it.
                boxShadow:
                  "inset 0 0 0 token(spacing.3xs) var(--colors-field-border-default)",
              },
            },
            // Whether the rail sizes to its contents or to its slot. Hugging is
            // right for chrome that floats or tucks into a corner; filling is
            // right for a control that is one row of a form and has to agree
            // with the column its neighbours sit in.
            fit: {
              hug: {
                // Also overrides the `article > *` width rule (@layer base)
                // that would otherwise stretch it to the text column.
                width: "max-content",
              },
              fill: { flex: "1 1 0", minWidth: 0 },
            },
            size: {
              md: {
                gap: "sm",
                height: "token(spacing.4xl)",
                // 6px — the block-axis inset the 40px height already implies
                // around a 28px button. Composed rather than tokenised: the
                // scale stops at 4 and jumps to 8, and one rail's inset is not
                // reason enough to wedge a step between them.
                paddingInline: "calc(token(spacing.sm) + token(spacing.xs))",
                borderRadius: "md",
              },
              sm: {
                gap: "none",
                height: "token(sizes.toolbarButton)",
                paddingInline: "none",
                borderRadius: "sm",
                // A rail's own `gap` only spaces its DIRECT children, and half
                // the toolbars in the app do not lay their buttons out
                // themselves: they hold an `OptionList.Toolbar`, whose inline
                // direction owns the 2px between the options. Asking for no gap
                // has to mean no gap wherever the row is actually laid out,
                // otherwise `sm` reads as gapless when the buttons are direct
                // children (the demo frame's rail) and 2px-apart when they come
                // from an OptionList — the same variant, two different boxes.
                // Deliberately not `:where()`, which would leave this tied with
                // the option list's own inline rule and let stylesheet order
                // decide the winner.
                // `listbox` as well as `toolbar`: the option list's inline
                // direction serves both a multi-toggle row and a horizontal
                // single-select (a segmented control is the latter), and the
                // rail cannot tell which it was handed.
                "& :is([role='toolbar'], [role='listbox'])": { gap: "none" },
                // The items go square: the rail owns the only corner in the
                // box. Reaches every control the same way the gap rule does,
                // since a button here may be a direct child (the demo frame's
                // rail) or an `OptionList.Option` a row down.
                "& :is(button, [role='button'])": { borderRadius: 0 },
                // Which makes the clip load-bearing rather than optional — the
                // end chips are square and would otherwise square off the 4px
                // corner they sit in. Safe to set here even though
                // `demoFrameControls` argues against `overflow: hidden` at
                // `md`: that argument is about not laying a trap for a
                // descendant that wants out, and the one thing in these rails
                // that ever wanted out — a hover tooltip — now portals itself
                // to the body rather than relying on its host not to crop.
                overflow: "hidden",
              },
            },
          },
          defaultVariants: { size: "md", tone: "surface", fit: "hug" },
          // Runtime variant values — force every branch to be emitted.
          staticCss: [{ size: ["*"], tone: ["*"], fit: ["*"] }],
        }),

        selectionPopover: defineRecipe({
          className: "selection-popover",
          description:
            "Shared floating popover for the text-selection / link / numbering / bullet menus — anchored above the target via CSS anchor() and flipped below when there's no room (Figma 422:833 selection, 474:74 numbering, 475:204 bullet). Composes with `toolbar` for the rail itself and adds only what floating costs: the anchor, the hairline, the elevation, and a clip. `align=center` centres on the target (text selection / link); `align=start` left-aligns to it (list-marker menus).",
          base: {
            position: "fixed",
            zIndex: 50,
            positionAnchor: "--selection-popover",
            // Default above the target; flip below when there is no room.
            bottom: "anchor(top)",
            marginBottom: "sm",
            positionTryFallbacks: "flip-block",
            maxWidth: "min(100vw, token(sizes.articleContent))",
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
          variants: {
            // Opt-in, for the tooltip that makes an OFFER rather than naming a
            // control — the demos' "Try it yourself". Brand type on the opaque
            // brand surface the popovers already use (rosemilk/rust): the box
            // covers whatever it is drawn over, so the fill can't be a
            // translucent brand wash the way an inline emphasis is.
            tone: {
              brand: {
                backgroundColor: { base: "brand.rosemilk", _dark: "brand.rust" },
                color: { base: "brand.pink", _dark: "brand.orange" },
                // The bright hue again at 25%, exactly as `field.border.active`
                // draws a focused frame — a neutral hairline is the one part of
                // the box that would still read as the default tooltip.
                borderColor: {
                  base: "color-mix(in srgb, var(--colors-brand-pink) 25%, transparent)",
                  _dark:
                    "color-mix(in srgb, var(--colors-brand-orange) 25%, transparent)",
                },
              },
            },
          },
          // The variant reaches the recipe through `Tooltip`'s rest props, which
          // is a runtime value Panda cannot read statically — without this the
          // class lands on the box and no rule is ever emitted for it.
          staticCss: [{ tone: ["*"] }],
        }),

        hotkey: defineRecipe({
          className: "hotkey",
          description:
            "A keyboard shortcut drawn as the key itself — the palette's `Esc` and the home header's `⌘K`. The `tooltip`'s box: same 20px height, 4px radius, hairline and caption type, sized by its content, one key or a combination. `surface` is the fill, and it belongs to whatever the shortcut is drawn among rather than to the chip. Whether a shortcut is worth SHOWING is the caller's call (`_hasCursor`), not the chip's.",
          base: {
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            height: "token(spacing.xxl)",
            paddingInline: "sm",
            borderRadius: "sm",
            borderWidth: "token(spacing.3xs)",
            borderStyle: "solid",
            borderColor: "border.divider",
            color: "text.body",
            // Overrides the UA's monospace default on <kbd>, the element this
            // is nearly always worn by.
            textStyle: "caption",
            whiteSpace: "nowrap",
          },
          variants: {
            // What the chip is standing among, which is what its fill answers
            // to. A shortcut is a label, not a control, so it should look like
            // the furniture around it and never like something to press.
            surface: {
              // Out in the layout, beside a tooltip — the home header, where the
              // two are one button's two labels and the cursor swaps one for the
              // other. Same fill, so it reads as a single box changing what it
              // says rather than as two chips trading places.
              page: {
                backgroundColor: { base: "neutral.200", _dark: "neutral.800" },
              },
              // Inside a menu, where the rows are what the eye is calibrated to:
              // the palette's `Esc` takes the wash a hovered row wears, so the
              // hint sits at the same depth as the thing it is a hint about.
              menu: { backgroundColor: "field.bg.hover" },
            },
          },
          defaultVariants: { surface: "page" },
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

        // The control rail that surfaces over a filled collection cell in the
        // editor (Figma 828:6697 dark / 828:6838 light).
        //
        // Reveal is pure CSS off the cell beside it — no hover state in React —
        // and keys on focus as well, so tabbing into the buttons brings it up.
        // `opacity: 0` (rather than `display: none` or unmounting) is what makes
        // that possible: a transparent element is still focusable.
        //
        // A SIBLING of the cell, never a child of it, which is what every `+`
        // below is about: the cell CLIPS — that is what rounds a photo filling
        // its slot — and this rail is centred on the cell's top edge with half
        // of it hanging outside. A child would be sliced off along that edge.
        // The pair sits in the `slot` box, so the rail is always the element
        // directly after the cell it belongs to.
        //
        // It used to sit dead-centre over the photo on a blurred wash, and both
        // halves of that were wrong: the wash defocused the very picture the
        // controls exist to work on, and the rail covered the middle of it. On
        // the edge it covers a strip of nothing and the photo stays sharp —
        // which is how a home-grid card carries its toolbar too
        // (`grid-item-toolbar.tsx`), so the two editors now agree.
        //
        // With no wash under it the rail has to separate itself from the photo,
        // so it takes the hairline and the elevation the home grid's rail
        // spends on exactly that job — the same values, because this is the
        // same problem and two chrome treatments for it would read as two
        // materials. (The Figma frame carries neither, on the reasoning that
        // the scrim already did the separating. Without the scrim it doesn't.)
        collectionCellToolbar: defineRecipe({
          className: "collection-cell-toolbar",
          description:
            "The hover/focus-revealed control pill for a filled collection cell in the editor, centred on the cell's top edge (Figma 828:6697 dark / 828:6838 light). Composes the shared `toolbar` recipe for the box and adds only what floating costs — position, hairline, elevation, clip — plus a cell-relative width cap. Everything the pill cannot say in four buttons — caption, background — is edited in the docked `propertiesPanel`.",
          base: {
            position: "absolute",
            // Centred on the cell's TOP EDGE — half above it, half over the
            // photo. Written as "put my centre on the edge" rather than as a
            // -20px offset, so it stays correct if the rail's height ever
            // changes; the grid's 20px gap is sized to swallow the half that
            // hangs out (see the `root` slot).
            insetBlockStart: 0,
            insetInlineStart: "half",
            transform: "translate(-50%, -50%)",
            // Rung 3 of the cell's paint ladder — see `collectionGrid`'s
            // `backgroundEffect` slot. Over the photo, and over a neighbouring
            // cell's drop-target ring, which the overhang reaches into.
            zIndex: 3,
            // What floating costs, in the same values `gridItemToolbar` and
            // `selectionPopover` spend on it — see the note above.
            borderWidth: "token(spacing.3xs)",
            borderStyle: "solid",
            borderColor: "border.divider",
            boxShadow:
              "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
            // The box — 40px tall, 6px inset, 4px gap, on `bg.surface` — is the
            // shared `toolbar` recipe this composes with; only the clip and the
            // cell-relative width cap are the pill's own.
            overflow: "hidden",
            maxWidth: "calc(100% - token(spacing.lg) * 2)",
            opacity: 0,
            // Inert as well as invisible while it is down: the rail straddles
            // the gap above the cell, and a control you cannot see must not be
            // a control you can hit. It is also what keeps `&:hover` below from
            // firing on a rail nobody can see.
            pointerEvents: "none",
            transition: "opacity 150ms ease",
            // Up while the cell is under the pointer, while the pointer is on
            // the rail's own overhanging half (the cell is NOT hovered there,
            // so without this the rail would drop out from under the hand
            // reaching for it), and while anything in it holds focus.
            "[data-collection-cell]:hover + &, &:hover, &:focus-within": {
              opacity: 1,
              pointerEvents: "auto",
            },
            // Down for the whole reorder, and back up once the dropped photo
            // has landed.
            //
            // `transition: none` makes this leave AT ONCE rather than fading:
            // the press lifts the cell's clip in the same frame so the photo
            // can tilt out of its slot, and chrome still dissolving over a
            // picture that has left is the wrong thing in the wrong place. Out
            // instantly, back in once the state clears — grabbing is abrupt,
            // letting go is not.
            //
            // The extra `[data-collection-cell]` is specificity, not reach:
            // without it this ties with the reveal rule above and would be
            // decided by source order alone.
            "[data-collection-grid][data-reordering] [data-collection-cell] + &":
              { opacity: 0, pointerEvents: "none", transition: "none" },
            // And it STAYS down once the gesture is over, for as long as the
            // pointer has not moved. A drag necessarily ends with the cursor
            // over the photo it dropped, so `:hover` matches the moment the
            // rule above lets go — reporting where the gesture finished as
            // though it were a reach for the controls. See `pointerIdle` in
            // `collection-grid.tsx`.
            //
            // No `transition` of its own, deliberately: this state is entered
            // from a rail that is ALREADY down, so there is nothing to animate
            // on the way in, and the fade on the way out should be the ordinary
            // hover fade.
            "[data-collection-grid][data-pointer-idle] [data-collection-cell] + &":
              { opacity: 0, pointerEvents: "none" },
            // In the cell a photo is FLYING INTO, the rail comes back over the
            // length of that flight rather than the shorter hover fade, so it
            // arrives exactly as the photo settles into the slot instead of
            // finishing early and waiting for it. Duration and curve match
            // `LANDING_MS` / `LANDING_EASE` in `collection-grid.tsx`. Never
            // conflicts with the rule above: `data-landing` is set in the same
            // commit that clears `data-reordering`, so the two are never on
            // together.
            "[data-collection-cell][data-landing] + &": {
              transition: "opacity 100ms ease-out",
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
            "Text-input family field — a label, a framed input shell (leading icon + control + optional trailing), and a hint. The presentational frame owns no behavior; the assembly fills the control slot. The 'Active' state is CSS-driven off the control's engagement (`:focus-visible`, a slider's plain `:focus`, or an open trigger's `aria-expanded` — see the label slot) rather than a prop, so label, frame bg/border, control text and the leading icon all shift to the brand accent (pink in light, orange in dark) on focus while the hint stays muted (Figma 586:876). Built to be shared by the forthcoming Select/Date inputs. A `role=\"switch\"` or `role=\"checkbox\"` control flips the same root into a control ∣ label/hint grid (the toggle archetype, shared by Switch and Checkbox), detected via `:has` — no prop. Scope: default + active only.",
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
              //
              // The selector is a UNION because each control archetype signals
              // engagement differently, and `:focus-visible` alone does not
              // cover them all:
              //   • text inputs — `:focus-visible`, which the spec makes always
              //     match on a keyboard-editable element, click or tab.
              //   • the Date/Select trigger — `aria-expanded`, so an open
              //     popover keeps its field lit.
              //   • the Slider — plain `:focus`. Its control is a <div>, which
              //     matches `:focus-visible` on a PROGRAMMATIC focus (what the
              //     track's pointerdown does) only while the browser's last
              //     interaction was the keyboard. Click any button first and
              //     the modality flips to pointer, so the field would stay
              //     resting through an entire drag. Text inputs never show this
              //     because of the rule above.
              // The keyboard ring below stays on `:focus-visible` alone — that
              // one IS meant to be keyboard-only.
              "[data-field]:has([data-control]:focus-visible, [data-control][role='slider']:focus, [data-control][aria-expanded='true']) &":
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
              "[data-field]:has([data-control]:focus-visible, [data-control][role='slider']:focus, [data-control][aria-expanded='true']) &":
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
              "[data-field]:has([data-control]:focus-visible, [data-control][role='slider']:focus, [data-control][aria-expanded='true']) &::placeholder, [data-field]:has([data-control]:focus-visible, [data-control][role='slider']:focus, [data-control][aria-expanded='true']) &[data-placeholder]":
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
          // inset. `sm` steps every part down one — 12/20 label, 14/24 value,
          // `fineprint` hint — into a 28px frame. Its 8px padding and gap come
          // from the base and deliberately do NOT shrink: at 28px tall that
          // horizontal rhythm is what keeps the value off the border.
          variants: {
            size: {
              sm: {
                label: { textStyle: "sidenote" },
                control: { textStyle: "bodySmall" },
                hint: { textStyle: "fineprint" },
                // 20 + 8: no single spacing token lands on 28, and the sum
                // mirrors how `lg` derives its own height from `4xl` + `md`.
                frame: {
                  height: "calc(token(spacing.xxl) + token(spacing.md))",
                },
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

        // The third control archetype of the field family, after the text input
        // and the toggles: a ruler and a numeric readout sharing one frame
        // (Figma 842:7179). It owns NO surface of its own — the 28px shell, its
        // fill, border and focus accent are the `field` recipe's `frame` at
        // `size="sm"`, and the 8px padding + 8px gap the frame already carries
        // place the track, separator and readout at exactly the drawn offsets.
        // So this recipe is only the marks inside: ruler ticks and separator on
        // the border token (the same hairline the frame's own edge uses), the
        // thumb and readout on `currentColor` — which the frame flips to the
        // brand accent on focus, so the whole active state comes for free.
        sliderField: defineSlotRecipe({
          className: "slider-field",
          description:
            "The ruler + thumb + numeric readout of a slider — the control slot of a `field`, drawn inside the shared `frame` rather than bringing a surface of its own. `track` is the focusable `role=\"slider\"` element (full frame height, so the hit target is the whole strip, not the 4px rule); `tick` marks the evenly spaced stops as 1px hairlines on `field.border.*`; `thumb` is the 4×20 pill at the current value; `separator` is the 0.5px rule dividing the ruler from the `output` — the value as an editable numeric input, so the number can be typed as well as dragged. Thumb and readout paint in `currentColor` so the frame's resting → active colour shift carries them, exactly as it carries a leading icon. Like the checkbox, the geometry is drawn at ONE size (Figma 842:7179); `size` scales only the readout's type, so it keeps step with the field's label and hint.",
          slots: ["track", "tick", "thumb", "separator", "output"],
          base: {
            track: {
              position: "relative",
              flex: "1 1 0",
              minWidth: 0,
              // Full height rather than the 4px of the rule: the whole strip is
              // the drag target, so a grab anywhere in the frame lands on the
              // slider instead of the frame's dead padding.
              alignSelf: "stretch",
              cursor: "pointer",
              // Claim the horizontal pan gesture — without it a touch drag
              // scrolls the page instead of moving the thumb.
              touchAction: "none",
              // `_disabled` covers [aria-disabled=true] as well as :disabled,
              // which is what a <div role="slider"> can actually carry.
              _disabled: { cursor: "not-allowed", opacity: 0.5 },
            },
            // Ticks and thumb are both centred on the track's midline and on
            // their own value, so they share the same centring transform and
            // differ only in size and colour.
            tick: {
              position: "absolute",
              top: "token(spacing.half)",
              transform: "translate(-50%, -50%)",
              width: "token(spacing.xxs)",
              height: "token(spacing.sm)",
              // Rounds the 1px hairline's ends, matching the round cap the
              // drawn vector has.
              borderRadius: "full",
              backgroundColor: "field.border.default",
              pointerEvents: "none",
              transition: "background-color 150ms ease",
              // The frame's own border goes accent on focus; the hairlines drawn
              // inside it follow, keyed off the same selector the `field` recipe
              // uses so the whole field flips in one step.
              "[data-field]:has([data-control]:focus-visible, [data-control][role='slider']:focus) &":
                {
                  backgroundColor: "field.border.active",
                },
            },
            thumb: {
              position: "absolute",
              top: "token(spacing.half)",
              transform: "translate(-50%, -50%)",
              width: "token(spacing.sm)",
              height: "token(spacing.xxl)",
              borderRadius: "full",
              // The frame owns the resting → active colour for everything it
              // contains; the thumb rides it like the leading icon does.
              backgroundColor: "currentColor",
              pointerEvents: "none",
            },
            separator: {
              alignSelf: "stretch",
              flexShrink: 0,
              width: "token(spacing.3xs)",
              backgroundColor: "field.border.default",
              transition: "background-color 150ms ease",
              "[data-field]:has([data-control]:focus-visible, [data-control][role='slider']:focus) &":
                {
                  backgroundColor: "field.border.active",
                },
            },
            output: {
              ...fieldValueBox,
              color: "inherit",
              // The value sits OUTSIDE the track, so the track's own dimming
              // can't reach it — without this a disabled slider greys its ruler
              // and leaves the number at full strength.
              "[data-field]:has([role='slider'][aria-disabled='true']) &": {
                opacity: 0.5,
              },
            },
          },
          variants: {
            // Only the readout's type: the ruler is drawn at one geometry (the
            // checkbox's bargain), so a bigger field grows label, hint and value
            // around an unchanged rule. Mirrors the `field` recipe's control.
            size: {
              sm: { output: { textStyle: "bodySmall" } },
              md: { output: { textStyle: "bodyLarge" } },
              lg: { output: { textStyle: "subheading" } },
            },
          },
          defaultVariants: { size: "sm" },
          // Slider calls sliderField({ size }) with the field's runtime size, so
          // the extractor only sees the default — force all three.
          staticCss: [{ size: ["*"] }],
        }),

        // Presentation only — the month math (Temporal) and selection live in
        // `calendar.tsx`. Slots map 1:1 to the compound parts.
        calendar: defineSlotRecipe({
          className: "calendar",
          description:
            "Calendar grid: a search field above a period list — one or more month columns, each a ‹ month year › label, the weekday header row and the day grid on a 24px cell / 4px gutter pitch (7 × 24 + 6 × 4 + 2 × 8 padding = 208px per month). The pair of nav chevrons is absolutely placed at the list's top corners, so they flank the whole range rather than a single month, and the list pages a full range at a time (Figma 715:912 — three months at 624px). A turn is a push: the list crops, the arriving page slides in from the side the range is travelling toward and the leaving one (the `outgoing` copy) is pushed out by the same `--calendar-push` — `step` month columns, signed by the direction. Day cells carry their state as attributes (aria-selected / data-state=today / data-outside / :disabled) plus data-weekday/data-weekend identity, so the look is fully re-skinnable off selectors. `tone` swaps which half of the palette reads brand: `default` is a self-framed neutral surface with a brand today/selection (Figma 644:1678/644:1681); `onBrand` is the Date popover's inverse (Figma 631:893/631:897).",
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
            "outgoing",
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
              // ...and the frame a page turn slides through. `default`'s root
              // already crops, but the `onBrand` popover's does not — and a
              // month sailing across the search row, or out of the popover
              // altogether, is worse than no transition at all. It also crops
              // the drag band, which is a tighter box than the root but the
              // same one the band is drawn in.
              overflow: "hidden",
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
              //
              // Lifted above BOTH pages of a turn: the outgoing one is
              // positioned over the whole list, so without this it would paint
              // across the chevrons for the length of the slide. It is also the
              // floor `edge`'s scrims need — see the layer order there.
              "& > [data-nav]": { position: "absolute", zIndex: 2 },
              "& > [data-nav='prev']": { left: "md" },
              "& > [data-nav='next']": { right: "md" },
            },
            // The page being pushed off — a copy of the row it is replacing,
            // lifted out of the flow and laid exactly over it (same widths,
            // same centring), so the arriving row goes on owning the list's
            // size while this one slides away. Held for `PUSH_MS`, then
            // unmounted; the motion itself is on the `period` slot, because
            // every column of both pages moves as one.
            outgoing: {
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              // It is a picture, not a page: a press mid-turn belongs to the
              // live row underneath. (`inert` covers the a11y tree and the tab
              // order; this covers hit-testing.)
              pointerEvents: "none",
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
              // ── The page turn ──────────────────────────────────────────
              // Both halves are declared on the COLUMN rather than on the two
              // rows that hold them, because a turn is one motion: every column
              // on screen, arriving or leaving, moves by the same
              // `--calendar-push`. That is what makes the pair read as a strip
              // being pushed along — and what lets a walking range (step <
              // months) carry a month over without it sliding against itself.
              // `[data-push]` is on the list only while a turn is in flight.
              "[data-push] > &": { animation: "calendarPageIn 200ms ease-out" },
              // `forwards` so the leaving page HOLDS off-frame at the end
              // rather than snapping back for the frame between the animation
              // finishing and React unmounting it.
              "[data-outgoing] > &": {
                animation: "calendarPageOut 200ms ease-out forwards",
              },
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
                    // The scrim rides on the base slot's `z-index: 2`, and
                    // needs it as badly as the chevron does: being positioned
                    // is NOT enough to sit above the grid, because the weekend
                    // and spill-over cells carry `opacity < 1` — each a
                    // stacking context painted at level 0, the same as
                    // `z-index: auto` — so DOM order decided, and the navs come
                    // first. Precisely the outermost column this scrim exists
                    // to fade was punching through it, sharp and unwashed.
                    // (The layer order across the calendar, since `auto` ties
                    // with those cells: marquee 1 ▸ nav 2 ▸ frame ring 3.)
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

        // A single-field editor that takes over a floating toolbar's interior:
        // leading glyph ▸ chrome-stripped input ▸ "Esc to exit" key-cap. Two
        // toolbars share it — the selection toolbar's link editor (Figma
        // 422:833) and a collection cell's caption editor (828:6870) — because
        // they are the same gesture: the buttons step aside, one value is
        // typed, Enter commits. The row owns no surface of its own; the pill
        // around it does, and this fills it edge to edge.
        inlineEditRow: defineSlotRecipe({
          className: "inline-edit-row",
          description:
            "Inline single-field editor that replaces a floating toolbar's buttons — leading icon, bare input, and an Esc hint. Shared by the link editor and the collection caption editor.",
          slots: ["root", "input", "hint", "hintKey", "hintLabel"],
          base: {
            root: {
              display: "flex",
              // Fill the pill, and stay shrinkable — the input's default
              // intrinsic width would otherwise push the toolbar wider than
              // the cell it is centred in.
              flex: "1 0 0",
              minWidth: 0,
              alignItems: "center",
              gap: "md",
              height: "token(spacing.4xl)",
              paddingInline: "lg",
            },
            input: {
              flex: "1 0 0",
              minWidth: 0,
              background: "transparent",
              border: "none",
              color: "text.default",
              textStyle: "bodySmall",
              // The pill is the focus indicator; a ring inside it would read as
              // a second, nested control.
              focusVisibleRing: "none",
              _placeholder: { color: "text.default/40" },
            },
            hint: {
              display: "flex",
              alignItems: "center",
              gap: "sm",
              flexShrink: 0,
            },
            hintKey: {
              display: "flex",
              alignItems: "center",
              paddingInline: "sm",
              height: "token(spacing.xxl)",
              borderRadius: "sm",
              borderWidth: "token(spacing.3xs)",
              borderStyle: "solid",
              borderColor: "border.divider",
              backgroundColor: "bg.itemHover",
              color: "text.default",
              textStyle: "caption",
              whiteSpace: "nowrap",
            },
            hintLabel: {
              color: "text.default/50",
              textStyle: "caption",
              whiteSpace: "nowrap",
            },
          },
        }),

        // The collection's tile grid, in BOTH the editor and the reader — one
        // recipe, because the tile itself (radius, hairline, cover crop) is the
        // same object in both and only the arrangement differs.
        //
        //   uniform  │ editor: every slot shown, filled or not, so the 6-image
        //            │ cap is visible rather than merely enforced (828:6837).
        //   featured │ reader, 3+ images: the first spans the 2×2 block and the
        //            │ next two stack in column 3 (829:6911).
        //   pair     │ reader, exactly 2: equal 1:1 tiles. The featured
        //   single   │ reader, 0–1: one tile at its NATURAL ratio, i.e. exactly
        //            │ what a lone `image` block looks like. The reader has no
        //            │ empty slots to draw, so a collection too small for the
        //            │ skeleton splits evenly instead of leaving holes.
        //
        // `aspectRatio` lives on the ROOT for the two-row layouts (a 3:2 box
        // divided by `1fr` rows) and on the CELL for `pair` (two squares whose
        // height follows their own width), so the grid never needs a measured
        // height.
        collectionGrid: defineSlotRecipe({
          className: "collection-grid",
          description:
            "Collection tile grid — a 3×2 slot grid in the editor, and in the reader a featured 2×2 with two stacked tiles (3+ images), an equal pair (2), or a single natural-ratio tile (0–1). Figma 828:6837/826:6501 editor, 829:6911/828:6658 reader.",
          slots: [
            "root",
            "slot",
            "cell",
            "tile",
            "image",
            "backgroundEffect",
            "dragPreview",
            "surplus",
            "surplusDivider",
            "surplusLabel",
          ],
          base: {
            root: {
              display: "grid",
              // 20px, and sized by what has to FIT between two cards rather
              // than by the grid on its own: the editor's control rail is a
              // 40px pill centred on a cell's TOP EDGE, so exactly half of it
              // hangs into the row above. At 20px that overhang lands in the
              // gap instead of over the neighbouring photo.
              gap: "xxl",
              width: "token(spacing.full)",
              maxWidth: "token(sizes.articleShowcase)",
              // Reordering is a pointer gesture rather than a native drag, so
              // the two things a native drag would have handled are stated
              // here: the cursor for the whole grip, and the selection that a
              // press-and-sweep across the editor would otherwise start.
              "&[data-reordering]": { cursor: "grabbing", userSelect: "none" },
            },
            // The editor's grid item: a cell and the control rail that belongs
            // to it, as one box. The cell CLIPS — that is what rounds a photo
            // filling its slot, since a picture nobody has rounded carries a
            // corner of zero (`DEFAULT_MEDIA_RADIUS`) — and the rail is centred
            // on the cell's top edge with half of it outside. A rail inside the
            // cell would be sliced off along that edge, so the two are siblings
            // in a box that does not clip, exactly as a home-grid card and its
            // toolbar are (see `grid-item-toolbar.tsx`).
            //
            // `grid` rather than `block` so the cell stretches to the slot in
            // BOTH axes without having to restate a size; the rail is absolute,
            // so it never becomes a second track. The reader has no rail and no
            // wrapper — its tiles are grid items themselves.
            slot: { position: "relative", display: "grid" },
            cell: {
              position: "relative",
              overflow: "hidden",
              // The CARD's corner — a constant of the design system, and
              // nothing to do with the picture inside it. The properties
              // panel's slider rounds the media OBJECT and only the media
              // object; this is the container that object and its ground sit
              // in, and it wears the same corner every surface of its kind
              // wears (`radii.xxl`, which the empty slot beside it and the
              // surplus badge over it already draw).
              //
              // The two are independent by design, not in tension: the cell
              // clips at this radius, so a picture filling its slot takes the
              // card's shape, and the picture's OWN corner is what shows once
              // an inset lifts it off this edge — exactly as
              // `MEDIA_RADIUS_STEP` describes it.
              //
              // `xl`, the corner a demo frame draws: a collection is a showcase
              // block sitting in the same column as those, so the two read as
              // the same kind of surface. Four other boxes are this same card
              // seen from somewhere else and move with it — the empty slot, the
              // hover scrim, the clone in hand, and the lightbox's ground.
              borderRadius: "xl",
              // Editor cells only — the reader's tiles carry `zoom-in` on the
              // button that opens the lightbox.
              "&[data-collection-cell]": { cursor: "grab" },
              // Pressing a photo answers the hand the way pressing a button
              // does, over the same 100ms as `action`'s `_active` — but at
              // TWICE its travel: 0.94 against the button's 0.97. A deliberate
              // divergence, not an oversight. A 40px control only has to twitch
              // to be felt; a 312px tile moving 3% still reads as sitting
              // still, because what registers is the shift against the tile's
              // own size, not the absolute pixels.
              //
              // KEEP IN STEP with `dragPreview`'s `&[data-carried]` below — the
              // clone takes this exact gesture over mid-press, and any gap
              // between the two shows up as the photo flinching at the moment
              // the drag begins. The two cannot share a custom property: the
              // clone is parented to <body>, outside this subtree.
              //
              // On POINTER DOWN, not when the drag threshold is crossed: the
              // grid has to acknowledge the press before it knows whether a
              // drag is coming, or holding a photo feels like holding nothing.
              //
              // Scoped to the direct picture — an <img> or a <video>, whichever
              // the cell is showing (see `Media`) — so it never reaches the
              // controls laid over it, and a press that LANDS on those never
              // sets this state at all, since the toolbar is not a drag handle.
              // Scaled ABOUT the point the hand landed on, which the component
              // supplies as `--press-origin` on the cell. Shrinking about the
              // centre slides the picture away from the cursor, so the pixel
              // you pressed is no longer the pixel you are holding; anchoring
              // there keeps it under the pointer. `center` only as a fallback,
              // for a state somehow set without a coordinate.
              // A pressed cell stops clipping, so the picture can tilt out of
              // its slot instead of being sliced off along the edge it is
              // turning past. Safe to drop the clip here because the photo
              // carries the SAME `borderRadius` itself (see the `image` slot),
              // so the rounded corners are the photo's own and survive without
              // the cell masking them. Raised at the same time, or the next
              // cell in source order paints over the part that now overhangs.
              "&[data-pressed]": { overflow: "visible", zIndex: 1 },
              // The photo AND the ground it sits on. They are siblings rather
              // than one nested pair — the gradient fills the CELL, so that a
              // change of crop cannot shift it — which means the press has to
              // name both or the picture shrinks off its own background and the
              // artifact appears to lift away from the thing it is standing on.
              //
              // The same values, the same anchor, no `transform-box` juggling:
              // both fill the identical box, so one `--press-origin` (a point
              // measured inside that box) lands on the same pixel in each and
              // they scale and turn as one card.
              //
              // This is also what the drag clone already does — its background
              // is a snapshot of this gradient, so the whole clone carries the
              // press. Missing it here made the two halves of one gesture
              // disagree: nothing moved until the drag threshold, and then the
              // gradient snapped into the tilt it should already have been in.
              "&[data-pressed] > :is(img, video), &[data-pressed] > [data-background-effect]":
                {
                  scale: "0.94",
                  // Tilts about the same anchor, so the picture pivots around
                  // the hand rather than swinging past it.
                  rotate: "2deg",
                  transformOrigin: "var(--press-origin, center)",
                },
              // The hairline round the card, on the cell's own box, which is
              // what makes it follow the corner above.
              borderWidth: "token(spacing.3xs)",
              borderStyle: "solid",
              borderColor: "border.divider",
              // No transition anywhere in here on purpose. Reordering is a
              // direct-manipulation gesture: the slot empties the instant you
              // lift the photo and is full again the instant you let go, with
              // nothing easing in behind it. Anything that fades reads as the
              // grid catching up with you rather than tracking you.
              // Reordering (editor only). The tile being CARRIED empties out
              // entirely and leaves a dashed outline of the slot: you are
              // holding that photo, so the grid should show the hole it came
              // from rather than a ghost of it still sitting there. Dashed
              // rather than the solid hairline an occupied tile wears, so a
              // vacated slot reads as temporary — and 1px rather than the
              // usual 0.5px, since a half-pixel dash barely renders.
              "&[data-dragging]": {
                borderStyle: "dashed",
                borderWidth: "token(spacing.xxs)",
                borderColor: "field.border.default",
                "& > *": { opacity: 0 },
              },
              // NOTE: the cell a photo is flying into carries `data-landing`,
              // but it is NOT styled here and must not be. Hiding its photo for
              // the length of the flight left a hole to see the page background
              // through — the very flash this was meant to avoid. The component
              // keeps that cell showing the photo it held BEFORE the swap
              // instead, so the slot is never empty and the incoming picture is
              // never in two places. The attribute is the marker the grid reads
              // to know a flight is still in the air.
              //
              // The other half of a swap. The dragged photo TRAVELS into the
              // cell you dropped it on, because you carried it there and the
              // eye should be able to follow it home. The photo it displaced
              // has no such journey — nobody moved it — so sliding it across
              // the grid would animate a trip that never happened. It fades up
              // in the slot instead, in step with the flight landing.
              // Duration and curve match the flight's `LANDING_MS` /
              // `LANDING_EASE` in `collection-grid.tsx` — the two halves of a
              // swap have to come to rest together.
              "&[data-arriving] > *": {
                animation: "collectionArrive 100ms ease-out",
              },
              // The tile about to RECEIVE it says so twice: a brand wash laid
              // over the photo, and the accent ring — the same one focus uses,
              // because both answer "this is the thing you are acting on".
              //
              // BOTH live on the pseudo-element, and the ring has to. An inset
              // box-shadow paints on the cell's own background, which its
              // <img> child then covers completely — the ring was being drawn
              // and immediately painted over. A ::after carrying the wash and
              // the ring together sits above the photo instead.
              // (Also why not `opacity` on the cell: that would drag the ring
              // down with it, when the point is to veil the OUTGOING photo
              // while the marker stays at full strength on top of it.)
              //
              // Being positioned is NOT enough to clear the photo, though it
              // was until the background effect arrived: the gradient has to
              // fill the cell, so the photo was lifted to `z-index: 1` to stay
              // over it, and this marker went under the picture it marks. See
              // the `backgroundEffect` slot for the whole ladder.
              "&[data-drop-target]::after": {
                content: '""',
                position: "absolute",
                inset: 0,
                zIndex: 2,
                borderRadius: "inherit",
                backgroundColor: "field.bg.active",
                boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
                // Decoration only — it lies over the whole tile, and the drop
                // events belong to the cell beneath it.
                pointerEvents: "none",
              },
              // The tile that carries the surplus badge turns into its own 2×2
              // grid purely to park the badge in the bottom-right quadrant at
              // quarter size; the photo leaves the flow so the grid positions
              // nothing but the badge (Figma 829:6912). The badge is a SIBLING
              // of the photo's button, never nested inside it — one interactive
              // control may not contain another, and the two open different
              // images anyway.
              "&[data-surplus]": {
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gridTemplateRows: "repeat(2, minmax(0, 1fr))",
                padding: "sm",
                gap: "sm",
                "& > [data-collection-tile]": {
                  position: "absolute",
                  inset: 0,
                },
                // The badge has taken this cell's bottom-right quadrant, so a
                // clip's transport crosses to the other corner rather than
                // sitting under it. Stated here, where the quadrant layout is,
                // because it is the badge's arrival that moves the chip.
                "& [data-media-transport]": { right: "auto", left: "lg" },
              },
            },
            tile: {
              display: "block",
              width: "token(spacing.full)",
              height: "token(spacing.full)",
              padding: "none",
              border: "none",
              background: "none",
              appearance: "none",
              cursor: "zoom-in",
              "html[data-keyboard-focus] &:focus-visible": {
                boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
              },
            },
            image: {
              display: "block",
              width: "token(spacing.full)",
              height: "token(spacing.full)",
              objectFit: "cover",
              // No corner here either. It is the picture's own property and
              // arrives as an inline style (`mediaObjectStyle`), which outranks
              // this class — a default stated here could only ever be the value
              // the panel does NOT show.
              // The press feedback the editor's cell drives above. Stated here
              // because the transition belongs to the thing that moves; the
              // reader never sets the state, so it costs it nothing.
              //
              // `scale` and `rotate` are the INDEPENDENT transform properties,
              // never `transform` itself — the drag preview writes `translate`
              // on every pointer move, and a transition covering `transform`
              // would be a transition on the pointer tracking too.
              scale: "1",
              rotate: "0deg",
              transition: "scale 100ms ease, rotate 100ms ease",
              // Middle rung of the cell's paint ladder — see `backgroundEffect`
              // below for the whole of it. Without a z-index the shader, which
              // must be positioned to fill the cell, would cover the photo
              // entirely: a positioned element always paints over a static
              // sibling however late in the DOM that sibling comes.
              position: "relative",
              zIndex: 1,
              // The picture is see-through and has no gradient standing behind
              // it, so it stands on the checkerboard instead. The editor says
              // which pictures those are (`useImageTransparency`); the reader
              // never sets this, and a picture WITH a gradient never sets it
              // either — a photo's background box paints over the layer behind
              // it, so the two grounds are exclusive by construction as well as
              // by intent.
              //
              // Deliberately NOT a rung of the paint ladder below. A picture
              // has exactly one ground, so a second layer would only be
              // something to order against the first; as the photo's own
              // background box it cannot come apart from the photo at all. That
              // is also what carries it onto the drag clone, which is a copy of
              // this <img> — see `dragPreview`.
              "&[data-checkered]": transparencyCheckerboard,
            },
            // The gradient painted behind a photo whose background effect is
            // on. The image stays `cover`, so this shows only where the picture
            // is itself transparent — which is exactly the case it exists for: a
            // screenshot of UI exported on a transparent canvas.
            //
            // Sized by the CELL rather than by the photo. The photo is a
            // cropped fill of the cell, so anchoring the gradient to it would
            // shift the ground every time the crop changed.
            //
            // THE CELL'S PAINT LADDER. All three rungs are stated explicitly
            // because introducing this one forced the other two: a positioned
            // element outranks every static sibling, so the moment the gradient
            // needed `position: absolute` the photo had to be lifted over it,
            // and lifting the photo silently sank everything laid over the
            // picture that had been left at `auto`. Keep them in step:
            //
            //   0  backgroundEffect — the ground
            //   1  image            — the picture
            //   2  cell's ::after   — the drop-target wash and ring
            //   3  the editor's control rail (`collectionCellToolbar`)
            //
            // The rail is on this ladder despite being a SIBLING of the cell
            // rather than a child of it: the cell is `position: relative` with
            // no z-index of its own, so it is not a stacking context and its
            // contents compete with the rail in the same one. Rung 3 is what
            // keeps the rail over a neighbouring cell's drop-target ring, which
            // its overhanging half reaches into.
            //
            // Rungs 2 and 3 were both written as `auto` and both sank under the
            // photo the moment rung 1 was raised. Neither is optional: every
            // positioned child of a cell has to name its rung, because "it is
            // positioned, so it is on top" stops being true as soon as ONE
            // sibling carries a z-index.
            backgroundEffect: {
              position: "absolute",
              inset: 0,
              zIndex: 0,
              // The CELL's corner, not the picture's: the ground fills the
              // card, so it is the card's shape it has to take — the picture
              // in front of it wears its own, which is a property of the
              // picture and stops at the picture.
              //
              // Its OWN copy of that corner rather than the cell's clip, though.
              // A pressed cell sets `overflow: visible` so the picture can tilt
              // out of its slot, and anything relying on that clip squares off
              // the moment the press lands.
              borderRadius: "inherit",
              // Decoration under the picture — the cell beneath it owns the
              // press that starts a reorder, and the tile above it owns clicks.
              pointerEvents: "none",
              // Matches the photo's, so the two ease into the press together.
              // Without it the ground would snap to 0.94 while the picture
              // standing on it took 100ms to get there.
              scale: "1",
              rotate: "0deg",
              transition: "scale 100ms ease, rotate 100ms ease",
            },
            // The photo that rides the cursor while you reorder — a clone the
            // editor appends to the body and positions itself. This is the
            // whole reason the gesture is built on pointer events instead of
            // the drag-and-drop API: a real element keeps its transparent
            // corners (a native drag bitmap composites onto white) and vanishes
            // the instant you let go (a native one animates itself home).
            // `left`/`top` stay at zero and movement goes through `transform`,
            // so tracking the pointer never touches layout. Size, position and
            // the corner are the only things set inline, because only they are
            // dynamic.
            //
            // The card's corner, because a picture filling its slot is clipped
            // to it and the clone has no cell around it to do that clipping —
            // it rides the cursor parented to the body. An INSET picture is not
            // touching that edge, so its own corner is the one on screen and
            // the editor writes it inline, in pixels: the `cqw` the picture
            // carries would resolve against the viewport out here and hand the
            // thing in hand a corner several times the one it left behind. See
            // `beginDrag`.
            dragPreview: {
              position: "fixed",
              left: 0,
              top: 0,
              zIndex: 60,
              pointerEvents: "none",
              objectFit: "cover",
              borderRadius: "xl",
              // Position rides the INDEPENDENT `translate` property, and the
              // press feedback below rides `scale`, precisely so they do not
              // share `transform`. A transition on `transform` would be a
              // transition on the pointer tracking too, and the photo would
              // swim after the cursor instead of sticking to it.
              translate: "0 0",
              // Born already carrying the press, with NO transition to play:
              // the photo was scaled down on pointer down, back when it was
              // still in its cell, and the clone takes over mid-press. Easing
              // it down again here would pop it up to full size first.
              //
              // Must equal the cell's `&[data-pressed] > img` scale AND tilt
              // above — this is the same press, on a second element.
              "&[data-carried]": { scale: "0.94", rotate: "2deg" },
              // The clone's className is REPLACED with this slot's, so the
              // checkerboard has to be restated here — but the attribute
              // driving it survives `cloneNode`, so nothing in the drag has to
              // know about it. A picture that was standing on its checkerboard
              // in the cell keeps standing on it in the air, which is the same
              // deal the gradient gets from its snapshot (and the two never
              // collide: a picture with a gradient is not marked). Careful with
              // the ordering — that snapshot is written as an INLINE
              // `background-image`, which replaces this pattern rather than
              // layering over it.
              "&[data-checkered]": transparencyCheckerboard,
              willChange: "translate, scale, rotate",
              // Lifted off the grid, so it reads as being held rather than
              // lying in a slot.
              boxShadow:
                "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 24%, transparent)",
            },
            surplus: {
              gridColumn: 2,
              gridRow: 2,
              justifySelf: "stretch",
              alignSelf: "stretch",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "sm",
              minWidth: 0,
              paddingBlock: "sm",
              paddingInline: "md",
              borderRadius: "xxl",
              borderWidth: "token(spacing.xxs)",
              borderStyle: "solid",
              borderColor: "border.divider",
              backgroundColor: "bg.surfaceGlass",
              color: "field.text.default",
              cursor: "zoom-in",
              appearance: "none",
              "html[data-keyboard-focus] &:focus-visible": {
                boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
              },
              // The photo beside it is absolutely positioned, so it paints in
              // the positioned layer — above ANY static sibling, however late
              // in the DOM. The badge has to join that layer to sit on top of
              // the image it is captioning.
              position: "relative",
              zIndex: 1,
              // Panda's `backdropFilter` utility emits ONLY the -webkit- form,
              // which Chromium does not recognise, so the blur silently never
              // lands. The raw key is the one that works; the prefixed
              // spelling stays for older WebKit. (Same workaround as the
              // calendar's edge scrims.)
              backdropFilter: "blur(token(spacing.md))",
              "-webkit-backdrop-filter": "blur(token(spacing.md))",
              "backdrop-filter": "blur(token(spacing.md))",
              "& svg": {
                width: "token(spacing.xxl)",
                height: "token(spacing.xxl)",
                flexShrink: 0,
                display: "block",
              },
              "& svg path[stroke]": { stroke: "currentColor" },
              "& svg path[fill]": { fill: "currentColor" },
            },
            surplusDivider: {
              flexShrink: 0,
              width: "token(spacing.xxs)",
              height: "token(sizes.toolbarButton)",
              backgroundColor: "border.divider",
            },
            surplusLabel: {
              textStyle: "bodyLarge",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            },
          },
          variants: {
            layout: {
              uniform: {
                root: {
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gridTemplateRows: "repeat(2, minmax(0, 1fr))",
                  aspectRatio: "3 / 2",
                },
              },
              featured: {
                root: {
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gridTemplateRows: "repeat(2, minmax(0, 1fr))",
                  aspectRatio: "3 / 2",
                  // Positional rather than a `data-featured` hook: index 0 IS
                  // the featured image in this model, so the selector and the
                  // data agree by construction.
                  "& > *:first-child": {
                    gridColumn: "1 / 3",
                    gridRow: "1 / 3",
                  },
                },
              },
              pair: {
                root: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
                cell: { aspectRatio: "1" },
              },
              single: {
                root: { gridTemplateColumns: "minmax(0, 1fr)" },
                // No crop for a lone image: it should look exactly like the
                // `image` block it stands in for, not a 3:2 slice of itself.
                tile: { height: "auto" },
                image: { height: "auto" },
              },
            },
          },
          defaultVariants: { layout: "featured" },
          // Both consumers pick `layout` at runtime from the item count.
          staticCss: [{ layout: ["*"] }],
        }),

        // A colour as TWO editable parts inside one field frame — the swatch,
        // the six hex digits, and an opacity percentage — divided by the same
        // hairlines the slider uses, so a column of colour rows and slider rows
        // reads as one set of controls (Figma 872:7296).
        //
        // The `#` is drawn by the field, never typed: `sanitizeHex` strips it
        // wherever it lands, so pasting `#FFAB6F` and typing `FFAB6F` agree.
        //
        // Both inputs carry `data-control`, not just the hex one. The `field`
        // recipe lights the whole frame off `:has([data-control]:focus-visible)`,
        // so without it the frame would stay resting while the opacity input
        // held focus — the one field in the panel that looked inactive while
        // being edited. Only the hex input takes the field's `id`, since a
        // label may point at exactly one control.
        colorField: defineSlotRecipe({
          className: "color-field",
          description:
            "Colour input — a live swatch, a six-digit hex input and a 0–100 opacity input, divided by hairlines inside the shared `field` frame (Figma 872:7296). The swatch composites the colour over a checkerboard so a partial opacity reads as partial rather than as a lighter colour.",
          slots: ["swatch", "swatchFill", "separator", "hex", "opacity"],
          base: {
            // The checkerboard. Without it a 0% colour is indistinguishable
            // from a 100% one that happens to match the field fill, and the
            // opacity input would be editing something invisible.
            swatch: {
              position: "relative",
              flexShrink: 0,
              width: "token(spacing.xl)",
              height: "token(spacing.xl)",
              borderRadius: "sm",
              overflow: "hidden",
              backgroundColor: "field.bg.default",
              backgroundImage:
                "conic-gradient(var(--colors-border-divider) 0deg 90deg, transparent 90deg 180deg, var(--colors-border-divider) 180deg 270deg, transparent 270deg 360deg)",
              backgroundSize: "token(spacing.md) token(spacing.md)",
              // A hairline of its own: a pale colour on a pale field would
              // otherwise have no edge at all.
              boxShadow: "inset 0 0 0 0.5px var(--colors-field-border-default)",
            },
            // The colour itself, over the checker. A separate layer rather than
            // a background on the swatch, because the checker occupies the
            // background and the two have to composite.
            swatchFill: { position: "absolute", inset: 0 },
            separator: {
              alignSelf: "stretch",
              flexShrink: 0,
              width: "token(spacing.3xs)",
              backgroundColor: "field.border.default",
              transition: "background-color 150ms ease",
              "[data-field]:has([data-control]:focus-visible) &": {
                backgroundColor: "field.border.active",
              },
            },
            hex: {
              flex: "1 1 0",
              minWidth: 0,
              // Digits only, and they change as you type — proportional figures
              // would make the value shuffle horizontally mid-edit.
              fontVariantNumeric: "tabular-nums",
              textTransform: "uppercase",
            },
            // The same box the slider's value wears — see `fieldValueBox`.
            opacity: { ...fieldValueBox },
          },
        }),

        // The properties panel for an image's background effect — a header, a
        // column of label ∣ control rows, and the remove action (Figma 845:7223).
        //
        // Anchored to the CELL being edited and fixed rather than absolute, for
        // the same reason the slash menu is: `position-try-fallbacks` measures
        // overflow against the viewport, and against a containing block taller
        // than the viewport there is always "room", so the flip never fires.
        // `flip-inline` is what puts the panel on a right-column cell's left.
        // The properties panel — a docked inspector for whatever is being
        // edited (Figma 845:7223).
        //
        // Docked to the viewport's right edge rather than anchored beside its
        // subject, which is what the background-effect panel it replaces did.
        // At fifteen rows that panel already stood taller than the cell it
        // pointed at, so "beside" degenerated into "shifted up until it fits"
        // and the relationship it was buying stopped reading. A docked panel
        // makes no such promise: it is always in the same place, and it can
        // grow to hold anything without ever choosing between fitting on
        // screen and pointing at its subject.
        //
        // The whole thing is one shape nested three deep — a 40px header strip
        // over a body: the panel (header ∣ sections), each section (header ∣
        // control panel), and the rows inside that. Only the SECTIONS scroll,
        // never the panel, so the title stays put however much is open below
        // it.
        propertiesPanel: defineSlotRecipe({
          className: "properties-panel",
          description:
            "Docked properties inspector — full viewport height at the right edge, sliding in from it. A fixed header over a scrolling column of sections, each a header strip whose add/remove button mounts and unmounts its control panel (Figma 845:7223).",
          slots: [
            "root",
            "header",
            "title",
            "section",
            "sectionHeader",
            "sectionTitle",
            "controlPanel",
            "text",
            // Last, so its `animation` overrides `root`'s: the two are both
            // single classes on the same element, and the tie is broken by the
            // order Panda emits the slots in — which is this order.
            "exiting",
          ],
          base: {
            root: {
              position: "fixed",
              zIndex: 50,
              // Full viewport height, flush to the edge: both block insets, so
              // the panel needs no height of its own and no dvh arithmetic to
              // survive a mobile browser's collapsing toolbar.
              insetBlock: 0,
              insetInlineEnd: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              width: "token(sizes.propertiesPanelWidth)",
              // On a phone the derived width is wider than the screen. Capping
              // it keeps the panel on screen; the control rows inside then
              // scroll horizontally rather than being clipped away.
              maxWidth: "100vw",
              // No radius, and a border on ONE side. The panel is docked, not
              // floating — rounding corners that sit flush against the edge of
              // the screen would draw two slivers of page either side of it.
              borderInlineStartWidth: "token(spacing.3xs)",
              borderInlineStartStyle: "solid",
              borderInlineStartColor: "border.divider",
              backgroundColor: "bg.surface",
              boxShadow:
                "0 4px 16px color-mix(in srgb, var(--colors-neutral-900) 12%, transparent)",
              // The panel IS the scroll container — there is no inner body to
              // scroll, because the structure is a header and then sections,
              // full stop. What keeps the title in place is `position: sticky`
              // on the header, not a wrapper the consumer would have to
              // remember to put its sections inside.
              //
              // Both axes, because the control rows have a fixed width the
              // panel is derived from: on a viewport narrower than that the
              // rows have to be reachable sideways rather than clipped off.
              overflow: "auto",
              // The page behind is a document the panel is editing — reaching
              // the end of the sections should not start scrolling it away.
              overscrollBehavior: "contain",
              animation: "propertiesPanelIn 200ms ease-out",
              // A phone held upright gets the same panel along the BOTTOM
              // edge instead: full width, half the viewport tall. Half is the
              // point of it — the other half is where the thing being edited
              // stays visible, which a rail 332px wide on a 390px screen
              // cannot offer.
              //
              // SQUARE, like the rail it is the same panel as. The two upper
              // corners are the only ones not flush with the screen and a
              // radius there is the conventional sheet, but this sheet is a
              // properties panel that has changed edge rather than a card that
              // has slid up: it fills the width, it is bordered on the one side
              // it meets the page, and its rows run to both edges. Rounding
              // only where it happens to be free would make it read as two
              // different surfaces depending on which way the phone is held.
              //
              // `dvh`, not `vh`: a phone's toolbar collapses as you scroll and
              // a sheet measured against the tall viewport would leave a strip
              // of page under it.
              _bottomSheet: {
                insetBlockStart: "auto",
                insetInline: 0,
                width: "token(spacing.full)",
                maxWidth: "none",
                height: "50dvh",
                borderInlineStartWidth: "0",
                borderBlockStartWidth: "token(spacing.3xs)",
                borderBlockStartStyle: "solid",
                borderBlockStartColor: "border.divider",
                animation: "bottomSheetIn 200ms ease-out",
                // Dismissal is a STATE here rather than an unmount, and that is
                // deliberate: the sheet only exists in this orientation, so a
                // page turned on its side must find its rail back exactly where
                // it left it. Nothing outside this media query reads
                // `data-dismissed`, which is what makes rotating the phone the
                // whole of the repair.
                //
                // `visibility` on a delay equal to the slide keeps the sheet
                // out of the tab order once it has gone, without cutting the
                // slide short on the way out.
                transition: "translate 200ms ease-out, visibility 0s",
                "&[data-dismissed]": {
                  translate: "0 100%",
                  visibility: "hidden",
                  transitionDelay: "0s, 200ms",
                },
                // A finger owns the sheet while it is on it — the transition is
                // for letting go.
                "&[data-dragging]": { transition: "none" },
              },
            },
            header: {
              // Stays put over the sections travelling under it. It needs its
              // own fill for that — the root's is behind the scrolled content,
              // not between it and the header.
              position: "sticky",
              insetBlockStart: 0,
              zIndex: 1,
              backgroundColor: "bg.surface",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "md",
              height: "token(spacing.4xl)",
              paddingInline: "lg",
              borderBottomWidth: "token(spacing.3xs)",
              borderBottomStyle: "solid",
              borderBottomColor: "border.divider",
              // The whole strip is one ink, stated ONCE here (Figma 845:7232).
              // The buttons in it are `action`'s icon variant, which paints in
              // `currentColor` precisely so a toolbar decides its own ink —
              // left alone they inherit the page's `text.default` and read a
              // step brighter than the title beside them.
              color: "text.body",
            },
            title: {
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            },
            section: {
              // Sections are content-sized and the panel scrolls; letting them
              // flex would share the panel's height out between them instead,
              // shrinking a long control list to fit.
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              borderBottomWidth: "token(spacing.3xs)",
              borderBottomStyle: "solid",
              borderBottomColor: "border.divider",
            },
            sectionHeader: {
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "md",
              height: "token(spacing.4xl)",
              paddingInline: "lg",
              // One ink for the strip — see the panel header above. The add /
              // remove button and the section's own icon both take it.
              color: "text.body",
            },
            sectionTitle: {
              display: "flex",
              alignItems: "center",
              gap: "sm",
              minWidth: 0,
              "& svg": {
                width: "token(spacing.xxl)",
                height: "token(spacing.xxl)",
                flexShrink: 0,
                display: "block",
              },
              "& svg path[stroke]": { stroke: "currentColor" },
              "& svg path[fill]": { fill: "currentColor" },
            },
            // Every labelled row IS a `Field`, relaid from the field's own
            // vertical stack into a label ∣ control grid. Done here rather
            // than with a wrapper and a bare <span> label so each control
            // keeps its native `htmlFor`/`id` association — fifteen rows of
            // hand-written `aria-label` would be fifteen chances to mislabel a
            // slider.
            //
            // Stacked labels were the alternative and are not viable: at 15
            // parameters the background section alone would stand twice as
            // tall as the picture it describes.
            //
            // A descendant selector rather than a class on the field root,
            // because both are the same specificity as the `field` recipe's
            // own root and which one won would come down to layer order.
            controlPanel: {
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              gap: "md",
              padding: "lg",
              "& [data-property-control]": {
                display: "grid",
                gridTemplateColumns:
                  "token(sizes.propertyRowLabel) token(sizes.propertyRowField)",
                alignItems: "center",
                columnGap: "md",
                width: "max-content",
              },
              // The label is a column of the grid now, so it must not also
              // stretch to the field's full width the way the stacked one does.
              "& [data-property-control] > label": { width: "auto" },
            },
            // Prose that fills its control panel — a caption, a note — rather
            // than a value sitting in a labelled row, so it wears no field
            // frame at all: the section header above it is the label, and a
            // box drawn round the only thing in the panel would be chrome
            // describing nothing.
            text: {
              width: "token(spacing.full)",
              minWidth: 0,
              margin: "none",
              background: "transparent",
              border: "none",
              padding: "none",
              textStyle: "sidenote",
              // The panel's ink, not the article's. This is a property being
              // edited in an inspector, and `text.default` is a step brighter
              // than everything around it (Figma 885:2249).
              color: "text.body",
              caretColor: "text.body",
              focusVisibleRing: "none",
              // Never a scrollbar of its own: it grows with what is typed and
              // the panel it sits in does the scrolling. A second scroll
              // region nested in the first is a second place to lose your
              // position. `rows` carries the floor where `field-sizing` is
              // unsupported.
              resize: "none",
              fieldSizing: "content",
              overflow: "hidden",
              _placeholder: { color: "text.body/40" },
            },
            // Composed onto `root` for the length of the closing slide. It has
            // to be a class rather than a data attribute because the element
            // is the shared Popover's, and `className` is the one hook the
            // shell gives us onto it.
            //
            // `forwards` so the panel HOLDS off-screen at the end instead of
            // snapping back into view for the frame between the animation
            // finishing and React unmounting it. Inert throughout — it is on
            // its way out and must not swallow the click that follows.
            exiting: {
              animation: "propertiesPanelOut 200ms ease-in forwards",
              pointerEvents: "none",
              // Out by the edge it came in by. See `bottomSheetIn`.
              _bottomSheet: {
                animation: "bottomSheetOut 200ms ease-in forwards",
              },
            },
          },
        }),

        // The reader's enlarged-image view.
        //
        // The size rule — "natural size, or 85vh/85vw, whichever is smaller" —
        // needs no JavaScript branch on orientation. With both maxima in play
        // and the natural width set inline, `width: auto` resolves to exactly
        // min(natural, 85vw, 85vh × ratio): a tall image is caught by the
        // height cap, a wide one by the width cap, and a small one by neither.
        collectionLightbox: defineSlotRecipe({
          className: "collection-lightbox",
          description:
            "Enlarged collection image — clamped to its natural size or 85% of the viewport, whichever is smaller, with the item's caption beneath.",
          slots: [
            "panel",
            "figure",
            "frame",
            "backgroundEffect",
            "image",
            "caption",
          ],
          base: {
            panel: {
              background: "transparent",
              border: "none",
              padding: "none",
              overflow: "visible",
              maxWidth: "none",
              maxHeight: "none",
              // A modal <dialog> is focusable, and this one holds focus on
              // ITSELF — it has no focusable children to hand off to, and it
              // needs the focus to receive the arrow keys. So the moment you
              // press one, `:focus-visible` matches and the UA paints its
              // default ring around a panel that is transparent and hugs the
              // photo, which reads as a border drawn on the image.
              //
              // globals.css's outline reset doesn't cover it: that list is
              // `a, button, input, select, textarea, summary, [tabindex]` and a
              // modal dialog is focusable without matching any of them. Every
              // other dialog in the app escapes this only because focus lands
              // on a child instead.
              //
              // Suppressing it costs no affordance — the dialog is a container,
              // not a control, so the ring marks nothing you could activate.
              focusVisibleRing: "none",
            },
            figure: {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "md",
              margin: "none",
            },
            // Wraps the image so the gradient has a box to fill. It cannot fill
            // the FIGURE — that column also holds the caption, and the ground
            // would run out behind the text. `flex` (not block) so the wrapper
            // shrink-wraps whatever size the image's own maxima resolve to.
            // No corner of its own — the enlarged picture keeps the one it was
            // authored with, like every other surface showing it. The clip
            // stays: it is what holds the gradient to the picture's shape,
            // since the ground fills this box exactly.
            frame: {
              position: "relative",
              display: "flex",
              minWidth: 0,
              overflow: "hidden",
            },
            backgroundEffect: {
              position: "absolute",
              inset: 0,
              zIndex: 0,
              pointerEvents: "none",
              // The same card corner a collection cell draws, for the same
              // reason: this is the container the picture and its ground sit
              // in, and a container's corner is a constant of the design system
              // rather than a per-image property. The picture in front of it
              // wears its own, which grows with the enlargement (see
              // `mediaRadiusPx`) while this does not.
              borderRadius: "xl",
            },
            image: {
              display: "block",
              // BOTH auto, so the two maxima below scale the image on its own
              // aspect ratio instead of cropping or stretching its box. The
              // component narrows `maxWidth` to the natural width once the
              // image has loaded, which is the third term of the size rule.
              width: "auto",
              height: "auto",
              maxWidth: "85vw",
              // Leave the caption room to sit under the image without pushing
              // the pair past the viewport.
              maxHeight: "calc(85vh - token(spacing.4xl))",
              objectFit: "contain",
              borderWidth: "token(spacing.3xs)",
              borderStyle: "solid",
              borderColor: "border.divider",
              // Above the gradient behind it — see the grid's `image` slot for
              // why a positioned sibling would otherwise win.
              position: "relative",
              zIndex: 1,
            },
            caption: {
              maxWidth: "85vw",
              textAlign: "center",
              textWrap: "pretty",
            },
          },
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
              "&[data-active]:not([aria-selected='true']):not([aria-pressed='true'])":
                { backgroundColor: "field.bg.hover" },
              // The bare :hover tint, split out so it can be gated on the live
              // input modality. A LISTBOX row only tints while the pointer is
              // the live device: a cursor parked over a menu opened with `/`
              // would otherwise paint a second lit row beside the one the
              // keyboard is driving, and the two are indistinguishable. A
              // TOOLBAR has no roving highlight, so nothing there can conflict
              // and hover always tints. Gated on `:not(…='keyboard')` so the
              // pre-input state, where the attribute is absent, still hovers.
              // `:where()` contributes no specificity, so both selectors keep
              // exactly the weight the single combined rule used to have.
              ":where([role='toolbar']) &:hover:not([aria-selected='true']):not([aria-pressed='true']), :where(html:not([data-input-modality='keyboard'])) &:hover:not([aria-selected='true']):not([aria-pressed='true'])":
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
                  // Same selected-row guard, and the same split of the roving
                  // highlight from the modality-gated :hover, as the base tone
                  // (see there). This override has to repeat the split: left
                  // combined, its ungated :hover would outrank the base rule
                  // and keep tinting the row under a parked cursor.
                  "&[data-active]:not([aria-selected='true']):not([aria-pressed='true'])":
                    { backgroundColor: "field.bg.hoverBrand" },
                  ":where([role='toolbar']) &:hover:not([aria-selected='true']):not([aria-pressed='true']), :where(html:not([data-input-modality='keyboard'])) &:hover:not([aria-selected='true']):not([aria-pressed='true'])":
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
            // How tall the scroll box may grow.
            //   scroll  — the base cap: 7 full rows plus a half-row peek that
            //             signals there is more to reach. Right for a long,
            //             browsable list (the Combobox's fruit list).
            //   content — hug the rows, so a menu that FITS shows itself whole
            //             instead of inventing a scrollbar it doesn't need
            //             (the slash menu, whose 11 commands are the whole
            //             vocabulary — seeing them all is the point). Still
            //             bounded by the viewport, so a list taller than the
            //             screen stays scrollable rather than running off it.
            fit: {
              scroll: {},
              content: {
                list: { maxHeight: "calc(100dvh - token(spacing.5xl))" },
              },
            },
            // The row pitch (Figma 1027:2276 for `sm`).
            //   md — the default: a 32px row, 24px of line box on a 4px inset
            //        all round, rows abutting so each is its own hit target.
            //   sm — the dense list: the inset goes vertical-first, so the row
            //        IS its 24px line box and a 2px gap does the separating a
            //        padded row did. The search strip drops 40 → 28 and its
            //        text 16 → 14 with it, or a full-size field would sit over
            //        a list two thirds its pitch.
            size: {
              md: {},
              sm: {
                search: {
                  height: "token(sizes.optionSearchSm)",
                  textStyle: "bodySmall",
                },
                list: {
                  gap: "xs",
                  paddingInline: "sm",
                  // The list keeps an inset of its own top and bottom, so the
                  // first and last rows are not flush against the search strip
                  // and the bottom edge (Figma 1027:2282).
                  paddingBlock: "sm",
                  // Read exactly as the base cap above it: the rows it means to
                  // show, plus their gaps, plus the list's own block padding,
                  // plus a half-row peek that says there is more to scroll. A
                  // shorter row fits more of them in — 9 here against the
                  // base's 7.
                  maxHeight:
                    "calc(9 * token(sizes.optionRowSm) + 8 * token(spacing.xs) + 2 * token(spacing.sm) + token(spacing.lg))",
                },
                option: { paddingInline: "sm", paddingBlock: "none" },
                empty: { height: "token(sizes.optionRowSm)" },
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
          defaultVariants: {
            tone: "default",
            direction: "block",
            fit: "scroll",
            size: "md",
          },
          // Runtime variant values — force every branch to be emitted.
          staticCss: [{ tone: ["*"], direction: ["*"], fit: ["*"], size: ["*"] }],
        }),

        // A segmented control — one row, every option visible, exactly one on
        // (Figma 885:1963). Almost all of it is already built: the BOX is the
        // shared `toolbar` at `size="sm"` on the field tone, and the OPTIONS
        // are `optionList`'s own, which already draw `field.bg.active` +
        // `field.text.active` for `aria-selected` and the neutral wash on
        // hover. So this recipe is only what a segmented control adds to an
        // inline option list: the row and its items STRETCH, splitting the
        // frame into equal segments instead of hugging their labels.
        //
        // Every declaration here is a property neither `optionList` nor
        // `toolbar` sets, which is what keeps the composition safe — the three
        // classes land in the same `@layer recipes` where a tie would be broken
        // by emission order. That is also why the row fills with `flex-grow` +
        // `flex-basis` rather than `width`, and why `flex-shrink` is left alone:
        // the `flex` shorthand would collide with the option's own
        // `flex-shrink: 0`, and longhands cannot.
        segmentedControl: defineSlotRecipe({
          className: "segmented-control",
          description:
            "Equal-width segments for a horizontal single-select — the stretch an `OptionList.Listbox` needs to become a segmented control inside a `toolbar({ size: 'sm', tone: 'field' })` rail (Figma 885:1963). `list` fills the rail; `option` takes an equal share of it and centres its label. Everything else — the 28px height, the squared abutting items, the selected chip — already comes from those two recipes.",
          slots: ["list", "option"],
          base: {
            // Stretched as well as grown, and BOTH are needed: the rail centres
            // its children, so without this the row would sit at its own
            // content height and a segment stretching to it would stretch to
            // nothing. The rail's height is definite (28px), so this row is
            // exactly that, and the segments below inherit a real box to fill.
            list: { flexGrow: 1, flexBasis: 0, minWidth: 0, alignSelf: "stretch" },
            option: {
              flexGrow: 1,
              flexBasis: 0,
              minWidth: 0,
              // A segment's label sits in the middle of its share; an option
              // row's sits against its leading edge. Same leaf, two jobs.
              justifyContent: "center",
              // Take the rail's full height rather than the option's own
              // 4px + line-box + 4px, which for a 24px line comes to 32 and
              // leaves the segment standing 2px proud of the 28px rail at
              // either end — invisible only because the rail clips it. A
              // stretched segment makes the selected chip's fill exactly the
              // height of the bar it is a segment OF, which is the whole read
              // of the control.
              alignSelf: "stretch",
            },
          },
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

        // ------------------------------------------------------------------
        // A pointer into the site drawn as a picture with its name written
        // across it — the tile the projects listing is made of, and the tile
        // the articles listing will be made of next.
        //
        // It replaced a card that was a 16/9 cover with the title, and
        // sometimes a blurb, stacked in a column underneath. That shape had two
        // problems worth naming. The card's height was whatever its text came
        // to, so a column of them was a column of unequal boxes with the
        // pictures at unequal heights; and the blurb was the FIRST PARAGRAPH of
        // the post, dug out of the document by the card itself, which is the
        // kind of derivation that reads as a summary while being nothing of the
        // sort. Both went the same way: the card is now one box, at one
        // declared shape, and everything it shows is laid over the picture.
        //
        // `aspect` is the whole of that promise, and the reason `overflow` is
        // not decoration. `aspect-ratio` on an auto-height box is a FLOOR, not
        // a shape: the box's automatic minimum size is still its content, so a
        // title long enough to wrap past the ratio's height simply pushes the
        // bottom edge down and the card silently comes out taller than the
        // shape it declared. Measured, not assumed — a 3:2 card asked for 100px
        // and rendered 392px with enough words in it. Clipping is what makes
        // the declaration true, and it is why the caption may sit in flow at
        // all: the cover is taken out of flow so only the words can ever push
        // the box, and then they cannot.
        // ------------------------------------------------------------------
        linkCard: defineSlotRecipe({
          className: "link-card",
          description:
            "A link rendered as one shaped tile — the projects listing's card, and the articles listing's next. `root` is the whole card and the only box with a shape: it takes an `aspect` from the app's shared ratio map and CLIPS to it, since aspect-ratio alone is only a floor. `cover` is the picture's slot, out of flow so it fills the card without being able to grow it, and a flat `bg.surface` plate until posters land. `caption` is the name — and, for a dated listing, the date — laid over the cover along its bottom edge. No hover state of its own beyond the press: the card is a picture, and a wash over a picture is a decision for when there is one.",
          slots: ["root", "cover", "caption"],
          base: {
            root: {
              position: "relative",
              display: "flex",
              flexDirection: "column",
              // The caption sits on the bottom edge, which is the one that
              // moves: a card is read from its picture down to its name, and
              // pinning the name to the foot keeps every card in a column
              // agreeing on where the words are regardless of how many lines
              // they run to.
              justifyContent: "flex-end",
              // Same 12px the card has always worn. The cover carries none of
              // its own — an overlay pinned flush inside a clipped, rounded box
              // is already rounded BY it, and a second radius would only hold
              // the plate back from the corner.
              borderRadius: "lg",
              overflow: "hidden",
              textDecoration: "none",
              _active: { transform: "scale(0.98)" },
            },
            cover: {
              position: "absolute",
              inset: 0,
              backgroundColor: "bg.surface",
            },
            // `position: relative` for one reason only: the cover is positioned
            // and this is not, so without it the plate paints OVER the words it
            // is supposed to sit behind. Both positioned, no z-index, DOM order
            // decides — which is the order they are written in.
            caption: {
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: "sm",
              padding: "xl",
            },
          },
          variants: {
            aspect: linkCardAspectVariants,
          },
          // The shape is chosen per card at RUNTIME, so the extractor never
          // sees one: without this only the ratios that happen to be written as
          // literals somewhere would be emitted, and every other card would
          // fall back to no shape at all. Same trap `demoFrameDemoArea` sprang.
          staticCss: [{ aspect: ["*"] }],
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
        // The smallest step in the scale — 10/16, below `caption`/`sidenote`.
        // Reserved for the subordinate line that must not compete with the
        // value it annotates: the small field's hint. Carries the same 0.5%
        // tracking the rest of the sub-14px family does, since tight glyphs
        // need the extra air to stay legible at this size.
        fineprint: {
          value: {
            fontFamily: "{fonts.switzer}",
            fontWeight: "{fontWeights.base}",
            fontSize: "0.625rem",
            lineHeight: "1.6",
            letterSpacing: "0.5%",
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
