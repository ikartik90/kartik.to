"use client";

import { useLayoutEffect, useRef } from "react";
import { css } from "../../../../styled-system/css";
import CheckIcon from "./icons/check-small.svg";

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
  label: string;
  checked: boolean;
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

  // `indeterminate` is DOM-only; there is no attribute for it.
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
