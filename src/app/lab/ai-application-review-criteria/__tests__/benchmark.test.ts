import { describe, expect, it } from "vitest";
import {
  benchmark,
  benchmarkSummary,
  candidateSetStatus,
  previousBenchmark,
  scoreTone,
  suggestedRewrites,
} from "../benchmark";
import { CRITERIA } from "../harness-data";

const NEW_LOGO = CRITERIA.find((c) => c.id === "new-logo")!;

const WITH_NEW_LOGO = CRITERIA.map(({ id, prompt }) => ({ id, prompt }));

const WITH_REWRITE = WITH_NEW_LOGO.map((c) =>
  c.id === "new-logo" ? { ...c, prompt: NEW_LOGO.suggestedRewrite.prompt } : c,
);

const byId = (rows: ReturnType<typeof benchmark>) =>
  Object.fromEntries(rows.map((row) => [row.id, row]));
const retest = byId(benchmark(WITH_NEW_LOGO));

describe("a retest with New Logo Acquisition added", () => {
  it("counts only the criteria that were met", () => {
    expect(retest.renee.met).toBe(3);
    expect(retest.marco.met).toBe(4);
    expect(retest.aisha.met).toBe(1);
    expect(retest.grace.met).toBe(0);
  });

  it("includes a candidate who meets all but one criterion, and excludes the rest", () => {
    expect(retest.renee.result).toBe("included");
    expect(retest.marco.result).toBe("included");
    expect(retest.dana.result).toBe("excluded");
    expect(retest.aisha.result).toBe("excluded");
  });

  it("flags a result that disagrees with what really happened to the candidate", () => {
    const mismatched = benchmark(WITH_NEW_LOGO)
      .filter((row) => row.mismatch)
      .map((row) => row.id);
    expect(mismatched).toEqual(["dana", "priya", "tomas"]);
  });

  it("keeps the fixture's order, all twelve", () => {
    expect(benchmark(WITH_NEW_LOGO).map((row) => row.name)).toEqual([
      "Renee Acheampong",
      "Dana Whitlock",
      "Marco Silva",
      "Priya Raman",
      "Kevin Tran",
      "Olivia Brennan",
      "Sam Okafor",
      "Nina Castellanos",
      "Tomas Reyes",
      "Grace Lin",
      "Devon Park",
      "Aisha Mahmoud",
    ]);
  });

  it("evaluates the criteria in the order they were tested in: the list's, and so the ring's", () => {
    const onTop = [
      WITH_NEW_LOGO[2],
      ...WITH_NEW_LOGO.filter((c) => c.id !== "new-logo"),
    ];
    expect(byId(benchmark(onTop)).dana.evaluations).toEqual([
      "not-met",
      "met",
      "met",
      "undecided",
    ]);
    expect(retest.dana.evaluations).toEqual([
      "met",
      "met",
      "not-met",
      "undecided",
    ]);
  });

  it("comes to the same results in any order, only its evaluations reordered", () => {
    const reversed = benchmark([...WITH_NEW_LOGO].reverse());
    expect(reversed).toEqual(
      benchmark(WITH_NEW_LOGO).map((row) => ({
        ...row,
        evaluations: [...row.evaluations].reverse(),
      })),
    );
  });

  it("names a mismatch's finding by its criterion's title, and gives the rest none", () => {
    expect(retest.dana.finding?.criterion).toBe("New Logo Acquisition");
    expect(retest.renee.finding).toBeNull();
  });
});

describe("a retest with the rewrite applied", () => {
  const rewritten = byId(benchmark(WITH_REWRITE));

  it("re-evaluates the rewritten criterion: numbers now count, a bare claim no longer does", () => {
    expect(rewritten.dana.evaluations[2]).toBe("met");
    expect(rewritten.priya.evaluations[2]).toBe("met");
    expect(rewritten.tomas.evaluations[2]).toBe("not-met");
    expect(rewritten.kevin.evaluations).toEqual(retest.kevin.evaluations);
  });

  it("agrees with every known outcome, so it finds nothing", () => {
    const rows = benchmark(WITH_REWRITE);
    expect(rows.filter((row) => row.mismatch)).toEqual([]);
    expect(rows.every((row) => row.finding === null)).toBe(true);
    expect(suggestedRewrites(rows)).toEqual([]);
  });
});

