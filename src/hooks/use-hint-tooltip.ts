"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCursorTooltip } from "./use-cursor-tooltip";

// A self-limiting cursor tooltip: withdraws after `duration`, and `retire()` puts it
// away for good. `dock()` shows it with no cursor, at the foot of the screen.

export const HINT_TOOLTIP_MS = 3000;

export function useHintTooltip(duration: number = HINT_TOOLTIP_MS) {
  const [visible, setVisible] = useState(false);
  const [docked, setDocked] = useState(false);
  const spent = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);
  const { ref, seed } = useCursorTooltip(visible, docked);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setVisible(false);
  }, []);

  // Via a ref, so `show` keeps one identity when `duration` is passed inline.
  const durationRef = useRef(duration);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  const open = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setVisible(true);
    timer.current = setTimeout(hide, durationRef.current);
  }, [hide]);

  const show = useCallback(
    (x: number, y: number) => {
      if (spent.current) return;
      setDocked(false);
      seed(x, y);
      open();
    },
    [seed, open],
  );

  const dock = useCallback(() => {
    if (spent.current) return;
    setDocked(true);
    open();
  }, [open]);

  const retire = useCallback(() => {
    spent.current = true;
    hide();
  }, [hide]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { ref, visible, docked, show, dock, hide, retire };
}
