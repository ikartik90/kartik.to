import {
  BENCHMARK_CANDIDATES,
  CRITERIA,
  EXPECTED_RESULT,
  MIN_BENCHMARK_CANDIDATES,
  MISSES_ALLOWED,
  PREVIOUS_BENCHMARK,
  type Evaluation,
  type KnownOutcome,
} from "./harness-data";

// ---------------------------------------------------------------------------
// A benchmark's results, read off the fixture: which candidates the criteria
// would let through, and which of those calls disagree with what really
// happened to the candidate. The fixture records only the evaluations;
// everything a results row says beyond them is worked out here.
//
// Two kinds of run: a RETEST of the criteria as drafted — evaluated as the
// fixture has them, and a rewritten prompt as its rewrite re-evaluates — and
// the PREVIOUS run, the three criteria that were running before, as recorded.
// Retesting exactly those three, unchanged, gives the previous run again: the
// same prompts give the same answers.
// ---------------------------------------------------------------------------

export type Result = "included" | "excluded";

/** A criterion as it was tested: which one, and with what prompt. */
export interface TestedCriterion {
  id: string;
  prompt: string;
}

export interface BenchmarkFinding {
  criterionId: string;
  /** The criterion the call was decided on, by its title. */
  criterion: string;
  why: string;
  resumeQuote: string;
}

export interface BenchmarkRow {
  id: string;
  name: string;
  knownOutcome: KnownOutcome;
  avgScore: number | null;
  /** One for each criterion tested, in the order tested — the list's, and so the ring's. */
  evaluations: readonly Evaluation[];
  met: number;
  result: Result;
  /** The result disagrees with the known outcome. */
  mismatch: boolean;
  /** Why, where the result disagrees. */
  finding: BenchmarkFinding | null;
}

type Candidate = (typeof BENCHMARK_CANDIDATES)[number];

const ALL_CANDIDATES = BENCHMARK_CANDIDATES.map((candidate) => candidate.id);

function rows(
  tested: readonly string[],
  evaluate: (candidate: Candidate, criterionId: string) => Evaluation,
  candidates: readonly string[] = ALL_CANDIDATES,
) {
  const criteria = tested.map(
    (id) => CRITERIA.find((criterion) => criterion.id === id)!,
  );
  const benchmarked = BENCHMARK_CANDIDATES.filter((candidate) =>
    candidates.includes(candidate.id),
  );
  return benchmarked.map((candidate): BenchmarkRow => {
    const evaluations = criteria.map((criterion) =>
      evaluate(candidate, criterion.id),
    );
    const met = evaluations.filter((evaluation) => evaluation === "met").length;
    const result: Result =
      met >= criteria.length - MISSES_ALLOWED ? "included" : "excluded";
    const mismatch = result !== EXPECTED_RESULT[candidate.knownOutcome];
    const { finding } = candidate;
    return {
      id: candidate.id,
      name: candidate.name,
      knownOutcome: candidate.knownOutcome,
      avgScore: candidate.avgScore,
      evaluations,
      met,
      result,
      mismatch,
      finding:
        mismatch && finding && tested.includes(finding.criterionId)
          ? {
              criterionId: finding.criterionId,
              criterion: criteria.find(
                (criterion) => criterion.id === finding.criterionId,
              )!.title,
              why: finding.why,
              resumeQuote: finding.resumeQuote,
            }
          : null,
    };
  });
}

/** How a candidate's resume evaluates against a criterion as first written. */
function asWritten(candidate: Candidate, criterionId: string): Evaluation {
  return candidate.evaluations[
    CRITERIA.findIndex((criterion) => criterion.id === criterionId)
  ];
}

/** A retest of `tested` against the benchmark candidates — all of them, or those named. */
export function benchmark(
  tested: readonly TestedCriterion[],
  candidates: readonly string[] = ALL_CANDIDATES,
): BenchmarkRow[] {
  const order = tested.map((criterion) => criterion.id);
  if (isPreviousRun(tested)) return rows(order, asPreviously, candidates);
  return rows(
    order,
    (candidate, criterionId) => {
      const criterion = CRITERIA.find((c) => c.id === criterionId)!;
      const prompt = tested.find((c) => c.id === criterionId)!.prompt;
      if (
        "suggestedRewrite" in criterion &&
        prompt === criterion.suggestedRewrite.prompt
      ) {
        const reevaluated: Partial<Record<string, Evaluation>> =
          criterion.suggestedRewrite.reevaluated;
        return reevaluated[candidate.id] ?? asWritten(candidate, criterionId);
      }
      return asWritten(candidate, criterionId);
    },
    candidates,
  );
}

