// The overlay's words: the About sheet's from the copywriter, the walk-through's comments from Kartik. `*`s mark bold
// phrases.

import type { Flag } from "./activations";
import type { Metric } from "./metric-card";
import type { PresetDraft } from "./presets";

/** The minimap's name, a press on which widens it to drag its pin. */
export const EXPAND_MAP = "Expand map to move the pin";

/** The hint under a template's geofence map. */
export const GEOFENCE_HINT = "Move the pin to set the job site's entrance, and the circles to adjust its boundaries";

/** A dashboard row's location link once its worker's location isn't tracked, in place of how far away they are. */
export const NOT_TRACKING = "Not Tracking";

/** View Location's timeline of where the worker's phone reported them, and the design system's example of it. */
export const LOCATION_HISTORY = {
  play: "Play location history",
  pause: "Pause location history",
  timeline: "Location history",
  example: "Location history",
};

export const SIDEBAR = {
  open: "About this project",
  hide: "Hide about this project",
  /** The cards' own headings, where their sheet's don't suit the card. */
  headings: {
    checkIns: "Cut attendance disputes from 90 a week to 31 by rebuilding check-ins and time tracking",
    designSystem: "Rolled out and maintained a design system that cut release cycle time by 38% in a year",
    flexibility: "Now floor managers check in workers who can't check themselves in",
    invoice: "The Timesheet is finance's source of truth: timecards track who made each edit",
    traceability: "Our operations team could confirm who was on site and triage likely no-shows",
    components: "Separate UI from business logic and build every screen from compound components",
    activationAndRetention: "Pre-boarding and one-drag reposting lifted tenth‑shift retention from 62% to 78%",
    onboarding: "New companies went from an empty dashboard to booked workers within hours",
    shiftScheduling: "Staffing managers extend a posted schedule with a drag",
  },
  /** The cards' own words where their sheet's run longer than 338 characters. */
  bodies: {
    checkIns:
      "Spotwork's time tracking sets what contract workers earn and companies pay. *15% of workers used to raise pay issues every week*.\n\nIn 2025, I rebuilt time tracking with floor managers and our finance team. Floor managers could now check in workers who couldn't check themselves in, and finance could *reconcile and invoice every hour worked from the Timesheet*. The check-in tracking dashboard let our operations team watch new workers and new teams closely.",
    flexibility:
      "At our remote warehouses, *poor signal blocked workers from checking in*. Those on site showed as missing until the shift ended. Our operations team had to verify them manually.\n\nI built a Check-ins page with the day's roster and live check-in status. Floor managers could *check workers in or out or mark them absent* mid-shift.\n\nI added the ability to draw and precisely adjust geofences around a worksite. Workers could then *check in or out only inside the work perimeter*. Geofences also flagged workers who left the worksite while checked in.",
    invoice:
      "Previously, hours a worker submitted replaced their check-in times. I made each timecard *track every edit and who made it*.\n\nCompanies used to book urgent shifts off-app, and finance had to invoice them on spreadsheets. I added off-app timecards for them. Every hour logged or changed had a change log behind it, so finance could treat the Timesheet as *the single source of truth for reconciliation*.",
    traceability:
      "I combined risk signals from OpenPhone texts and our shift, worker and company data to enable our operations team to *triage missing check-ins demanding urgent action*.\n\nGig work is inherently low trust. So I added location history, which let our operations team *ensure workers were on site for the duration of their shift*. From the dashboard, they could text any worker who left the job site.",
    designSystem:
      "As product designer and product manager, I led the rebuild of Spotwork's staffing management platform. Poor separation of concerns and hardcoded values led to code duplication and visual inconsistencies. Both made *development and testing prohibitively slow and expensive*.\n\nI drafted design system guidelines, and built compound components with engineering to separate presentation from business logic. The modularity and reusability we achieved *brought down the median release cycle time from 21 days to 13 days in a year*.",
    tokens:
      "Colours and sizes used to be raw values. So components that behaved alike *looked different from place to place*.\n\nI wrote colours in OKLCH, where equal lightness looks equally light in every hue. That made Active, Success, Warning and Alert *match surface, text and outline shades*.\n\nI set sizes in rem and borders in px. So *layouts scaled with browser text size* while borders held one even pixel.",
    components:
      "Our UI used to be intertwined with business logic. So existing elements were *hard to reuse*.\n\nWe built each screen as *declarative UI*, stating what it showed in the named parts of compound components. Outside its own component, a part raised an error naming its owner.\n\nWe set rules so every component in code *followed the design system*. Any local override carried a written reason we could track.",
    activationAndRetention:
      "Companies came to Spotwork to book workers. Their first impressions *dictated whether they stayed with us*.\n\nPreviously, companies started on an empty dashboard, which delayed activation. I enabled Sales to set them up with relevant job templates and a reliable worker pool to *minimize their time to first booking*.\n\nExtending a posted schedule used to mean drafting the shift again and sending workers a fresh round of offers. Staffing managers could now extend it in place, and offers went out automatically to the workers already booked. Repeat workers trusted companies they had already worked with, resulting in *fewer no-shows than first-timers*, which kept companies booking with us.",
    onboarding:
      "Before the rebuild, new companies started on an empty dashboard. Customers had to create templates before they could post shifts. Further, they had to wait for relevant workers to apply after posting shifts. These friction points delayed customers from experiencing *Spotwork's core value proposition*, making activation harder.\n\nI designed a pre-boarding workflow that let Sales set up each approved company's team before the company signed up. Sales prepared the team's templates, and added reliable workers with relevant skills to its worker pool. As a result, new companies reached the “aha moment” sooner, going *from an empty dashboard to booked workers within hours*.",
    shiftScheduling:
      "In the past, the staffing managers who posted most often had to draft a shift again to add dates and *send workers a fresh round of offers*.\n\nI prototyped two concepts. Recurrence proved efficient but rigid. Drag to select kept the calendar staffing managers already used.\n\nNow they *extend or change a posted schedule in place*.",
  },
  /** The metric of a project with no sheet to take one from. */
  outcomes: {
    activationAndRetention: {
      value: "78%",
      label: "tenth‑shift retention",
      trend: "up",
      change: "16 points",
      detail: "Pre-boarding and effortless reposting lifted tenth‑shift retention by 16 points, *from 62% to 78%*.",
    },
  } satisfies Record<string, Metric>,
  /** What each card's demo plays, beside its Play, on one line. */
  demos: {
    flexibility: "Edit check-ins",
    geofence: "Adjust a job site's geofence",
    invoice: "Adjust and confirm hours",
    traceability: "View location and send a text",
    riskSignals: "Risk signals",
    onboarding: "Set up a company before signup",
    schedule: "Add and cancel posted shifts",
  },
  /** The rows that open a page of the design system's site, in Kartik's words, and their button's name, the copywriter's. */
  links: {
    open: "Open page",
    guideline: "Design guidelines",
    tokens: "Design tokens",
    engineering: "Design engineering guidelines",
    components: "Components",
  },
  /** The first card's rows for the sheet's role and year. */
  facts: { role: "Role", year: "Year" },
  /** The eyebrows of Activation and retention's cards, in Kartik's words. */
  eyebrows: { onboarding: "Onboarding and activation", shiftScheduling: "Shift scheduling" },
};

