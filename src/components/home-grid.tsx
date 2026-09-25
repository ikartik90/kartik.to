"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { css } from "../../styled-system/css";
import {
  CardPropertiesPanel,
  type CardMediaSlot,
} from "@/components/card-properties-panel";
import { ComponentInsertDialog } from "@/components/component-insert-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DemoComponent } from "@/components/demo-component";
import { DemoFrame } from "@/components/demo-frame";
import { GridItem } from "@/components/grid-item";
import { ImageInsertDialog } from "@/components/image-insert-dialog";
import { LinkCard } from "@/components/link-card";
import { type PropertiesPanelHandle } from "@/components/ui/properties-panel";
import { getDemoComponent, pendingInsertFor } from "@/components/demo/registry";
import { listingColumnsFor } from "@/utils/listing-columns";
import { useGridDraftStore } from "@/store/grid-draft";
import { applyGridDraft } from "@/utils/grid-draft";
import { linkCardHref, linkCardTitle, type LinkCardConfig } from "@/domain/link-card";
import { postCardMedia, type PostCardConfig } from "@/domain/post";
import type { ImageInsertPayload } from "@/hooks/use-image-insert";
import type { MediaNode } from "@/domain/nodes";
import type { GridCard } from "@/lib/grid";
import UnpublishIcon from "@/assets/icons/unpublish.svg";

// ---------------------------------------------------------------------------
// The homepage. Projects, articles and published components in one masonry
// grid, and — for the admin, in edit mode — the controls that place them.
//
// This replaced two separate sections, a `column-count` project listing and a
// dated writing list. They had to merge: a pin names an absolute seat, and
// "seat 3" cannot mean anything while there are two lists it might be seat 3
// of. One grid is also the only way an article can ever sit between two
// projects, which is the whole reason for pinning by hand.
//
// The cards come in ALREADY ordered (`getGridCards`), and while editing they
// are re-projected through the unsaved draft. Nothing writes as you click: the
// grid is edited like an article, so the changes accumulate and the palette's
// two exits either commit them or throw them away. A toolbar that saved on
// press would leave "Discard and exit" with nothing to discard.
//
// The position a card is rendered at is the seat a pin claims for it, so the
// list on screen and the list the toolbar acts on are necessarily the same one.
// ---------------------------------------------------------------------------

const containerStyle = css({
  containerType: "inline-size",
  containerName: "projectsGrid",
});

// The cards fill their cell, and may exceed it. The cell owns the shape — it
// carries the aspect the grid reserved rows from — but as a FLOOR: a demo
// frame stops shrinking with its width at its content's height plus its
// padding, and a card at one or two columns is regularly past that point. So
// the card grows and the cell measures it (`GridItem` publishes the result for
// the row span), rather than the card being held at a height it cannot hold
// its contents in.
//
// In flow rather than absolute, which is what makes that measurement possible:
// an absolute card contributes nothing to its cell's height, so the cell could
// only ever be the shape. `flexGrow` is what fills the cell in its place —
// a percentage height would resolve against a `min-height` and give nothing.
const fillStyle = css({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  "& > *": { flexGrow: 1 },

  // While editing, the card is scenery. Clicking it would navigate away and
  // take the unsaved layout with it — and a published component is a LIVE demo,
  // so without this you would be playing with a shift scheduler while trying to
  // place it. The pointer falls through to the cell, which is what wants it:
  // the cell is the hover target that reveals the controls.
  //
  // Pointer events alone are not enough. The card is an `<a href>` and stays in
  // the tab order, where Enter would navigate just as well — see the matching
  // `interactive` prop on `LinkCard`.
  "&[data-inert]": { pointerEvents: "none" },
});

/**
 * The card of a demo that POINTS somewhere — the reel, which is the shader
 * playground's window.
 *
 * Its demo is inert to the pointer always, not only while editing: a linked
 * card is a picture of where it goes, so every click in it belongs to the link.
 * That is the trade a `link` in the registry makes, and it is why the demos you
 * are meant to play with have none — see `DemoComponentEntry.link`.
 *
 * `fillStyle`'s job too, and deliberately not shared with it: that one fills
 * the cell and goes inert only under `data-inert`, and folding the two together
 * would mean either every card losing its pointer or this one keeping it.
 */
const demoLinkStyle = css({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  "& > *": { flexGrow: 1, pointerEvents: "none" },
});

