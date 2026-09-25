import { defineSlotRecipe } from "@pandacss/dev";

// ---------------------------------------------------------------------
// The ramp, as a grid of swatches (Figma 1088:2591).
//
// It replaces a count slider over a stack of colour fields — one row per
// stop, which at ten stops stood taller than everything else in the rail
// put together and still made you read a number to find out how many
// colours you had. A grid says that at a glance: the ramp IS the filled
// cells, in order, and the empty ones are the room left.
//
// FIVE columns, always, whatever the shader's ceiling. The count is a
// property of the panel rather than of the shader — 5 × 36 + 4 × 8 is
// exactly `propertyRowField`, so the grid fills its column edge to edge
// — and a shader with a lower ceiling simply draws fewer cells into the
// same shape. What varies is how many cells there are, never how wide
// they are, so two shaders' ramps are read on one pitch.
//
// The cell is the colour FIELD's swatch at another size, deliberately:
// same checkerboard under the fill so a partial alpha reads as partial,
// same hairline so a pale colour on a pale ground still has an edge.
// ---------------------------------------------------------------------
export const colorSwatchGrid = defineSlotRecipe({
  className: "color-swatch-grid",
  description:
    "A shader preset's ramp as a five-column grid of 36×28 swatches — filled cells are the colours in order, and every empty one offers to add. Each swatch is a button that opens the shared ColorPicker: a filled cell on its own colour, a blank on the stop pressing it appends. Sized so the grid is exactly the properties rail's field column (Figma 1088:2591).",
  slots: ["grid", "cell", "fill", "icon"],
  base: {
    grid: {
      display: "grid",
      // `1fr`, not the 36px it comes out at: the cell's width is a
      // consequence of the column it is drawn in, and stating both
      // would be two answers to one question. A rail forced narrower
      // than its own width (a phone in landscape) shrinks the cells
      // rather than overflowing.
      gridTemplateColumns: "repeat(5, 1fr)",
      gap: "md",
      width: "token(spacing.full)",
      minWidth: 0,
    },
    cell: {
      // The button reset the colour field's swatch carries, for the
      // same reason: this is a trigger everywhere it appears, and a
      // native border inside the grid would be the one edge in the rail
      // that is not a hairline of ours.
      appearance: "none",
      margin: "none",
      padding: "none",
      borderWidth: "0",
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "token(sizes.toolbarButton)",
      minWidth: 0,
      borderRadius: "sm",
      overflow: "hidden",
      cursor: "pointer",
      // The EMPTY cell: a flat wash, the same one every field frame in
      // the rail rests on. It is the base rather than a variant because
      // an empty cell is simply one with nothing painted over it.
      backgroundColor: "field.bg.default",
      // The checkerboard, so a translucent colour reads as translucent
      // rather than as a paler one — same conic gradient the colour
      // field's swatch draws, at the same 8px pitch. ONLY under a
      // colour: a `background-image` paints over its own
      // `background-color`, so left in the base it would tile across
      // the empty cells too and turn "room for four more" into a strip
      // of texture.
      "&[data-swatch-filled]": {
        backgroundImage:
          "conic-gradient(var(--colors-border-divider) 0deg 90deg, transparent 90deg 180deg, var(--colors-border-divider) 180deg 270deg, transparent 270deg 360deg)",
        backgroundSize: "token(spacing.md) token(spacing.md)",
      },
      // EMPTY, said out loud: hatched with the frame's own hairline.
      //
      // The wash alone did not say it. `field.bg.default` is the fill
      // every input in the rail rests on, so a blank cell read as a
      // swatch holding that colour rather than as one holding none —
      // and on a ramp, "there is a colour here" and "there is room
      // here" are the two things a cell has to tell apart.
      //
      // SHADING rather than a single strike through the middle. A lone
      // diagonal is a mark laid ON a cell — it reads as a cell that has
      // been crossed out, which is a different claim from an empty one.
      // Ruled at a 2.8px pitch the lines stop being a mark and become a
      // tone, which is what a blank should be: a texture you look past,
      // not a symbol you read.
      //
      // The ink is the frame's own hairline exactly: 0.5px of
      // `field.border.default`, so the shading and the edge around it
      // are one piece of drawing rather than two weights of line.
      //
      // ONE line in a TILED 4px square, and every part of that is
      // load-bearing.
      //
      //   • Tiled rather than `repeating-linear-gradient`. A repeating
      //     gradient is rasterised as one image across the whole box,
      //     so every line lands on a different subpixel phase: at 0.5px
      //     the coverage of a device pixel then differs line to line and
      //     the hatching draws visibly uneven, some rules darker than
      //     their neighbours. A `background-size` tile is rendered once
      //     and repeated, so every line is the SAME rasterisation and
      //     the tone is even. The tile is a whole number of CSS pixels
      //     for the same reason — a fractional one would put each
      //     repeat back on its own phase.
      //
      //   • One line per tile rather than two. Two would alternate
      //     between two phases within the tile and bring the unevenness
      //     back at half the period.
      //
      //   • That line is the tile's own corner-to-corner diagonal — the
      //     band at 50%, which for a square at 135deg is exactly it.
      //     Corner to corner is what makes the tiling seamless: each
      //     line ends where the next tile's begins, so they run on as
      //     unbroken diagonals across the cell rather than breaking at
      //     every tile edge. The pitch is then the tile over root two,
      //     which is the 2.8px above.
      //
      // Stops are measured ALONG the gradient line, perpendicular to the
      // band, so the 0.5px is a true width whatever angle the tile works
      // out to — no aspect-ratio arithmetic, which matters because the
      // cell's 36×28 is a consequence of the column the grid is drawn in
      // (see `grid`) and not a number this recipe knows.
      //
      // Under the add glyph rather than replacing it: the shading says
      // what the cell IS, the glyph says what pressing it would do, and
      // the glyph is drawn over it on hover (see `icon`).
      "&:not([data-swatch-filled])::before": {
        content: '""',
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        backgroundImage:
          "linear-gradient(135deg, transparent calc(50% - 0.25px), var(--colors-field-border-default) calc(50% - 0.25px), var(--colors-field-border-default) calc(50% + 0.25px), transparent calc(50% + 0.25px))",
        backgroundSize: "token(spacing.sm) token(spacing.sm)",
      },
      // A blank that cannot take a colour — a full ramp, or a grid
      // given no `onAdd`. Every other blank is pressable, so this is
      // the one case that offers nothing and says so by not lighting
      // up. (Where the colour LANDS is still the first gap: the ramp is
      // dense. Which cell you may press is a separate question.)
      "&:disabled": { cursor: "default" },
      // The frame, on an OVERLAY rather than on the cell itself.
      //
      // An inset shadow paints below the element's children, and a
      // filled cell's colour is a child covering the whole box — so
      // stated on the cell the hairline drew on the blanks and vanished
      // under every colour, which left the ramp reading as a row of
      // bare chips beside framed empty ones. Painted after the fill,
      // every cell is framed the same way whatever is in it, and the
      // focus ring is visible on a filled cell for the first time.
      //
      // The frame does NOT answer to hover. Which blank you are over is
      // said by the add glyph appearing in it (see `icon`) — that is
      // the whole of the affordance, and a ring brightening underneath
      // it was a second answer to the same question that read as a
      // focus halo on a control that was not focused.
      "&::after": {
        content: '""',
        position: "absolute",
        inset: 0,
        borderRadius: "inherit",
        pointerEvents: "none",
        boxShadow:
          "inset 0 0 0 0.5px var(--colors-field-border-default)",
        transition: "box-shadow 150ms ease",
      },
      "html[data-keyboard-focus] &:focus-visible::after": {
        boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
      },
    },
    // The colour itself, over the checker — a layer rather than a
    // background, because the checker occupies the background and the
    // two have to composite.
    fill: { position: "absolute", inset: 0 },
    // The add glyph, on whichever blank is under the pointer. Drawn
    // only on hover and on keyboard focus: at rest the row should read
    // as a ramp and its remaining room, not as a strip of buttons.
    //
    // It follows the pointer across the blanks rather than sitting on
    // one of them. Pinned to the first gap it appeared to JUMP as you
    // swept the row — the glyph lighting up a cell away from the one
    // you were over — which read as the icon moving rather than as the
    // row having a single live target.
    icon: {
      position: "relative",
      width: "token(spacing.xxl)",
      height: "token(spacing.xxl)",
      display: "block",
      color: "text.body",
      opacity: 0,
      transition: "opacity 150ms ease",
      "& path[stroke]": { stroke: "currentColor" },
      "& path[fill]": { fill: "currentColor" },
      "[data-swatch-add]:hover &": { opacity: 1 },
      "html[data-keyboard-focus] [data-swatch-add]:focus-visible &": {
        opacity: 1,
      },
    },
  },
});
