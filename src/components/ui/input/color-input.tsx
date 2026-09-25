"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";
import { cx } from "../../../../styled-system/css";
import {
  colorField,
  colorPickerPopover,
  comboboxPopover,
} from "../../../../styled-system/recipes";
import { Popover } from "@/components/ui/popover";
import { usePickerPin } from "@/hooks/use-picker-pin";
import {
  clampOpacity,
  formatColor,
  parseColor,
  sanitizeHex,
} from "@/utils/color-value";
import { ColorPicker } from "./color-picker";
import { Field, useField } from "./field";

export interface ColorInputProps {
  /** The colour, as `#RRGGBBAA`. */
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  /** Applied to the field frame. */
  className?: string;
}

export function ColorInput({
  value,
  onValueChange,
  disabled = false,
  className,
}: ColorInputProps) {
  // Only the hex may be `Field.Control` (it takes the id), so the opacity input borrows its styles.
  const { styles: fieldStyles } = useField("ColorInput");
  const styles = colorField();
  const committed = parseColor(value);

  // Drafts, because both inputs are lossy: deriving from `value` would pad `FF` mid-keystroke.
  // `null` shows the committed value, so an edit from elsewhere still lands.
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const [opacityDraft, setOpacityDraft] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const pin = usePickerPin();
  const uid = useId();
  const swatchRef = useRef<HTMLButtonElement>(null);

  const closePicker = () => {
    setOpen(false);
    pin.unpin();
    swatchRef.current?.focus();
  };

  // Pressing this swatch toggles; a neighbouring swatch closes this picker.
  const keepOpenFor = `[data-color-swatch="${uid}"]`;

  const dismiss = () => {
    // The portalled format menu lies outside this picker; while it is open, it owns dismissal.
    if (document.querySelector(`.${comboboxPopover()}`)) return;
    closePicker();
  };

  const hex = hexDraft ?? committed.hex;
  const opacity = opacityDraft ?? String(committed.opacity);

  function commitHex(event: ChangeEvent<HTMLInputElement>) {
    const next = sanitizeHex(event.target.value);
    setHexDraft(next);
    onValueChange(formatColor(next, committed.opacity));
  }

  function commitOpacity(event: ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/[^0-9]/g, "").slice(0, 3);
    setOpacityDraft(digits);
    // An emptied field is mid-edit, not zero.
    if (digits === "") return;
    onValueChange(formatColor(hex, clampOpacity(Number(digits))));
  }

  return (
    <Field.Frame className={className}>
      <button
        ref={swatchRef}
        type="button"
        // With `aria-expanded`, keeps the field lit while the picker is open.
        data-control
        data-color-swatch={uid}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Edit colour"
        disabled={disabled}
        className={styles.swatch}
        onClick={() => {
          setOpen((wasOpen) => {
            // Read before the panel exists, off the swatch as it stands.
            if (wasOpen) pin.unpin();
            else pin.pin(swatchRef.current);
            return !wasOpen;
          });
        }}
      >
        <span
          className={styles.swatchFill}
          style={{ backgroundColor: value }}
        />
      </button>
      <span className={styles.separator} aria-hidden />
      <Field.Control
        value={hex}
        onChange={commitHex}
        disabled={disabled}
        className={styles.hex}
        placeholder="000000"
        spellCheck={false}
        autoComplete="off"
        inputMode="text"
        maxLength={7}
        onBlur={() => setHexDraft(null)}
      />
      <span className={styles.separator} aria-hidden />
      <input
        type="text"
        // Lights the frame too; no `id`, since the label points at the hex alone.
        data-control
        aria-label="Opacity, percent"
        value={opacity}
        onChange={commitOpacity}
        disabled={disabled}
        className={cx(fieldStyles.control, styles.opacity)}
        spellCheck={false}
        autoComplete="off"
        inputMode="numeric"
        maxLength={3}
        onBlur={() => {
          setOpacityDraft(null);
          if (opacityDraft !== null && opacityDraft !== "") {
            onValueChange(formatColor(hex, clampOpacity(Number(opacityDraft))));
          }
        }}
      />

      {open && (
        <Popover
          className={colorPickerPopover()}
          role="dialog"
          ariaLabel="Color picker"
          // Portalled: the rail scrolls (`overflow: auto`) and would crop the picker.
          portal
          ignoreSelector={keepOpenFor}
          onDismiss={dismiss}
          containerRef={pin.ref}
          style={{ top: pin.top }}
        >
          <ColorPicker
            value={value}
            onValueChange={onValueChange}
            onClose={closePicker}
            disabled={disabled}
            // The portalled panel is otherwise unreachable by keyboard.
            autoFocus
          />
        </Popover>
      )}
    </Field.Frame>
  );
}