/**
 * Publish the grid's own width, in plain pixels, for the row-span arithmetic.
 *
 * `masonryGrid` divides one CSS length by another with `tan(atan2(A, B))` —
 * the only construction in CSS that does it. WebKit gets that wrong the moment
 * a CONTAINER QUERY UNIT is one of the operands. Measured in Safari 26.6.2
 * inside a 799px `inline-size` container: `tan(atan2(50px, 10px))` is right,
 * `tan(atan2(100cqw, 799px))` resolves `100cqw` against the VIEWPORT, and the
 * same expression routed through an unregistered custom property first — which
 * is exactly the recipe's `--col-width` → `--cell-width` → `--aspect-height`
 * chain — computes to 0, collapsing every card to the gutter. `@supports`
 * cannot tell the two apart: it tests parsing, and the broken form parses.
 *
 * So the same quantity is handed over as a plain px length instead, and the
 * recipe's 1px-row tier is gated on `data-measured` so the `100cqw` fallback
 * can never reach an `atan2`. Both are written here, width first: the flag is
 * the promise that the width is there, and a flag standing without one would
 * put the `cqw` straight back in.
 *
 * ONE observer, on the grid. The grid's width is a single number for every
 * card in it; per-card measurement would be a layout pass per card per resize,
 * which is the arrangement the recipe explicitly rejects. `GridItem`'s own
 * observer measures something else — how tall its card actually came out.
 *
 * Writing to the observed element DOES restart the observer, and the guard
 * below is what stops that becoming a loop. A `ResizeObserver` watches the
 * content box, so it reports height as well as width — and height is precisely
 * what this hook's own publication changes, since `--grid-width` decides every
 * card's row span and therefore how tall the grid comes out. Writing a custom
 * property invalidates style for the grid and every card in it, so publishing
 * on each notification feeds the next one. The geometry still converges, but
 * WebKit reports the cycle as "ResizeObserver loop completed with undelivered
 * notifications" — a window `error` event rather than a console line, so it
 * reaches error reporting. Measured in Safari 26.6.2 over five window resizes:
 * 5 errors against 0 before this existed, and it fired with `grid-lanes` on as
 * well, where the span arithmetic is not running at all.
 *
 * So a notification that does not CHANGE the width writes nothing, and a cycle
 * has nowhere to start.
 */
function useGridWidth(grid: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const node = grid.current;
    if (!node) return;

    // The width last published, held here rather than read back off the node:
    // what matters is whether this hook has anything new to say, and a
    // comparison against the DOM would be a second copy of the same fact.
    let published = 0;

    const publish = () => {
      // Up, never down, for the same reason `GridItem` rounds its height up:
      // the span is a whole number of 1px rows, so a width rounded down
      // understates the shape's height and hands the next card a row this one
      // is still drawing in. The grid draws no border and no padding, so its
      // border box is the content box `100cqw` would have measured.
      const width = Math.ceil(node.getBoundingClientRect().width);
      // Nothing to say until there is a layout. A measured zero — an unmounted
      // grid, a hidden tab — would make `--col-width` negative and every span
      // with it, where saying nothing leaves the un-measured tier in charge.
      if (width <= 0) return;
      // Nothing to say when the width has not moved, either: this is the
      // height-only notification the comment above describes, and answering it
      // with a write is what starts the loop.
      if (width === published) return;
      published = width;
      node.style.setProperty("--grid-width", `${width}px`);
      node.setAttribute("data-measured", "");
    };

    const observer = new ResizeObserver(publish);
    observer.observe(node);
    publish();

    return () => observer.disconnect();
  }, [grid]);
}

/** Where an insertion is aimed, held while the component picker is open. */
interface PendingInsert {
  index: number;
}

/**
 * Which slot of which card a library dialog is about to fill.
 *
 * The card is named by KEY rather than captured as a closure, for the reason
 * the open panel is: the dialog outlives a render, and the grid re-projects
 * through the draft on every edit — so a card object held across the dialog's
 * lifetime would be a stale copy by the time Insert is pressed.
 */
interface PendingPick {
  key: string;
  /** The theme slot, for a picture. Absent when the file is a document. */
  slot?: CardMediaSlot;
}

/**
 * A library payload as a media node.
 *
 * The payload is what the LIBRARY knows about a file — a url, a description,
 * the kind its content type declares — and a node is that plus everything an
 * author can do to it in a frame. The article editor spells out the identical
 * conversion for the identical reason (see `mediaNodeFrom` there): the dialog
 * stays ignorant of the shape a document keeps.
 *
 * Not shared with it, and that is a judgement rather than an oversight: two
 * call sites is where this repo PROMOTES a component, and the rule is about
 * components. Lifting six lines of object literal into a module both a card and
 * an editor import would make the document's shape a shared dependency for the
 * saving of nothing.
 */
function mediaNodeFrom(payload: ImageInsertPayload): MediaNode {
  return {
    type: "media",
    kind: payload.kind,
    src: payload.src,
    ...(payload.alt ? { alt: payload.alt } : {}),
    // Both or neither: a node carrying one dimension is a record of something
    // that went wrong, and the reserved box falls back to the house ratio for
    // it anyway (`mediaReservedAspect`).
    ...(payload.width && payload.height
      ? { width: payload.width, height: payload.height }
      : {}),
  };
}

