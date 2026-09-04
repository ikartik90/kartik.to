"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import type { Temporal } from "@js-temporal/polyfill";
import type {
  Calchemy,
  ExpectedDateValue,
  ParseDateContext,
} from "@calchemy/date-core";
import { parseQuery, type QueryCandidate } from "@/utils/calchemy-query";

// ---------------------------------------------------------------------------
// The phrase, and everything that follows from it — shared by the playground
// and by the article's demo, which are the same instrument at two sizes.
//
// The state is small but the RULES between its parts are not, which is what
// makes this a hook rather than four `useState`s at each call site:
//
//   • the highlight and the commitment are different things. The highlight
//     moves freely and the days follow it, so walking the readings shows what
//     each one would select; committing is the separate act that settles on
//     one. Drawing the committed reading instead would make the arrows silent.
//   • both are dropped by a new phrase and by a new kind, because either can
//     change what the readings even ARE — a highlight carried over would point
//     at a reading that no longer exists.
//   • an unparseable phrase is not an error. The box is being typed INTO, so
//     every prefix of a good phrase is a bad one.
// ---------------------------------------------------------------------------

export interface CalchemyQuery {
  /** The phrase as typed. */
  query: string;
  /** Replace it — which also drops the highlight and the commitment. */
  setQuery: (next: string) => void;
  /** The days the phrase means, in order. Empty while it means nothing yet. */
  dates: Temporal.PlainDate[];
  /** The readings to choose between; empty unless there is a real choice. */
  candidates: QueryCandidate[];
  /** Which reading is being previewed on the calendar. */
  activeId: string | null;
  /** Which reading has been settled on, if any. */
  committed: string | null;
  /** Point the highlight at one reading — a hover, or a click. */
  preview: (id: string) => void;
  /** Walk it by `step` readings, wrapping at both ends. */
  movePreview: (step: number) => void;
  /**
   * Settle on one reading by name — a click, which names the row it landed on
   * rather than the row the arrows were sitting on.
   */
  commit: (id: string | null) => void;
  /** Settle on whichever reading is highlighted — what Enter does. */
  commitPreview: () => void;
  /**
   * Arrow/Enter handling for the field the phrase is typed into — the field
   * keeps focus and the highlight moves under it, the command palette's
   * arrangement. Inert while there is no choice to make, so it is safe to hand
   * to the box unconditionally.
   */
  onKeyDown: (event: KeyboardEvent) => void;
}

export function useCalchemyQuery(
  calchemy: Calchemy | null,
  context?: ParseDateContext,
  kind: ExpectedDateValue = "multiple",
): CalchemyQuery {
  const [query, setQueryState] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [committed, setCommitted] = useState<string | null>(null);

  // Parsed on every render rather than cached: a phrase costs microseconds,
  // and the calendar asks for its navigation target during the very keystroke
  // that sets this state — so at the moment a cache would be read there is
  // nothing in it yet.
  const { dates, candidates, activeId } = useMemo(
    () =>
      calchemy
        ? parseQuery(calchemy, query, context, kind, active ?? undefined)
        : { dates: [], candidates: [], activeId: null },
    [calchemy, query, context, kind, active],
  );

  // A phrase that no longer offers the reading it was left on: the highlight is
  // dropped rather than followed, and `parseQuery` has already fallen back to
  // the first, which is what `activeId` reports.
  const movePreview = (step: number) => {
    if (candidates.length === 0) return;
    const at = candidates.findIndex((candidate) => candidate.id === activeId);
    const next = (at + step + candidates.length) % candidates.length;
    setActive(candidates[next].id);
  };

  return {
    query,
    setQuery: (next) => {
      setQueryState(next);
      setActive(null);
      setCommitted(null);
    },
    dates,
    candidates,
    activeId,
    committed,
    preview: setActive,
    movePreview,
    commit: setCommitted,
    commitPreview: () => setCommitted(activeId),
    onKeyDown: (event) => {
      if (candidates.length === 0) return;

      if (event.key === "Enter") {
        event.preventDefault();
        setCommitted(activeId);
        return;
      }

      const step =
        event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
      if (step === 0) return;

      event.preventDefault();
      movePreview(step);
    },
  };
}
