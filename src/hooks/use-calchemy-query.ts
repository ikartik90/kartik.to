"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import type { Temporal } from "@js-temporal/polyfill";
import type {
  Calchemy,
  ExpectedDateValue,
  ParseDateContext,
} from "@calchemy/date-core";
import { parseQuery, type QueryCandidate } from "@/utils/calchemy-query";

// Phrase state shared by the playground and the article demo. The highlight and the
// commitment are separate, and a new phrase or kind drops both.

export interface CalchemyQuery {
  query: string;
  /** Also drops the highlight and the commitment. */
  setQuery: (next: string) => void;
  dates: Temporal.PlainDate[];
  candidates: QueryCandidate[];
  /** Which reading is being previewed on the calendar. */
  activeId: string | null;
  /** Which reading has been settled on, if any. */
  committed: string | null;
  /** A readable phrase to offer in place of an unreadable one; taken via `setQuery`. */
  suggestion: string | null;
  preview: (id: string) => void;
  movePreview: (step: number) => void;
  commit: (id: string | null) => void;
  commitPreview: () => void;
  /** Arrow/Enter handling for the input; inert when there is no choice. */
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

  const { dates, candidates, activeId, suggestion } = useMemo(
    () =>
      calchemy
        ? parseQuery(calchemy, query, context, kind, active ?? undefined)
        : { dates: [], candidates: [], activeId: null, suggestion: null },
    [calchemy, query, context, kind, active],
  );

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
    suggestion,
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
