"use client";

import type { ReactNode } from "react";
import { cx } from "../../../../styled-system/css";
import { segmentedControl, toolbar } from "../../../../styled-system/recipes";
import { OptionList, type OptionItem } from "./option-list";

export interface SegmentedControlOption extends OptionItem {
  /** Drawn in place of the label, which becomes its name. */
  icon?: ReactNode;
}

export interface SegmentedControlProps {
  /** Two or three; beyond that, use a Combobox. */
  options: SegmentedControlOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Only without a surrounding `Field`: a second name would override its visible label. */
  ariaLabel?: string;
  /** `hug` sizes the segments to their content, as a row of icons wants. */
  fit?: "fill" | "hug";
  className?: string;
}

export function SegmentedControl({
  options,
  value,
  defaultValue,
  onValueChange,
  ariaLabel,
  fit = "fill",
  className,
}: SegmentedControlProps) {
  const styles = segmentedControl({ fit });

  return (
    // A wrapper, not the listbox itself: both classes on one element would tie on `gap` and `overflow`.
    <div className={cx(toolbar({ size: "sm", tone: "field", fit }), className)}>
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
              aria-label={
                option.ariaLabel ?? (option.icon ? option.label : undefined)
              }
              className={styles.option}
            >
              {option.icon ?? option.label}
            </OptionList.Option>
          ))}
        </OptionList.Listbox>
      </OptionList>
    </div>
  );
}
