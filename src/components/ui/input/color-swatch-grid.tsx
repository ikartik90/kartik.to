"use client";

import { useId, useRef, useState } from "react";
import { css } from "../../../../styled-system/css";
import { colorPickerPopover } from "../../../../styled-system/recipes";
import { Popover } from "@/components/ui/popover";
import { usePickerPin } from "@/hooks/use-picker-pin";
import { ColorPicker } from "./color-picker";
import AddIcon from "@/assets/icons/add.svg";

// ---------------------------------------------------------------------------
// ColorSwatchGrid — a preset's ramp, drawn as the colours themselves
// (Figma 1088:2591):
//
//   <Field size="sm" data-property-control>
//     <Field.Label>Ramp</Field.Label>
//     <ColorSwatchGrid
//       ariaLabel="Ramp"
//       capacity={spec.maxColors}
//       values={colors}
//       onValueChange={setColorAt}
//       onAdd={appendColour}
//       onRemove={dropColourAt}
//     />
//     <ThemeToggleButton />
//   </Field>
//
// It composes into a `<Field>` like every other control in the rail, and the
// row's three children land in the panel's three tracks — label, field, and the
// action column the toggle sits in.
//
// The ramp is DENSE and the grid says so: filled cells run from the start, the
// first empty one offers to add, and every cell after that is an inert blank
// showing how much room is left. There is no gesture that could put a colour in
// the seventh cell of a three-colour ramp, so there is no cell that appears to
// take one.
//
// ONE picker for the whole grid, not one per cell. Which colour it is editing
// is this component's state, so opening a second cell moves the panel rather
// than stacking two of them — and the panel is pinned where the cell was when
// it opened (see `usePickerPin`), so the rail can scroll underneath without
// dragging it along.
// ---------------------------------------------------------------------------

export interface ColorSwatchGridProps {
  /** The ramp, in order. One filled cell each. */
  values: string[];
  /** How many cells to draw — the shader's own ceiling. */
  capacity: number;
  /** Fired with the index edited and its new `#RRGGBBAA`. */
  onValueChange: (index: number, value: string) => void;
  /**
   * Append a colour. Left off, the grid never offers to add — which is what a
   * single-cell row (the ground, the rails) wants.
   */
  onAdd?: () => void;
  /**
   * Drop the colour at an index, offered inside the picker. Left off, or on the
   * last colour standing, the picker shows no remove.
   */
  onRemove?: (index: number) => void;
  /**
   * Names the group, and — on a ONE-cell grid — its single swatch.
   *
   * Required: a grid of unlabelled swatches names nothing. Make it specific
   * rather than echoing the row's visible label, because a properties panel
   * already has SECTIONS with those names ("Ramp", "Edge") and two groups with
   * one name is a panel a screen reader cannot navigate. "Ramp colours" beside
   * a section called Ramp is the distinction that costs nothing on screen.
   */
  ariaLabel: string;
  /**
   * Names each cell, for a grid whose cells differ by ROLE rather than by
   * position — a lattice's minor and major ink, say.
   *
   * Left off, a multi-cell grid numbers them ("Colour 2"), which is right for a
   * ramp, where the position IS the meaning, and wrong for a pair where it is
   * not: there "Colour 2" names the one on the right, and what the reader needs
   * to know is that it is the major one.
   */
  labels?: string[];
}

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
//
// A shader preset's ramp as a five-column grid of 36×28 swatches — filled cells
// are the colours in order, and every empty one offers to add. Each swatch is a
// button that opens the shared ColorPicker: a filled cell on its own colour, a
// blank on the stop pressing it appends. Sized so the grid is exactly the
// properties rail's field column (Figma 1088:2591).
const swatchGridStyle = css({
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
});

const swatchGridCellStyle = css({
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
  "html[data-keyboard-focus] &": {
    "&:focus-visible::after": {
      boxShadow: "inset 0 0 0 1.5px var(--colors-border-focus-ring)",
    },
  },
});

// The colour itself, over the checker — a layer rather than a
// background, because the checker occupies the background and the
// two have to composite.
const swatchGridFillStyle = css({ position: "absolute", inset: 0 });

// The add glyph, on whichever blank is under the pointer. Drawn
// only on hover and on keyboard focus: at rest the row should read
// as a ramp and its remaining room, not as a strip of buttons.
//
// It follows the pointer across the blanks rather than sitting on
// one of them. Pinned to the first gap it appeared to JUMP as you
// swept the row — the glyph lighting up a cell away from the one
// you were over — which read as the icon moving rather than as the
// row having a single live target.
const swatchGridIconStyle = css({
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
});

