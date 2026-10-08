import { useEffect, useState, type RefObject } from "react";
import { FADE, fadeBelow } from "./figure";

// Until the words are measured.
const NO_DOTS = "linear-gradient(transparent, transparent)";

/**
 * A mask for a `Dots` filling the words' offset parent: clear behind the words, fading in under their foot as a
 * project card's ground under its heading. Layout offsets, so the sheet's opening transform doesn't skew them.
 */
export function useFadeUnder(words: RefObject<HTMLElement | null>, on = true) {
  const [foot, setFoot] = useState(0);

  useEffect(() => {
    const text = words.current;
    if (!on || !text) return;
    const measure = () => setFoot(text.offsetTop + text.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(text);
    if (text.offsetParent) observer.observe(text.offsetParent);
    return () => observer.disconnect();
  }, [on, words]);

  if (!on) return undefined;
  return foot ? fadeBelow(foot, FADE, 1) : NO_DOTS;
}
