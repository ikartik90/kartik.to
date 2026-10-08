import CalendarIcon from "@/assets/icons/calendar.svg";
import CopyIcon from "@/assets/icons/copy.svg";
import MetricIcon from "@/assets/icons/metric.svg";
import QuoteIcon from "@/assets/icons/quote.svg";
import type { MediaNode } from "@/domain/nodes";
import { clipGround, walkthroughClip } from "./clips";
import type { Feature } from "./feature-grid";
import type { Metric } from "./metric-card";

// The shift scheduling sheet's words, drawn from the published article (/work/redesigning-shift-scheduling), and the
// article's own clips and demos. `*`s mark what's highlighted.

const R2 = "https://pub-3f00bf1204d54dbe88e07be7288fe49c.r2.dev";
const clip = (file: string, alt: string, ground: ReturnType<typeof clipGround>) =>
  walkthroughClip(`${R2}/media/${file}.mp4`, `${R2}/posters/${file}.jpg`, alt, ground);

/** What shipped: the first two clips of the article's opening carousel, as it shows them. */
const CLIPS: MediaNode[] = [
  clip(
    "b43a6d5b-b8b0-4563-a997-2485086fd046-new-shift-redesign",
    "A video depicting the new shift posting experience.",
    clipGround(["#1954DCFF", "#C3DEEBFF", "#DAEBFFFF"], {
      positions: 57,
      waveX: 0.49,
      waveXShift: 0.25,
      waveYShift: 0.46,
      mixing: 0.61,
      grainMixer: 0.4,
    }),
  ),
  clip(
    "cb6e2c38-8fc4-49e1-bacf-19f48856785b-schedule-extension",
    "A video depicting the new schedule editing experience. Adding and removing shifts could now be done in a matter of seconds.",
    clipGround(["#1954DCFF", "#C3DEEBFF", "#DAEBFFFF"], { positions: 29, grainMixer: 0.65, offsetY: -0.08 }),
  ),
];

const reasons: Feature[] = [
  {
    Icon: CalendarIcon,
    title: "Schedules couldn't be extended",
    body: "The companies posting most often could only extend or change a posted schedule by cancelling it first.",
  },
  {
    Icon: CopyIcon,
    title: "Duplicate work",
    body: "Each extension had staffing managers redraft the shift and send workers a fresh round of offers, repeating work the first posting had already done.",
  },
  {
    Icon: MetricIcon,
    title: "Backlog as projected cash flow",
    body: "Our backlog of scheduled shifts reflected projected cash flow and the health of our business. So companies needed the easiest path to post and extend shifts.",
  },
];

/** A heading over paragraphs, split on blank lines. */
export interface CardCopy {
  title: string;
  text: string;
}

// The comparison's ten schedules (`SHIFT.comparison`), totalled: 358 clicks on the old calendar, 67 with drag to select.
const outcome: Metric = {
  value: "81%",
  label: "fewer clicks to pick shift dates",
  detail:
    "Dragging across the calendar to select dates in bulk *cut the clicks to pick shift dates by 81%* compared with picking them one at a time.",
};