/**
 * The overlay's projects and a project's versions, in Figma's words (1564:1932, 1564:1934); the projects' names, and
 * Check-ins' and Activation's versions, in Kartik's.
 */
export const PROJECTS = [
  { id: "design-system", label: "Design system" },
  {
    id: "check-ins",
    label: "Check-ins and time tracking",
    versions: [
      { id: "company", label: "Company" },
      { id: "admin", label: "Spotwork admin" },
    ],
  },
  {
    id: "activation-and-retention",
    label: "Activation and retention",
    versions: [
      { id: "activation", label: "Activation" },
      { id: "final", label: "Final version" },
      { id: "recurrence", label: "Recurrence concept" },
      { id: "old", label: "Old design" },
    ],
  },
];

/** The design system's words that Figma lacks, from the copywriter; Figma names its other sections and what they show. */
export const DESIGN_SYSTEM = {
  nav: "Design System",
  overview: "Overview",
  guidelines: "Guidelines",
  example: "Example",
  code: "Code",
  component: "Component",
  components: "Components",
  name: "Curie Design System",
  cards: {
    foundations: "Find the CSS variable for any color, type style, width, radius or effect you see in a design",
    components: (count: number) =>
      `Click through ${count} design system components in all their states, with the code under each example`,
    guidelines: "What Spotwork stands for, how it sounds, and the six architecture and design principles behind its interface",
  },
  foundations: "Foundations",
  textStyles: "Text styles",
  typesetting: "Typesetting",
  layout: "Layout",
  width: "Width",
  radius: "Corner Radius",
  effects: "Effects",
  borderAndOutline: "Border and outline",
  noOutline: "Outline · None",
  border: "Border",
  borderVariable: "Border CSS variable",
  outline: "Outline",
  outlineVariable: "Outline CSS variable",
  shadow: "Shadow",
  background: "Background",
  cssVariable: "CSS Variable",
  font: "Font",
  sizeLineHeight: "Size/Line Height",
  letterSpacing: "Letter spacing",
  value: "Value",
  token: "Token",
  property: "Property",
  sizesInRems: "Sizes in rems",
  edgesInPixels: "Edges in pixels",
  palette: "Palette",
  state: "State",
  showCode: "Show full code",
  showUnused: "Show unused colors",
  showPixels: "Show pixel values",
  showOklch: "Show OKLCH values",
  lightness: "Lightness",
  chroma: "Chroma",
  hue: "Hue",
  iconSizes: "Small, Medium and Large",
  iconName: "Icon",
  smallIcon: "Small (20 × 20)",
  mediumIcon: "Medium (25 × 25)",
  largeIcon: "Large (30 × 30)",
};

