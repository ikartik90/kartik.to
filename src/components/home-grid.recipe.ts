import { defineRecipe } from "@pandacss/dev";

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
// WEBKIT: that atan2 must be fed PLAIN LENGTHS. A container query unit
// anywhere in it is computed wrong. Measured in Safari 26.6.2, inside
// a 799px `inline-size` container: `calc(100px * tan(atan2(50px,
// 10px)))` gives the correct 500px; `calc(100px * tan(atan2(100cqw,
// 799px)))` gives 161.97px, because `100cqw` was resolved against the
// VIEWPORT; and `--f: min(1, tan(atan2(100cqw - 40px, 799px)))` read
// back as `calc(799px * var(--f))` gives 0 outright. The last is this
// recipe's own shape — `--col-width` → `--cell-width` →
// `--aspect-height`, all cqw-derived — so every card collapsed to the
// gutter term across macOS Safari 15.4–26.3 and every iOS browser
// before 26.4, all of which are WebKit. Newer Safari escaped only
// because the `grid-lanes` tier below wins there.
//
// No `@supports` test can catch this, and adding one is the wrong
// instinct: `@supports` tests PARSING, the broken form parses, and the
// guard above passes because plain pixels are computed correctly. So
// the width arrives as a px length instead — `--grid-width`, published
// by one ResizeObserver on the grid in `HomeGrid` — and every operand
// of the atan2 is a kind WebKit gets right. See `--col-width` for how
// the un-measured first frame is kept out of it.
//
// Two nested containers, deliberately. The grid is its own unnamed
// `inline-size` container so a child's `100cqw` is the GRID's width and
// the arithmetic is exact; the tier queries name `projectsGrid` and so
// skip it for the section outside. Capping the grid's width while
// measuring against a wider ancestor is precisely the drift this
// arrangement rules out. The container survives the px measurement
// because `100cqw` is still what sizes the cells before the first
// layout, and is still the honest name for the quantity.
// -------------------------------------------------------------------
export const masonryGrid = defineRecipe({
  className: "masonry-grid",
  description:
    "A masonry grid that supports column spans. Upgrades to `display: grid-lanes` where it exists; elsewhere it packs cards into 1px row tracks and computes each card's row span from its declared aspect and the width it lands at. Children drive it with three custom properties — `--span` (columns, clamped to what the grid has), `--aspect-w` and `--aspect-h` (the shape as a pair, kept as integers so ratios like 3:2 stay exact) — and may publish a fourth, `--card-height`, when they have measured themselves taller than their shape; the span reserves the larger of the two. The grid hands `--aspect-height` back to each child, which is the shape's height at the width that child landed at, so the child can take its shape as a floor. `data-columns` is the CEILING on the column count from `listingColumnsFor`; the tier queries hand out the smaller of that and what fits. The 1px-row tier additionally waits on `data-measured` and `--grid-width` — the grid's own width in plain pixels, published by a single `ResizeObserver` — because the `tan(atan2(…))` division is computed wrongly by WebKit on a container query unit; until then the grid is a plain aligned grid at the same widths and shapes.",
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
      // The grid's width, twice over, naming ONE quantity: the px
      // length `HomeGrid`'s observer publishes, falling back to the
      // container unit that means the same thing.
      //
      // Which of the two is in play is not a detail — see the WebKit
      // note above. The `100cqw` fallback is only ever reached before
      // the grid has been measured, and the `[data-measured]` gate
      // below is what keeps that state out of the `atan2`: unmeasured,
      // the only thing reading this chain is the cell's `min-height`,
      // where a container unit is computed correctly by every engine.
      // So the fallback keeps the shapes right on the server and in
      // the first frame, and never reaches the arithmetic that breaks
      // on it.
      "--col-width":
        "calc((var(--grid-width, 100cqw) - (var(--columns) - 1) * var(--grid-gap)) / var(--columns))",
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
      // `start`, not the default `stretch`. Stretched, a card grows to
      // fill the rows it was given INCLUDING the gutter rows, and the
      // gap closes to nothing. It is also what keeps the measurement
      // below from chasing its own tail: the card's height decides the
      // span, and the span must not decide the card's height back.
      //
      // In the BASE tier rather than with the span it protects, because
      // the un-measured first paint is a plain grid and stretch there
      // means a short card grows to the tallest in its row, then snaps
      // back the moment packing starts — with `GridItem` publishing the
      // stretched height as `--card-height` in between. Started, every
      // card is already at its final height before the JS lands. The
      // `grid-lanes` tier resets this to `auto`, which still wins: it
      // is later, and this adds no specificity to outrank it with.
      alignSelf: "start",
    },

    "@supports (grid-row: span calc(tan(atan2(1px, 1px))))": {
      // Gated on the measurement, and inside `:where()` so the gate
      // costs no specificity — the `grid-lanes` tier below is a bare
      // `&`, and it has to keep winning on SOURCE ORDER alone. A plain
      // `&[data-measured]` would outrank it and take that tier out
      // wherever both apply.
      //
      // Until the grid is measured this whole tier is simply absent,
      // which leaves a plain grid: right column count, right shapes
      // (the cells' `min-height` needs no measurement), rows aligned
      // rather than packed. That is the deliberate first paint — the
      // alternative was admitting `--grid-width`'s `100cqw` fallback
      // into the `atan2`, which is the WebKit failure itself, and
      // dropping the fallback instead makes the whole `grid-row`
      // invalid-at-computed-value-time, i.e. `auto` over 1px rows:
      // every card one pixel tall until the JS lands.
      "&:where([data-measured])": {
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
        },
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
});