export function ColorSwatchGrid({
  values,
  capacity,
  onValueChange,
  onAdd,
  onRemove,
  ariaLabel,
  labels,
}: ColorSwatchGridProps) {
  const uid = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const cellsRef = useRef<Map<number, HTMLButtonElement>>(new Map());
  const pin = usePickerPin();

  // Whether an empty cell may be pressed to grow the ramp. False once the ramp
  // fills its ceiling, which is what takes the affordance away rather than
  // leaving a button that declines.
  //
  // EVERY blank offers it, not just the first gap. Where a colour lands is
  // still the first gap — the ramp is dense and a stop never appears in the
  // seventh slot with nothing before it — but where you may PRESS is a
  // different question, and a row of identical blanks of which only one is live
  // is a target you have to find rather than one you can hit.
  const canAdd = Boolean(onAdd) && values.length < capacity;

  // Where the next colour lands, which is also the cell the picker opens on.
  const addIndex = values.length;

  const closePicker = () => {
    const wasOpen = openIndex;
    setOpenIndex(null);
    pin.unpin();
    // Back to the cell that opened it — the trigger is where the keyboard left
    // off, exactly as the colour field's swatch is.
    if (wasOpen !== null) cellsRef.current.get(wasOpen)?.focus();
  };

  // The one press outside the picker that must NOT dismiss it: a cell of THIS
  // grid, so pressing another colour moves the panel to it in a single click
  // instead of closing and needing a second.
  const keepOpenFor = `[data-swatch-grid="${uid}"]`;

  // Grow the ramp and open the picker on the stop that was just made. Adding is
  // the START of choosing a colour: leaving it at the append would put a colour
  // nobody picked into the ramp and make the author click the same cell again.
  //
  // Pinned to the cell the colour LANDS in rather than the one that was
  // pressed, because the picker opens level with the swatch it edits and those
  // are only the same cell when the first gap is the one you hit.
  function addAndOpen() {
    onAdd?.();
    pin.pin(cellsRef.current.get(addIndex) ?? null);
    setOpenIndex(addIndex);
  }

  function openAt(index: number) {
    // Re-pressing the open cell closes it; pressing a different one moves the
    // panel, and re-reads the position so it opens level with its new row.
    if (openIndex === index) {
      closePicker();
      return;
    }
    pin.pin(cellsRef.current.get(index) ?? null);
    setOpenIndex(index);
  }

  return (
    <>
      <div className={swatchGridStyle} role="group" aria-label={ariaLabel}>
        {Array.from({ length: capacity }, (_, index) => {
          const color = values[index];
          const offersAdd = !color && canAdd;
          return (
            <button
              key={index}
              type="button"
              ref={(node) => {
                if (node) cellsRef.current.set(index, node);
                else cellsRef.current.delete(index);
              }}
              data-swatch-grid={uid}
              // Read by the recipe to reveal the add glyph on hover — a
              // marker rather than a variant, because whether a cell is still
              // blank changes with the ramp's length on every edit.
              data-swatch-add={offersAdd || undefined}
              // Draws the checkerboard under the colour. Only where there IS
              // one — see the recipe.
              data-swatch-filled={color ? "" : undefined}
              // Inert only where the ramp cannot grow at all — a full ramp,
              // or a grid given no `onAdd`. There is nowhere for a colour to
              // go, so the cell says so by not lighting up.
              disabled={!color && !offersAdd}
              aria-haspopup={color ? "dialog" : undefined}
              aria-expanded={color ? openIndex === index : undefined}
              // A ramp's cells are numbered because their POSITION is what
              // distinguishes them. A one-cell grid has no position to name —
              // it is the rails' colour, or the ground's — so it takes the
              // row's own name instead of being a second "Colour 1" in a panel
              // that already has ten of them.
              aria-label={
                offersAdd
                  ? "Add a colour"
                  : (labels?.[index] ??
                    (capacity === 1 ? ariaLabel : `Colour ${index + 1}`))
              }
              className={swatchGridCellStyle}
              onClick={() => (offersAdd ? addAndOpen() : openAt(index))}
            >
              {color ? (
                <span className={swatchGridFillStyle} style={{ backgroundColor: color }} />
              ) : (
                offersAdd && <AddIcon aria-hidden className={swatchGridIconStyle} />
              )}
            </button>
          );
        })}
      </div>

      {openIndex !== null && values[openIndex] && (
        <Popover
          className={colorPickerPopover()}
          role="dialog"
          ariaLabel="Color picker"
          // Out to the body: the picker opens BESIDE the docked rail, which is
          // its own scroll container — left in flow it would be cropped at the
          // rail's edge, the one place it may not be.
          portal
          ignoreSelector={keepOpenFor}
          onDismiss={closePicker}
          containerRef={pin.ref}
          style={{ top: pin.top }}
        >
          <ColorPicker
            value={values[openIndex]}
            onValueChange={(value) => onValueChange(openIndex, value)}
            onClose={closePicker}
            // Only where there is more than one colour to lose. The schema's
            // floor is one, and a control that offers what the schema refuses
            // is a control that reports a failure the author cannot act on.
            onRemove={
              onRemove && values.length > 1
                ? () => {
                    onRemove(openIndex);
                    closePicker();
                  }
                : undefined
            }
            // The trigger is outside the popover in the tab order, so without
            // this the panel could be opened and never reached.
            autoFocus
          />
        </Popover>
      )}
    </>
  );
}