/** A Guideline card; `` ` ``s in its text mark code, and a blank line starts a paragraph. `abreast`, it sits three across. */
export type Guideline = { title: string; text: string; example?: string; abreast?: true };

/** The Guidelines page: each section's cards, in groups under their labels, from the copywriter but Design's, in Kartik's deck's words. */
export const GUIDELINE_SECTIONS: { title: string; intro?: string; groups: { title?: string; cards: Guideline[] }[] }[] = [
  {
    title: "Who we are",
    intro: "Spotwork connects employers who need shifts covered with workers who want to work them, from booking to payday.",
    groups: [
      {
        title: "Employers",
        cards: [
          {
            title: "Speed",
            text: "We fill shifts in hours. When a big order lands or someone calls in sick, employers post the shift and have people booked the same day.",
          },
          {
            title: "Reliability",
            text: "The people who book a shift show up, ready to work. No-shows are what employers fear most. So this is the promise they care about most.",
          },
          {
            title: "Quality",
            text: "Every worker we send is vetted, rated and already trained for the role. Employers get people who know the job the moment they walk in.",
          },
          {
            title: "Flexibility",
            text: "We let employers staff up when demand climbs and scale back when it drops. They pay for the shifts they book, and the cost ends there.",
          },
        ],
      },
      {
        title: "Workers",
        cards: [
          {
            title: "Control",
            text: "Workers choose when and where they work. We put the shifts in front of them, and they decide which ones fit their week.",
          },
          { title: "Fast pay", text: "We pay workers for every shift on the next business day. A Thursday shift is money in their account by Friday." },
          {
            title: "Steady work",
            text: "We keep a dependable flow of shifts coming, close to where workers live. Enough to plan a week around.",
          },
        ],
      },
    ],
  },
  {
    title: "Tone and voice",
    intro: "Our voice stays constant, and our tone shifts with the moment.",
    groups: [
      {
        title: "Voice",
        cards: [
          {
            title: "Plainspoken",
            text: "Write the way people talk on the job. Use short words and name things plainly: shift, pay, check in. Cut anything a reader would skim past.",
            example: "Your shift at the Brampton warehouse starts at 7:00 am. Check in at the front gate.",
          },
          {
            title: "Warm",
            text: "Write to one person, by name. Thank them for the work they do. Keep it friendly and short.",
            example: "Thanks for covering Saturday, Priya. The Mississauga team said you were a big help.",
          },
          {
            title: "Direct",
            text: "Lead with what matters. Put the date, time and place up front. One message, one ask.",
            example: "Confirm by 6:00 pm today to keep your shift on Saturday, 31 October.",
          },
        ],
      },
      {
        title: "Tone",
        cards: [
          {
            title: "Upbeat",
            text: "A confirmed shift is good news. Share it first, then the date, time and place. One exclamation mark, at most.",
            example: "You're booked, Marcus! Saturday, 31 October, 8:00 am to 4:00 pm at the Mississauga warehouse.",
          },
          {
            title: "Calm",
            text: "When a payment runs late, own the delay. Say how much is owed and when it arrives. Apologise once, then give the facts.",
            example:
              "Your $168.00 for Thursday's shift is running late. It will reach your account by 5:00 pm on Monday, 26 October. Sorry for the wait.",
          },
          {
            title: "Brisk",
            text: "In employer reports, lead with the numbers. Keep each line to one fact. Make it readable at a glance.",
            example:
              "Week of 19 October, Brampton warehouse: 42 shifts posted, 42 filled, 41 workers checked in on time. Total: $7,056.",
          },
        ],
      },
    ],
  },
  {
    title: "Interface",
    groups: [
      {
        title: "Design",
        cards: [
          {
            title: "Colours in OKLCH",
            text: "Write colours in `oklch(L% C H)`, where hues at equal lightness and chroma look equally light, keeping contrast predictable and values easy to interpolate between them. So Info, Success, Warning and Alert match surface, text and outline shades, each in its own hue.",
          },
          {
            title: "Sizes in rems, edges in pixels",
            text: "Set `width`, `height`, `padding`, `margin`, `gap`, `border-radius`, `font` and `letter-spacing` in rem, where 1rem is 16px at the default text size. When someone changes their browser's text size, these properties scale together and keep layouts in proportion.\n\nKeep `border`, `outline` and `box-shadow` in px. A 1px border stays one even pixel at every text size, and focus outlines keep their weight. Shadows take up no layout room.",
          },
          {
            title: "Readability",
            text: "When in doubt, prioritize readability and actionable layouts over minimalism—especially for data-heavy tasks like scheduling.",
            abreast: true,
          },
          {
            title: "Shared tokens",
            text: "Maintain distinct design systems for web and mobile, but use common design tokens for brand cohesion and shared vocabulary.",
            abreast: true,
          },
          {
            title: "Proven reusability",
            text: "Only formalize new component variants after proving their reusability to avoid “design system bloat.” The aim is to enable, not enforce.",
            abreast: true,
          },
        ],
      },
      {
        title: "Design engineering",
        cards: [
          {
            title: "Composition from owned parts",
            text: "Build declarative UI from compound components, each split into named parts. Compose those parts in a screen to declare what it shows.\n\nUse each part only inside the component that owns it, like `Dropdown.Item` in `Dropdown`. Placed anywhere else, a part throws an error that names its owner.",
          },
          {
            title: "Component contracts",
            text: "Pass className only what each component contract allows, like margin and width, and let the `no-restyle` lint rule flag the rest. Put edge-case tweaks in `UNSAFE_className` with a written reason, so the team can audit them for components the design system needs.",
          },
          {
            title: "Separation of concerns",
            text: "Apply separation of concerns: keep components to presenting the UI, and move Firebase and other business logic into separate services.",
          },
        ],
      },
    ],
  },
];

