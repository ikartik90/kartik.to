/**
 * Hold the page's scroll position across a modal `<dialog>` closing.
 *
 * Safari zeroes the page scroll roughly two frames AFTER a modal dialog closes.
 * Measured in Safari 26.6 with everything else held still — no theme change, no
 * cmdk interaction, nothing of ours touching `scrollTop`:
 *
 *   showModal() then close()   700 -> 700 at 16ms -> 0 at 40ms
 *   closed via cancel          700 -> 700 at 13ms -> 0 at 30ms
 *   never opened (control)     700, and stays there
 *
 * It is the close that does it, not anything the dialog contained, and it holds
 * whichever element is the scroll container — demoting `<body>` so the viewport
 * scrolls instead changes nothing. Chromium does not do it at all.
 *
 * The position is still correct in the `close` handler itself, so the repair is
 * to read it there and put it back when the clobber lands. Watching for it —
 * rather than writing the value back unconditionally — is what keeps this from
 * becoming a second bug in every other browser: where nothing zeroes the
 * scroll, nothing is ever written.
 */

/** The page's scroll position, as a seam the tests can stand in for. */
export interface PageScroll {
  read(): number;
  write(y: number): void;
}

export const domPageScroll: PageScroll = {
  // Whichever of these is the scroll container answers; the others sit at 0.
  // `<body>` is the one that scrolls on this site (Panda's preflight sizes it
  // to `height: 100%`, and `overflow-x: hidden` in globals.css makes that
  // viewport-tall box the scroller), but reading all three keeps this honest if
  // that ever changes.
  read: () =>
    document.body.scrollTop ||
    document.documentElement.scrollTop ||
    window.scrollY,
  write: (y) => {
    document.body.scrollTop = y;
    document.documentElement.scrollTop = y;
  },
};

/**
 * Twelve frames ≈ 200ms at 60Hz. The clobber lands by frame 3, so this is
 * generous; the cost of the slack is a handful of no-op reads on browsers that
 * never clobber at all.
 */
const FRAME_BUDGET = 12;

/** Events that mean the visitor has taken over, and the watch should stand down. */
const HANDOVER_EVENTS = ["wheel", "touchmove", "keydown"] as const;

export function preservePageScroll(scroll: PageScroll = domPageScroll): void {
  const target = scroll.read();
  // Already at the top: there is nothing a reset could take away.
  if (target <= 0) return;

  let frames = 0;
  let watching = true;

  const standDown = () => {
    watching = false;
    for (const event of HANDOVER_EVENTS) {
      window.removeEventListener(event, standDown);
    }
  };

  for (const event of HANDOVER_EVENTS) {
    window.addEventListener(event, standDown, { passive: true });
  }

  const tick = () => {
    if (!watching) return;
    if (scroll.read() === 0) {
      scroll.write(target);
      standDown();
      return;
    }
    if (++frames >= FRAME_BUDGET) {
      standDown();
      return;
    }
    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}
