import { useCallback, useState } from "react";

/** A value its owner holds when it passes one, or else the part holds, starting at `initial`; `onChange` hears either. */
export function useControllable<T>(value: T | undefined, initial: T, onChange?: (value: T) => void) {
  const [own, setOwn] = useState(initial);
  const held = value !== undefined;
  const set = (next: T) => {
    if (!held) setOwn(next);
    onChange?.(next);
  };
  return [held ? value : own, set] as const;
}

/**
 * Whether a popover is open, from `defaultOpen`. One open from the start stays open through presses outside it
 * (`outside` is false) until it's opened or shut itself, so a page showing its Active state keeps showing it.
 */
export function useOpen(defaultOpen: boolean) {
  const [open, setShown] = useState(defaultOpen);
  const [kept, setKept] = useState(defaultOpen);
  const setOpen = useCallback((next: boolean) => {
    setKept(false);
    setShown(next);
  }, []);
  return { open, setOpen, outside: !kept };
}
