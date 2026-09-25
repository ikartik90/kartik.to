"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { css, cx } from "../../styled-system/css";
import ShuffleIcon from "@/assets/icons/shuffle.svg";
import type { Testimonial } from "@/domain/testimonial";
import {
  SKYLINE_VIEWBOX_HEIGHT,
  SKYLINE_VIEWBOX_WIDTH,
  skylineTopAt,
} from "@/data/skyline-profile";
import { TestimonialQuote } from "./testimonial-quote";
import { Button } from "./ui/button";
import { Tooltip } from "./ui/tooltip";
import { Typography } from "./ui/typography";

/** Odd, so the tower has a middle column. */
const COLUMNS = 5;

const ROTATION_MS = 8000;

const FADE_MS = 350;

/** 3·2·1·2·3; the rest wait off the band (see `rotate`). */
const BAND_SIZE = 11;

/** Moves the `edge` card to `middle`; with a queue, the middle card joins its back and the front takes the edge. */
function rotate<T>(order: T[], edge: number, middle: number): T[] {
  const next = [...order];
  if (order.length <= BAND_SIZE) {
    [next[edge], next[middle]] = [order[middle], order[edge]];
    return next;
  }
  next[middle] = order[edge];
  next[edge] = order[BAND_SIZE];
  return [
    ...next.slice(0, BAND_SIZE),
    ...order.slice(BAND_SIZE + 1),
    order[middle],
  ];
}

/**
 * One card in the centre column (clear of the tower), the rest middle-outwards two deep,
 * then edges only. Deterministic, so the server and the client deal the same hand.
 */
export function dealIntoColumns<T>(items: T[], columns = COLUMNS): T[][] {
  const centre = Math.floor(columns / 2);
  const dealt: T[][] = Array.from({ length: columns }, () => []);
  if (items.length === 0) return dealt;

  dealt[centre].push(items[0]);

  // Nearest the middle first, left before right on a tie, so the order is stable.
  const outwards = Array.from({ length: columns }, (_, i) => i)
    .filter((i) => i !== centre)
    .sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre) || a - b);
  const edges = [0, columns - 1];

  items.slice(1).forEach((item, i) => {
    const seat =
      i < 2 * outwards.length
        ? outwards[i % outwards.length]
        : edges[(i - 2 * outwards.length) % edges.length];
    dealt[seat].push(item);
  });

  return dealt;
}

/** 96px, the homepage's gap above the grid; held per column against the skyline beneath it. */
const SKYLINE_CLEARANCE = "calc({spacing.5xl} + {spacing.xl})";

/** The footer's top padding plus half the skyline, so the cards stand in front of the rooflines. */
const OVERLAP = "calc({spacing.5xl} + {sizes.siteFooter} * 0.5)";

/** From the band's bottom up to the antenna tip; nothing in the middle column may reach into it. */
const TOWER_ZONE = `calc(${OVERLAP} - {spacing.5xl} - {sizes.skylineTowerTip})`;

/** The static fallback until `useSkylineClearance` measures; safe, since the tower is the tallest thing. */
const TOWER_CLEARANCE = `calc(${TOWER_ZONE} + ${SKYLINE_CLEARANCE})`;

const EDGE_FADE = "clamp(24px, 5vw, 120px)";

const BLEED = "clamp(24px, 8vw, 200px)";

const bandStyle = css({
  // Never squashed by the body's flex column, which would leave cards hanging out of the box.
  flexShrink: 0,
  marginBlockStart: "5xl",
  marginBlockEnd: "3xl",

  md: {
    // Its own layer, or the footer after it paints over the cards.
    position: "relative",
    zIndex: 1,
    // A negative margin, not a pull on `SiteFooter`, which is shared and unaware of this.
    marginBlockEnd: `calc(-1 * (${OVERLAP}))`,
    maskImage: `linear-gradient(to right, transparent, black ${EDGE_FADE}, black calc(100% - ${EDGE_FADE}), transparent)`,
    maskRepeat: "no-repeat",
    // 500% tall, so tooltips and glows painted outside the box stay inside the mask.
    maskSize: "100% 500%",
    maskPosition: "center",
  },
});

const headerStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  paddingInline: "xl",
  marginBlockEnd: "3xl",

  md: {
    // Reaches into the notch the stagger leaves over the middle column.
    marginBlockEnd: "calc({spacing.3xl} - {spacing.4xl})",
    inlineSize: "fit-content",
    marginInline: "auto",
    // Above the wall, whose box would otherwise take presses on the button's lower half.
    position: "relative",
    zIndex: 1,
  },
});

/** Band only: the phone's rail already reaches every card. */
const shuffleStyle = css({
  marginBlockStart: "lg",
  mdDown: { display: "none" },
});