export const SHIFT = {
  clips: CLIPS,
  stakes: {
    eyebrow: "Business fit",
    heading: "Repeat shifts were a critical lever of our business",
    body: "Companies posting shifts regularly signalled high trust and retention, and saw higher worker attendance.",
    reasons,
  },
  gap: {
    eyebrow: "UX gap",
    heading: "The calendar allowed many dates but needed a click for each one",
    demo: "shift-scheduling-v0",
    points: [
      {
        Icon: CalendarIcon,
        title: "Clicks grew in lockstep with shift dates",
        body: "Clicks grew with every date a staffing manager chose: 100 consecutive days took 103.",
      },
      {
        Icon: QuoteIcon,
        title: "Echoed in support requests",
        body: "Support requests and back-channel feedback described picking dates one at a time as slow and tedious, especially for longer schedules.",
      },
    ] satisfies Feature[],
    tally: {
      clicks: "clicks",
      dates: "shift dates selected",
      drag: "A drag counts as two clicks.",
    },
  },
  // The bare demos' Play and Stop, said in words under them.
  demoControls: { play: "Replay demo", stop: "Stop demo", hint: "or try it yourself. It's interactive." },
  northStar: "Let staffing managers schedule and extend shifts 10x faster and easier than they can today.",
  cards: {
    steps: {
      title: "Give shift details and schedule planning their own steps",
      text: "The shift form packed shift, job role and scheduling data into one view, pushing *40% of its fields past the average fold*.\n\nThe first release *split shift details and schedule planning into steps*. Start and end times, the only position fields staffing managers changed, moved into the planning step.",
    },
    positions: {
      title: "Turn read-only position fields into a card with a map",
      text: "The remaining position data was read-only, yet disabled input fields gave it the same weight as the fields staffing managers filled in. So the form *looked denser than it was*.\n\nOne card grouped that data with a map of the site, letting staffing managers *take in the position at a glance*.",
    },
    edit: {
      title: "Let staffing managers extend and modify a schedule after it's posted",
      text: "A shift's dates were fixed once it was posted. To add more, staffing managers drafted the shift again and *sent a fresh round of offers*.\n\nStaffing managers now *extend or change a posted schedule in place*: Edit Schedule opens it in the same drag-to-select calendar, where a drag adds dates and a click cancels one. SpotFill can then send offers for the new dates.",
    },
  } satisfies Record<string, CardCopy>,
  conceptTesting: {
    eyebrow: "Concept testing",
    heading: "I prototyped two concepts to make scheduling more efficient",
  },
  // Keyed as their toggle's values.
  concepts: {
    recurrence: {
      title: "Concept 1: Recurrence",
      text: "Recurrence came from calendar and meeting apps I studied: staffing managers pick weekdays and an end date, and *extend a schedule to any length by changing that date*.",
    },
    drag: {
      title: "Concept 2: Drag to select",
      text: "Drag to select kept the scheduling calendar staffing managers already used, where a click toggles one date, and added a drag that *toggles many dates in one gesture*.",
    },
  } satisfies Record<string, CardCopy>,
  // Counted from the demos at each one's fewest clicks, each calendar opening on the run's first month, and
  // recurrence's shift date on the run's first date (its weekday's chip on, Until six days after it). A date, a change
  // of month, the switch, a chip and opening Until are a click each; a drag is two (its press and its release) and
  // selects the rectangle between the dates it starts and ends on, across the three months shown. Recurrence only
  // repeats weekdays every week between two dates, so a run with a gap in it is beyond it. The 100 days run to
  // 14 January 2026; weekdays every other week start with the week of 3 November.
  comparison: {
    heading: "I evaluated both concepts against 10 scheduling prompts the operations team and I defined upfront",
    head: ["Scheduling prompt", "Old calendar", "Recurrence", "Drag to select"],
    rows: [
      ["100 consecutive days from 7 October 2025", "103", "12", "11"],
      ["All Mondays, Wednesdays and Fridays from January to March 2025", "41", "7", "18"],
      ["All days in Q2 2025, excluding Good Friday", "92", "Not possible", "3"],
      ["Every weekday in November 2025", "20", "7", "2"],
      ["Every Tuesday and Thursday in November 2025", "8", "4", "4"],
      ["Thursday to Sunday every week in November 2025", "18", "6", "4"],
      ["Every Friday and Saturday in November and December 2025", "18", "5", "4"],
      ["Every weekend in November and December 2025", "19", "5", "6"],
      ["Weekdays every other week in November and December 2025", "24", "Not possible", "10"],
      ["The first week of November and December 2025", "15", "Not possible", "5"],
    ],
    note: "A drag counts as two clicks, and every change of month as one.",
    // What testing made of the last columns' schedulers, under them.
    verdicts: ["rejected", "approved"] as const,
  },
  outcome,
  takeaway: {
    eyebrow: "Takeaway",
    heading: "Speed has to leave room for exceptions",
    paragraphs: [
      "Recurrence was efficient but rigid. Drag to select brought that efficiency to the calendar staffing managers already used, and kept supervisors in complete control over exclusions such as business holidays.",
      "A pattern borrowed from other tools pays off only when it bends to the schedules people keep.",
    ],
  },
};

/** Which of a row's results take the fewest clicks: the lowest number; words ("Not possible") never. */
export function fewest(cells: string[]) {
  const counts = cells.map(Number);
  const least = Math.min(...counts.filter(Number.isFinite));
  return counts.map((count) => count === least);
}
