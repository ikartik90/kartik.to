"use client";

import { cx } from "../../../../styled-system/css";
import { segmentedControl, toolbar } from "../../../../styled-system/recipes";
import { OptionList, type OptionItem } from "./option-list";

export interface ToggleBarProps {
  /** A short row; beyond four or five, use a list. */
  options: OptionItem[];
  value: string[];
  onValueChange?: (value: string[]) => void;
  /** Whether the last pressed toggle may be released; otherwise that press is ignored. */
  allowEmpty?: boolean;
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
      // In the options' order, so two bars in the same state hold equal arrays.
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
    // A wrapper, as in SegmentedControl: both classes on one element would tie on `gap` and `overflow`.
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