const wallStyle = css({
  display: "flex",
  gap: "xl",
  overflowX: "auto",
  alignItems: "flex-start",
  scrollSnapType: "x mandatory",
  paddingInline: "xl",
  // Insets the snap positions to match, or the first card rests flush against the edge.
  scrollPaddingInline: "xl",
  // Hidden, so a classic scrollbar never takes height from the cards; both forms for cross-browser.
  scrollbarWidth: "none",
  "&::-webkit-scrollbar": { display: "none" },

  md: {
    display: "grid",
    gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))`,
    // `start`: stretching would flatten the stagger margins.
    alignItems: "start",
    // At least five full columns, so the outer cards pass the screen's edge.
    inlineSize: `clamp(calc(${COLUMNS} * {sizes.testimonialCard} + ${COLUMNS - 1} * {spacing.xl}), calc(100% + 2 * ${BLEED}), calc(${COLUMNS} * {sizes.testimonialCardWide} + ${COLUMNS - 1} * {spacing.xl}))`,
    // Positioned, not negative-margined, so the band's own box (and its mask) stays page-wide.
    position: "relative",
    insetInlineStart: "half",
    transform: "translateX(-50%)",
    // Reserves room above the tower whatever the content; on the grid, which the middle column measures against.
    minBlockSize: `calc(${TOWER_CLEARANCE} + {sizes.testimonialCardTallest})`,
    // `visible`: a scroll container would clip the overlap onto the footer.
    overflowX: "visible",
    scrollSnapType: "none",
    paddingInline: "none",
  },
});

const columnStyle = css({
  // Fixed grid tracks, not flex: a flex item without a width falls back to max-content, one line wide.
  display: "grid",
  gridAutoFlow: "column",
  gridAutoColumns: "token(sizes.testimonialCard)",
  gap: "xl",
  alignItems: "start",
  // A squeezed column leaves its cards hanging into the next one; the rail scrolls instead.
  flexShrink: 0,
  margin: "none",
  padding: "none",
  listStyle: "none",

  md: {
    // Real columns, not one grid: a grid row is as tall as its tallest card and would flatten the stagger.
    display: "flex",
    flexDirection: "column",
    gap: "xl",
    minWidth: 0,
  },
});

/** The queue: the rail's tail on a phone, hidden on the band. */
const waitingStyle = css({ md: { display: "none" } });

/** How far each column hangs below the one outside it; `useSkylineClearance` then moves the whole band. */
const COLUMN_STAGGER = [
  css({ md: { marginBlockStart: "none" } }),
  css({ md: { marginBlockStart: "4xl" } }),
  css({ md: { marginBlockStart: "calc(2 * {spacing.4xl})" } }),
  css({ md: { marginBlockStart: "4xl" } }),
  css({ md: { marginBlockStart: "none" } }),
];

const cardStyle = css({
  scrollSnapAlign: "start",

  md: {
    // The mark is on the slot, not the card, so a card moved into a marked slot arrives at 0 and fades up.
    transition: `opacity ${FADE_MS}ms ease`,
    "&[data-swapping]": { opacity: 0 },
  },
});

const SLOT_ATTR = "data-testimonial-slot";
/** Which column a `<ul>` is, counting the empty ones. */
const COLUMN_ATTR = "data-testimonial-column";

/** Card tops relative to the wall, so a band moving during a swap does not read as cards moving. */
function cardTops(wall: HTMLElement): Map<number, number> {
  const base = wall.getBoundingClientRect().top;
  const tops = new Map<number, number>();
  for (const card of wall.querySelectorAll<HTMLElement>(`[${SLOT_ATTR}]`)) {
    tops.set(
      Number(card.getAttribute(SLOT_ATTR)),
      card.getBoundingClientRect().top - base,
    );
  }
  return tops;
}

/** `SKYLINE_CLEARANCE` in px; a test keeps the two equal. */
const CLEARANCE_PX = 96;

/**
 * Moves the whole band by one margin, keeping the stagger, until its closest column clears the
 * skyline by `SKYLINE_CLEARANCE` — measured with the tallest cards, so no shuffle breaks the floor.
 */
function useSkylineClearance(
  bandRef: React.RefObject<HTMLElement | null>,
  wallRef: React.RefObject<HTMLDivElement | null>,
  columnCount: number,
) {
  useLayoutEffect(() => {
    const band = bandRef.current;
    const wall = wallRef.current;
    if (!band || !wall) return;

    const place = () => {
      // Reset first, so each pass measures the stylesheet's baseline.
      band.style.marginBlockEnd = "";

      const svg = document.querySelector<SVGElement>("[data-site-footer] svg");
      if (!svg || getComputedStyle(wall).display !== "grid") return;

      const drawing = svg.getBoundingClientRect();
      if (drawing.height === 0) return;

      // `xMidYMax slice`: scaled by height, with the viewBox centre pinned to the middle.
      const scale = drawing.height / SKYLINE_VIEWBOX_HEIGHT;
      const middle = drawing.left + drawing.width / 2;
      const toViewBox = (x: number) =>
        SKYLINE_VIEWBOX_WIDTH / 2 + (x - middle) / scale;

      const tallest = [...wall.querySelectorAll<HTMLElement>(`[${SLOT_ATTR}]`)]
        .map((card) => card.getBoundingClientRect().height)
        .sort((a, b) => b - a);

      let tightest = Infinity;
      for (const column of wall.children) {
        const box = column.getBoundingClientRect();
        if (box.height === 0) continue;

        // The lowest this column could reach with any hand.
        const cards = column.childElementCount;
        const gap = Number.parseFloat(getComputedStyle(column).rowGap) || 0;
        const deepest =
          box.top +
          tallest.slice(0, cards).reduce((total, card) => total + card, 0) +
          (cards - 1) * gap;

        const top = skylineTopAt(toViewBox(box.left), toViewBox(box.right));
        tightest = Math.min(
          tightest,
          drawing.top + top * scale - Math.max(box.bottom, deepest),
        );
      }
      if (!Number.isFinite(tightest)) return;

      const overlap = Number.parseFloat(getComputedStyle(band).marginBlockEnd);
      if (Number.isNaN(overlap)) return;
      band.style.marginBlockEnd = `${overlap - (tightest - CLEARANCE_PX)}px`;
    };

    place();

    // Every column too: the wall's height is pinned by its min-block-size, so it misses a column growing.
    const observer = new ResizeObserver(place);
    observer.observe(wall);
    observer.observe(document.documentElement);
    for (const column of wall.children) observer.observe(column);
    return () => {
      observer.disconnect();
      band.style.marginBlockEnd = "";
    };
  }, [bandRef, wallRef, columnCount]);
}

/** A card cut by the window's edge (else any outer card) and a middle card, picked uniformly; never two outer cards. */
function pickTrade(wall: HTMLElement): [number, number] | null {
  const cut: number[] = [];
  const outer: number[] = [];
  const middle: number[] = [];
  for (const element of wall.querySelectorAll(`[${SLOT_ATTR}]`)) {
    const slot = Number(element.getAttribute(SLOT_ATTR));
    // Waiting off the band: brought on by `rotate`, never picked.
    const seat = element.parentElement?.getAttribute(COLUMN_ATTR);
    if (seat == null) continue;
    const column = Number(seat);
    if (column !== 0 && column !== COLUMNS - 1) {
      middle.push(slot);
      continue;
    }
    outer.push(slot);
    const box = element.getBoundingClientRect();
    if (box.left < 0 || box.right > window.innerWidth) cut.push(slot);
  }

  const pick = (from: number[]) =>
    from[Math.floor(Math.random() * from.length)];
  const from = cut.length > 0 ? cut : outer;
  if (from.length > 0 && middle.length > 0) return [pick(from), pick(middle)];

  const all = [...outer, ...middle];
  if (all.length < 2) return null;
  const first = pick(all);
  return [first, pick(all.filter((slot) => slot !== first))];
}

/** Trades a card every `ROTATION_MS`, paused for reduced motion, hover, focus and the phone's rail. */
function useAutoShuffle(
  shuffle: () => void,
  wallRef: React.RefObject<HTMLDivElement | null>,
) {
  const [held, setHeld] = useState(false);
  // A dependency of the interval, so a press restarts the countdown.
  const [round, setRound] = useState(0);
  // A ref, so the interval is not rebuilt with `shuffle`; written in an effect, not during render.
  const shuffleRef = useRef(shuffle);
  useEffect(() => {
    shuffleRef.current = shuffle;
  });

  useEffect(() => {
    if (held || !window.matchMedia) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(() => {
      const wall = wallRef.current;
      if (!wall || getComputedStyle(wall).display !== "grid") return;
      shuffleRef.current();
    }, ROTATION_MS);
    return () => clearInterval(timer);
  }, [held, round, wallRef]);

  return {
    restart: () => setRound((current) => current + 1),
    hold: {
      // Pointer events, so a swipe on the rail does not latch the band shut.
      onPointerEnter: () => setHeld(true),
      onPointerLeave: () => setHeld(false),
      onFocusCapture: () => setHeld(true),
      onBlurCapture: () => setHeld(false),
    },
  };
}

export interface TestimonialWallProps {
  /** Published rows only; this does no filtering. */
  testimonials: Testimonial[];
}

export function TestimonialWall({ testimonials }: TestimonialWallProps) {
  // Reset during render when a new array arrives; an effect would paint the stale hand first.
  const [shuffled, setShuffled] = useState({
    from: testimonials,
    order: testimonials,
  });
  if (shuffled.from !== testimonials) {
    setShuffled({ from: testimonials, order: testimonials });
  }
  const order = shuffled.from === testimonials ? shuffled.order : testimonials;
  const [swapping, setSwapping] = useState<readonly number[]>([]);
  const wallRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLElement>(null);
  const headingId = useId();
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trading = useRef(false);
  const settleFrom = useRef<Map<number, number> | null>(null);
  const settling = useRef<Animation[]>([]);

  useEffect(
    () => () => {
      if (swapTimer.current) clearTimeout(swapTimer.current);
      for (const glide of settling.current) glide.cancel();
    },
    [],
  );

  /** Fades both slots out, reorders while they are invisible, then fades in; the effect below glides the rest. */
  const swap = useCallback((a: number, b: number) => {
    if (a === b) return;
    trading.current = true;
    setSwapping([a, b]);

    swapTimer.current = setTimeout(() => {
      // A transform counts towards `getBoundingClientRect`, so glides are cancelled before reading.
      for (const glide of settling.current) glide.cancel();
      settling.current = [];
      settleFrom.current = wallRef.current ? cardTops(wallRef.current) : null;

      setShuffled((current) => {
        if (a >= current.order.length || b >= current.order.length) {
          return current;
        }
        return { ...current, order: rotate(current.order, a, b) };
      });
      // Two frames: in one, the browser would merge the reorder and the unmark and the pair would just appear.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setSwapping([]);
          trading.current = false;
        }),
      );
    }, FADE_MS);
  }, []);

  /** One trade; ignored, not queued, while one is running. */
  const shuffle = useCallback(() => {
    if (trading.current || !wallRef.current) return;
    const pair = pickTrade(wallRef.current);
    if (pair) swap(...pair);
  }, [swap]);

  const auto = useAutoShuffle(shuffle, wallRef);

  /** FLIPs the cards a swap moved, before paint; the swapped pair fades instead, and reduced motion skips it. */
  useLayoutEffect(() => {
    const wall = wallRef.current;
    const before = settleFrom.current;
    settleFrom.current = null;
    if (!wall || !before) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const after = cardTops(wall);
    for (const [slot, from] of before) {
      if (swapping.includes(slot)) continue;
      const to = after.get(slot);
      if (to === undefined) continue;
      const distance = from - to;
      // Sub-pixel differences are rounding, not movement.
      if (Math.abs(distance) < 1) continue;

      const card = wall.querySelector<HTMLElement>(`[${SLOT_ATTR}="${slot}"]`);
      if (!card) continue;
      settling.current.push(
        card.animate(
          [{ transform: `translateY(${distance}px)` }, { transform: "none" }],
          { duration: FADE_MS, easing: "ease" },
        ),
      );
    }
  });

  // Given the column count so it re-measures when a testimonial is published.
  useSkylineClearance(bandRef, wallRef, Math.min(order.length, COLUMNS));

  if (order.length === 0) return null;

  const columns = dealIntoColumns(order.slice(0, BAND_SIZE));
  const waiting = order.slice(BAND_SIZE);
  const slotOf = new Map(order.map((row, index) => [row.id, index]));

  const card = (testimonial: Testimonial) => {
    const slot = slotOf.get(testimonial.id) ?? 0;
    return (
      <li
        key={testimonial.id}
        className={cardStyle}
        {...{ [SLOT_ATTR]: slot }}
        data-swapping={swapping.includes(slot) ? "" : undefined}
      >
        <TestimonialQuote testimonial={testimonial} />
      </li>
    );
  };

  return (
    <section ref={bandRef} aria-labelledby={headingId} className={bandStyle}>
      <header className={headerStyle}>
        <Typography tag="h2" type="title" id={headingId}>
          Music to my ears
        </Typography>
        <Typography tag="p" type="bodyLarge">
          Affirmations from those who have worked closely with me
        </Typography>
        <Button
          variant="icon"
          aria-label="Shuffle"
          onClick={() => {
            shuffle();
            auto.restart();
          }}
          className={shuffleStyle}
        >
          <ShuffleIcon aria-hidden />
          <Button.Tooltip>
            <Tooltip.Text>Shuffle</Tooltip.Text>
          </Button.Tooltip>
        </Button>
      </header>
      <div ref={wallRef} className={wallStyle} {...auto.hold}>
        {columns.map((column, index) =>
          // Absent, not empty: an empty `<ul>` announces an empty list.
          column.length === 0 ? null : (
            <ul
              key={index}
              className={cx(columnStyle, COLUMN_STAGGER[index])}
              {...{ [COLUMN_ATTR]: index }}
            >
              {column.map(card)}
            </ul>
          ),
        )}
        {waiting.length > 0 && (
          <ul className={cx(columnStyle, waitingStyle)}>{waiting.map(card)}</ul>
        )}
      </div>
    </section>
  );
}
