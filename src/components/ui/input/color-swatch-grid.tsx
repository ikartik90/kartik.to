"use client";

import { useId, useRef, useState } from "react";
import {
  colorPickerPopover,
  colorSwatchGrid,
} from "../../../../styled-system/recipes";
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

export function ColorSwatchGrid({
  values,
  capacity,
  onValueChange,
  onAdd,
  onRemove,
  ariaLabel,
  labels,
}: ColorSwatchGridProps) {
  const styles = colorSwatchGrid();
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
      <div className={styles.grid} role="group" aria-label={ariaLabel}>
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
              className={styles.cell}
              onClick={() => (offersAdd ? addAndOpen() : openAt(index))}
            >
              {color ? (
                <span className={styles.fill} style={{ backgroundColor: color }} />
              ) : (
                offersAdd && <AddIcon aria-hidden className={styles.icon} />
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
