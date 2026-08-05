"use client";

import { useState, type ChangeEvent } from "react";
import { cx } from "../../../../styled-system/css";
import { colorField } from "../../../../styled-system/recipes";
import {
  clampOpacity,
  formatColor,
  parseColor,
  sanitizeHex,
} from "@/utils/color-value";
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
      <span className={styles.swatch} aria-hidden>
        {/* The colour composites OVER the frame's checkerboard, so a partial
            opacity reads as partial rather than as a paler colour. */}
        <span className={styles.swatchFill} style={{ backgroundColor: value }} />
      </span>
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
        className={cx(fieldStyles.control, styles.hex, styles.opacity)}
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
    </Field.Frame>
  );
}
