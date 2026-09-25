"use client";

import { cx } from "../../../../styled-system/css";
import { segmentedControl, toolbar } from "../../../../styled-system/recipes";
import { OptionList, type OptionItem } from "./option-list";

export interface SegmentedControlProps {
  /** Two or three; beyond that, use a Combobox. */
  options: OptionItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Only without a surrounding `Field`: a second name would override its visible label. */
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
    // A wrapper, not the listbox itself: both classes on one element would tie on `gap` and `overflow`.
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
        // Re-picking the selected row reports `null`; a segment is only ever replaced.
        onValueChange={(next) => {
          if (next != null) onValueChange?.(next);
        }}
      >
        <OptionList.Listbox
          aria-label={ariaLabel}
          className={styles.list}
          loop
        >
          {options.map((option) => (
            <OptionList.Option
              key={option.value}
              value={option.value}
              aria-label={option.ariaLabel}
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
