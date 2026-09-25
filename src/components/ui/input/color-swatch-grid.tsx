"use client";

import { useId, useRef, useState } from "react";
import { css } from "../../../../styled-system/css";
import { colorPickerPopover } from "../../../../styled-system/recipes";
import { Popover } from "@/components/ui/popover";
import { usePickerPin } from "@/hooks/use-picker-pin";
import { ColorPicker } from "./color-picker";
import AddIcon from "@/assets/icons/add.svg";

export interface ColorSwatchGridProps {
  values: string[];
  /** How many cells to draw: the shader's ceiling. */
  capacity: number;
  onValueChange: (index: number, value: string) => void;
  /** Left off, the grid never offers to add. */
  onAdd?: () => void;
  /** Offered inside the picker, never on the last colour. */
  onRemove?: (index: number) => void;
  /** Names the group, and a one-cell grid's swatch; keep it distinct from section names. */
  ariaLabel: string;
  /** Per-cell names, for cells that differ by role rather than position. */
  labels?: string[];
}

// Five columns always: 5 × 36 + 4 × 8 is exactly `propertyRowField`.
const swatchGridStyle = css({
  display: "grid",
  // `1fr`, so a rail forced narrower shrinks the cells instead of overflowing.
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: "md",
  width: "token(spacing.full)",
  minWidth: 0,
});

const swatchGridCellStyle = css({
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
  backgroundColor: "field.bg.default",
  // Only under a colour: in the base it would tile across the empty cells too.
  "&[data-swatch-filled]": {
    backgroundImage:
      "conic-gradient(var(--colors-border-divider) 0deg 90deg, transparent 90deg 180deg, var(--colors-border-divider) 180deg 270deg, transparent 270deg 360deg)",
    backgroundSize: "token(spacing.md) token(spacing.md)",
  },
  // Empty: hatched with the frame's hairline, one corner-to-corner line per whole-pixel tile. Not a
  // repeating gradient, which rasterises each 0.5px line on a different subpixel phase.
  "&:not([data-swatch-filled])::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundImage:
      "linear-gradient(135deg, transparent calc(50% - 0.25px), var(--colors-field-border-default) calc(50% - 0.25px), var(--colors-field-border-default) calc(50% + 0.25px), transparent calc(50% + 0.25px))",
    backgroundSize: "token(spacing.sm) token(spacing.sm)",
  },
  "&:disabled": { cursor: "default" },
  // The frame is an overlay: an inset shadow on the cell would paint under the colour fill.
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

// A layer, because the checkerboard occupies the background.
const swatchGridFillStyle = css({ position: "absolute", inset: 0 });

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

  // Every blank offers to add; the colour still lands in the first gap.
  const canAdd = Boolean(onAdd) && values.length < capacity;

  const addIndex = values.length;

  const closePicker = () => {
    const wasOpen = openIndex;
    setOpenIndex(null);
    pin.unpin();
    if (wasOpen !== null) cellsRef.current.get(wasOpen)?.focus();
  };

  // Pressing another cell of this grid moves the picker instead of dismissing it.
  const keepOpenFor = `[data-swatch-grid="${uid}"]`;

  // Pinned to the cell the colour lands in, which may not be the one pressed.
  function addAndOpen() {
    onAdd?.();
    pin.pin(cellsRef.current.get(addIndex) ?? null);
    setOpenIndex(addIndex);
  }

  function openAt(index: number) {
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
              data-swatch-add={offersAdd || undefined}
              data-swatch-filled={color ? "" : undefined}
              disabled={!color && !offersAdd}
              aria-haspopup={color ? "dialog" : undefined}
              aria-expanded={color ? openIndex === index : undefined}
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
          // Portalled: the rail scrolls and would crop the picker.
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
            // The schema's floor is one colour.
            onRemove={
              onRemove && values.length > 1
                ? () => {
                    onRemove(openIndex);
                    closePicker();
                  }
                : undefined
            }
            // The portalled panel is otherwise unreachable by keyboard.
            autoFocus
          />
        </Popover>
      )}
    </>
  );
}
