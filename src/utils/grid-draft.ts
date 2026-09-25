import { orderGridItems } from "@/utils/grid-order";
import type { GridCard } from "@/lib/grid";
import type { DemoFrameAspectRatio } from "@/utils/demo-frame-sizing";
import type { LinkCardConfig } from "@/domain/link-card";
import type { PostCardConfig } from "@/domain/post";

// Pure: the server's card list is never mutated, because it is the copy a discard restores.

export interface PendingComponentInsert {
  key: string;
  componentId: string;
  /** Null for a palette insert, which arrives unpinned. */
  index: number | null;
  aspect: DemoFrameAspectRatio;
  logger: boolean;
}

export interface GridDraft {
  /** Null releases the pin. */
  pins: Record<string, number | null>;
  spans: Record<string, number>;
  aspects: Record<string, DemoFrameAspectRatio>;
  /** Components only; the write turns a post away. */
  loggers: Record<string, boolean>;
  /** Replaces what is stored, never merges: a merge could never clear a field. Components only. */
  props: Record<string, LinkCardConfig>;
  /** Replaces what is stored, like `props`. Posts only. */
  cards: Record<string, PostCardConfig>;
  inserts: PendingComponentInsert[];
  removals: string[];
}

/** One app-wide counter: two would hand out `pending:1` twice. */
let pendingSeq = 0;
export function nextPendingKey(): string {
  return `pending:${(pendingSeq += 1)}`;
}

export function emptyGridDraft(): GridDraft {
  return {
    pins: {},
    spans: {},
    aspects: {},
    loggers: {},
    props: {},
    cards: {},
    inserts: [],
    removals: [],
  };
}

export function isGridDraftDirty(draft: GridDraft): boolean {
  return (
    Object.keys(draft.pins).length > 0 ||
    Object.keys(draft.spans).length > 0 ||
    Object.keys(draft.aspects).length > 0 ||
    Object.keys(draft.loggers).length > 0 ||
    Object.keys(draft.props).length > 0 ||
    Object.keys(draft.cards).length > 0 ||
    draft.inserts.length > 0 ||
    draft.removals.length > 0
  );
}

export type DraftedGridCard = GridCard & { pending?: boolean };

export function applyGridDraft(
  cards: GridCard[],
  draft: GridDraft,
): DraftedGridCard[] {
  const removed = new Set(draft.removals);

  const kept: DraftedGridCard[] = cards
    .filter((card) => !removed.has(card.key))
    .map((card) => {
      // Untouched cards come back identical, so a no-op draft is provably a no-op.
      const pinned = card.key in draft.pins;
      const widened = card.key in draft.spans;
      const reshaped = card.key in draft.aspects;
      // A key naming the wrong kind of card is ignored rather than spread onto it.
      const logged = card.kind === "component" && card.key in draft.loggers;
      const configured = card.kind === "component" && card.key in draft.props;
      const dressed = card.kind === "post" && card.key in draft.cards;
      if (
        !pinned &&
        !widened &&
        !reshaped &&
        !logged &&
        !configured &&
        !dressed
      )
        return card;
      return {
        ...card,
        // Spread conditionally: `...null` keeps the server's value instead of writing undefined.
        ...(pinned ? { gridIndex: draft.pins[card.key] } : null),
        ...(widened ? { span: draft.spans[card.key] } : null),
        ...(reshaped ? { aspect: draft.aspects[card.key] } : null),
        ...(logged ? { logger: draft.loggers[card.key] } : null),
        ...(configured ? { props: draft.props[card.key] } : null),
        ...(dressed ? { card: draft.cards[card.key] } : null),
      };
    });

  const added: DraftedGridCard[] = draft.inserts
    .filter((insert) => !removed.has(insert.key))
    .map((insert) => ({
      kind: "component",
      key: insert.key,
      // `pending` stops this empty id from being sent to the server.
      id: "",
      pending: true,
      componentId: insert.componentId,
      // Draft overrides win over the insert's registry defaults.
      logger: draft.loggers[insert.key] ?? insert.logger,
      aspect: draft.aspects[insert.key] ?? insert.aspect,
      props: draft.props[insert.key] ?? {},
      span: draft.spans[insert.key] ?? 1,
      gridIndex:
        insert.key in draft.pins ? draft.pins[insert.key] : insert.index,
      // Max Date: newest, so an unpinned insert lands at the front.
      publishedAt: new Date(8640000000000000),
    }));

  return orderGridItems([...kept, ...added]);
}