/** The date picker's screen-reader labels, from the copywriter. */
export const DATE_PICKER = {
  open: (month: string) => `${month}, choose month and year`,
  close: "Back to days",
  previousMonth: "Previous month",
  nextMonth: "Next month",
  previousYear: "Previous year",
  nextYear: "Next year",
};

/** Screen-reader labels, from the copywriter. */
export const NAV = {
  dialog: "Spotwork prototypes",
  label: "Projects",
  versions: "Versions",
};

/** The demo's words, in Kartik's; the note its Timesheet demo types, the copywriter's. */
export const DEMO = {
  play: "Play demo",
  note: "Worker started 15 min late. Adjusted start time to match.",
};

/** The app's own words that Figma doesn't have. */
export const TIME_PICKER = {
  invalid: "Enter a time like 3:07 PM",
};

const actedOn = (noun: string) => ({
  created: `${noun} created`,
  drafted: `${noun} draft saved`,
  updated: `${noun} updated`,
  duplicated: `${noun} duplicated`,
  deleted: `${noun} deleted`,
});

const counted = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;
// Two outcomes are two sentences, each with its full stop; one stands alone without.
const outcomes = (...said: (string | false)[]) => {
  const lines = said.filter((line) => line !== false);
  return lines.length > 1 ? lines.map((line) => `${line}.`).join(" ") : lines[0];
};

