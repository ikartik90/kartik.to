"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { css, cx } from "../../styled-system/css";
import type { Testimonial } from "@/domain/testimonial";
import {
  SKYLINE_VIEWBOX_HEIGHT,
  SKYLINE_VIEWBOX_WIDTH,
  skylineTopAt,
} from "@/data/skyline-profile";
import { TestimonialQuote } from "./testimonial-quote";

// ---------------------------------------------------------------------------
// The band of published testimonials at the foot of the homepage — a wide,
// staggered drift of cards standing in front of the skyline, wider than the
// screen it is shown on.
//
// A BAND, NOT A WALL, and that distinction is the whole shape of this file. The
// first version was a wall: two blocks of cards, every column starting on the
// same line, the whole set visible at once and as tall as it needed to be. It
// read as one more listing under the listing above it. What it should read as
// is a drift of other people's words passing behind the page — which needs
// three things a wall does not have:
//
//   * COLUMNS THAT DO NOT LINE UP. Five of them, each starting lower than its
//     neighbour towards the outside, so the top edge is a shape rather than a
//     rule. See `COLUMN_STAGGER`.
//   * MORE BAND THAN SCREEN. The band is at least five full columns wide
//     whatever the viewport, so the outermost cards are always partly past the
//     edge, and the edges fade rather than stop.
//   * CARDS THAT TAKE TURNS. Anything past the edge would otherwise never be
//     read, so every `ROTATION_MS` one off-screen card trades places with one
//     on screen. See `useRotation`.
//
// THE TOWER DECIDES THE MIDDLE COLUMN. The skyline behind this is drawn
// `xMidYMax`, so the CN Tower is pinned to the centre of the viewport at every
// width and reaches within 3% of the top of the footer's box. Every card is
// wider than the tower is (58px at the most), so there is no question of
// threading the middle column past it — the middle column simply has to STOP
// above the antenna. Which is why it is the one column that holds exactly one
// card, why its stagger is zero (it starts at the very top of the band, with
// the most room to work in), and why the band reserves `testimonialCardTallest`
// of height above `TOWER_ZONE` no matter how little content it has.
//
// The centre card is the thing the band would otherwise be missing: without it
// the middle of the page is a dead channel between two groups.
//
// AND ON A PHONE NONE OF THIS APPLIES. At 375px the tower sits dead centre and
// a card cannot fit either side of it, so below `md` the five columns become
// one horizontal rail that swipes, in normal flow, ending before the skyline
// begins. Nothing overlaps because nothing can — the rail is as tall as its
// tallest card, whichever one you have swiped into view. The rotation stops
// there too: a reader who can reach every card by swiping does not need them
// brought to them, and moving one under a thumb mid-swipe is a worse thing to
// do than leaving it where it was.
// ---------------------------------------------------------------------------

/** How many columns the band is dealt into. ODD, so there is a true middle one
 *  for the tower — and five rather than three or seven because eight
 *  testimonials spread over seven columns is a scattering rather than a band. */
const COLUMNS = 5;

/** How long a card stays put before it may be traded off-screen. */
const ROTATION_MS = 8000;

/** How long each half of a swap takes — out, then in. Slow enough to read as
 *  an exchange rather than a flicker, and short enough that the pair are not
 *  missing from the band for long. */
const FADE_MS = 350;

/**
 * Deal testimonials into the band's columns.
 *
 * TWO RULES, and both of them are about the middle. The centre column takes
 * exactly ONE card, because everything below it has to stay clear for the
 * tower; and the rest fill the remaining columns from the middle OUTWARDS, so a
 * short list clusters where the eye already is instead of stranding cards at
 * the far edges where they are half off-screen anyway.
 *
 * Deterministic, so the server and the client deal the same hand from the same
 * order — the rotation moves cards by reordering the list, never by dealing it
 * differently.
 *
 * Exported for its test: this is the only real logic in the file, and "which
 * card is where" is exactly what the tower's clearance depends on.
 */
export function dealIntoColumns<T>(items: T[], columns = COLUMNS): T[][] {
  const centre = Math.floor(columns / 2);
  const dealt: T[][] = Array.from({ length: columns }, () => []);
  if (items.length === 0) return dealt;

  dealt[centre].push(items[0]);

  // Nearest the middle first, and left before right at equal distance, so the
  // order is stable rather than dependent on how `sort` breaks a tie.
  const outwards = Array.from({ length: columns }, (_, i) => i)
    .filter((i) => i !== centre)
    .sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre) || a - b);

  items.slice(1).forEach((item, i) => {
    dealt[outwards[i % outwards.length]].push(item);
  });

  return dealt;
}

