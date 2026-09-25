import { defineSlotRecipe } from "@pandacss/dev";

// Presentation only — the month math (Temporal) and selection live in
// `calendar.tsx`. Slots map 1:1 to the compound parts.
export const calendar = defineSlotRecipe({
  className: "calendar",
  description:
    "Calendar grid: a search field above a period list — one or more month columns, each a ‹ month year › label, the weekday header row and the day grid on a 24px cell / 4px gutter pitch (7 × 24 + 6 × 4 + 2 × 8 padding = 208px per month). The pair of nav chevrons is absolutely placed at the list's top corners, so they flank the whole range rather than a single month, and the list pages a full range at a time (Figma 715:912 — three months at 624px). A turn is a push: the list crops, the arriving page slides in from the side the range is travelling toward and the leaving one (the `outgoing` copy) is pushed out by the same `--calendar-push` — `step` month columns, signed by the direction. Day cells carry their state as attributes (aria-selected / data-state=today / data-outside / :disabled) plus data-weekday/data-weekend identity, so the look is fully re-skinnable off selectors. `fluid` lets the grid FILL a box wider than its months instead of hugging them, spending the surplus in the gutters between the seven columns so the day cell keeps its 24px square. `tone` swaps which half of the palette reads brand: `default` is a self-framed neutral surface with a brand today/selection (Figma 644:1678/644:1681); `onBrand` is the Date popover's inverse (Figma 631:893/631:897).",
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
      // Anchors the selection ring below. Every cell, not just the
      // selected one, so the box does not change class when it is
      // picked. Harmless to the layer order the nav scrims and the
      // marquee depend on: those carry explicit z-indices (1/2/3) and
      // still sit above a positioned cell at `z-index: auto`.
      position: "relative",
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
      // ── SELECTION RING (trial) ───────────────────────────────
      // A chip filled with `field.bg.active` also wears the matching
      // `field.border.active` edge — which is what the Switch and the
      // Checkbox have always done, and what the segmented control now
      // does over its rail. Scoped to exactly that fill: the `onBrand`
      // tone below takes the neutral `field.bg.selected` chip instead
      // and turns the ring off, because on a brand surface the accent
      // IS the background and an accent edge would have nothing to sit
      // against.
      //
      // On a pseudo rather than a `box-shadow`, so it composes with the
      // focus ring the slot already spends its `box-shadow` on.
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
    // Which FIELD size this calendar is serving. It scales the search
    // row and nothing else — deliberately. The grid's measure is a
    // fixed pitch (`calendarDay`, 24px, on a 4px gutter) that the whole
    // system draws days at, and a month is 208px because of it; scaling
    // that with the label beside it would make the same calendar a
    // different size in two forms. The search row is the one part
    // shared with the field family — it stands exactly where the input
    // it replaced stood — so it takes that family's height and text and
    // the popover lands flush on its trigger instead of overhanging it.
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
    // Fill the box, instead of hugging the months. The calendar's
    // measure is otherwise intrinsic — 208px a month, and a consumer
    // handing it a wider column just gets 208px of calendar sitting in
    // one corner of it. `fluid` spends the surplus in the GUTTERS: the
    // period grows to the list, and each grid distributes what is left
    // between its seven tracks, so a day cell stays the 24px square the
    // rest of the system draws and only the space BETWEEN the columns
    // opens up. The alternative — stretching the cells — would make the
    // selected chip a wide bar in one layout and a square in another,
    // and it is the same calendar in both.
    //
    // At the natural measure the arithmetic is a no-op (free space is
    // zero), which is what lets a consumer set this once and leave the
    // decision to whatever column the calendar lands in.
    fluid: {
      true: {
        root: { width: "token(spacing.full)" },
        // One month takes the whole list; several share it equally.
        period: { flexGrow: 1 },
        // Both grids, so the weekday header keeps step with the day
        // columns it names.
        week: { justifyContent: "space-between" },
        grid: { justifyContent: "space-between" },
      },
    },
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
          // The chip here is neutral, not the brand fill — so it takes
          // no brand edge. See the ring in the base slot.
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
  // Runtime variant values — force every branch to be emitted.
  staticCss: [
    { tone: ["*"], navPlacement: ["*"], fluid: ["*"], size: ["*"] },
  ],
});