interface HomeGridProps {
  cards: GridCard[];
  /**
   * Whether to show the placement controls.
   *
   * A prop, not a global flag or a session lookup, because edit mode is a
   * ROUTE here exactly as it is for an article: `/` renders the grid and
   * `/edit/home` renders it editable, and that page has already refused
   * anyone who is not the admin. Deciding it again on the client would be a
   * second, weaker copy of a gate the server already holds — and it was the
   * source of a real bug, since the client cannot tell "not signed in" from
   * "session not read yet" on first paint.
   */
  editable?: boolean;
  /**
   * Demos the PAGE already rendered, keyed by card key.
   *
   * A slot map, the same shape `ArticleRenderer` takes for the grid itself: a
   * client component cannot render a server one, but it can be handed the
   * finished node. A demo whose content is a database read arrives complete
   * this way — see `serverDemoSlots` — instead of showing a progress bar while
   * the browser fetches a chunk and then makes a round trip for the data.
   *
   * Partial by design. A key that is missing falls back to the browser loader,
   * which is what every demo without a server half uses, and what a card
   * inserted into an unsaved layout must use — the server has never seen it.
   */
  demos?: Record<string, ReactNode>;
}

// -------------------------------------------------------------------
// Masonry, done as arithmetic rather than as a layout mode.
//
// `display: grid-lanes` is the real answer, and this upgrades to it
// wherever it exists (Safari 26.4+ as of writing; Chrome and Firefox
// still behind a flag). Everywhere else the same picture is built from
// a grid whose rows are 1px tall, with every card spanning as many of
// them as its own height comes to. A card's height is a function of the
// width it lands at and the shape it declares, and BOTH are knowable in
// CSS, so the span can be computed rather than measured.
//
// The division is the awkward part: `calc()` will not divide a length
// by a length and hand back a number. `tan(atan2(A, B))` will — atan2
// takes two same-unit values and returns an angle, and the tangent of
// that angle is A/B as a bare number. It is a trigonometric identity
// pressed into service as a type cast, it is ugly, and it is the only
// thing in CSS that does this. BOTH divisions have to route through it,
// the gutter term included; a bare `calc(20px / 1px)` is invalid and
// takes the whole declaration down with it.
//
// Rejected: `column-count`, which is what this replaces. It packs
// beautifully and cannot span — a card two columns wide is not
// expressible in a column box at all — and spanning is the entire point
// of the grid this feeds. Rejected: measuring heights in JS and writing
// spans back, which is a layout pass per card per resize and a frame of
// wrong on each one. An observer still has a job here, but as a
// correction for content that outgrows its declared shape, not as the
// mechanism.
//
// The `@supports` guard is load-bearing rather than polite. Without it
// an engine lacking `atan2` drops the `grid-row` declaration and KEEPS
// `grid-auto-rows: 1px`, collapsing every card to a single pixel. It
// tests the exact construction it protects, not a proxy for it.
//
// WEBKIT: that atan2 must be fed PLAIN LENGTHS. A container query unit
// anywhere in it is computed wrong. Measured in Safari 26.6.2, inside
// a 799px `inline-size` container: `calc(100px * tan(atan2(50px,
// 10px)))` gives the correct 500px; `calc(100px * tan(atan2(100cqw,
// 799px)))` gives 161.97px, because `100cqw` was resolved against the
// VIEWPORT; and `--f: min(1, tan(atan2(100cqw - 40px, 799px)))` read
// back as `calc(799px * var(--f))` gives 0 outright. The last is this
// recipe's own shape — `--col-width` → `--cell-width` →
// `--aspect-height`, all cqw-derived — so every card collapsed to the
// gutter term across macOS Safari 15.4–26.3 and every iOS browser
// before 26.4, all of which are WebKit. Newer Safari escaped only
// because the `grid-lanes` tier below wins there.
//
// No `@supports` test can catch this, and adding one is the wrong
// instinct: `@supports` tests PARSING, the broken form parses, and the
// guard above passes because plain pixels are computed correctly. So
// the width arrives as a px length instead — `--grid-width`, published
// by one ResizeObserver on the grid in `HomeGrid` — and every operand
// of the atan2 is a kind WebKit gets right. See `--col-width` for how
// the un-measured first frame is kept out of it.
//
// Two nested containers, deliberately. The grid is its own unnamed
// `inline-size` container so a child's `100cqw` is the GRID's width and
// the arithmetic is exact; the tier queries name `projectsGrid` and so
// skip it for the section outside. Capping the grid's width while
// measuring against a wider ancestor is precisely the drift this
// arrangement rules out. The container survives the px measurement
// because `100cqw` is still what sizes the cells before the first
// layout, and is still the honest name for the quantity.
// -------------------------------------------------------------------
//
// A masonry grid that supports column spans. Upgrades to `display: grid-lanes`
// where it exists; elsewhere it packs cards into 1px row tracks and computes
// each card's row span from its declared aspect and the width it lands at.
// Children drive it with three custom properties — `--span` (columns, clamped
// to what the grid has), `--aspect-w` and `--aspect-h` (the shape as a pair,
// kept as integers so ratios like 3:2 stay exact) — and may publish a fourth,
// `--card-height`, when they have measured themselves taller than their shape;
// the span reserves the larger of the two. The grid hands `--aspect-height`
// back to each child, which is the shape's height at the width that child
// landed at, so the child can take its shape as a floor. `data-columns` is the
// CEILING on the column count from `listingColumnsFor`; the tier queries hand
// out the smaller of that and what fits. The 1px-row tier additionally waits on
// `data-measured` and `--grid-width` — the grid's own width in plain pixels,
// published by a single `ResizeObserver` — because the `tan(atan2(…))` division
// is computed wrongly by WebKit on a container query unit; until then the grid
// is a plain aligned grid at the same widths and shapes.
const masonryGridStyle = css({
  // The gap, once, as a length the arithmetic can read back. It has
  // to be a custom property rather than `columnGap` alone, because the
  // span calc needs the same quantity as an operand and a recipe
  // cannot read back what it set.
  //
  // 20px, the gutter the `column-count` masonry used. Note that it
  // is narrower than the 28px button `GridInsertRail` centres in it,
  // so in edit mode that button overhangs the cards either side by
  // 4px. Deliberate, and only visible while editing.
  "--grid-gap": "token(spacing.xxl)",
  "--columns": "1",

  containerType: "inline-size",
  display: "grid",
  gridTemplateColumns: "repeat(var(--columns), minmax(0, 1fr))",
  columnGap: "var(--grid-gap)",
  rowGap: "var(--grid-gap)",
  width: "token(spacing.full)",
  marginInline: "auto",

  "& > *": {
    // Clamped in CSS, not by the caller: the column count is a
    // function of the space available and changes under the caller's
    // feet, so a card asking for three columns in a one-column grid
    // has to be cut down HERE. Left unclamped it does not overflow —
    // it silently mints two implicit columns and takes the layout
    // with it.
    gridColumn: "span min(var(--span, 1), var(--columns))",
    minWidth: "0",

    "--span-clamped": "min(var(--span, 1), var(--columns))",
    // The grid's width, twice over, naming ONE quantity: the px
    // length `HomeGrid`'s observer publishes, falling back to the
    // container unit that means the same thing.
    //
    // Which of the two is in play is not a detail — see the WebKit
    // note above. The `100cqw` fallback is only ever reached before
    // the grid has been measured, and the `[data-measured]` gate
    // below is what keeps that state out of the `atan2`: unmeasured,
    // the only thing reading this chain is the cell's `min-height`,
    // where a container unit is computed correctly by every engine.
    // So the fallback keeps the shapes right on the server and in
    // the first frame, and never reaches the arithmetic that breaks
    // on it.
    "--col-width":
      "calc((var(--grid-width, 100cqw) - (var(--columns) - 1) * var(--grid-gap)) / var(--columns))",
    // A spanning card is not N columns wide — it is N columns plus
    // the N-1 gutters it swallows.
    "--cell-width":
      "calc(var(--col-width) * var(--span-clamped) + (var(--span-clamped) - 1) * var(--grid-gap))",
    // The height the declared shape asks for at the width the card
    // landed at. Published to the cell rather than kept for the span
    // arithmetic, because the cell takes it as a `min-height` — see
    // `--card-height` below for why it cannot be an `aspect-ratio`.
    "--aspect-height":
      "calc(var(--cell-width) * var(--aspect-h, 9) / var(--aspect-w, 16))",
    // `start`, not the default `stretch`. Stretched, a card grows to
    // fill the rows it was given INCLUDING the gutter rows, and the
    // gap closes to nothing. It is also what keeps the measurement
    // below from chasing its own tail: the card's height decides the
    // span, and the span must not decide the card's height back.
    //
    // In the BASE tier rather than with the span it protects, because
    // the un-measured first paint is a plain grid and stretch there
    // means a short card grows to the tallest in its row, then snaps
    // back the moment packing starts — with `GridItem` publishing the
    // stretched height as `--card-height` in between. Started, every
    // card is already at its final height before the JS lands. The
    // `grid-lanes` tier resets this to `auto`, which still wins: it
    // is later, and this adds no specificity to outrank it with.
    alignSelf: "start",
  },

  "@supports (grid-row: span calc(tan(atan2(1px, 1px))))": {
    // Gated on the measurement, and inside `:where()` so the gate
    // costs no specificity — the `grid-lanes` tier below is a bare
    // `&`, and it has to keep winning on SOURCE ORDER alone. A plain
    // `&[data-measured]` would outrank it and take that tier out
    // wherever both apply.
    //
    // Until the grid is measured this whole tier is simply absent,
    // which leaves a plain grid: right column count, right shapes
    // (the cells' `min-height` needs no measurement), rows aligned
    // rather than packed. That is the deliberate first paint — the
    // alternative was admitting `--grid-width`'s `100cqw` fallback
    // into the `atan2`, which is the WebKit failure itself, and
    // dropping the fallback instead makes the whole `grid-row`
    // invalid-at-computed-value-time, i.e. `auto` over 1px rows:
    // every card one pixel tall until the JS lands.
    "&:where([data-measured])": {
      gridAutoRows: "1px",
      rowGap: "0",
      "& > *": {
        // Height, then the gutter, both as counts of 1px rows. `row-gap`
        // is zero above precisely so the second term can be the gap —
        // a real row-gap would apply between every 1px track and turn a
        // 20px gutter into 20px times the height of the card.
        //
        // The height is the LARGER of the shape's and the card's own.
        // The shape is a floor, not a fixed height: a demo frame stops
        // shrinking with its width at its content's height plus its
        // padding, so a card too narrow for its shape to hold its
        // contents is taller than its shape — which is every card at
        // one column, and most of them at two. Reserving the shape's
        // height there packed the next card into rows this one was
        // still drawing in, and the card, told to fill a cell shorter
        // than its contents, simply clipped them.
        //
        // `--card-height` is measured and published by the cell itself
        // (`GridItem`), because a rendered height is not a quantity CSS
        // can be asked for. Absent — before the first measurement, and
        // on the server — this falls back to the shape's height alone,
        // which is what the grid reserved before any of this existed.
        gridRow:
          "span calc(tan(atan2(max(var(--aspect-height), var(--card-height, 0px)), 1px)) + tan(atan2(var(--grid-gap), 1px)))",
      },
    },
  },

  // Last, so it wins on source order where both are supported.
  "@supports (display: grid-lanes)": {
    display: "grid-lanes",
    gridAutoRows: "auto",
    rowGap: "var(--grid-gap)",
    "& > *": {
      gridRow: "auto",
      alignSelf: "auto",
    },
  },

  // Narrow to wide: the tiers OVERLAP, so the wider one has to be the
  // later of the two.
  "@container projectsGrid (min-width: 640px)": {
    "&[data-columns='2'], &[data-columns='3']": { "--columns": "2" },
  },
  "@container projectsGrid (min-width: 960px)": {
    width: "min(100%, token(sizes.listingGrid3Up))",
    "&[data-columns='3']": { "--columns": "3" },
  },
});

