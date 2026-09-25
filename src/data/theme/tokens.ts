import { defineTokens } from "@pandacss/dev";

export const tokens = defineTokens({
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
    // The skyline footer's height (`SiteFooter`). The drawing crops itself
    // to `xMidYMax slice` from a 4000 × 600 viewBox, so a box at k × its
    // own width shows 600 / k of those units across — 1714 at 0.35: the
    // whole harbour view (1050 units) with the waterfront carrying on
    // either side of it to the edges, the same slice at ANY width.
    // Floored so a phone gets a skyline rather than a strip (the sides
    // overflow there, which is what the crop is for) and capped so it
    // never becomes the page. The top is only cropped once the box is
    // wider than 6.67 × its height, i.e. past 4000px at the cap.
    siteFooter: { value: "clamp(280px, 35vw, 600px)" },
    // How far below the top of the skyline's box the CN Tower's antenna
    // begins — the one number the homepage's testimonial band needs in
    // order to stop above it.
    //
    // MEASURED OFF THE DRAWING rather than guessed. The skyline is a
    // 4000×600 viewBox sliced `xMidYMax`, and because the box is always
    // far taller in proportion than the artwork, the scale is decided by
    // the HEIGHT — every on-screen length in that picture is its viewBox
    // length × `siteFooter / 600`. The antenna's tip is at y 17.9 of
    // those 600 units, which is why this is written as that ratio rather
    // than as a number: the footer's height is a clamp, so the tip is 8px
    // down on a phone and 18px down on a wide display, and anything
    // holding clear of it has to move when the clamp does.
    //
    // For the record, since the band also has to clear the tower
    // SIDEWAYS: it spans x 1968.2 → 2026.5 of the same viewBox — 58.3
    // units, so at most 58px on screen, centred on the 2000 that `xMid`
    // pins to the middle of the viewport. Every card is wider than that,
    // so the band's middle column covers the tower's line whatever it
    // holds; clearing the tower is entirely a question of stopping above
    // this tip.
    skylineTowerTip: { value: "calc({sizes.siteFooter} * 17.9 / 600)" },
    calchemyDemo: { value: "720px" },
    // The Calchemy playground's year. The site's 960 column, spent on a
    // 3 × 4 grid of months: the gap BETWEEN months takes its 80 first —
    // without it the twelve dissolve into one field of numbers — and the
    // months are `fluid` over what is left, so the rest opens the gutters
    // between the seven day columns and every cell keeps its 24px square.
    calchemyPlayground: { value: "960px" },
    librarySidebar: { value: "200px" },
    imagePreviewMax: { value: "280px" },
    // The narrowest a testimonial card may be drawn, which is the
    // narrowest a few lines of prose read well at — below this the quote
    // breaks into a ragged column of four-word rows. It is what the
    // board's `auto-fill` tracks are sized against, so the number of
    // columns is decided by the words rather than declared.
    testimonialCard: { value: "280px" },
    // What a card may grow to once the band has more room than it needs.
    // The band is a fixed FIVE columns (see `TestimonialBand`), so past a
    // certain width the choice is between wider cards and a band that
    // stops short of the screen — and a quote reads perfectly well at
    // 400px, where it stops reading like a column and starts reading like
    // a paragraph.
    testimonialCardWide: { value: "400px" },
    // The tallest a card gets: a full 280-character quote in the
    // NARROWEST column, which is the worst case, measured rather than
    // estimated. The band reserves this much room above the tower so the
    // middle column always has somewhere to put a card, whichever one the
    // rotation deals it.
    testimonialCardTallest: { value: "320px" },
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
    // What ONE month column measures: seven day cells on a 4px gutter,
    // plus the period's own 8px inset — the 208px pitch the calendar
    // recipe hugs to, and so the natural width of a single-month
    // `datePopover`. Written out from its parts rather than as 208 so it
    // tracks `calendarDay`, and named so a consumer sizing a surface
    // AROUND a calendar can state that intent instead of restating the
    // number (see the Calchemy playground's named-date panel).
    calendarPeriod: {
      value:
        "calc(7 * {sizes.calendarDay} + 6 * {spacing.sm} + 2 * {spacing.md})",
    },
    // Fixed like the calendar's 208px pitch, so a select popover and a
    // date popover read as siblings (Figma 647:2383, 629:1416).
    optionListWidth: { value: "208px" },
    // What a date field is drawn at: room for a dd/mm/yyyy value and the
    // frame's trailing calendar glyph, and no more. Narrower than the
    // popover it opens (one month, `calendarPeriod`) — a date is ten
    // characters, so the field is sized for the value rather than for the
    // calendar that fills it in.
    dateField: { value: "140px" },
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
    // label ∣ field ∣ action, and the panel's WIDTH is derived from it
    // below — one row, one panel, so the two can never drift out of
    // agreement.
    propertyRowLabel: { value: "80px" },
    // 212, not the 220 it was. The action column costs 36px (a gap and a
    // button) and the rail only grew by 28 of them, so the field gives up
    // the last 8. It is the right column to take them from: what fills a
    // field here is a slider track or a menu, which loses 8px of travel
    // rather than 8px of legible text.
    propertyRowField: { value: "212px" },
    // The empty cell at the end of every row — the place an icon button
    // lands on the row it belongs to, and until one does, the column that
    // holds a row's content clear of the panel's edge. Sized to the
    // toolbar chip it is holding open for, so the reserve and the thing
    // reserved for cannot disagree; it lands directly under the header
    // strips' own buttons, which sit on the same 12px inset.
    propertyRowAction: { value: "{sizes.toolbarButton}" },
    // 12 + 80 + 8 + 212 + 8 + 28 + 12 — the row plus the control panel's
    // own inset on both sides. Written out rather than hard-coded at
    // 360px so widening a field widens the panel with it.
    propertiesPanelWidth: {
      value:
        "calc({sizes.propertyRowLabel} + {sizes.propertyRowField} + {sizes.propertyRowAction} + 2 * {spacing.md} + 2 * {spacing.lg})",
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
    // Two bright hues, and the two quiet ones they settle into.
    //
    // `rust` and `rosemilk` are not free-standing pigments: each is its
    // theme's bright hue at 15% over that theme's canvas — the brand as
    // far into the background as it goes while staying a colour. Written
    // as the mix rather than as the hex it comes to, so a retuned canvas
    // or a retuned brand carries them both with it instead of leaving two
    // frozen numbers behind that used to agree with everything.
    //
    // `rust` was ALREADY exactly this (#41362E to the byte); `rosemilk`
    // was a step stronger at 25% (#F2C9DE), which is why a focused field
    // in light used to open a popover a shade deeper than its own frame.
    // Levelling the two is what lets `field.bg.active` and
    // `field.bg.popover` be the same paint — see them below.
    //
    // Base tokens, so each mixes with the NEUTRAL its canvas resolves to
    // rather than with `bg.canvas` itself: a base token holds one value
    // and cannot ask which theme is on.
    brand: {
      rust: {
        value:
          "color-mix(in srgb, var(--colors-brand-orange) 15%, var(--colors-neutral-900))",
      },
      orange: { value: "#FFAB6F" },
      rosemilk: {
        value:
          "color-mix(in srgb, var(--colors-brand-pink) 15%, var(--colors-neutral-100))",
      },
      pink: { value: "#FF4D97" },
    },

    // The weather graphic's pigments (Figma 1995:24). A separate group
    // from `brand`/`neutral` on purpose: these are ILLUSTRATION colours,
    // and an illustration must not shift when an interface token is
    // retuned — a cloud that restyled itself because the body text got a
    // point darker would be a bug with no obvious cause. Nothing outside
    // `weatherGraphic` should reach for them.
    //
    // The sun is the one deliberate exception and is NOT here: it is
    // painted in `brand.pink → brand.orange`, the site's own gradient, so
    // a clear day is literally the brand in the sky.
    sky: {
      moonCore: { value: "#F5E7A3" },
      moonRim: { value: "#A7A6F2" },
      moonGlow: { value: "#F4E59A" },
      cloudLight: { value: "#F3F5F7" },
      cloudMid: { value: "#D4DAE2" },
      cloudDeep: { value: "#A3BDE0" },
      cloudShade: { value: "#4C78B3" },
      dropLight: { value: "#D2ECF9" },
      dropDeep: { value: "#38B9FA" },
      flakeDeep: { value: "#B8E4F9" },
      boltCore: { value: "#F5E7A3" },
      boltEdge: { value: "#F0CE21" },
      boltGlow: { value: "#FAEB9E" },
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
    // The softening at the small end, for boxes `sm` would overpower: the
    // 20px media thumbnail, and the 1px progress track whose own height
    // clamps this down to half a pixel anyway. Three recipes already
    // asked for `xs` before it existed here — the scale mirrors spacing,
    // so the hole read as a token rather than as the typo it was.
    xs: { value: "{spacing.xs}" },
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
});