/** The benchmark run before this draft: the criteria that were running, as that run recorded them. */
export function previousBenchmark(
  candidates: readonly string[] = ALL_CANDIDATES,
): BenchmarkRow[] {
  return rows(PREVIOUS_BENCHMARK.criteria, asPreviously, candidates);
}

/** How the previous run evaluated a candidate against one of its criteria. */
function asPreviously(candidate: Candidate, criterionId: string): Evaluation {
  const differences: Partial<
    Record<string, Partial<Record<string, Evaluation>>>
  > = PREVIOUS_BENCHMARK.differences;
  return (
    differences[candidate.id]?.[criterionId] ??
    asWritten(candidate, criterionId)
  );
}

/** Whether `tested` is what the previous run tested: its criteria, each as first written. */
function isPreviousRun(tested: readonly TestedCriterion[]) {
  const ran: readonly string[] = PREVIOUS_BENCHMARK.criteria;
  return (
    tested.length === ran.length &&
    tested.every(
      ({ id, prompt }) =>
        ran.includes(id) &&
        CRITERIA.find((criterion) => criterion.id === id)?.prompt === prompt,
    )
  );
}

/** The known outcomes, in the order the summary's bar and legend take them. */
export const KNOWN_OUTCOMES: readonly KnownOutcome[] = [
  "hired",
  "archived-interview",
  "archived-application-review",
];

/** How many of `candidates` came to each known outcome. */
export function outcomeCounts(
  candidates: readonly { knownOutcome: KnownOutcome }[],
): Record<KnownOutcome, number> {
  const outcomes = Object.fromEntries(
    KNOWN_OUTCOMES.map((outcome) => [outcome, 0]),
  ) as Record<KnownOutcome, number>;
  for (const candidate of candidates) outcomes[candidate.knownOutcome] += 1;
  return outcomes;
}

export function benchmarkSummary(rows: BenchmarkRow[]) {
  const mismatched = rows.filter((row) => row.mismatch);
  return {
    total: rows.length,
    outcomes: outcomeCounts(rows),
    mismatches: mismatched.length,
    criteriaAtFault: new Set(mismatched.map((row) => row.finding?.criterionId))
      .size,
  };
}

export type CandidateSetStatus =
  | { kind: "balanced" }
  | { kind: "missing"; outcomes: KnownOutcome[] }
  | { kind: "too-few" };

/**
 * Whether a candidate set is fit to benchmark against: every known outcome
 * among them, and enough of them. An outcome with no one is named first, even
 * below the minimum (Figma 115:5909); then too few (Figma 110:5881).
 */
export function candidateSetStatus(
  outcomes: Record<KnownOutcome, number>,
): CandidateSetStatus {
  const missing = KNOWN_OUTCOMES.filter((outcome) => outcomes[outcome] === 0);
  if (missing.length > 0) return { kind: "missing", outcomes: missing };
  const total = KNOWN_OUTCOMES.reduce((sum, o) => sum + outcomes[o], 0);
  if (total < MIN_BENCHMARK_CANDIDATES) return { kind: "too-few" };
  return { kind: "balanced" };
}

export interface SuggestedRewrite {
  criterionId: string;
  prompt: string;
  /** The part of `prompt` the rewrite adds. */
  addedClause: string;
}

/** A rewrite for each criterion a mismatch was decided on, where it has one. */
export function suggestedRewrites(rows: BenchmarkRow[]): SuggestedRewrite[] {
  const atFault = new Set(
    rows.filter((row) => row.mismatch).map((row) => row.finding?.criterionId),
  );
  return CRITERIA.flatMap((criterion) =>
    atFault.has(criterion.id) && "suggestedRewrite" in criterion
      ? [
          {
            criterionId: criterion.id,
            prompt: criterion.suggestedRewrite.prompt,
            addedClause: criterion.suggestedRewrite.addedClause,
          },
        ]
      : [],
  );
}

/** As the source colours an average score: 3 and up, below it, or none at all. */
export function scoreTone(score: number | null): "good" | "low" | "none" {
  if (score === null) return "none";
  return score >= 3 ? "good" : "low";
}
