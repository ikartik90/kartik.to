import { defineSlotRecipe } from "@pandacss/dev";

export const calendar = defineSlotRecipe({
  className: "calendar",
  description:
    "Date picker calendar: a search field, month columns with navigation, a weekday header and the day grid. `size`, `fluid`, `navPlacement` and `tone` set its scale, width, nav position and colours.",
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
      // Not `safe center`: an over-narrow range must crop evenly on both sides.
      justifyContent: "center",
      position: "relative",
      // Crops the page turn and the drag band; the `onBrand` root does not crop.
      overflow: "hidden",
      userSelect: "none",
      // The chevrons are `color: inherit`, so the list owns their hue.
      color: "field.text.default",
      // Direct children only, so a nav nested in consumer chrome stays in flow.
      // zIndex lifts it over both pages of a turn.
      "& > [data-nav]": { position: "absolute", zIndex: 2 },
      "& > [data-nav='prev']": { left: "md" },
      "& > [data-nav='next']": { right: "md" },
    },
    outgoing: {
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      pointerEvents: "none",
    },
    period: {
      display: "flex",
      flexDirection: "column",
      gap: "sm",
      padding: "md",
      // Hold the 208px pitch: an over-narrow list overflows and crops instead.
      flexShrink: 0,
      // Animated per column, so every column of both pages moves as one strip.
      "[data-push] > &": { animation: "calendarPageIn 200ms ease-out" },
      // `forwards` so the leaving page holds off-frame until React unmounts it.
      "[data-outgoing] > &": {
        animation: "calendarPageOut 200ms ease-out forwards",
      },
    },
    // Styles the chevron's wrapper: slot-recipe layers can't override the button's `action` styles.
    nav: {
      display: "flex",
      flexShrink: 0,
      // Dim only the glyph, so the hover chip keeps full strength.
      "& svg": { opacity: 0.5, transition: "opacity 150ms ease" },
      "&:hover svg": { opacity: 1 },
    },
    month: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "token(sizes.toolbarButton)",
      textAlign: "center",
      textStyle: "bodyLarge",
      color: "field.text.default",
    },
    week: {
      display: "grid",
      gridTemplateColumns: "repeat(7, token(sizes.calendarDay))",
      gap: "sm",
      paddingTop: "sm",
    },
    weekday: {
      display: "grid",
      placeItems: "center",
      width: "token(sizes.calendarDay)",
      textStyle: "bodySmall",
      color: "field.text.default",
      userSelect: "none",
      "&[data-weekend]": { opacity: 0.5 },
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(7, token(sizes.calendarDay))",
      gap: "sm",
    },
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
      // Anchors the selection ring; the nav scrims and marquee sit above it by z-index.
      position: "relative",
      textStyle: "bodySmall",
      color: "field.text.default",
      cursor: "pointer",
      userSelect: "none",
      transition:
        "background-color 150ms ease, color 150ms ease, box-shadow 150ms ease",
      // Selected cells opt out rather than override: at equal specificity, emission order decides.
      "&:is(:hover, [data-query]):not([aria-selected='true'])": {
        backgroundColor: "bg.itemHover",
      },
      "&[data-weekend]:not([aria-selected='true'], [data-state='today'], [data-outside])":
        { opacity: 0.5 },
      "&[data-outside]": { opacity: 0.15 },
      "&[data-state='today']": { color: "field.text.active" },
      "&[aria-selected='true']": {
        backgroundColor: "field.bg.active",
        color: "field.text.active",
      },
      // On a pseudo, not box-shadow, which the focus ring already uses.
      "&[aria-selected='true']::after": {
        content: '""',
        position: "absolute",
        inset: 0,
        borderRadius: "inherit",
        borderWidth: "token(spacing.3xs)",
        borderStyle: "solid",
        borderColor: "field.border.active",
        pointerEvents: "none",
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
    // Scales the search row only; the grid keeps its fixed 24px pitch at every size.
    size: {
      sm: {
        search: {
          height: "calc(token(spacing.xxl) + token(spacing.md))",
          textStyle: "bodySmall",
        },
      },
      md: {
        search: {
          height: "token(spacing.4xl)",
          textStyle: "bodyLarge",
        },
      },
      lg: {
        search: {
          height: "calc(token(spacing.4xl) + token(spacing.md))",
          textStyle: "subheading",
        },
      },
    },
    // Fills a wider box by spreading the surplus into the gutters, so day cells stay 24px squares.
    fluid: {
      true: {
        root: { width: "token(spacing.full)" },
        period: { flexGrow: 1 },
        // Both grids, so the weekday header keeps step with the day columns.
        week: { justifyContent: "space-between" },
        grid: { justifyContent: "space-between" },
      },
    },
    // `label`: bare chevrons on the month row. `edge`: full-height scrims that fade a cropped range.
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
            // Relies on the base z-index 2: faded cells (opacity < 1) would otherwise paint over it.
            // Layer order: marquee 1 ▸ nav 2 ▸ frame ring 3.
            pointerEvents: "none",
            "& > *": { pointerEvents: "auto", zIndex: 1 },
            // Two stacked backdrop blurs with different masks approximate a variable-radius blur.
            "&::before, &::after": {
              content: '""',
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              // Panda's `backdropFilter` emits only the -webkit- form; the raw key is what Chromium reads.
              backdropFilter: "blur(1.4px)",
              "-webkit-backdrop-filter": "blur(1.4px)",
              "backdrop-filter": "blur(1.4px)",
            },
          },
          "& > [data-nav='prev']": {
            left: 0,
            justifyContent: "flex-start",
            backgroundImage:
              "linear-gradient(to right, token(colors.bg.surfaceRaised), transparent)",
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
              "linear-gradient(to left, token(colors.bg.surfaceRaised), transparent)",
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
    tone: {
      default: {
        root: {
          backgroundColor: "field.bg.default",
          borderRadius: "sm",
          overflow: "hidden",
          position: "relative",
          // Its own layer above the grid: a border would break the 208px pitch,
          // and an inset shadow on the root is painted under the `edge` scrims.
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
        periodList: { color: "field.text.active" },
        month: { color: "field.text.active" },
        weekday: { color: "field.text.active" },
        date: {
          color: "field.text.active",
          "&[data-state='today']": { color: "field.text.default" },
          "&[aria-selected='true']": {
            backgroundColor: "field.bg.selected",
            color: "field.text.default",
          },
          "&[aria-selected='true']::after": { borderWidth: 0 },
        },
      },
    },
  },
  defaultVariants: {
    tone: "default",
    navPlacement: "label",
    size: "md",
  },
  // Variants are chosen at runtime, so emit every branch.
  staticCss: [
    { tone: ["*"], navPlacement: ["*"], fluid: ["*"], size: ["*"] },
  ],
});