/**
 * The air every column leaves between its lowest card and the drawing beneath
 * it — 96px.
 *
 * BORROWED, not chosen. It is the gap the homepage already puts between the row
 * of social icons and the top of the grid, which is the one other place on this
 * page where a block of content stops above something else. Using the same
 * figure is what stops the foot of the page having a second opinion about how
 * far apart two things should be.
 *
 * Held per COLUMN against the silhouette directly beneath it rather than once
 * for the whole band — see `useSkylineClearance`. A single figure measured
 * against the tallest thing on screen would be measured against the CN Tower,
 * and every column would stop where only the middle one needs to.
 */
const SKYLINE_CLEARANCE = "calc({spacing.5xl} + {spacing.xl})";

/**
 * How far the band sits over the footer.
 *
 * The footer's own `5xl` top padding first — clearing that is what gets the
 * cards onto the drawing at all rather than merely into the gap above it — and
 * then half the skyline's height, which is about where the city's rooflines
 * start. So the cards stand in front of the sky and the tops of the buildings,
 * with the tower running up between them.
 */
const OVERLAP = "calc({spacing.5xl} + {sizes.siteFooter} * 0.5)";

/**
 * The height at the foot of the band that belongs to the tower.
 *
 * Measured from the band's own bottom edge up to the antenna's tip, out of the
 * two facts that put them where they are: the band's bottom is `OVERLAP` below
 * the top of the footer, and the tip is `5xl + skylineTowerTip` below the same
 * line. Nothing in the middle column may reach into this.
 */
const TOWER_ZONE = `calc(${OVERLAP} - {spacing.5xl} - {sizes.skylineTowerTip})`;

/**
 * ...and where the middle column stops before anything has been measured: the
 * tower's own zone plus the clearance every column keeps.
 *
 * This is the STATIC fallback — what the band is drawn at on the server, and
 * what it stays at if the script never runs. `useSkylineClearance` replaces it
 * (and the stagger on every other column) with a figure read off the drawing
 * as soon as there is a layout to measure. The fallback is deliberately the
 * safe one: the tower is the highest thing in the picture, so a column holding
 * clear of IT is holding clear of everything.
 */
const TOWER_CLEARANCE = `calc(${TOWER_ZONE} + ${SKYLINE_CLEARANCE})`;

/** How much of each edge the band fades out over — enough that the outermost
 *  cards read as passing off the screen rather than being cut at it. */
const EDGE_FADE = "clamp(24px, 5vw, 120px)";

/** How far past each edge of the screen the band reaches when the screen is
 *  wide enough that five columns would otherwise fit inside it. */
const BLEED = "clamp(24px, 8vw, 200px)";

const bandStyle = css({
  // NEVER SQUASHED. `<body>` is a flex column (globals.css) and this is one of
  // its items, so it carries the default `flex-shrink: 1` — ordinarily
  // harmless, because a flex item will not shrink below its own content. The
  // `min-block-size` below is what makes it dangerous: an explicit minimum
  // REPLACES the automatic `min-height: auto` content floor, so the body was
  // free to compress this section to exactly its reserve and leave the last
  // row of cards hanging out of its own box. Content-sized, always.
  flexShrink: 0,
  // Off the foot of the document above. These cards are the same weight as the
  // grid's, so without a step between them the band reads as four more tiles in
  // the same listing — `5xl` is the step the page already uses between sections
  // (it is the footer's own top padding).
  marginBlockStart: "5xl",
  // Clear of the drawing on a phone, with the footer's own `5xl` top padding
  // under this again. Nothing overlaps at this size — see the note at the top.
  marginBlockEnd: "3xl",

  md: {
    // In front of the skyline. The footer is an ordinary block after this one,
    // so without a layer of its own the drawing would paint over the cards.
    position: "relative",
    zIndex: 1,
    // ...and up onto it. A negative block-end margin rather than a positive
    // pull on the footer, because `SiteFooter` is shared with every article
    // page and has no idea this exists.
    marginBlockEnd: `calc(-1 * (${OVERLAP}))`,
    // The band carries on past the screen. Both edges, so the two sides are
    // symmetrical about the tower.
    maskImage: `linear-gradient(to right, transparent, black ${EDGE_FADE}, black calc(100% - ${EDGE_FADE}), transparent)`,
    maskRepeat: "no-repeat",
    // TALLER THAN THE BOX, AND CENTRED ON IT, which is the trick that makes the
    // mask safe. A mask clips to its own image: at the default `100% 100%`
    // anything a card paints outside the section's box — a cursor tooltip on
    // the top row, the shader's glow — would fall outside the mask and simply
    // vanish. The gradient runs `to right`, so stretching it vertically changes
    // nothing about the fade; it just gives that overflow a full box-height of
    // correctly masked room above and below to live in.
    maskSize: "100% 500%",
    maskPosition: "center",
  },
});

