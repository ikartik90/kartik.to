"use client";

import { useEffect, useRef } from "react";

const CHARS_PER_SECOND = 50;

/** Types `text` into a field a character at a time, so a scenario's note fills itself in. */
export function useTypedNote(onChange: (text: string) => void) {
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearInterval(timer.current), []);
  return (text: string) => {
    window.clearInterval(timer.current);
    let shown = 0;
    timer.current = window.setInterval(() => {
      shown += 1;
      onChange(text.slice(0, shown));
      if (shown >= text.length) window.clearInterval(timer.current);
    }, 1000 / CHARS_PER_SECOND);
  };
}
