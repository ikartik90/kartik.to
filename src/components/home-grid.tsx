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
import { masonryGrid } from "../../styled-system/recipes";
import { CardPropertiesPanel } from "@/components/card-properties-panel";
import { ComponentInsertDialog } from "@/components/component-insert-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DemoComponent } from "@/components/demo-component";
import { DemoFrame } from "@/components/demo-frame";
import { GridItem } from "@/components/grid-item";
import { LinkCard } from "@/components/link-card";
import { type PropertiesPanelHandle } from "@/components/ui/properties-panel";
import { getDemoComponent } from "@/components/demo/registry";
import { listingColumnsFor } from "@/utils/listing-columns";
import { useGridDraftStore } from "@/store/grid-draft";
import { applyGridDraft } from "@/utils/grid-draft";
import type { GridCard } from "@/lib/grid";

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

/** Distinct per insert, so two of the same demo remain separate cards. */
let pendingSeq = 0;

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

export function HomeGrid({ cards, editable = false, demos }: HomeGridProps) {
  const draft = useGridDraftStore();
  const [insert, setInsert] = useState<PendingInsert | null>(null);
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
   * What the panel may offer for this card's log output — nothing at all
   * unless the demo behind it logs.
   *
   * The REGISTRY answers "can this card log", because that is a fact about the
   * demo's code; the card's own `logger` answers "is the panel on show", which
   * is this publication's override of the registry's default. Offering the
   * control on a demo with no logging would be a switch over nothing.
   */
  const loggerEntry =
    propertiesCard?.kind === "component"
      ? getDemoComponent(propertiesCard.componentId)
      : undefined;
  const propertiesLogger =
    propertiesCard?.kind === "component" && loggerEntry?.logger
      ? {
          shown: propertiesCard.logger,
          onShownChange: (visible: boolean) =>
            draft.setLogger(propertiesCard.key, visible),
        }
      : undefined;

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
      <div ref={gridRef} className={masonryGrid()} data-columns={columns}>
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
                <LinkCard
                  href={card.href}
                  title={card.title}
                  aspect={card.aspect}
                  date={card.date ?? undefined}
                  interactive={!editable}
                />
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
              const entry = getDemoComponent(componentId);
              // Pinned to the seat by default: you chose this spot, so the card
              // stays in it rather than drifting the next time something ships.
              draft.addInsert({
                key: `pending:${(pendingSeq += 1)}`,
                componentId,
                index: insert?.index ?? 0,
                aspect: entry?.aspectRatio ?? "3/2",
                logger: Boolean(entry?.logger),
              });
              setInsert(null);
            }}
          />

          <ConfirmDialog
            open={confirmUnpublish !== null}
            title="Unpublish Component"
            message="You are about to unpublish this component. Do you want to proceed?"
            confirmLabel="Unpublish"
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