const workerAdded = "Worker added to pool";
const workerRemoved = "Worker removed from pool";
const template = actedOn("Template");
const preset = actedOn("Template preset");

/** The snackbar after each action, from the copywriter: what was acted on, then the past-tense verb. */
export const SNACKS = {
  checkInCode: (code: string) => `Check-in code ${code} copied`,
  checkOutCode: (code: string) => `Check-out code ${code} copied`,
  checkedIn: "Worker checked in",
  checkInUpdated: "Worker's check-in updated",
  markedAbsent: "Worker marked absent",
  rescheduled: (added: number, cancelled: number, offered = 0) =>
    outcomes(
      (added > 0 || !cancelled) && `${counted(added, "shift")} posted`,
      cancelled > 0 && `${counted(cancelled, "shift")} cancelled`,
      offered > 0 && `${counted(offered, "offer")} sent`,
    ),
  spotFill: (on: boolean) => `SpotFill turned ${on ? "on" : "off"}`,
  template,
  preset,
  templatesDeleted: (count: number) => (count === 1 ? template.deleted : `${counted(count, "template")} deleted`),
  presetsDuplicated: (count: number) => (count === 1 ? preset.duplicated : `${counted(count, "template preset")} duplicated`),
  confirmed: (hours: string) => `${hours} hours confirmed`,
  unconfirmed: (hours: string) => `${hours} hours unconfirmed`,
  absenceConfirmed: "Absence confirmed",
  absenceUnconfirmed: "Absence unconfirmed",
  offAppAdded: "Off-app timecard added",
  offAppUpdated: "Off-app timecard updated",
  offAppDeleted: "Off-app timecard deleted",
  messageSent: "Message sent",
  noteAdded: "Note added",
  workerAdded,
  workerRemoved,
  workersAdded: (count: number) => (count === 1 ? workerAdded : `${counted(count, "worker")} added to pool`),
  workersRemoved: (count: number) => (count === 1 ? workerRemoved : `${counted(count, "worker")} removed from pool`),
  riskAcknowledged: "Risk acknowledged",
  riskUnacknowledged: "Risk acknowledgement removed",
  approved: "Company approved",
  rejected: "Company rejected",
  reverted: "Company reverted to pending",
  companyDeactivated: "Company deactivated",
  teamDeactivated: "Team deactivated",
  teamRestored: "Team deactivation undone",
  teamAdded: "Team added",
  teamUpdated: "Team updated",
  teamDeleted: "Team deleted",
  companyReactivated: "Company deactivation undone",
  roleChanged: (role: string) => `Team member's role changed to ${role}`,
  membersInvited: (count: number) => (count === 1 ? "Team member invited" : `${count} team members invited`),
  invitationSent: "Invitation sent",
  linkCopied: "Invitation link copied",
  phoneCopied: "Phone number copied",
  emailCopied: "Email address copied",
  prospectAdded: "Company added",
  prospectUpdated: "Company updated",
  checkInCodes: (on: boolean) => `Check-in codes turned ${on ? "on" : "off"}`,
  featureFlag: (label: string, on: boolean) => `${label} turned ${on ? "on" : "off"}`,
  requirementsUpdated: "Mandatory requirements updated",
  offersSent: (offered: number, waitlisted: number) =>
    outcomes(
      (offered > 0 || !waitlisted) && `${counted(offered, "offer")} sent`,
      waitlisted > 0 && `${counted(waitlisted, "offer")} waitlisted`,
    ),
  offersWithdrawn: (count: number) => `${counted(count, "offer")} withdrawn`,
};

const and = (picks: string[]) => new Intl.ListFormat("en-GB", { type: "conjunction" }).format(picks);

