// Safari zeroes the page scroll ~2 frames after a modal <dialog> closes. The position is
// read on close and written back only if it gets zeroed, so other browsers are untouched.

/** A seam the tests stand in for. */
export interface PageScroll {
  read(): number;
  write(y: number): void;
}

export const domPageScroll: PageScroll = {
  // Whichever is the scroll container answers (here, `<body>`); the others read 0.
  read: () =>
    document.body.scrollTop ||
    document.documentElement.scrollTop ||
    window.scrollY,
  write: (y) => {
    document.body.scrollTop = y;
    document.documentElement.scrollTop = y;
  },
};

/** ≈200ms at 60Hz; the clobber lands by frame 3. */
const FRAME_BUDGET = 12;

const HANDOVER_EVENTS = ["wheel", "touchmove", "keydown"] as const;

export function preservePageScroll(scroll: PageScroll = domPageScroll): void {
  const target = scroll.read();
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
