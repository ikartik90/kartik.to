import { defineTokens } from "@pandacss/dev";

export const tokens = defineTokens({
  sizes: {
    articleContent: { value: "640px" },
    dialogXs: { value: "320px" },
    dialogSm: { value: "480px" },
    // The listing grid's tier pitch: two-up at 2×, three-up at 3× (floors, not widths).
    listingColumn: { value: "320px" },
    listingGrid3Up: { value: "calc(3 * {sizes.listingColumn})" },
    articleShowcase: { value: "960px" },
    // Floored so a phone gets a skyline, capped so it never becomes the page; the drawing crops `xMidYMax slice`.
    siteFooter: { value: "clamp(280px, 35vw, 600px)" },
    // The CN Tower's antenna tip: y 17.9 of the skyline's 600-unit viewBox, scaled by the footer's height.
    skylineTowerTip: { value: "calc({sizes.siteFooter} * 17.9 / 600)" },
    calchemyDemo: { value: "720px" },
    calchemyPlayground: { value: "960px" },
    librarySidebar: { value: "200px" },
    imagePreviewMax: { value: "280px" },
    // The narrowest a quote reads well at; the board's `auto-fill` tracks size against it.
    testimonialCard: { value: "280px" },
    testimonialCardWide: { value: "400px" },
    // The tallest card (a full quote at the narrowest width), measured; the band reserves it above the tower.
    testimonialCardTallest: { value: "320px" },
    insertDialogHeight: { value: "480px" },
    dialogFooter: { value: "44px" },
    quoteMark: { value: "52px" },
    tooltipIcon: { value: "14px" },
    listMarker: { value: "24px" },
    // Also the weekday header cell and the month chevrons, so the grid keeps one pitch.
    calendarDay: { value: "24px" },
    calendarNavZone: { value: "72px" },
    // One month column (208px), written from its parts so it tracks `calendarDay`.
    calendarPeriod: {
      value:
        "calc(7 * {sizes.calendarDay} + 6 * {spacing.sm} + 2 * {spacing.md})",
    },
    // Matches the calendar's 208px pitch, so select and date popovers read as siblings.
    optionListWidth: { value: "208px" },
    dateField: { value: "140px" },
    fieldValue: { value: "60px" },
    // 24px line + 2×4 inset.
    optionRow: { value: "32px" },
    // The small list: the row is the 14/24 line box; the search strip adds a 2px inset.
    optionRowSm: { value: "calc({sizes.optionRow} - 2 * {spacing.sm})" },
    optionSearchSm: {
      value: "calc({sizes.optionRowSm} + 2 * {spacing.xs})",
    },
    listBullet: { value: "8px" },
    listBulletGlyph: { value: "20px" },
    toolbarButton: { value: "28px" },
    sidenoteWidth: { value: "320px" },
    sidenoteOffset: { value: "100px" },
    // Stacked fallback: content-column width minus this inset.
    sidenoteStackedInset: { value: "80px" },
    sidenoteMinWidth: { value: "320px" },
    sidenoteMaxWidth: { value: "480px" },
    // Properties-panel row: label ∣ field ∣ action; the panel width is derived from it.
    propertyRowLabel: { value: "80px" },
    propertyRowField: { value: "212px" },
    // The row's action column, sized to the toolbar chip it holds open.
    propertyRowAction: { value: "{sizes.toolbarButton}" },
    // The row plus the panel's inset on both sides (12 + 80 + 8 + 212 + 8 + 28 + 12).
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
    // `rust` and `rosemilk` are each theme's bright hue at 15% over its canvas neutral.
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

    // Illustration colours for `weatherGraphic` only, kept apart so retuning interface tokens never shifts them.
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
    xs: { value: "{spacing.xs}" },
    sm: { value: "{spacing.sm}" },
    md: { value: "{spacing.md}" },
    lg: { value: "{spacing.lg}" },
    xl: { value: "{spacing.xl}" },
    xxl: { value: "{spacing.xxl}" },
    // Pill: `spacing.half` (50%) draws an ellipse on an oblong box.
    full: { value: "9999px" },
  },
});
