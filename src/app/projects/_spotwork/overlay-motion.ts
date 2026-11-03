import {
  CLOSE_EASE,
  CLOSE_MS,
  fromFirstFrame,
  OPEN_EASE,
  OPEN_MS,
  reducedMotion,
  slideOf,
  stepIn,
} from "./opening";
import { PAGE_OPENING } from "@/data/page-opening";

// The overlay's opening: its ground fades in as the window slides up, then its controls rise in together as the About
// sheet's cards come in from the right, or up from below when the sheet lies under the window, a step apart. Closing fades the ground as the rest drops. Each part is marked
// with its `data-overlay-motion`.

type Part = "ground" | "window" | "controls" | "cards";

const partsOf = (root: Element, part: Part) => [
  ...root.querySelectorAll<HTMLElement>(`[data-overlay-motion="${part}"]`),
];

// With the comments over the app, which only fade: they're placed with a transform.
const groundOf = (root: Element) => [
  ...partsOf(root, "ground"),
  ...root.querySelectorAll<HTMLElement>("[data-comment]"),
];

const cardsOf = (root: Element) =>
  partsOf(root, "cards")
    .flatMap((column) => [...column.children] as HTMLElement[])
    .filter((card) => card.getBoundingClientRect().left < window.innerWidth);

/**
 * Plays the overlay's opening, held at its start through its first two frames: the second, drawing the app and its
 * shader, can take as long as a third of the opening.
 */
export function openOverlay(root: HTMLDialogElement) {
  if (reducedMotion()) return [];
  const timing = { duration: OPEN_MS, easing: OPEN_EASE };
  const step = PAGE_OPENING.lineGapMs;
  const opening = [
    root.animate([{ opacity: 0 }, { opacity: 1 }], { pseudoElement: "::backdrop", ...timing, fill: "forwards" }),
    // To whatever each rests at.
    ...groundOf(root).map((el) => el.animate([{ opacity: 0, offset: 0 }], timing)),
    ...partsOf(root, "window").map((el) =>
      el.animate(
        [
          { opacity: 0, translate: `0px ${slideOf(el)}px` },
          { opacity: 1, translate: "0px 0px" },
        ],
        timing,
      ),
    ),
    ...partsOf(root, "controls").map((el) => stepIn(el, step)),
    ...cardsOf(root).map((card, i) => stepIn(card, (i + 1) * step, card.closest("[data-upright]") ? "below" : "right")),
  ];
  opening.forEach((animation) => animation.pause());
  requestAnimationFrame(() => fromFirstFrame(opening));
  return opening;
}

/** Plays the overlay's closing from wherever its `opening` had got to, then calls `close`. */
export function closeOverlay(root: HTMLDialogElement, opening: Animation[], close: () => void) {
  if (reducedMotion()) return close();
  const ground = groundOf(root);
  const drops = [...partsOf(root, "window"), ...partsOf(root, "controls"), ...cardsOf(root)];
  const drawn = (el: Element) => {
    const style = getComputedStyle(el);
    return {
      opacity: style.opacity,
      translate: style.translate === "none" ? "0px 0px" : style.translate,
      filter: style.filter === "none" ? "blur(0px)" : style.filter,
    };
  };
  const shade = getComputedStyle(root, "::backdrop").opacity;
  const from = new Map([...ground, ...drops].map((el) => [el, drawn(el)]));
  opening.forEach((animation) => animation.cancel());

  const timing = { duration: CLOSE_MS, easing: CLOSE_EASE, fill: "forwards" } as const;
  const backdrop = root.animate([{ opacity: shade }, { opacity: 0 }], { pseudoElement: "::backdrop", ...timing });
  const closing = [
    backdrop,
    ...ground.map((el) => el.animate([{ opacity: from.get(el)!.opacity }, { opacity: 0 }], timing)),
    ...drops.map((el) =>
      el.animate([from.get(el)!, { opacity: 0, translate: `0px ${slideOf(el)}px`, filter: "blur(0px)" }], timing),
    ),
  ];
  // The backdrop's last frame is let go only once the dialog has gone, or it could show again for a frame.
  const done = () => {
    close();
    requestAnimationFrame(() => backdrop.cancel());
  };
  Promise.all(closing.map((animation) => animation.finished)).then(done, done);
}