export function HomeGrid({ cards, editable = false, demos }: HomeGridProps) {
  const draft = useGridDraftStore();
  const [insert, setInsert] = useState<PendingInsert | null>(null);
  const [pick, setPick] = useState<PendingPick | null>(null);
  const [confirmUnpublish, setConfirmUnpublish] = useState<{
    key: string;
  } | null>(null);

  // The card whose properties panel is open, keyed on the CARD and not on its
  // seat. Pinning slides its neighbours along and unpublishing takes one out
  // entirely, so a stored index would strand the open panel on whatever moved
  // into that slot — customising the wrong card. Pinning to the key makes "the
  // panel follows its card" and "the panel closes when its card is gone" fall
  // out of a plain lookup, with no effect keeping them in step.
  const [propertiesKey, setPropertiesKey] = useState<string | null>(null);
  // Closing goes through the PANEL, never through this state directly — see
  // `togglePropertiesPanel`.
  const propertiesPanelRef = useRef<PropertiesPanelHandle>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  useGridWidth(gridRef);

  // The card the last move acted on. Held rather than flashed: you nudge a card
  // several times to get it where you want, and a ring that faded after each
  // press would be gone exactly when you look up to find what moved.
  const [movedKey, setMovedKey] = useState<string | null>(null);

  // Outside edit mode the draft is not applied at all, so a layout left
  // unsaved never leaks onto the page a visitor sees.
  const shown = useMemo(
    () => (editable ? applyGridDraft(cards, draft) : cards),
    [cards, draft, editable],
  );

  // How many columns this grid gets at its widest, and therefore how wide a
  // single card may be told to span. One number for both, read off the same
  // call: a card offered a fourth column in a three-column grid would be
  // clamped back down by the CSS and the control would do nothing.
  const columns = listingColumnsFor(shown.length);

  // Read out of the DRAFTED list rather than off the card the button was
  // pressed on: the panel edits the draft, so a value read from the server's
  // copy would spring back to the stored one the moment it was changed.
  const propertiesCard =
    shown.find((card) => card.key === propertiesKey) ?? null;

  /**
   * The registry entry behind the card the panel is open on — which is what
   * decides WHICH sections it gets.
   *
   * The registry answers what a card CAN carry, because that is a fact about
   * the code: whether the demo logs at all, and whether the entry is a card
   * rather than a specimen. The row answers what it currently says — the log
   * panel's state, the card's own content. Offering a log control on a demo
   * that does not log would be a switch over nothing, and offering the link
   * card's sections on a scheduler would be three.
   */
  const propertiesEntry =
    propertiesCard?.kind === "component"
      ? getDemoComponent(propertiesCard.componentId)
      : undefined;

  /**
   * What the panel may offer for this card's log output — nothing at all
   * unless the demo behind it logs.
   */
  const propertiesLogger =
    propertiesCard?.kind === "component" && propertiesEntry?.logger
      ? {
          shown: propertiesCard.logger,
          onShownChange: (visible: boolean) =>
            draft.setLogger(propertiesCard.key, visible),
        }
      : undefined;

  /**
   * The card the panel authors — for the one entry that IS one.
   *
   * Gated on the registry's `card` rather than on the componentId, so the fact
   * that decides how the tile RENDERS (see `ComponentCard`) is the same fact
   * that decides which sections the rail offers. A card drawn bare with no
   * sections to fill it in, or sections over a framed demo, are the two ways
   * those could disagree.
   */
  const propertiesLinkCard =
    propertiesCard?.kind === "component" && propertiesEntry?.card
      ? {
          config: propertiesCard.props ?? {},
          onChange: (config: LinkCardConfig) =>
            draft.setProps(propertiesCard.key, config),
          onPickMedia: (slot: CardMediaSlot) =>
            setPick({ key: propertiesCard.key, slot }),
          onPickDocument: () => setPick({ key: propertiesCard.key }),
        }
      : undefined;

  /**
   * A post's card — the picture, the line and the scrim, which are the things
   * about it the post does not decide. What the post DOES say goes with them:
   * its own picture, so the rail can start the Media section from what the
   * card is wearing, and its own meta line, so the rail offers to write one
   * only where there is none.
   */
  const propertiesPostCard =
    propertiesCard?.kind === "post"
      ? {
          config: propertiesCard.card,
          cover: propertiesCard.cover,
          meta: propertiesCard.date,
          onChange: (config: PostCardConfig) =>
            draft.setCard(propertiesCard.key, config),
          onPickMedia: (slot: CardMediaSlot) =>
            setPick({ key: propertiesCard.key, slot }),
        }
      : undefined;

  /** The card a library dialog is filling a slot on, re-read from the draft. */
  const picked = shown.find((card) => card.key === pick?.key) ?? null;

  /**
   * Put the file the dialog handed back into whichever slot asked for it.
   *
   * One handler for both dialogs and both kinds of card, because "which slot"
   * was decided when the dialog was OPENED and is sitting in `pick` —
   * branching on it here keeps the two dialogs to their one real difference,
   * which is what they list. Which RECORD the file lands in is the card's
   * kind: a post's card is its own column, a link card's is its `props`.
   */
  function fillPickedSlot(payload: ImageInsertPayload) {
    if (!pick || !picked) return;
    if (picked.kind === "post") {
      // A post's rail offers pictures alone — its destination is its slug —
      // so a pick with no slot cannot have come from one.
      if (pick.slot) {
        draft.setCard(pick.key, {
          ...picked.card,
          media: { ...picked.card.media, [pick.slot]: mediaNodeFrom(payload) },
        });
      }
    } else {
      const config = picked.props ?? {};
      draft.setProps(
        pick.key,
        pick.slot
          ? {
              ...config,
              media: { ...config.media, [pick.slot]: mediaNodeFrom(payload) },
            }
          : {
              ...config,
              // Only the URL travels. A document is FETCHED rather than drawn,
              // so the kind and the pixel shape the payload also carries
              // describe nothing about it — `mediaKindOf` answers "image" for
              // a PDF because every caller before this one had already ruled
              // documents out.
              link: {
                kind: "document",
                href: payload.src,
                newTab: config.link?.newTab,
              },
            },
      );
    }
    setPick(null);
  }

  /**
   * Opens the panel for a card — or closes it, if that card's is the one
   * already open.
   *
   * Closing ASKS the panel rather than dropping it from the tree: clearing
   * this state unmounts it on the spot and takes its closing slide with it. It
   * calls back once it has finished leaving. Same arrangement as the
   * collection editor's, for the same reason.
   */
  function togglePropertiesPanel(key: string) {
    if (propertiesKey === key) {
      propertiesPanelRef.current?.dismiss();
      return;
    }
    setPropertiesKey(key);
  }

  return (
    <section aria-label="Work" className={containerStyle}>
      {/* `data-measured` is written by the observer rather than rendered here,
          and has to be: it says the grid has been laid out, which is not a
          fact the server or the first render can know. */}
      <div ref={gridRef} className={masonryGridStyle} data-columns={columns}>
        {shown.map((card, index) => (
          <GridItem
            key={card.key}
            aspect={card.aspect}
            span={card.span}
            editing={editable}
            pinned={card.gridIndex !== null}
            canMoveBack={index > 0}
            canMoveForward={index < shown.length - 1}
            label={card.kind === "post" ? card.title : card.componentId}
            onTogglePin={() => {
              draft.setPin(card.key, card.gridIndex === null ? index : null);
              // Releasing a pin hands the card back to chronology, so it is no
              // longer anywhere you put it and the ring would be pointing at
              // a placement that no longer exists.
              if (card.key === movedKey) setMovedKey(null);
            }}
            moved={card.key === movedKey}
            onMoveBack={() => {
              draft.setPin(
                card.key,
                Math.max(0, (card.gridIndex ?? index) - 1),
              );
              setMovedKey(card.key);
            }}
            onMoveForward={() => {
              draft.setPin(card.key, (card.gridIndex ?? index) + 1);
              setMovedKey(card.key);
            }}
            // Width, which is a separate axis from placement: a card is
            // widened where it stands, so neither of these touches its seat or
            // the "just moved" ring. Clamped here rather than in the store,
            // because the ceiling belongs to the grid rather than to the draft
            // — the same card is allowed a third column on a page with three
            // cards on it and only a second on a page with two.
            canAddColumn={card.span < columns}
            canRemoveColumn={card.span > 1}
            onAddColumn={() =>
              draft.setSpan(card.key, Math.min(columns, card.span + 1))
            }
            onRemoveColumn={() =>
              draft.setSpan(card.key, Math.max(1, card.span - 1))
            }
            // Shape, which is neither placement nor width: it belongs to the
            // card's own record and overrides whatever default it had — the
            // registry's for a component, 16:9 for a post. Per PUBLICATION,
            // not per demo, so the same component shown twice can be wide in
            // one slot and square in the other.
            onAspectChange={(aspect) => draft.setAspect(card.key, aspect)}
            // Everything else about the card — for a logging demo, whether its
            // log output is on show — is edited in the docked panel below.
            propertiesOpen={propertiesKey === card.key}
            onToggleProperties={() => togglePropertiesPanel(card.key)}
            // Only a component can be retired from here. An article is
            // unpublished from its own page, and offering a second route to it
            // from a tile would be two places to get it wrong.
            onUnpublish={
              card.kind === "component"
                ? () => setConfirmUnpublish({ key: card.key })
                : undefined
            }
            onInsertBefore={() => setInsert({ index })}
            onInsertAfter={() => setInsert({ index: index + 1 })}
          >
            <div className={fillStyle} data-inert={editable ? "" : undefined}>
              {card.kind === "post" ? (
                <PostCard card={card} editable={editable} />
              ) : (
                <ComponentCard
                  card={card}
                  demo={demos?.[card.key]}
                  editable={editable}
                />
              )}
            </div>
          </GridItem>
        ))}
      </div>

      {/* A SIBLING of the grid, not a child of the cell it edits: one docked
          surface for the whole grid, since only one card can be inspected at a
          time. It is fixed to the viewport (and portals to the body to get
          there), so it takes no space here and needs none. */}
      {editable && propertiesCard && (
        <CardPropertiesPanel
          ref={propertiesPanelRef}
          // Remounted per card, so a panel reopened on another one starts from
          // that card's values rather than the previous card's.
          key={propertiesCard.key}
          logger={propertiesLogger}
          linkCard={propertiesLinkCard}
          postCard={propertiesPostCard}
          onDismiss={() => setPropertiesKey(null)}
        />
      )}

      {/* Mounted only while editing, and that is a correctness requirement
          rather than a saving. A closed `<dialog>` still renders its contents
          into the document, so mounting these on the public page put "You are
          about to unpublish this component" into the HTML every visitor
          receives — invisible, but there, and admin surface on a page that has
          no admin. Found by the e2e check that asserts an anonymous visitor is
          shown no admin commands. */}
      {editable && (
        <>
          <ComponentInsertDialog
            open={insert !== null}
            onClose={() => setInsert(null)}
            onInsert={(componentId) => {
              // Pinned to the seat by default: you chose this spot, so the card
              // stays in it rather than drifting the next time something ships.
              // The palette's "New widget…" passes null here instead — it was
              // chosen from a list with no spot in mind.
              draft.addInsert(pendingInsertFor(componentId, insert?.index ?? 0));
              setInsert(null);
            }}
          />

          {/* The two library dialogs the rail opens — one for pictures, one for
              documents. They live HERE and not in the panel: the panel is a
              portalled, fixed surface with its own outside-press dismiss, and a
              modal opened from inside it would be a second surface fighting the
              first for every press. The panel exempts `dialog` from that
              dismiss so it survives the round trip.

              Two elements rather than one with a switched `accepts`, because
              the hook resets its whole state on `open` and re-reads the
              library: one element toggling between the halves would refetch and
              re-anchor on every switch, and the two are never open at once
              anyway — `pick` holds exactly one slot. */}
          <ImageInsertDialog
            open={pick !== null && pick.slot !== undefined}
            mode="change"
            initialPhase="library"
            onClose={() => setPick(null)}
            onInsert={fillPickedSlot}
          />

          <ImageInsertDialog
            open={pick !== null && pick.slot === undefined}
            accepts="document"
            mode="change"
            initialPhase="library"
            onClose={() => setPick(null)}
            onInsert={fillPickedSlot}
          />

          <ConfirmDialog
            open={confirmUnpublish !== null}
            title="Unpublish Component"
            message="You are about to unpublish this component. Do you want to proceed?"
            confirmLabel="Unpublish"
            confirmIcon={UnpublishIcon}
            onConfirm={() => {
              if (confirmUnpublish) draft.remove(confirmUnpublish.key);
            }}
            onClose={() => setConfirmUnpublish(null)}
          />
        </>
      )}
    </section>
  );
}