describe("the previous benchmark", () => {
  const previous = byId(previousBenchmark());

  it("tested the three criteria that were running, before New Logo Acquisition", () => {
    for (const row of previousBenchmark())
      expect(row.evaluations).toHaveLength(3);
    expect(previous.dana.evaluations).toEqual(["met", "met", "undecided"]);
  });

  it("had Tomas Reyes undecided on CRM & Sales Ops, so he met one of three and was excluded", () => {
    expect(previous.tomas.evaluations).toEqual([
      "met",
      "undecided",
      "undecided",
    ]);
    expect(previous.tomas.result).toBe("excluded");
    expect(previous.kevin.result).toBe("included");
  });

  it("agrees with every known outcome, so it finds nothing", () => {
    expect(previousBenchmark().filter((row) => row.mismatch)).toEqual([]);
    expect(previousBenchmark().every((row) => row.finding === null)).toBe(true);
  });

  it("is what a retest of those three criteria, unchanged, gives again", () => {
    const running = CRITERIA.filter((c) => c.id !== "new-logo").map(
      ({ id, prompt }) => ({ id, prompt }),
    );
    expect(benchmark(running)).toEqual(previousBenchmark());
    expect(benchmark(running, ["kevin", "tomas"])).toEqual([
      previous.kevin,
      previous.tomas,
    ]);
  });

  it("is what a retest of those three in another order gives, evaluated in that order", () => {
    const reordered = ["crm", "full-cycle", "large-deals"].map((id) => {
      const { prompt } = CRITERIA.find((c) => c.id === id)!;
      return { id, prompt };
    });
    expect(byId(benchmark(reordered)).tomas.evaluations).toEqual([
      "undecided",
      "met",
      "undecided",
    ]);
    expect(byId(benchmark(reordered)).tomas.result).toBe("excluded");
  });

  it("is not what a retest gives once one of them is reworded", () => {
    const reworded = CRITERIA.filter((c) => c.id !== "new-logo").map(
      ({ id, prompt }) => ({
        id,
        prompt: id === "crm" ? `${prompt} Reworded.` : prompt,
      }),
    );
    expect(byId(benchmark(reworded)).tomas.evaluations).toEqual([
      "met",
      "met",
      "undecided",
    ]);
  });
});

describe("a retest of some of the candidates", () => {
  it("evaluates only those, just as it would among all twelve", () => {
    const some = benchmark(WITH_NEW_LOGO, ["dana", "kevin"]);
    expect(some.map((row) => row.id)).toEqual(["dana", "kevin"]);
    expect(some).toEqual([retest.dana, retest.kevin]);
  });
});

describe("benchmark summary", () => {
  it("counts the candidates, by what really happened to them", () => {
    expect(benchmarkSummary(benchmark(WITH_NEW_LOGO))).toMatchObject({
      total: 12,
      outcomes: {
        hired: 4,
        "archived-interview": 4,
        "archived-application-review": 4,
      },
    });
  });

  it("counts the mismatches, and the criteria they were decided on", () => {
    expect(benchmarkSummary(benchmark(WITH_NEW_LOGO))).toMatchObject({
      mismatches: 3,
      criteriaAtFault: 1,
    });
    expect(benchmarkSummary(previousBenchmark())).toMatchObject({
      mismatches: 0,
      criteriaAtFault: 0,
    });
  });
});

describe("score tone", () => {
  it("is good from 3 up, low below it, and none without a score", () => {
    expect(scoreTone(3.8)).toBe("good");
    expect(scoreTone(3)).toBe("good");
    expect(scoreTone(2.9)).toBe("low");
    expect(scoreTone(null)).toBe("none");
  });
});

describe("suggested rewrites", () => {
  it("offers a rewrite for each criterion a mismatch was decided on", () => {
    expect(suggestedRewrites(benchmark(WITH_NEW_LOGO))).toEqual([
      {
        criterionId: "new-logo",
        prompt: NEW_LOGO.suggestedRewrite.prompt,
        addedClause: NEW_LOGO.suggestedRewrite.addedClause,
      },
    ]);
  });
});

describe("the candidate set's status", () => {
  const set = (hired: number, interview: number, review: number) => ({
    hired,
    "archived-interview": interview,
    "archived-application-review": review,
  });

  it("is balanced with ten or more candidates, and every outcome among them", () => {
    expect(candidateSetStatus(set(4, 4, 4))).toEqual({ kind: "balanced" });
    expect(candidateSetStatus(set(3, 4, 4))).toEqual({ kind: "balanced" });
  });

  it("asks for more candidates below ten (Figma 110:5881)", () => {
    expect(candidateSetStatus(set(2, 2, 2))).toEqual({ kind: "too-few" });
    expect(candidateSetStatus(set(4, 4, 1))).toEqual({ kind: "too-few" });
  });

  it("names an outcome with no candidates, before asking for more (Figma 115:5909)", () => {
    expect(candidateSetStatus(set(2, 2, 0))).toEqual({
      kind: "missing",
      outcomes: ["archived-application-review"],
    });
    expect(candidateSetStatus(set(0, 4, 4))).toEqual({
      kind: "missing",
      outcomes: ["hired"],
    });
    expect(candidateSetStatus(set(4, 0, 4))).toEqual({
      kind: "missing",
      outcomes: ["archived-interview"],
    });
  });

  it("names every outcome with no candidates, in the legend's order", () => {
    expect(candidateSetStatus(set(0, 3, 0))).toEqual({
      kind: "missing",
      outcomes: ["hired", "archived-application-review"],
    });
  });
});
