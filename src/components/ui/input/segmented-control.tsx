"use client";

import { cx } from "../../../../styled-system/css";
import { segmentedControl, toolbar } from "../../../../styled-system/recipes";
import { OptionList, type OptionItem } from "./option-list";

// ---------------------------------------------------------------------------
// SegmentedControl — a short single-select with every choice on show, as one
// row of a form (Figma 885:1963):
//
//   <Field size="sm">
//     <Field.Label>Object Fit</Field.Label>
//     <SegmentedControl
//       options={[{ value: "cover", label: "Cover" }, …]}
//       value={fit}
//       onValueChange={setFit}
//     />
//   </Field>
//
// Composed rather than drawn. The BOX is the shared `toolbar` at `size="sm"` —
// 28px, no inset, no gap, items squared and the rail clipping the row's ends to
// its own 4px corner, which is exactly the continuous-bar look a segmented
// control wants — on the `field` tone, so it takes the field family's fill and
// hairline and lines up with the text inputs and sliders stacked above it. The
// OPTIONS are `OptionList`'s, which already paint `field.bg.active` +
// `field.text.active` for `aria-selected` and the neutral wash on hover. The
// only thing left to say is that the segments stretch, which is
// `segmentedControl`.
//
// A LISTBOX, not a toolbar: exactly one option is on and picking a second
// releases the first, which is `aria-selected` on a `role="listbox"` and gets
// the roving arrow-key cursor for free. `OptionList.Toolbar` is the multi-toggle
// sibling — right for a formatting bar where bold and italic are independent,
// wrong here.
//
// It brings no label of its own. Composed into a `Field` it borrows that
// field's label id the way every other control in the family does, so a row in
// the properties panel is labelled once, natively. `ariaLabel` is the fallback
// for a standalone one with no Field around it.
// ---------------------------------------------------------------------------

export interface SegmentedControlProps {
  /** The segments, left to right. Two or three — beyond that use a Combobox. */
  options: OptionItem[];
  /** Controlled value. */
  value?: string;
  /** Initial value when uncontrolled. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /**
   * Names the control when there is no `Field` around it to borrow a label
   * from. Omit inside a `Field` — the field's own label already names it, and a
   * second name would win over the visible one.
   */
  ariaLabel?: string;
  className?: string;
}

export function SegmentedControl({
  options,
  value,
  defaultValue,
  onValueChange,
  ariaLabel,
  className,
}: SegmentedControlProps) {
  const styles = segmentedControl();

  return (
    // The rail is a wrapper rather than the listbox itself: the listbox already
    // carries the option list's own inline-row class, and putting the toolbar's
    // on the same element would put `gap` and `overflow` in a same-layer tie
    // that emission order, not intent, would settle.
    <div
      className={cx(
        toolbar({ size: "sm", tone: "field", fit: "fill" }),
        className,
      )}
    >
      <OptionList
        direction="inline"
        value={value}
        defaultValue={defaultValue}
        // A segment is never released, only replaced — the option list reports
        // `null` when the selected row is re-picked, and a control with no
        // segment on is not a state this has.
        onValueChange={(next) => {
          if (next != null) onValueChange?.(next);
        }}
      >
        <OptionList.Listbox
          aria-label={ariaLabel}
          className={styles.list}
          // Wraps, because the row is short and both ends are one key apart:
          // arrowing off the last segment should land on the first rather than
          // stop dead.
          loop
        >
          {options.map((option) => (
            <OptionList.Option
              key={option.value}
              value={option.value}
              className={styles.option}
            >
              {option.label}
            </OptionList.Option>
          ))}
        </OptionList.Listbox>
      </OptionList>
    </div>
  );
}
