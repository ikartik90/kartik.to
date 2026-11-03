"use client";

import { useEffect, useState } from "react";

/** True `delay` ms after `on` turns true, and false the moment it turns false. */
export function useDelayedOn(on: boolean, delay: number) {
  const [waited, setWaited] = useState(false);
  // Reset while rendering, so the next time `on` turns true the wait starts over.
  if (!on && waited) setWaited(false);

  useEffect(() => {
    if (!on) return;
    const timer = setTimeout(() => setWaited(true), delay);
    return () => clearTimeout(timer);
  }, [on, delay]);

  return on && waited;
}
