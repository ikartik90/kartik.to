"use client";

import { useLayoutEffect, useRef } from "react";
import { css } from "../../../../styled-system/css";
import CheckIcon from "./icons/check-small.svg";

// ---------------------------------------------------------------------------
// The candidate tables' checkbox (the source's Checkbox, Figma 73:3044): a
// 16px box of white veil ruled in the border, 2px inside a 20px square.
// Checked, it shows the ink check the source's component keeps hidden in the
// box (its `check-small`); mixed — the header's, with some rows selected but
// not all — a dash.
//
// A native checkbox lies unseen over the whole square, so it is clicked,
// focused and read as a checkbox; its keyboard focus rings the box.
// ---------------------------------------------------------------------------

const boxStyle = css({
  position: "relative",
  display: "block",
  width: "16px",
  height: "16px",
  margin: "2px",
  borderRadius: "4px",
  backgroundColor: "var(--cashby-veil)",
  boxShadow: "inset 0 0 0 var(--cashby-rule) var(--cashby-border)",
  "html[data-keyboard-focus] &": {
    "&:has(:focus-visible)": {
      boxShadow:
        "inset 0 0 0 var(--cashby-rule) var(--cashby-border), var(--cashby-focus-ring)",
    },
  },
});

const inputStyle = css({
  position: "absolute",
  inset: "-2px",
  margin: 0,
  appearance: "none",
  opacity: 0,
});

// The check's own 20px square, on the box's centre.
const checkStyle = css({
  position: "absolute",
  inset: "-2px",
  pointerEvents: "none",
});

const dashStyle = css({
  position: "absolute",
  insetInline: "4px",
  insetBlockStart: "calc(50% - 0.625px)",
  height: "1.25px",
  borderRadius: "1px",
  backgroundColor: "var(--cashby-ink)",
  pointerEvents: "none",
});

export interface CheckboxProps {
  /** What checking it selects, as a screen reader reads it. */
  label: string;
  checked: boolean;
  /** Some of what it stands for is selected, but not all. */
  mixed?: boolean;
  onChange: () => void;
  id?: string;
}

export function Checkbox({
  label,
  checked,
  mixed = false,
  onChange,
  id,
}: CheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Only the DOM can say mixed.
  useLayoutEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = mixed;
  }, [mixed]);

  return (
    <span className={boxStyle}>
      {checked ? (
        <CheckIcon aria-hidden className={checkStyle} />
      ) : (
        mixed && <span aria-hidden className={dashStyle} />
      )}
      <input
        ref={inputRef}
        id={id}
        type="checkbox"
        aria-label={label}
        className={inputStyle}
        checked={checked}
        onChange={onChange}
      />
    </span>
  );
}