/**
 * A post's tile: the post's own words and destination, over whatever picture
 * and band its author has said anything about.
 *
 * Resolved HERE, at render, rather than on the server where `cover` was read:
 * the rail edits `card` through the draft, and a picture chosen before the
 * page was rebuilt could not show the choice until it was.
 *
 * The post's own meta line WINS over the authored one, which is the rule that
 * keeps the rail honest rather than a preference between two values: an
 * article is filed by its date, so the rail offers no Meta row on one at all
 * (see `PostCardSections`), and a project promoted to an article gets its date
 * rather than a line no control on screen would then admit to.
 */
function PostCard({
  card,
  editable,
}: {
  card: Extract<GridCard, { kind: "post" }>;
  editable: boolean;
}) {
  const { light, dark } = postCardMedia(card.card, card.cover);
  return (
    <LinkCard
      href={card.href}
      title={card.title}
      aspect={card.aspect}
      meta={card.date ?? card.card.meta}
      cover={light}
      coverDark={dark}
      scrim={card.card.scrim}
      tone={card.card.tone}
      interactive={!editable}
    />
  );
}

/** A published demo, rendered in the frame the article renderer gives it. */
function ComponentCard({
  card,
  demo,
  editable,
}: {
  card: Extract<GridCard, { kind: "component" }>;
  /** The page's own render of this demo, if it had one. */
  demo?: ReactNode;
  editable: boolean;
}) {
  const entry = getDemoComponent(card.componentId);
  if (!entry) return null;

  // The one entry that is not a specimen. It draws itself, and it draws itself
  // BARE — a frame is a box that says "this is a prototype, and it ends here",
  // which is the wrong sentence for a tile whose whole job is to be one of the
  // cards on this grid. Its content is the row's own `props`, so there is no
  // chunk to fetch and no preloader between placing it and seeing it.
  if (entry.card) {
    const config = card.props ?? {};
    return (
      <LinkCard
        href={linkCardHref(config)}
        title={config.content?.title}
        meta={config.content?.meta}
        // A card may be a picture with no words on it, and the picture is
        // decorative — so without this the link would be announced as its own
        // URL. `linkCardTitle` falls back to the destination's own name.
        label={linkCardTitle(config)}
        aspect={card.aspect}
        cover={config.media?.light}
        coverDark={config.media?.dark}
        scrim={config.content?.scrim}
        tone={config.content?.tone}
        newTab={config.link?.newTab}
        interactive={!editable}
      />
    );
  }

  const frame = (
    // The card says WHETHER the log panel shows; the registry says what it
    // shows — a demo's empty hint, say. Handing the frame a bare `true` would
    // turn the panel on and drop the configuration that goes with it, so the
    // entry's own value is what travels once the card has said yes. `true` is
    // the fallback for a row that was told to log a demo the registry has no
    // logger for, which the panel does not offer but a hand-edited row can.
    <DemoFrame
      aspectRatio={card.aspect}
      logger={card.logger ? entry.logger ?? true : false}
      chrome={entry.chrome}
      fill={entry.fill}
    >
      {/* The page's node when it sent one, and the browser's loader otherwise.
          A plain `??` rather than a branch on the demo's identity: which demos
          the server can render is `server-demos.tsx`'s business, and the grid
          only needs to know whether this card came with one. */}
      {demo ?? <DemoComponent entry={entry} aspect={card.aspect} />}
    </DemoFrame>
  );

  if (!entry.link) return frame;

  return (
    // Out of the TAB ORDER while editing, not merely inert to the pointer —
    // the same rule `LinkCard` follows and for the same reason: Enter on a
    // focused link navigates just as well as a click, and navigating away
    // during an edit takes the unsaved layout with it.
    <a
      href={entry.link.href}
      aria-label={entry.link.label}
      className={demoLinkStyle}
      tabIndex={editable ? -1 : undefined}
    >
      {frame}
    </a>
  );
}
