import { orderGridItems } from "@/utils/grid-order";
import type { GridCard } from "@/lib/grid";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";
import type { LinkCardConfig } from "@/domain/link-card";

// ---------------------------------------------------------------------------
// Unsaved edits to the grid's layout, and how they are shown before they are
// saved.
//
// The grid is edited the way an article is: you change things, you see them,
// and then you either publish or throw the lot away. That means the edits
// cannot go straight to the database as they are made — a "Discard and exit"
// that had already written everything would have nothing to discard.
//
// So the server's list stays untouched and a draft sits on top of it. This
// function is the projection of one through the other, and it is pure: the
// input array is never mutated, because it is the copy a discard restores.
// ---------------------------------------------------------------------------

/** A component chosen from the picker but not yet written to the database. */
export interface PendingComponentInsert {
  /** A temporary key, standing in for the row id it does not have yet. */
  key: string;
  componentId: string;
  /** The seat it was inserted at — a `[+]` places what it publishes. */
  index: number;
  aspect: DemoFrameAspectRatio;
  logger: boolean;
}

export interface GridDraft {
  /** Card key → its new seat, or null to release it. */
  pins: Record<string, number | null>;
  /**
   * Card key → how many columns it should occupy.
   *
   * Its own record rather than a field on the card, and separate from `pins`,
   * because position and width are edited independently: a card can be widened
   * without being pinned, and moved without being resized. Merging the two into
   * one "placement" record would mean every widen had to carry a seat it was
   * not changing.
   */
  spans: Record<string, number>;
  /**
   * Card key → the shape it should be drawn at.
   *
   * Buffered here with the placements even though it is NOT one: a shape
   * belongs to the card's own record — a component's `aspect` override, a
   * post's — where a pin and a span describe where the card sits on the grid.
   * It rides along because it is edited in the same session by the same rail
   * and has to be thrown away by the same "Discard and exit"; the two part
   * company at the write, not here.
   */
  aspects: Record<string, DemoFrameAspectRatio>;
  /**
   * Card key → whether its log output is on show.
   *
   * A property of the card's own record, like the shape above and for the same
   * reason it rides here rather than with the placements: it is edited in the
   * same session, from the same rail, and has to be thrown away by the same
   * "Discard and exit".
   *
   * COMPONENTS only — a post card has no log panel, and no column to record one
   * in. Nothing here enforces that: what a key names is the caller's business
   * everywhere else in this draft too, and the write is where a post is turned
   * away (see `saveGridLayout`).
   */
  loggers: Record<string, boolean>;
  /**
   * Card key → the configuration it carries.
   *
   * The odd one out among these records, and worth saying why it still belongs
   * here. Every other entry is an OVERRIDE — a seat instead of chronology, a
   * shape instead of the registry's — so an absent key means "whatever the row
   * or the registry already said". This one is not an override of anything: for
   * a link card the blob IS the card, because the registry entry is a shell (see
   * `LinkCardConfigSchema`). It rides along for the reason the shape and the log
   * panel do — edited in the same session, from the same rail, and thrown away
   * by the same "Discard and exit".
   *
   * The value REPLACES what is stored rather than merging into it. The rail
   * hands back the whole configuration on every change, and a merge would make
   * clearing anything impossible: the absent key would fall through to the
   * stored one forever, so a title you deleted would come back.
   */
  props: Record<string, LinkCardConfig>;
  inserts: PendingComponentInsert[];
  /** Card keys to take off the grid. */
  removals: string[];
}

export function emptyGridDraft(): GridDraft {
  return {
    pins: {},
    spans: {},
    aspects: {},
    loggers: {},
    props: {},
    inserts: [],
    removals: [],
  };
}

/** Whether a draft holds anything worth saving — drives the exits' wording. */
export function isGridDraftDirty(draft: GridDraft): boolean {
  return (
    Object.keys(draft.pins).length > 0 ||
    Object.keys(draft.spans).length > 0 ||
    Object.keys(draft.aspects).length > 0 ||
    Object.keys(draft.loggers).length > 0 ||
    Object.keys(draft.props).length > 0 ||
    draft.inserts.length > 0 ||
    draft.removals.length > 0
  );
}

