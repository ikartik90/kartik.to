// Invented data, flawed on purpose; don't "fix": `new-logo` asks for experience with no
// evidence (the prototype's finding), and `large-deals` is undecided for half (no ACV).

/** Criteria a candidate may miss and still be included. */
export const MISSES_ALLOWED = 1;
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
    flawWord: "experience",
    suggestedRewrite: {
      prompt:
        "New logo acquisition experience in B2B SaaS environment, evidenced by the number of accounts won or the new business quota attained.",
      addedClause:
        "evidenced by the number of accounts won or the new business quota attained",
      effect:
        "Accepts a resume that reports the outcome in numbers, not only one that names the experience.",
      costNote:
        "Applying is free. Retesting your 12 benchmark candidates costs 12 credits.",
      /** Only the evaluations the rewrite changes. */
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

/** `evaluations` are in CRITERIA order. */
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

// Tomas's CRM difference is load-bearing: without it he and Kevin (otherwise
// identical) can't both agree with their outcomes.
export const PREVIOUS_BENCHMARK = {
  criteria: ["full-cycle", "crm", "large-deals"],
  differences: { tomas: { crm: "undecided" } },
} as const;

export const EXPECTED_RESULT: Record<KnownOutcome, "included" | "excluded"> = {
  hired: "included",
  "archived-interview": "included",
  "archived-application-review": "excluded",
};
