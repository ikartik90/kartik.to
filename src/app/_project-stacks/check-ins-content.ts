import ClockIcon from "@/assets/icons/clock.svg";
import MetricIcon from "@/assets/icons/metric.svg";
import PageIcon from "@/assets/icons/page.svg";
import type { MediaNode } from "@/domain/nodes";
import type { StageGap } from "./check-ins-gap";
import type { SpiderData } from "./check-ins-spider";
import { clipGround, walkthroughClip } from "./clips";
import type { Feature } from "./feature-grid";
import type { Metric } from "./metric-card";

// The check-ins and time tracking sheet's words and clips. `*`s mark what's highlighted.

const R2 = "https://pub-3f00bf1204d54dbe88e07be7288fe49c.r2.dev";
const clip = (file: string, alt: string, ground: ReturnType<typeof clipGround>) =>
  walkthroughClip(`${R2}/media/${file}.mp4`, `${R2}/posters/${file}.jpg`, alt, ground);

const CLIPS: MediaNode[] = [
  clip(
    "6c9661a5-42e5-4c1b-ab70-5302cd606ecd-check-ins-1-check-ins-page",
    "A video of a floor manager on the Check-ins page checking in one worker and marking another absent, adding a note to each.",
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
    "5c8b3a48-bfbe-409c-991a-a1d298cacc69-check-ins-2-timesheet",
    "A video of finance opening a worker's timecard, with checked-in and posted hours listed separately, then adding an off-app shift to the timesheet.",
    clipGround(["#1954DCFF", "#C3DEEBFF", "#DAEBFFFF"], { positions: 29, grainMixer: 0.65, offsetY: -0.08 }),
  ),
  clip(
    "4953b2b8-cc0a-4e7e-b789-857866d1ff41-check-ins-3-dashboard",
    "A video of the operations team reviewing a missing check-in's risk signals and location, then messaging the worker, whose side sheet logged the message.",
    clipGround(["#DAEBFFFF", "#1954DCFF", "#C3DEEBFF"], {
      positions: 78,
      mixing: 0.67,
      grainMixer: 0.75,
      rotation: 90,
      offsetX: 0.47,
    }),
  ),
];

const reasons: Feature[] = [
  {
    Icon: PageIcon,
    title: "Offline attendance records",
    body: "Floor managers kept attendance on paper and in spreadsheets of their own.",
  },
  {
    Icon: ClockIcon,
    title: "Reconciliation by hand",
    body: "Matching those records to the timesheet took floor managers 30 minutes a shift.",
  },
  {
    Icon: MetricIcon,
    title: "Attendance disputes",
    body: "Mistakes from that manual work surfaced as disputes over workers' pay and companies' invoices.",
  },
];

const stages: StageGap[] = [
  {
    stage: "Shift begins",
    title: "Check-in needed mobile data",
    body: "At remote sites with poor signal, workers' hours went unlogged.",
  },
  {
    stage: "Shift in progress",
    title: "Missing check-ins turned into phone calls",
    body: "Our operations team chased each one, even when the worker was already on site.",
  },
  {
    stage: "Shift ends",
    title: "Submitted times overrode the worker app's check-ins",
    body: "Workers could replace the worker app's check-in and check-out times with their own, which became the hours on record.",
  },
  {
    stage: "Invoicing",
    title: "Off-app shifts missed the invoice",
    body: "Companies booked extra workers at short notice, off the platform, causing billing gaps and pay issues.",
  },
];

