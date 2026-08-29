"use client";

import { cx } from "../../../../styled-system/css";
import { segmentedControl, toolbar } from "../../../../styled-system/recipes";
import { OptionList, type OptionItem } from "./option-list";

// ---------------------------------------------------------------------------
// ToggleBar — the MULTI-select sibling of `SegmentedControl`: one row, every
// choice on show, any combination of them on.
//
//   <Field size="sm">
//     <Field.Label>Direction</Field.Label>
//     <ToggleBar
//       ariaLabel="Direction"
//       options={[{ value: "up", label: "Up" }, …]}
//       value={directions}
//       onValueChange={setDirections}
//     />
//   </Field>
//
// Same BOX as its sibling, down to the recipe — the shared `toolbar` rail at
// `size="sm"` on the `field` tone, with `segmentedControl` stretching the
// items to an equal share of it. Two controls that sit in the same panel and
// mean "pick from this short row" should not be two different shapes; what
// differs between them is what a press MEANS, and that is the part below.
//
// A TOOLBAR, not a listbox, and that is the whole difference: these choices are
// independent, so each button carries its own `aria-pressed` and a press
// toggles it alone. `OptionList.Listbox` is the single-select sibling — right
// where picking a second choice releases the first, wrong here.
//
// It brings no visible label of its own; composed into a `Field` the row is
// labelled once by that field. `ariaLabel` names the GROUP of buttons for
// assistive tech, which is a different job from naming the row and does not
// override it — each button already carries its own name.
// ---------------------------------------------------------------------------

export interface ToggleBarProps {
  /** The toggles, left to right. A short row — beyond four or five, use a list. */
  options: OptionItem[];
  /** Controlled value: every pressed option, in the caller's own order. */
  value: string[];
  onValueChange?: (value: string[]) => void;
  /**
   * Whether the LAST pressed toggle may be released, emptying the bar.
   *
   * Off by default, because for most of what a row like this controls "none of
   * them" is not a setting — it is the control switched off, wearing the same
   * face as a setting. Releasing the last one is then ignored, exactly as
   * re-picking a `SegmentedControl`'s selected segment is: the press does
   * nothing rather than the button pretending it cannot be pressed.
   */
  allowEmpty?: boolean;
  /** Names the row of buttons for assistive tech. */
  ariaLabel: string;
  className?: string;
}

export function ToggleBar({
  options,
  value,
  onValueChange,
  allowEmpty = false,
  ariaLabel,
  className,
}: ToggleBarProps) {
  const styles = segmentedControl();
  const pressed = new Set(value);

  const toggle = (option: string) => {
    if (!pressed.has(option)) {
      // Added in the OPTIONS' order rather than appended, so the value reads
      // the way the row does however it was arrived at — and two bars in the
      // same state hold equal arrays, which is what lets a caller compare them.
      onValueChange?.(
        options.map((entry) => entry.value).filter((entry) =>
          entry === option ? true : pressed.has(entry),
        ),
      );
      return;
    }
    if (!allowEmpty && pressed.size === 1) return;
    onValueChange?.(value.filter((entry) => entry !== option));
  };

  return (
    // The rail is a wrapper rather than the toolbar itself, for the reason
    // `SegmentedControl` gives: the behavior container already carries the
    // option list's inline-row class, and putting the rail's on the same
    // element would leave `gap` and `overflow` to be settled by emission order.
    <div
      className={cx(
        toolbar({ size: "sm", tone: "field", fit: "fill" }),
        className,
      )}
    >
      <OptionList direction="inline">
        <OptionList.Toolbar aria-label={ariaLabel} className={styles.list}>
          {options.map((option) => (
            <OptionList.Option
              key={option.value}
              value={option.value}
              className={styles.option}
              pressed={pressed.has(option.value)}
              onClick={() => toggle(option.value)}
            >
              {option.label}
            </OptionList.Option>
          ))}
        </OptionList.Toolbar>
      </OptionList>
    </div>
  );
}