/** A card the grid is showing that has no row behind it yet. */
export type DraftedGridCard = GridCard & { pending?: boolean };

/**
 * What the grid should show: the server's cards, with the draft applied.
 *
 * Removals are taken out before anything else, so an insert that was added and
 * then removed again simply never appears — the two cancel and neither reaches
 * the server.
 */
export function applyGridDraft(
  cards: GridCard[],
  draft: GridDraft,
): DraftedGridCard[] {
  const removed = new Set(draft.removals);

  const kept: DraftedGridCard[] = cards
    .filter((card) => !removed.has(card.key))
    .map((card) => {
      // Only rebuild the ones the draft actually touched, so an untouched
      // grid comes back identical and a no-op draft is provably a no-op.
      const pinned = card.key in draft.pins;
      const widened = card.key in draft.spans;
      const reshaped = card.key in draft.aspects;
      // A post cannot carry one, so a stray key naming one is ignored here
      // rather than spreading a `logger` field onto a card that has no such
      // property to be read back off it.
      const logged = card.kind === "component" && card.key in draft.loggers;
      // Same rule as `logged`: a post has no configuration to carry, so a key
      // naming one is ignored rather than spreading a `props` field onto a card
      // with no such property to read it back off.
      const configured = card.kind === "component" && card.key in draft.props;
      if (!pinned && !widened && !reshaped && !logged && !configured)
        return card;
      return {
        ...card,
        // Both applied in one rebuild, because a card that was moved AND
        // widened in the same session has to come out with both. Spread
        // conditionally rather than written unconditionally: `...null`
        // contributes nothing, so an untouched field keeps the server's value
        // instead of being overwritten with an undefined.
        ...(pinned ? { gridIndex: draft.pins[card.key] } : null),
        ...(widened ? { span: draft.spans[card.key] } : null),
        ...(reshaped ? { aspect: draft.aspects[card.key] } : null),
        // Spread conditionally like the rest, and here it is load-bearing
        // twice over: `false` is a real value — hiding the panel on a demo the
        // registry logs by default — so a `??` merge would drop exactly the
        // edit the control exists to make.
        ...(logged ? { logger: draft.loggers[card.key] } : null),
        // Spread conditionally like the rest, and the whole blob at once —
        // never merged into the stored one. See `GridDraft.props`.
        ...(configured ? { props: draft.props[card.key] } : null),
      };
    });

  const added: DraftedGridCard[] = draft.inserts
    .filter((insert) => !removed.has(insert.key))
    .map((insert) => ({
      kind: "component",
      key: insert.key,
      // No row exists yet, so there is no id to carry. `pending` is what stops
      // this key being mistaken for one and sent to the server.
      id: "",
      pending: true,
      componentId: insert.componentId,
      // The registry's default for this demo, unless the panel has already
      // been used on the card — the same rule the shape below follows, and for
      // the same reason: an override made before the row exists still has to
      // reach the card on screen.
      logger: draft.loggers[insert.key] ?? insert.logger,
      // The registry's default for this demo, unless the picker has already
      // been used on the card — an override made before the row exists still
      // has to reach the card on screen.
      aspect: draft.aspects[insert.key] ?? insert.aspect,
      // A link card is PLACED and then filled in, so the row does not exist for
      // the whole first half of authoring one. Empty until the rail has been
      // used, which is a blank card rather than a broken one.
      props: draft.props[insert.key] ?? {},
      // An unsaved card is widened by the same control as a saved one, so the
      // draft's `spans` has to answer for it too. One column until it does.
      span: draft.spans[insert.key] ?? 1,
      gridIndex:
        insert.key in draft.pins ? draft.pins[insert.key] : insert.index,
      // Newest, so an unpinned insert lands at the front rather than the back.
      publishedAt: new Date(8640000000000000),
    }));

  return orderGridItems([...kept, ...added]);
}
