/**
 * Fixture data for the criteria-benchmark prototype.
 *
 * EVERYTHING HERE IS INVENTED. No real candidate, resume or company.
 *
 * Two things are wrong ON PURPOSE and must not be "fixed":
 *  1. `new-logo` is a claim test. Its prompt asks for experience without naming
 *     any evidence, so it is satisfied by a resume that states the experience and
 *     missed by one that demonstrates it in numbers. This is the finding the
 *     whole prototype exists to surface.
 *  2. `large-deals` abstains on half the benchmark, because most resumes give no
 *     ACV figure. A criterion can be useless without ever causing a disagreement.
 *
 * Nothing here is computed. Result, counts and findings are derived in the view.
 */

/** A candidate is included who meets all but this many of the criteria tested: 3 of 4, 2 of 3. */
export const MISSES_ALLOWED = 1;
/** Fewer candidates than this are too few to benchmark against. */
export const MIN_BENCHMARK_CANDIDATES = 10;
export const CREDITS_PER_CANDIDATE = 1;

export type Evaluation = "met" | "not-met" | "undecided";
export type KnownOutcome =
  | "hired"
  | "archived-interview"
  | "archived-application-review";

export const CRITERIA = [
  {
    id: "full-cycle",
    title: "Full Sales Cycle Experience",
    prompt:
      "Has managed a full B2B sales cycle from prospecting through close, as described by responsibilities or achievements on the resume.",
    note: "Met by all 4 hires, and by 2 of the 4 archived at Application Review.",
    noteTone: "neutral",
  },
  {
    id: "crm",
    title: "CRM & Sales Ops",
    prompt:
      "Experience with CRM tools such as Salesforce or HubSpot for pipeline management and real-time updates, including CRM-driven forecasting and reporting.",
    note: "Met by 3 of 4 hired candidates.",
    noteTone: "neutral",
  },
  {
    id: "new-logo",
    title: "New Logo Acquisition",
    prompt: "New logo acquisition experience in B2B SaaS environment.",
    /** The word doing the damage. Highlighted in the form. */
    flawWord: "experience",
    suggestedRewrite: {
      prompt:
        "New logo acquisition experience in B2B SaaS environment, evidenced by the number of accounts won or the new business quota attained.",
      addedClause:
        "evidenced by the number of accounts won or the new business quota attained",
      effect:
        "Accepts a resume that reports the outcome in numbers, not only one that names the experience.",
      /** No outcome is claimed. Changing a criterion means a new, paid test. */
      costNote:
        "Applying is free. Retesting your 12 benchmark candidates costs 12 credits.",
      /**
       * How the rewrite evaluates where the claim test did not: the two hires who
       * report accounts won in numbers now meet it, and the resume that only
       * names the experience no longer does. Everyone else comes out the same.
       */
      reevaluated: { dana: "met", priya: "met", tomas: "not-met" },
    },
  },
  {
    id: "large-deals",
    title: "Closed Large Deals",
    prompt:
      "Documented history of closing deals with ACV over $50,000, with specific examples listed on the resume.",
    note: "Undecided for 6 of 12 benchmark candidates. Most resumes give no ACV figure.",
    noteTone: "warn",
  },
] as const;

/**
 * The twelve candidates the benchmark is run against — the job's suggested
 * candidates, and the set it was last run with. `company` is where each works
 * now; `role`, `knownOutcome` and `decided` say which of the company's past
 * openings they applied to, how far they got and when it was decided.
 *
 * Evaluations are ordered to match CRITERIA; a benchmark reads them off in the
 * order the criteria are tested in, which is the ring's.
 */
