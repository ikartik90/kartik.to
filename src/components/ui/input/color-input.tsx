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

// ---------------------------------------------------------------------------
// ColorInput — the colour archetype of the field family, composed INTO a
// <Field> exactly like Slider and Switch:
//
//   <Field size="sm">
//     <Field.Label>Color 1</Field.Label>
//     <ColorInput value="#FFAB6FFF" onValueChange={setColor} />
//   </Field>
//
// It brings no surface of its own — it renders the shared field frame and draws
// a swatch, a hex input, an opacity input and the two hairlines between them,
// so it wears the same fill, border and focus accent as the sliders it is
// stacked with.
//
// ONE value in, one value out: `#RRGGBBAA`. The split into "six digits and a
// percentage" is a fact about the EDITOR, not about the colour, so it lives
// here and never reaches the document — see `@/utils/color-value`.
//
// The swatch is also the field's TRIGGER: pressing it opens the ColorPicker
// beside the properties rail (Figma 1066:2338). The picker speaks the same
// `#RRGGBBAA` this field does, so the two are simply two ends of one value —
// type it here, or reach for it there, and neither has to know about the other.
// ---------------------------------------------------------------------------

export interface ColorInputProps {
  /** The colour, as `#RRGGBBAA`. */
  value: string;
  /** Fired with the recombined `#RRGGBBAA` on every keystroke in either input. */
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
  // The field's own slot styles — the opacity input is a raw <input> (only the
  // hex may be `Field.Control`, which claims the field's id), so it has to be
  // handed the same control reset that `Field.Control` applies internally.
  const { styles: fieldStyles } = useField("ColorInput");
  const styles = colorField();
  const committed = parseColor(value);

  // Drafts, because both inputs are lossy on the way out and the round trip
  // would fight the typist. `formatColor` pads a short hex, so deriving the
  // field straight from `value` would rewrite `FF` to `FF0000` on the second
  // keystroke and park the caret after it; the opacity input has the same
  // problem with an emptied field, which would snap back to 100 before the new
  // number could be typed. `null` means "show the committed value" — so an
  // edit from elsewhere (a preset, an undo) still lands in the field.
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const [opacityDraft, setOpacityDraft] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  // Where the picker opens, read off this swatch ONCE. See the hook: the panel
  // used to track the swatch through the rail's scroll, and now holds still.
  const pin = usePickerPin();
  const uid = useId();
  const swatchRef = useRef<HTMLButtonElement>(null);

  const closePicker = () => {
    setOpen(false);
    pin.unpin();
    // Back to the swatch, not the hex box: the trigger is where the keyboard
    // left off, and it is still the thing the picker belongs to.
    swatchRef.current?.focus();
  };

  // The one press outside the picker that must NOT dismiss it: THIS swatch, so
  // pressing it again toggles rather than closing-then-reopening. Only this
  // one — a press on a NEIGHBOURING colour's swatch does close this picker,
  // which is what keeps two of them from standing on the same CSS anchor name.
  const keepOpenFor = `[data-color-swatch="${uid}"]`;

  const dismiss = () => {
    // The format menu is a popover of its own, nested inside this one — and
    // portalled, so a press on it lands OUTSIDE this picker and would dismiss
    // the whole thing. While the menu is up it owns the dismissal: closing it
    // is what a press or an Escape means. (Escape is already the menu's alone —
    // `useDismiss` gives it to the surface opened last — so this guard is now
    // the pointer's.) The class comes from the recipe rather than being written
    // out, so the two cannot drift apart.
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
    // Digits only: the field owns the `%`, exactly as it owns the `#`.
    const digits = event.target.value.replace(/[^0-9]/g, "").slice(0, 3);
    setOpacityDraft(digits);
    // An emptied field is still being typed in, so it must not be committed as
    // zero — the swatch would blink transparent between "1" and "10".
    if (digits === "") return;
    onValueChange(formatColor(hex, clampOpacity(Number(digits))));
  }

  return (
    <Field.Frame className={className}>
      <button
        ref={swatchRef}
        type="button"
        // Carries `data-control` for the same reason the opacity box does: the
        // field lights up while it is engaged. `aria-expanded` is in that same
        // selector, so the field stays lit for as long as the picker is open —
        // the Combobox trigger's arrangement exactly.
        data-control
        data-color-swatch={uid}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Edit colour"
        disabled={disabled}
        className={styles.swatch}
        onClick={() => {
          setOpen((wasOpen) => {
            // Read BEFORE the panel exists, off the swatch as it stands now.
            if (wasOpen) pin.unpin();
            else pin.pin(swatchRef.current);
            return !wasOpen;
          });
        }}
      >
        {/* The colour composites OVER the frame's checkerboard, so a partial
            opacity reads as partial rather than as a paler colour. */}
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
        // The field's own `#` is drawn, not typed. Pasting one is fine —
        // `sanitizeHex` strips it wherever it lands.
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
        // Carries `data-control` so the frame lights up for THIS input too —
        // the field recipe keys its active state off any `[data-control]` in
        // focus, and without it editing the opacity would leave the field
        // looking untouched. It deliberately does not take the field's `id`:
        // a label may point at only one control, and that is the hex.
        data-control
        aria-label="Opacity, percent"
        value={opacity}
        onChange={commitOpacity}
        disabled={disabled}
        // The `opacity` slot IS the slider's value box (one `fieldValueBox` in
        // the config), so the two field types are the same number in the same
        // place — `hex` no longer has anything to lend it.
        className={cx(fieldStyles.control, styles.opacity)}
        spellCheck={false}
        autoComplete="off"
        inputMode="numeric"
        maxLength={3}
        // Snapping back on blur is what makes an emptied or out-of-range field
        // resolve: the draft goes, and the committed value paints instead.
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
          // Out to the body: the picker opens BESIDE the docked rail, and the
          // rail is its own scroll container with `overflow: auto` — left in
          // flow it would be cropped at the rail's edge, which is the one place
          // it is not allowed to be. CSS anchor positioning still pins it to
          // the swatch across the portal.
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
            // The trigger is outside the popover in the tab order, so without
            // this the panel could be opened and never reached.
            autoFocus
          />
        </Popover>
      )}
    </Field.Frame>
  );
}
