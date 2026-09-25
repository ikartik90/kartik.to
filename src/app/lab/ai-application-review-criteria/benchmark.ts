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

export type Result = "included" | "excluded";

export interface TestedCriterion {
  id: string;
  prompt: string;
}

export interface BenchmarkFinding {
  criterionId: string;
  /** The criterion's title. */
  criterion: string;
  why: string;
  resumeQuote: string;
}

export interface BenchmarkRow {
  id: string;
  name: string;
  knownOutcome: KnownOutcome;
  avgScore: number | null;
  /** One per tested criterion, in test order. */
  evaluations: readonly Evaluation[];
  met: number;
  result: Result;
  /** Result disagrees with the known outcome. */
  mismatch: boolean;
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

function asWritten(candidate: Candidate, criterionId: string): Evaluation {
  return candidate.evaluations[
    CRITERIA.findIndex((criterion) => criterion.id === criterionId)
  ];
}

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

export function previousBenchmark(
  candidates: readonly string[] = ALL_CANDIDATES,
): BenchmarkRow[] {
  return rows(PREVIOUS_BENCHMARK.criteria, asPreviously, candidates);
}

function asPreviously(candidate: Candidate, criterionId: string): Evaluation {
  const differences: Partial<
    Record<string, Partial<Record<string, Evaluation>>>
  > = PREVIOUS_BENCHMARK.differences;
  return (
    differences[candidate.id]?.[criterionId] ??
    asWritten(candidate, criterionId)
  );
}

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

/** Order matters: the summary's bar and legend follow it. */
export const KNOWN_OUTCOMES: readonly KnownOutcome[] = [
  "hired",
  "archived-interview",
  "archived-application-review",
];

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
  addedClause: string;
}

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

export function scoreTone(score: number | null): "good" | "low" | "none" {
  if (score === null) return "none";
  return score >= 3 ? "good" : "low";
}