export const BENCHMARK_CANDIDATES = [
  {
    id: "renee",
    name: "Renee Acheampong",
    company: "Northwind",
    role: "Account Executive",
    decided: "Oct 2024",
    knownOutcome: "hired",
    avgScore: 3.4,
    evaluations: ["met", "met", "met", "undecided"],
    finding: null,
  },
  {
    id: "dana",
    name: "Dana Whitlock",
    company: "Brightloom",
    role: "Senior AE",
    decided: "Jan 2025",
    knownOutcome: "hired",
    avgScore: 3.7,
    evaluations: ["met", "met", "not-met", "undecided"],
    finding: {
      criterionId: "new-logo",
      kind: "not-met",
      title: "“New Logo Acquisition” not met",
      subtitle: "Would be included if met.",
      why: "This criterion matches claims of new logo acquisition. A resume that reports outcomes in numbers, but never names it as new logo acquisition fails to meet this criterion.",
      resumeQuote:
        "Grew the mid-market SaaS book from 0 to 42 accounts in 18 months.",
    },
  },
  {
    id: "marco",
    name: "Marco Silva",
    company: "Corveto",
    role: "Account Executive",
    decided: "Oct 2023",
    knownOutcome: "hired",
    avgScore: 3.8,
    evaluations: ["met", "met", "met", "met"],
    finding: null,
  },
  {
    id: "priya",
    name: "Priya Raman",
    company: "Halden",
    role: "Mid-Market AE",
    decided: "Jan 2024",
    knownOutcome: "hired",
    avgScore: 3.5,
    evaluations: ["met", "undecided", "not-met", "met"],
    finding: {
      criterionId: "new-logo",
      kind: "not-met",
      title: "“New Logo Acquisition” not met",
      subtitle: "Would be included if met.",
      why: "This criterion matches claims of new logo acquisition. A resume that reports outcomes in numbers, but never names it as new logo acquisition fails to meet this criterion.",
      resumeQuote:
        "Owned the Pacific Northwest for a Series C data platform: grew the territory from 3 to 17 accounts, six above $250K ACV.",
    },
  },
  {
    id: "kevin",
    name: "Kevin Tran",
    company: "Pellonia",
    role: "Account Executive",
    decided: "Sep 2025",
    knownOutcome: "archived-interview",
    avgScore: 2.9,
    evaluations: ["met", "met", "met", "undecided"],
    finding: null,
  },
  {
    id: "olivia",
    name: "Olivia Brennan",
    company: "Sundry",
    role: "Enterprise AE",
    decided: "Jul 2023",
    knownOutcome: "archived-interview",
    avgScore: 3.0,
    evaluations: ["met", "undecided", "met", "met"],
    finding: null,
  },
  {
    id: "sam",
    name: "Sam Okafor",
    company: "Merrow",
    role: "Account Executive",
    decided: "Jul 2025",
    knownOutcome: "archived-interview",
    avgScore: 2.8,
    evaluations: ["met", "met", "met", "undecided"],
    finding: null,
  },
  {
    id: "nina",
    name: "Nina Castellanos",
    company: "Ravel",
    role: "Account Executive",
    decided: "Mar 2025",
    knownOutcome: "archived-interview",
    avgScore: 3.1,
    evaluations: ["met", "met", "met", "met"],
    finding: null,
  },
  {
    id: "tomas",
    name: "Tomas Reyes",
    company: "Quillon",
    role: "Senior AE",
    decided: "Mar 2024",
    knownOutcome: "archived-application-review",
    // No interview happened, so no scorecards exist to average.
    avgScore: null,
    evaluations: ["met", "met", "met", "undecided"],
    finding: {
      criterionId: "new-logo",
      kind: "met",
      title: "“New Logo Acquisition” met",
      subtitle: "Met on the claim alone.",
      why: "The resume states the experience, which is all the criterion asks. Nothing else in it shows an account won or a quota carried.",
      resumeQuote:
        "Responsible for new logo acquisition across the enterprise segment.",
    },
  },
  {
    id: "grace",
    name: "Grace Lin",
    company: "Tavolo",
    role: "Account Executive",
    decided: "Mar 2023",
    knownOutcome: "archived-application-review",
    avgScore: null,
    evaluations: ["not-met", "not-met", "not-met", "not-met"],
    finding: null,
  },
  {
    id: "devon",
    name: "Devon Park",
    company: "Riverbend",
    role: "Account Manager",
    decided: "Feb 2023",
    knownOutcome: "archived-application-review",
    avgScore: null,
    evaluations: ["not-met", "not-met", "not-met", "undecided"],
    finding: null,
  },
  {
    id: "aisha",
    name: "Aisha Mahmoud",
    company: "Pell & Co",
    role: "Inside Sales",
    decided: "Jan 2023",
    knownOutcome: "archived-application-review",
    avgScore: null,
    evaluations: ["met", "undecided", "not-met", "not-met"],
    finding: null,
  },
] as const;

/**
 * The benchmark last run on the job, before New Logo Acquisition was added: its
 * three running criteria against the same twelve candidates, and every result
 * agreeing with what really happened.
 *
 * The same evaluations as now but for one, recorded as that run had it: Tomas
 * Reyes came out undecided on CRM & Sales Ops, so he met one of three and was
 * excluded. Without that difference he and Kevin Tran — identical on the other
 * three — could not both agree with their outcomes.
 */
export const PREVIOUS_BENCHMARK = {
  criteria: ["full-cycle", "crm", "large-deals"],
  differences: { tomas: { crm: "undecided" } },
} as const;

/**
 * A result agrees with the known outcome when:
 *   hired                        -> Included
 *   archived-interview           -> Included  (they cleared the resume screen in real life)
 *   archived-application-review  -> Excluded
 * Three rows break this, and `new-logo` is decisive in all three.
 */
export const EXPECTED_RESULT: Record<KnownOutcome, "included" | "excluded"> = {
  hired: "included",
  "archived-interview": "included",
  "archived-application-review": "excluded",
};
