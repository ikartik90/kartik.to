import { Temporal } from "@js-temporal/polyfill";
import { resolveExpectedDateValue } from "@calchemy/date-core";
import type {
  Calchemy,
  ExpectedDateValue,
  ParseDateContext,
  ParseDateResult,
} from "@calchemy/date-core";

// ---------------------------------------------------------------------------
// Turn a typed phrase into the set of days a calendar should light up — the one
// thing both the playground and the article's demo actually do.
//
// Two resolutions, and they answer different questions.
//
// The first is the KIND the playground is set to, and it is a filter: asked for
// a `single` date, "mondays next month" resolves to nothing rather than to some
// arbitrary day out of the set, because the phrase does not mean one day. The
// parser owns that judgement (`resolveExpectedDateValue`), including the one
// coercion it allows — a duration from an anchor read as the day it lands on.
//
// The second is always `multiple`, and it is for DRAWING: a grid can only light
// up a set of days, so whatever survived the first resolution is flattened into
// one. A single date becomes a set of one and a range becomes every day it
// covers.
//
// An unparseable phrase is not an error here — it is an empty selection. The
// input is being typed INTO, so every prefix of a good query is a bad one, and
// a playground that shouted at each keystroke would be unusable.
// ---------------------------------------------------------------------------

/**
 * The days `query` resolves to, in chronological order — empty when the phrase
 * does not (yet) parse, or does not mean the `kind` asked for.
 */
export function parseQueryDates(
  calchemy: Calchemy,
  query: string,
  context?: ParseDateContext,
  kind: ExpectedDateValue = "multiple",
): Temporal.PlainDate[] {
  const meant = resolveExpectedDateValue(
    calchemy.parseDate(query, context),
    kind,
  );
  const result = resolveExpectedDateValue(meant, "multiple");

  if (result.status !== "valid" || result.value.kind !== "multiple") return [];

  return result.value.dates
    .map((date) => Temporal.PlainDate.from(date.toString()))
    .sort(Temporal.PlainDate.compare);
}


/** One reading of a phrase that has more than one. */
export interface QueryCandidate {
  /** What identifies the choice — `mdy`, `dmy`, and so on. */
  id: string;
  /** The reading in words: "March 4, 2025". */
  label: string;
}

export interface QueryAnswer {
  /** The days to draw. Empty while an ambiguity is unresolved. */
  dates: Temporal.PlainDate[];
  /**
   * The readings to choose between — empty unless the phrase genuinely has
   * more than one the chosen kind can use.
   */
  candidates: QueryCandidate[];
  /** Which reading `dates` came from, when there was a choice to make. */
  activeId: string | null;
  /**
   * The phrase the parser would have read instead, when it can work one out.
   * Null whenever there is nothing to correct — see `rewriteOf`.
   */
  suggestion: string | null;
}

/**
 * The rewrite the parser offers for a phrase it could not read: a backwards
 * range given the year that makes it run forwards ("tomorrow until march" →
 * "tomorrow until march 2027"), a numeric date given its dashes ("2020 03 15"
 * → "2020-03-15").
 *
 * Only ever taken from a FAILED parse, which is narrower than it sounds and
 * deliberately so. A phrase the chosen KIND turned down is not a typo —
 * "mondays next month" is perfectly readable, it simply does not mean one day —
 * and rewriting it would answer a question nobody asked. An ambiguous phrase is
 * not broken either: three readings is a choice, and it already has a list of
 * its own to make it in.
 */
function rewriteOf(result: ParseDateResult): string | null {
  if (result.status !== "invalid") return null;

  return (
    result.errors.find((error) => error.suggestedInput)?.suggestedInput ?? null
  );
}

/** The days a resolved result means, flattened for drawing. */
function drawableDates(result: ParseDateResult): Temporal.PlainDate[] {
  const asSet = resolveExpectedDateValue(result, "multiple");
  if (asSet.status !== "valid" || asSet.value.kind !== "multiple") return [];

  return asSet.value.dates
    .map((date) => Temporal.PlainDate.from(date.toString()))
    .sort(Temporal.PlainDate.compare);
}

/**
 * What `query` means, and — when that is more than one thing — the readings to
 * choose between.
 *
 * An ambiguous phrase PREVIEWS a reading: the one being pointed at is drawn, so
 * moving through the list shows what each would select rather than describing
 * it. Which is the point of a calendar — "April 3, 2025" and "March 4, 2025"
 * are two pieces of text, and two quite different pictures. The first is
 * previewed so the arrows have somewhere to start; committing is a separate
 * act, and belongs to the consumer.
 *
 * The readings are filtered by ATTEMPTING each against the chosen kind rather
 * than by comparing kinds, so one rule decides what a phrase may mean whether
 * or not it was ambiguous — including the coercion the parser allows. A
 * phrase whose readings all fall away under the current kind offers no choice,
 * because there is none to make.
 */
export function parseQuery(
  calchemy: Calchemy,
  query: string,
  context?: ParseDateContext,
  kind: ExpectedDateValue = "multiple",
  activeId?: string,
): QueryAnswer {
  const parsed = calchemy.parseDate(query, context);

  if (parsed.status !== "ambiguous") {
    return {
      dates: parseQueryDates(calchemy, query, context, kind),
      candidates: [],
      activeId: null,
      suggestion: rewriteOf(parsed),
    };
  }

  const usable = parsed.candidates
    .map((candidate) => ({
      candidate,
      resolved: resolveExpectedDateValue(
        {
          status: "valid",
          input: parsed.input,
          value: candidate.value,
          candidates: [candidate],
          corrections: parsed.corrections,
          warnings: parsed.warnings,
        },
        kind,
      ),
    }))
    .filter((reading) => reading.resolved.status === "valid");

  // No reading the kind can use: the phrase does not mean what is being asked
  // for, and offering readings that cannot be drawn would be worse than silence.
  if (usable.length === 0) {
    return { dates: [], candidates: [], activeId: null, suggestion: null };
  }

  // One reading left is not a choice — the kind already made it.
  if (usable.length === 1) {
    return {
      dates: drawableDates(usable[0].resolved),
      candidates: [],
      activeId: null,
      suggestion: null,
    };
  }

  // The reading being pointed at, or the first — which is also what a highlight
  // carried over from a phrase that no longer has it falls back to.
  const active =
    usable.find((reading) => reading.candidate.id === activeId) ?? usable[0];

  return {
    dates: drawableDates(active.resolved),
    candidates: usable.map(({ candidate }) => ({
      id: candidate.id,
      label: candidate.label,
    })),
    activeId: active.candidate.id,
    suggestion: null,
  };
}
