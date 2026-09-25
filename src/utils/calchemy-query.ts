import { Temporal } from "@js-temporal/polyfill";
import { resolveExpectedDateValue } from "@calchemy/date-core";
import type {
  Calchemy,
  ExpectedDateValue,
  ParseDateContext,
  ParseDateResult,
} from "@calchemy/date-core";

/** Chronological; empty while the phrase doesn't parse (yet) or doesn't mean `kind`. */
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


export interface QueryCandidate {
  id: string;
  label: string;
}

export interface QueryAnswer {
  dates: Temporal.PlainDate[];
  candidates: QueryCandidate[];
  activeId: string | null;
  suggestion: string | null;
}

/** The parser's rewrite of a FAILED parse only: a phrase the kind turned down is not a typo. */
function rewriteOf(result: ParseDateResult): string | null {
  if (result.status !== "invalid") return null;

  return (
    result.errors.find((error) => error.suggestedInput)?.suggestedInput ?? null
  );
}

function drawableDates(result: ParseDateResult): Temporal.PlainDate[] {
  const asSet = resolveExpectedDateValue(result, "multiple");
  if (asSet.status !== "valid" || asSet.value.kind !== "multiple") return [];

  return asSet.value.dates
    .map((date) => Temporal.PlainDate.from(date.toString()))
    .sort(Temporal.PlainDate.compare);
}

/** Like `parseQueryDates`, plus the readings of an ambiguous phrase, previewing the active one. */
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

  if (usable.length === 0) {
    return { dates: [], candidates: [], activeId: null, suggestion: null };
  }

  if (usable.length === 1) {
    return {
      dates: drawableDates(usable[0].resolved),
      candidates: [],
      activeId: null,
      suggestion: null,
    };
  }

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