const wallStyle = css({
  // ---------------------------------------------------------------------
  // Phone: the five columns end to end as one rail, swiped sideways.
  // ---------------------------------------------------------------------
  display: "flex",
  gap: "xl",
  overflowX: "auto",
  // Each card keeps its own height and the rail is as tall as the tallest of
  // them, so the page reserves room for the biggest card in the set rather than
  // for the one that happens to be on screen. Swiping a taller one into view
  // therefore moves nothing and overlaps nothing.
  alignItems: "flex-start",
  scrollSnapType: "x mandatory",
  // ONE GUTTER, THE SAME AT BOTH ENDS — the same `xl` everything else on the
  // page is kept off its edges by.
  //
  // It was half the leftover width until now: enough room for the first and
  // last card to reach the MIDDLE of the screen, because cards snapped centred.
  // That is right while a card is most of the screen and absurd as soon as it
  // is not — at 819px a 280px card centres itself behind 270px of blank page,
  // so the rail opens on a gap with a card parked in the middle of it. Cards
  // snap by their leading edge now (see `cardStyle`), so the first one starts
  // where the page's text starts at every width.
  paddingInline: "xl",
  // ...and the snap positions inset to match. A snap position is measured
  // against the SNAPPORT, which is this box less its scroll padding; without
  // this the first card would come to rest flush against the edge of the pane
  // and eat the gutter it is supposed to keep.
  scrollPaddingInline: "xl",
  // NO BAR. A classic horizontal scrollbar is drawn INSIDE this box, so on a
  // platform that has them the pane either takes a strip off the bottom of the
  // cards or changes height as the bar comes and goes — and the bottom of these
  // cards is already the tightest thing in the layout. Hidden, the pane is
  // exactly as tall as its tallest card on every platform.
  //
  // Two declarations because they cover different browsers, not because one is
  // a fallback: `scrollbar-width` is the standard property, and the pseudo
  // element is what Safari and older Chrome answer to.
  //
  // `scrollbar-gutter: stable` is what would normally hold that strip open, and
  // it is deliberately absent: it has no effect once `scrollbar-width` is
  // `none`, since there is then no scrollbar to reserve a gutter for. The
  // height is stable either way — it just comes from the bar never being there
  // rather than from space held open in case it is.
  scrollbarWidth: "none",
  "&::-webkit-scrollbar": { display: "none" },

  // ---------------------------------------------------------------------
  // From `md` up: five staggered columns, wider than the screen.
  // ---------------------------------------------------------------------
  md: {
    display: "grid",
    gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))`,
    // Top-aligned, because the stagger below is a margin on each column and
    // stretching would flatten it straight back out.
    alignItems: "start",
    // AT LEAST five full columns, however narrow the screen — which is what
    // puts the outer cards past the edge and makes the rotation worth having —
    // and no wider than five comfortable ones, so a very wide display gets
    // roomier cards rather than five columns of stretched prose.
    inlineSize: `clamp(calc(${COLUMNS} * {sizes.testimonialCard} + ${COLUMNS - 1} * {spacing.xl}), calc(100% + 2 * ${BLEED}), calc(${COLUMNS} * {sizes.testimonialCardWide} + ${COLUMNS - 1} * {spacing.xl}))`,
    // Centred on the viewport whatever that works out to, so the middle column
    // is over the tower and the overflow is even on both sides. Positioned
    // rather than given a negative margin, so the band's own box stays the
    // width of the page and the mask above still fades at the SCREEN's edges.
    position: "relative",
    insetInlineStart: "half",
    transform: "translateX(-50%)",
    // Room for the middle column to sit above the tower, whatever the content
    // does. Eight cards over five columns can leave the band barely two cards
    // tall, and at that height there is nowhere above the antenna to put the
    // middle card at all. Reserving the tower's zone plus the tallest a card
    // can be makes that room a property of the LAYOUT rather than a lucky
    // consequence of how long this month's quotes happen to run.
    //
    // ON THE GRID, not on the section around it. The middle column is placed
    // against the bottom of its grid AREA (see `middleColumnStyle`), and the
    // grid area is this element's box — so a reserve declared on the section
    // would leave the column measuring itself against the shorter box inside.
    minBlockSize: `calc(${TOWER_CLEARANCE} + {sizes.testimonialCardTallest})`,
    // The phone's rail undone. `visible` matters as much as the rest: a scroll
    // container would clip the overlap below rather than letting it hang over
    // the footer, and would put a scrollbar under a band that is meant to
    // overflow.
    overflowX: "visible",
    scrollSnapType: "none",
    paddingInline: "none",
  },
});

const columnStyle = css({
  // Phone: part of the rail. The five columns sit end to end and read as one.
  //
  // A GRID OF FIXED TRACKS, not a flex row, and that is a deliberate choice
  // about where a card's width is allowed to come from. Laid out with flex, the
  // width had to be declared on every card, and an item in a flex row that
  // loses its width falls back to MAX-CONTENT — which for a 280-character quote
  // is a single 1450px line and a card wider than the screen. In a grid the
  // track is the width: it is stated once, here, and nothing inside a column
  // can size itself out of it.
  //
  // It also settles the column's own width. A flex row asks its children how
  // wide they would like to be, and they answered with their whole unwrapped
  // quote; a row of fixed tracks is exactly as wide as the tracks in it.
  display: "grid",
  gridAutoFlow: "column",
  gridAutoColumns: "token(sizes.testimonialCard)",
  gap: "xl",
  // Each card keeps its natural height rather than stretching to the tallest in
  // the rail, which is what makes the rail's own height the tallest card's.
  alignItems: "start",
  // AND NEVER SQUEEZED. As flex items of the rail these carry the default
  // `flex-shrink: 1` — so a rail narrower than its content compressed the
  // COLUMNS and left their cards hanging out of the box, one column's card
  // drawn straight over the next one's. The rail scrolls; nothing in it needs
  // to fit.
  flexShrink: 0,
  margin: "none",
  padding: "none",
  listStyle: "none",

  md: {
    // A column of its own, so cards stack directly under one another and every
    // gap is the same. This is why the band is five real columns rather than
    // one grid: a grid row is as tall as the tallest card in it, so a short
    // card would leave a hole under itself, and multi-column flow balances the
    // columns to one height — which is exactly the aligned top edge the
    // stagger exists to break up.
    display: "flex",
    flexDirection: "column",
    gap: "xl",
    minWidth: 0,
  },
});

/**
 * How far each column hangs below the one outside it.
 *
 * The outermost columns start at the top of the band and each step inwards
 * starts a little lower, so the band's top edge dips towards the middle instead
 * of running as a rule across the page — which is the shape of the reference
 * this band is drawn from. `4xl` a step.
 *
 * A TASTE DECISION, and the only one in the band's vertical placement. Where a
 * column STOPS is not up to this: `useSkylineClearance` takes the whole band —
 * stagger and all — and slides it until the closest column is exactly
 * `SKYLINE_CLEARANCE` above the drawing. This shape is preserved through that;
 * it just ends up in the right place.
 */
const COLUMN_STAGGER = [
  css({ md: { marginBlockStart: "none" } }),
  css({ md: { marginBlockStart: "4xl" } }),
  css({ md: { marginBlockStart: "calc(2 * {spacing.4xl})" } }),
  css({ md: { marginBlockStart: "4xl" } }),
  css({ md: { marginBlockStart: "none" } }),
];

const cardStyle = css({
  // One page of the phone's rail. It declares no width of its own at either
  // size — the column does, as a fixed track below `md` and as the flex column
  // it stretches to above (see `columnStyle`). A card is never the thing that
  // decides how wide a card is.
  //
  // Snapped by its LEADING edge, so a card comes to rest where the page's text
  // begins rather than in the middle of the pane. Centring reads well while a
  // card is most of the screen and worse with every pixel after that: the
  // wider the screen, the further the first card walks in from the edge, until
  // the rail opens on a blank gutter. Aligned to the start it opens on a card
  // at every width, with the next one peeking past the edge to say it moves.
  scrollSnapAlign: "start",

  md: {
    // THE SWAP, AND WHY IT IS A TRANSITION RATHER THAN AN ANIMATION.
    //
    // A rotation exchanges two cards, and doing that in one frame is a flicker
    // in the corner of the eye of somebody reading something else entirely.
    // So the two slots fade out, trade places while they cannot be seen, and
    // fade back in — `FADE_MS` each way.
    //
    // The trick that makes this one CSS rule rather than two keyframes is that
    // the attribute is keyed to the SLOT, not to the card. React moves the two
    // nodes between the slots (same keys, new order), and both slots are marked
    // throughout — so each node is already at `opacity: 0` when it lands, and
    // dropping the mark on the next frame fades it back up from there. Nothing
    // has to know which card went where.
    //
    // It also covers the jump that would otherwise be the worst part: the two
    // columns change height the instant the order does, and that happens while
    // both cards are invisible.
    transition: `opacity ${FADE_MS}ms ease`,
    "&[data-swapping]": { opacity: 0 },
  },
});

/** Where a card sits in the band's order — what the rotation trades. */
const SLOT_ATTR = "data-testimonial-slot";

/**
 * Where every card is, keyed by the slot it is in.
 *
 * MEASURED AGAINST THE WALL, not against the window, and that is the whole
 * reason this is a function rather than a line of `getBoundingClientRect`. The
 * band can move while a swap is happening — the clearance above the skyline is
 * re-read whenever the wall changes size — and a band sliding into its new
 * place is not a card changing place. From the wall's own top edge, a card's
 * number changes only when something above it in ITS column did, which is
 * exactly the movement worth animating.
 *
 * Any transform still running is cancelled before this is called, so these are
 * where the cards ARE rather than where an unfinished glide has them.
 */
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

/** The gap above the drawing, as a number — the CSS above is the same figure
 *  spelled in tokens, and the two are checked against each other by a test. */
const CLEARANCE_PX = 96;

/**
 * Slide the whole band until its closest column is exactly
 * {@link SKYLINE_CLEARANCE} above the drawing — and no column is closer.
 *
 * A FLOOR, NOT A SPACING. Each column ends up somewhere between 96px and a
 * great deal more above the skyline, depending on what the picture is doing
 * beneath it; 96 is the distance at the tightest point. Which point that is
 * moves with the viewport — it is the middle column over the CN Tower on a wide
 * display and an outer column over the financial district on a narrow one — so
 * it is measured rather than assumed.
 *
 * MEASURED AGAINST THE DEEPEST HAND, NOT THE ONE ON SCREEN, and that is the
 * difference between a floor and a floor most of the time. The rotation deals
 * the same cards into the same shaped columns in a different order, and the
 * cards are different heights — so a column whose card is replaced by one
 * seventy pixels taller reaches seventy pixels further down, into air that was
 * measured when something shorter was standing there. That is not a hypothesis:
 * left to the visible hand the middle column measured 96px clear on load and
 * 24px clear a rotation later, with the band never moving, because nothing it
 * was watching had changed size.
 *
 * So each column is placed by how far down it could EVER reach: its own top,
 * plus the tallest cards in the set stacked in it. The set is fixed and a
 * column's card count does not change (`dealIntoColumns` deals by index), so
 * that figure is the same for every order the rotation can produce — which is
 * what keeps the band still. The alternative, re-placing the band on each swap,
 * holds the number and moves the footer up and down every eight seconds.
 *
 * ONE SHIFT FOR THE WHOLE BAND, not a margin per column, and that is the
 * difference between this and the version before it. Placing each column
 * individually against its own roofline does hold the 96 everywhere, but it
 * throws away the stagger (the shape becomes a tracing of the skyline) and it
 * pushes cards outside the section's own box, where the edge mask — which can
 * only cover the box — cuts them off mid-sentence. Moving the band as one piece
 * keeps the arrangement exactly as laid out and keeps every card inside the box
 * it is masked by.
 *
 * HOW A COLUMN FINDS ITS PATCH OF THE PICTURE. The drawing is `xMidYMax slice`:
 * its scale is set by the box's HEIGHT, and viewBox x 2000 is pinned to the
 * middle of the viewport. So a column's left and right edges convert to viewBox
 * units with one multiplication, and `skylineTopAt` answers what is under it.
 *
 * WHY ONE PASS SETTLES. The shift is applied to the band's own bottom margin —
 * the negative one that overlaps the footer — so it changes the distance
 * between the band and the drawing by exactly the amount asked for and changes
 * nothing else. Measuring from the CSS baseline each time (the margin is
 * cleared before the read) keeps passes from compounding.
 *
 * It does nothing below `md`, where the columns are a rail laid end to end and
 * there is no overlap to keep clear of. The computed `display` is what it asks,
 * rather than a breakpoint repeated from `panda.config.ts`.
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
      // Back to what the stylesheet says before reading anything, so each pass
      // measures the same baseline instead of its own last answer.
      band.style.marginBlockEnd = "";

      // Reached for by selector because the drawing belongs to `SiteFooter`,
      // which knows nothing about this band and should not have to.
      const svg = document.querySelector<SVGElement>("[data-site-footer] svg");
      if (!svg || getComputedStyle(wall).display !== "grid") return;

      const drawing = svg.getBoundingClientRect();
      if (drawing.height === 0) return;

      // Every viewBox unit is this many pixels — the slice is height-driven,
      // because the box is always the wider of the two in proportion.
      const scale = drawing.height / SKYLINE_VIEWBOX_HEIGHT;
      const middle = drawing.left + drawing.width / 2;
      const toViewBox = (x: number) =>
        SKYLINE_VIEWBOX_WIDTH / 2 + (x - middle) / scale;

      // Every card in the band, tallest first. The same list whatever order the
      // rotation has them in, which is the whole point of it.
      const tallest = [...wall.querySelectorAll<HTMLElement>(`[${SLOT_ATTR}]`)]
        .map((card) => card.getBoundingClientRect().height)
        .sort((a, b) => b - a);

      let tightest = Infinity;
      for (const column of wall.children) {
        const box = column.getBoundingClientRect();
        if (box.height === 0) continue;

        // The lowest this column could reach with any hand: its own top, which
        // the stagger fixes, plus its share of the tallest cards there are.
        //
        // Taking every column at its own worst is not the over-estimate it
        // looks like. What binds the band is the ONE tightest column, and any
        // single column can really be dealt the tallest cards — so the largest
        // of these deficits is exactly the smallest shift that holds the floor
        // for every order, rather than a margin of safety on top of one.
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

      // Positive means the band is sitting higher than it needs to and can come
      // down; negative means it is too close and must go up. Added to a margin
      // that is already negative.
      const overlap = Number.parseFloat(getComputedStyle(band).marginBlockEnd);
      if (Number.isNaN(overlap)) return;
      band.style.marginBlockEnd = `${overlap - (tightest - CLEARANCE_PX)}px`;
    };

    place();

    // The band is re-laid whenever the window changes — and the drawing's own
    // height is a `clamp` on the viewport, so both ends of the sum move at
    // once. Watching the document element rather than listening for `resize`
    // also catches a scrollbar appearing.
    //
    // AND EVERY COLUMN, because the wall's own box is a poor witness: its
    // height is pinned by the `min-block-size` that reserves the tower's room,
    // so a column growing inside it — a face arriving late, a font swapping,
    // a card wrapping to another line — changes nothing the wall can report. A
    // rotation no longer changes the answer, but everything else about a
    // column's height still does.
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

/**
 * Trade one off-screen card for one on screen, every {@link ROTATION_MS}.
 *
 * The band is deliberately wider than the window, so at any moment two or three
 * testimonials are past the edge. Without this they would be decoration — words
 * somebody wrote that nobody can read. With it, every card comes into view if
 * you leave the page alone long enough.
 *
 * ONE CARD AT A TIME, which is the whole reason this is a swap rather than a
 * reshuffle: moving one card changes one column's height, and the eye follows
 * it. Re-dealing the whole band every eight seconds would be the page
 * rearranging itself under a reader.
 *
 * MEASURED, NOT ASSUMED. Which cards are off-screen depends on the window, the
 * column widths and how tall the cards happen to be, so it is read off
 * `getBoundingClientRect` rather than derived from a column index — the band
 * does not need to know its own layout in order to know what is hidden.
 *
 * It stops for the three cases where moving content is the wrong thing to do: a
 * reader who has asked for reduced motion, a pointer resting on the band, and
 * focus inside it — the last two so that reading a card, or tabbing to a
 * profile link, is never interrupted by the card leaving.
 *
 * ...and for a fourth, which is the whole of the rail. See `tick`.
 */
function useRotation(
  count: number,
  swap: (a: number, b: number) => void,
  rootRef: React.RefObject<HTMLDivElement | null>,
) {
  const [held, setHeld] = useState(false);
  // Kept in a ref so the interval below is not torn down and rebuilt: with a
  // dependency on `swap` the timer would restart on every rotation, and the
  // eight seconds would never elapse. Assigned in an effect rather than during
  // the render that produced it, because a ref written while rendering is a
  // value React is entitled to throw away.
  const swapRef = useRef(swap);
  useEffect(() => {
    swapRef.current = swap;
  });

  useEffect(() => {
    if (held || count < 2) return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const tick = () => {
      const root = rootRef.current;
      if (!root) return;

      // THE BAND ONLY. Below `md` these are a rail the reader scrolls
      // themselves, and a swap there is wrong twice over. Everything past the
      // fold measures as hidden, so the trade is between a card somebody is
      // looking at and one they have already scrolled away from; and the pane
      // keeps its scroll offset while the content under it changes, so a card
      // a reader swiped to is replaced by one they did not. The rotation exists
      // because the BAND is wider than the screen with no way to reach the rest
      // of it — the rail has one, and it is the reader's thumb.
      //
      // Asked of the layout rather than of a breakpoint repeated from
      // `panda.config.ts`, which is the same question `useSkylineClearance`
      // asks, and it re-asks on every tick: the answer changes when the window
      // is dragged across `md` and nothing re-runs this effect.
      if (getComputedStyle(root).display !== "grid") return;

      const hidden: number[] = [];
      const shown: number[] = [];
      for (const element of root.querySelectorAll(`[${SLOT_ATTR}]`)) {
        const slot = Number(element.getAttribute(SLOT_ATTR));
        const box = element.getBoundingClientRect();
        // Wholly inside the window counts as shown; anything clipped by either
        // edge is a candidate to be brought in, because a card half past the
        // edge is still half unread.
        (box.left >= 0 && box.right <= window.innerWidth ? shown : hidden).push(
          slot,
        );
      }

      // Nothing hidden (a display wide enough to show the whole band) or
      // nothing shown: either way there is no trade to make.
      if (hidden.length === 0 || shown.length === 0) return;

      const pick = (from: number[]) =>
        from[Math.floor(Math.random() * from.length)];
      swapRef.current(pick(hidden), pick(shown));
    };

    const timer = setInterval(tick, ROTATION_MS);
    return () => clearInterval(timer);
  }, [held, count, rootRef]);

  return {
    // `pointerenter`/`leave` rather than `mouseenter`, so a touch that swipes
    // the rail does not latch the band shut. Focus is captured so a profile
    // link anywhere inside counts as somebody reading.
    onPointerEnter: () => setHeld(true),
    onPointerLeave: () => setHeld(false),
    onFocusCapture: () => setHeld(true),
    onBlurCapture: () => setHeld(false),
  };
}

export interface TestimonialWallProps {
  /** Published rows only. This component does no filtering — see
   *  `getPublishedTestimonials`, where the gate belongs. */
  testimonials: Testimonial[];
}

export function TestimonialWall({ testimonials }: TestimonialWallProps) {
  // The band's own order, seeded from the server's and its own from then on.
  // The rotation reorders THIS; the dealing below is a pure function of it, so
  // a swap here moves two cards between columns and changes nothing else.
  //
  // Held ALONGSIDE the prop it came from, rather than synchronised to it from
  // an effect. The band is handed a fresh array whenever the server re-renders
  // the homepage — publishing a row does exactly that — and its own shuffled
  // order has to give way to it. Adjusting during the render that notices is
  // React's own answer to that; an effect would paint the stale hand first and
  // then correct it.
  const [shuffled, setShuffled] = useState({
    from: testimonials,
    order: testimonials,
  });
  if (shuffled.from !== testimonials) {
    setShuffled({ from: testimonials, order: testimonials });
  }
  const order = shuffled.from === testimonials ? shuffled.order : testimonials;
  // The two slots mid-swap, held at `opacity: 0` for as long as they are here.
  const [swapping, setSwapping] = useState<readonly number[]>([]);
  const wallRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLElement>(null);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Where the cards were, read in the instant before the order changes, and the
  // glides that reading turned into. See `swap` and the layout effect under it.
  const settleFrom = useRef<Map<number, number> | null>(null);
  const settling = useRef<Animation[]>([]);

  // A swap left running past the band's life fires against nothing, and the
  // frame callback inside it would set state on an unmounted component.
  useEffect(
    () => () => {
      if (swapTimer.current) clearTimeout(swapTimer.current);
      for (const glide of settling.current) glide.cancel();
    },
    [],
  );

  /**
   * Exchange two cards, over three steps rather than in one frame.
   *
   * MARK, then MOVE, then UNMARK. Both slots go transparent; `FADE_MS` later —
   * once they are actually invisible — the order changes underneath them, which
   * is also when the two columns jump to their new heights; and on the frame
   * after that the mark comes off and both fade back up.
   *
   * The mark belongs to the SLOT, so it survives the reorder: React moves the
   * two nodes between the marked slots, and each one arrives already at zero
   * with a transition ready to take it back to one.
   *
   * AND EVERY OTHER CARD IN THOSE TWO COLUMNS MOVES TOO, which is the part the
   * fade cannot cover. The cards are different heights — that is the whole look
   * of the band — so trading a six-line quote for a three-line one shortens one
   * column and lengthens the other, and everything below the swap in both of
   * them is somewhere else the moment the order changes. Left alone that is a
   * card jumping seventy pixels in one frame beside a card fading politely.
   *
   * So the positions are read here, a frame before the change, and the effect
   * below puts each card back where it was and lets it glide to where it now
   * belongs.
   */
  const swap = useCallback((a: number, b: number) => {
    if (a === b) return;
    setSwapping([a, b]);

    swapTimer.current = setTimeout(() => {
      // Anything still gliding is stopped first: a transform counts towards
      // `getBoundingClientRect`, so a reading taken over one would be where a
      // card is passing through rather than where it lives.
      for (const glide of settling.current) glide.cancel();
      settling.current = [];
      settleFrom.current = wallRef.current ? cardTops(wallRef.current) : null;

      setShuffled((current) => {
        if (a >= current.order.length || b >= current.order.length) {
          return current;
        }
        const next = [...current.order];
        [next[a], next[b]] = [next[b], next[a]];
        return { ...current, order: next };
      });
      // TWO frames, not one: the first is the one React paints the reordered
      // cards in, still transparent. Dropping the mark in the same frame would
      // let the browser collapse both changes into a single style
      // recalculation, and the pair would simply appear.
      requestAnimationFrame(() => requestAnimationFrame(() => setSwapping([])));
    }, FADE_MS);
  }, []);

  /**
   * Put every card that moved back where it was, and let it glide.
   *
   * FIRST, LAST, INVERT, PLAY — the oldest trick in the book, and the only way
   * to animate a change nothing transitionable caused. A card lower in its
   * column has not had a property changed; the card ABOVE it became a different
   * height, and flow layout moved it. There is no `height` or `top` to
   * transition on the card that moved, so it is given a transform that cancels
   * the move out and then animates that transform away.
   *
   * A LAYOUT EFFECT, because this is the one moment both positions are known:
   * the reorder has been committed to the DOM and the browser has not painted
   * it yet. In an ordinary effect the frame with the jump in it is already on
   * screen, which is the thing being fixed.
   *
   * The Web Animations API rather than a class and a transition: it leaves the
   * element's own styles alone — including the `opacity` transition the swap
   * itself runs — and it hands back a handle that can be cancelled, which is
   * what keeps a second swap from measuring a card mid-glide.
   *
   * NOT THE TWO CARDS BEING SWAPPED. They are invisible and about to fade in
   * where they now are; sliding them in from the column they came from would
   * animate the one movement that is supposed to be covered by the fade.
   *
   * Runs after every render and does nothing unless a swap staged a reading,
   * which is `null` on all of them but one. A reader who has asked for reduced
   * motion never gets here at all — `useRotation` does not start.
   */
  useLayoutEffect(() => {
    const wall = wallRef.current;
    const before = settleFrom.current;
    settleFrom.current = null;
    if (!wall || !before) return;

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
          // The same `FADE_MS` the exchange itself takes, deliberately: the
          // settle and the fade-in run together and read as one movement
          // rather than as a reaction to one.
          { duration: FADE_MS, easing: "ease" },
        ),
      );
    }
  });

  const hold = useRotation(order.length, swap, wallRef);
  // Reads the drawing and slides the band until the closest column is exactly
  // clear of it. Given the column count so it re-measures when a testimonial is
  // published or unpublished.
  useSkylineClearance(bandRef, wallRef, Math.min(order.length, COLUMNS));

  // Nothing at all rather than an empty band: a band drawn around no cards is a
  // stretch of blank page above the skyline, which reads as something that
  // failed to load. It is a real state — every row starts unpublished.
  if (order.length === 0) return null;

  const columns = dealIntoColumns(order);
  // Where each testimonial sits in `order`, which is what a swap moves.
  const slotOf = new Map(order.map((row, index) => [row.id, index]));

  return (
    // Named, because it is a landmark with no heading over it. A visible
    // heading was considered and left out: the cards say what they are, and a
    // title would be the only piece of furniture on this page announcing its
    // own section.
    <section ref={bandRef} aria-label="Testimonials" className={bandStyle}>
      {/* NO SHADER STAGE. There was one — the band used to draw the house
          social icon on every card, and a stage is what lends those a single
          WebGL context rather than one each. The cards have no icon now (the
          whole card is the link), so the stage would be a context held open for
          nothing, off a page budget of about sixteen that the demos and the
          homepage's own icon row are already sharing. */}
      <div ref={wallRef} className={wallStyle} {...hold}>
        {columns.map((column, index) =>
          // Absent rather than empty: an empty `<ul>` is a list announced to
          // anyone listening with nothing in it. Happens whenever fewer
          // testimonials are published than the band has columns.
          column.length === 0 ? null : (
            <ul key={index} className={cx(columnStyle, COLUMN_STAGGER[index])}>
              {column.map((testimonial) => {
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
              })}
            </ul>
          ),
        )}
      </div>
    </section>
  );
}
