"use client";

import { useMemo, useState } from "react";
import { css } from "../../styled-system/css";
import { masonryGrid } from "../../styled-system/recipes";
import { ComponentInsertDialog } from "@/components/component-insert-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DemoComponent } from "@/components/demo-component";
import { DemoFrame } from "@/components/demo-frame";
import { GridItem } from "@/components/grid-item";
import { LinkCard } from "@/components/link-card";
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

// The cards fill their cell rather than sizing themselves: the cell owns the
// shape (it carries the aspect the grid computed a row span from), so a card
// that also sized itself could disagree with the space reserved for it.
const fillStyle = css({
  position: "absolute",
  inset: 0,
  "& > *": { height: "token(spacing.full)" },

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
}

export function HomeGrid({ cards, editable = false }: HomeGridProps) {
  const draft = useGridDraftStore();
  const [insert, setInsert] = useState<PendingInsert | null>(null);
  const [confirmUnpublish, setConfirmUnpublish] = useState<{
    key: string;
  } | null>(null);

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

  return (
    <section aria-label="Work" className={containerStyle}>
      <div className={masonryGrid()} data-columns={columns}>
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
                <ComponentCard card={card} />
              )}
            </div>
          </GridItem>
        ))}
      </div>

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
}: {
  card: Extract<GridCard, { kind: "component" }>;
}) {
  const entry = getDemoComponent(card.componentId);
  if (!entry) return null;
  return (
    <DemoFrame aspectRatio={card.aspect} logger={card.logger}>
      <DemoComponent entry={entry} />
    </DemoFrame>
  );
}