// Mock workers and readings, a few factors folded together: absences with late check-ins, location off with distance
// from the site.
const spider: SpiderData = {
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
  workers: [
    {
      key: "brittany",
      first: "Brittany",
      name: "Brittany Pilz",
      shift: "Packaging Worker · CCLS First Gulf",
      readings: {
        worker: { level: 3, text: "3rd shift" },
        cancel: { level: 3, text: "Wants to cancel" },
        lateCancel: { level: 2, text: "Cancelled 3.5 h before last shift" },
        attendance: { level: 1, text: "1 late check-in" },
        location: { level: 3, text: "7.3 km away" },
        company: { level: 0, text: "Team's 213th shift" },
      },
    },
    {
      key: "aspen",
      first: "Aspen",
      name: "Aspen Curtis",
      shift: "Picker Packer · Sweets from the Earth",
      readings: {
        worker: { level: 2, text: "8th shift" },
        cancel: { level: 0, text: "No request" },
        lateCancel: { level: 2, text: "1 late cancellation" },
        attendance: { level: 1, text: "1 absence" },
        location: { level: 1, text: "2.1 km away" },
        company: { level: 3, text: "Team's 1st shift" },
      },
    },
    {
      key: "angel",
      first: "Angel",
      name: "Angel Saris",
      shift: "Picker Packer · CCLS First Gulf",
      readings: {
        worker: { level: 0, text: "120th shift" },
        cancel: { level: 0, text: "No request" },
        lateCancel: { level: 1, text: "1 late cancellation, 6 months ago" },
        attendance: { level: 1, text: "1 late check-in" },
        location: { level: 0, text: "On site" },
        company: { level: 0, text: "Team's 212th shift" },
      },
    },
  ],
};

const outcome: Metric = {
  value: "65%",
  label: "fewer attendance disputes",
  detail:
    "Correcting hours during the shift, with every change on record, *cut attendance disputes by 65%*, from an average of 90 a week to under 35 after launch.",
};

export const CHECK_INS = {
  clips: CLIPS,
  stakes: {
    eyebrow: "Business fit",
    heading: "Time tracking drove pay and billing",
    body: "Every week, 15% of workers raised pay issues, rising to 20% in busy season.",
    reasons,
  },
  gap: { eyebrow: "UX gap", heading: "The timesheet worked until a shift went off plan", stages },
  northStar:
    "Get every hour worked from check-in to invoice with full traceability and the flexibility to handle any exception.",
  cards: {
    checkIns: {
      title: "Let floor managers fix attendance while the shift runs",
      text: "Floor managers could correct attendance *only after the shift*. Until then, a worker whose phone had died showed as missing.\n\nThe new Check-ins page let floor managers *check a worker in or out, or mark them absent*, with a note saying why.",
    },
    timecards: {
      title: "Keep the worker app's times and worker-submitted times apart on every timecard",
      text: "The old timesheet showed both kinds of time identically, *hiding which hours a worker had changed*.\n\nEach timecard now *listed every source of hours separately*, with one selected for billing and each edit logged with who made it.",
    },
    offApp: {
      title: "Give finance sole control of off-app shifts",
      text: "Finance appended off-app shifts to invoices *on spreadsheets, outside the platform*.\n\nNow *only finance added them, as off-app timecards during invoicing*. Companies saw them read-only, which kept their scheduling on the platform.",
    },
    dashboard: {
      title: "Watch new workers and new teams more closely",
      text: "No-show risk ran higher on *a worker's first shifts, and on a team's first 10*. Established teams had a roster of reliable workers that were likely to show up.\n\nThe dashboard split all check-ins into tiles: missing check-ins, late check-ins and absences, alongside new workers and new teams. One click on a tile let our operations team *switch to the workers they needed to track closely*.",
    },
  },
  signals: {
    eyebrow: "Risk signals",
    heading: "Six signals added up to a worker's no-show risk",
    spider,
  },
  traceability: {
    eyebrow: "Traceability",
    heading: "I built a dashboard where our operations team used these risk signals to monitor likely no-shows",
  },
  outcome,
  takeaway: {
    eyebrow: "Takeaway",
    heading: "Workarounds write the brief",
    paragraphs: [
      "Floor managers' spreadsheets and photos of their paper attendance sheets, along with an invoicing cycle I spent apprenticing with finance, surfaced all four gaps.",
      "The records a team keeps by hand point to the work its software should take on.",
    ],
  },
};