/** Manage Template Presets' words that Figma lacks, from the copywriter; `description` is what Generate types. */
export const PRESETS = {
  delete: "Delete",
  editTitle: "Edit template preset",
  save: "Save changes",
  description: ({ title, skills, requirements: { equipment, physical, certificates, conditions } }: PresetDraft) =>
    [
      `The worker would fill the ${title.trim()} role.`,
      `They would need ${and(skills)} skills.`,
      equipment?.length && `The role requires ${and(equipment)}.`,
      physical?.length && `Physical requirements include ${and(physical)}.`,
      certificates?.length && `The worker must possess a valid ${and(certificates)}.`,
      conditions?.length && `The role has these working conditions: ${and(conditions)}.`,
    ]
      .filter(Boolean)
      .join(" "),
};

/** A company's own templates: the presets' form under the copywriter's names, and its cards' pill in Figma's words. */
export const COMPANY_TEMPLATES = {
  create: "Create a template",
  submit: "Create template",
  edit: "Edit template",
  activeShifts: (count: number) => (count ? `${count} Active Shift${count === 1 ? "" : "s"}` : "No Active Shifts"),
};

/** What the Companies page asks before it rejects, deactivates or deletes, any with a `note` asking why; the copywriter's. */
export const CONFIRMATIONS = {
  reject: {
    title: "Rejecting company sign-up",
    body: "You can undo this later from Company settings. Are you sure you want to reject this sign-up?",
    note: "Add a note describing why you are rejecting the sign-up",
    action: "Reject sign-up",
  },
  company: {
    title: "Deactivating company",
    body: "No one will be able to post shifts under any of this company's teams or open the shifts already posted. You can undo this later to bring the company and its teams back as they were. Are you sure you want to deactivate this company?",
    note: "Add a note describing why you are deactivating the company",
    action: "Deactivate company",
  },
  team: {
    title: "Deactivating team",
    body: "No one will be able to post shifts under this team or open the shifts already posted. You can undo this later, but the team's future shifts will stay deleted. Are you sure you want to deactivate this team?",
    note: "Add a note describing why you are deactivating the team",
    action: "Deactivate team",
  },
  deleteTeam: {
    title: "Deleting team",
    body: "The team's templates, worker pool, check-in codes and other settings will be deleted. You can't undo this. Are you sure you want to delete this team?",
    action: "Delete team",
  },
};

/** What a Caution zone's undo brings back; the copywriter's. */
export const UNDO = {
  approval: "You can undo this approval to move this company back to pending for sales to approve or reject again.",
  rejection: "You can undo this rejection to move this company back to pending for sales to approve or reject again.",
  company: "You can undo this deactivation to bring the company and its teams back as they were, with their settings.",
  team: "You can undo this deactivation to bring the team back with its team members, check-in codes and other settings. The team's future shifts stay deleted.",
};

/** A rejected or deactivated card's Caution zone heading, on the day it's archived; the copywriter's. */
export const ARCHIVING = {
  company: (state: "rejected" | "deactivated", on: string) => `This company has been ${state} and will be archived on ${on}`,
  team: (on: string) => `This team has been deactivated and will be archived on ${on}`,
};

/** Manage feature flags' switches: the user's labels, the copywriter's descriptions. */
export const FEATURE_FLAGS: Record<Flag, { label: string; description: string }> = {
  betaDashboard: {
    label: "Beta dashboard",
    description: "This company's teams get the new dashboard in the company app before it's released to everyone.",
  },
  geofencing: {
    label: "Worksite geofencing",
    description: "Workers can check in and out of this company's shifts only from inside the area drawn round the worksite.",
  },
  checkInCodes: {
    label: "Check-in codes",
    description: "Each team at this company can turn on check-in codes for workers to enter when checking in and out.",
  },
};

/** The walk-through's comments, in Kartik's words; a title only names its step in the comment editor. */
export const TOUR = {
  steps: [
    {
      id: "open-check-in",
      title: "Check in Maria Franci",
      body: "Sometimes, technical limitations such as network coverage at remote job sites prevented workers from checking in.\nI enabled floor managers to check workers in while the shift was in progress to minimize payment disputes.",
    },
    {
      id: "excuse-late",
      title: "Excuse a late check-in",
      body: "Beyond checking a worker in or out, floor managers could also excuse the worker for being late for valid reasons, preventing their reliability metrics from getting adversely affected.",
    },
  ],
} as const;
