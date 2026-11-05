import type { Metric } from "./metric-card";
import type { RiskScale } from "./risk-levels";

// The words the About sheet's stories, the risk chart and the dashboard take from the projects' long-form sheets.
// `*`s mark what's highlighted.

// A few factors folded together: absences with late check-ins, location off with distance from the site.
const spider: RiskScale = {
  title: "No-show risk",
  levels: ["None", "Low", "Medium", "High"],
  factors: [
    { id: "worker", label: "New worker" },
    { id: "cancel", label: "Cancellation request" },
    { id: "lateCancel", label: "Late cancellations" },
    { id: "attendance", label: "Late check-ins and absences" },
    { id: "location", label: "Location" },
    { id: "company", label: "New team" },
  ],
};

export const CHECK_INS = {
  signals: { spider },
  traceability: { eyebrow: "Traceability" },
  outcome: {
    value: "65%",
    label: "fewer attendance disputes",
    detail:
      "Correcting hours during the shift, with every change on record, cut attendance disputes by 65%, *from an average of 90 to 31 a week after launch*.",
  } satisfies Metric,
};

// The role beside the heading, the year after its eyebrow.
export const LIVE_INTRO = {
  role: { label: "My Role", pills: ["Product management", "Product design", "Prototyping"] },
  year: { label: "Year", value: "2025" },
};

export const LIVE_HEADS = {
  checkIns: {
    eyebrow: "Flexibility",
    heading: "Let floor managers handle check-in exceptions",
    body: "Many of our sites were remote warehouses where *poor signal kept workers from checking in on the worker app*. Workers already on site showed as missing, and our operations team had to verify every missing check-in manually.\n\nThe Check-ins page listed the roster of workers scheduled to work on the day with their live check-in status, enabling floor managers to *settle missing check-ins on site during the shift*.",
  },
  timesheet: {
    eyebrow: "Invoice",
    heading: "Make the Timesheet the single source of truth for every hour worked",
    body: "Adjustments submitted by workers, such as in case of overtime, replaced the check-in times on their timecard. Sometimes, companies also booked known workers off the platform for urgent shifts and backfills. These scenarios led to billing gaps and payment disputes, *forcing finance to manually reconcile on spreadsheets*.\n\nI added statuses to the Timesheet for each of these scenarios, reconciliation for off-app shifts, and flags on worker-submitted adjustments that needed approval. With these, finance could *invoice every hour worked from the Timesheet alone*.",
  },
};

export const DESIGN_SYSTEM = {
  // The role beside the heading, the year after its eyebrow.
  intro: {
    role: { label: "My Role", pills: ["Product design", "Design engineering", "Design system management"] },
    year: { label: "Year", value: "2024–25" },
  },
  heads: {
    tokens: {
      eyebrow: "Tokens",
      heading: "Give every colour, spacing value and radius a token",
      body: "Colours, spacing and radius lived in inline styles as hard-coded raw values, down to a bare `fontSize: 30`. Every change meant our engineers and our QA tracking each value down by hand, *slowing development and testing alike*.\n\nWeb and mobile kept separate design systems on *one shared set of tokens*. So both carried one brand, and our engineers and our QA used one name for each colour, size and edge. Colour tokens came from reference ramps as CSS variables, with sizes in rem and edges in px.",
    },
    components: {
      eyebrow: "Components",
      heading: "Use the app's own records to show every component's Figma properties live",
      body: "Our front end was monolithic, with presentation and business logic intertwined in the same code. That *made existing UI elements difficult to reuse in each new release*.\n\nComponents fell into 10 groups, from Actions to Primitives, and each page showed *every Figma property as a live example* built from the app's own records. Our engineers and our QA saw each variant, down to the Table Cell and the parts its slots take, with the data it would hold.",
    },
  },
  outcome: {
    value: "1.5×",
    label: "release frequency",
    trend: "up",
    change: "9 releases",
    detail:
      "Reusable components cut median release cycle time by 38%, enabling us to ship *26 releases in the 12 months to September 2025, up from 17 the year before*.",
  } satisfies Metric,
};
