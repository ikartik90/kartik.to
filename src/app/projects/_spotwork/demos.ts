import { Temporal } from "@/utils/temporal";
import { planDemoRecurrence } from "@/components/demo/shift-scheduling-v1";
import { planDemoSweep } from "@/components/demo/shift-scheduling-v2";
import { WEEKDAY_KEYS } from "@/utils/calendar-month";
import { DEMO, PRESETS } from "./copy";
import { AUTHORED_NOW, departure, leftSiteNote, rowsFor } from "./dashboard";
import { PEOPLE } from "./data";
import type { Point, Step, Target } from "./demo";
import { alongEdge, worldPixel, type Geofence, type LatLng } from "./geofence";
import { HIT } from "./geofence-map";
import { PLAY_STEP } from "./location-history";
import { MAX_ZOOM, MIN_ZOOM } from "./logo-crop";
import { ADDRESS } from "./preset-sheet";
import { presetsSeed } from "./presets";
import type { Choice } from "./project-nav";
import { WEEKDAYS, addDays, isoOf, seedSeries, weekOf, weekdayOf, type Iso } from "./shifts";

// Play's demos, each the live app's own controls pressed in turn on its page, after the walkthrough clips'
// stories (../check-ins-walkthrough, ../onboarding-walkthrough) and with their words. Started on another page, a demo
// goes to its own through the sidebar first. Fields with a scenario type themselves in once focused.

type Root = () => HTMLElement | null;

function finders(root: Root) {
  const all = (selector: string) => [...(root()?.querySelectorAll<HTMLElement>(selector) ?? [])];
  const named = (element: Element) => element.getAttribute("aria-label") ?? element.textContent?.trim();
  const button = (name: string, within = ""): Target => () =>
    all(`${within} button, ${within} [role=menuitem]`.trim()).find((each) => named(each) === name) ?? null;
  const option = (name: string): Target => () => all("[role=option]").find((each) => named(each) === name) ?? null;
  const field = (label: string): Target => () => {
    const owner = all("label").find((each) => each.textContent?.trim() === label);
    return owner && "htmlFor" in owner ? root()?.ownerDocument.getElementById(owner.htmlFor as string) ?? null : null;
  };
  const date = (iso: Iso): Target => () => all(`button[data-date="${iso}"]:not([data-outside])`).at(-1) ?? null;
  // A calendar showing a month before the date's steps on to it first, up to three months on.
  const onTo = (iso: Iso): Step[] => [
    ...Array.from({ length: 3 }, (): Step => ({
      at: () => (date(iso)() ? null : all("button[data-nav=next]").at(-1) ?? null),
      optional: true,
    })),
    { at: date(iso) },
  ];
  // The sidebar's item for the demo's page, unless that page is open; shut, its rail keeps the item in reach.
  const visit = (item: string): Step[] => {
    const entry = button(item, "nav[aria-label=Main]");
    return [{ at: () => (entry()?.getAttribute("aria-current") !== "page" ? entry() : null), optional: true, hold: 900 }];
  };
  return { all, button, option, field, date, onTo, visit };
}

/** Monday, Wednesday and Friday of next month's first full week: always ahead, and in full view. */
function firstWeekOfNextMonth() {
  const today = new Date();
  const first = isoOf(new Date(today.getFullYear(), today.getMonth() + 1, 1));
  const monday = addDays(first, (8 - weekdayOf(first)) % 7);
  return [0, 2, 4].map((day) => addDays(monday, day));
}

const isoOfPlain = (date: Temporal.PlainDate) => date.toString() as Iso;

// The final version and the recurrence concept take the live sheet's own Drag to select and Recurrence demos' dates:
// next month's full Monday-to-Friday weeks with a Wednesday swapped for a Saturday, and tomorrow's shift on four
// weekdays until it makes 25.
function schedulingShift(root: Root, version: string): Step[] {
  const { button, option, field, date, onTo, visit } = finders(root);
  const today = Temporal.Now.plainDateISO();
  const describe: Step[] = [
    { at: field("Shift Title"), hold: 700 },
    { at: field("Template") },
    { at: option("Forklift Operator"), hold: 600 },
  ];
  const open: Step = { at: button("New shift..."), hold: 800 };

  if (version === "old") {
    const [monday, wednesday, friday] = firstWeekOfNextMonth();
    return [...visit("Shifts"), open, describe[0], ...onTo(monday), ...onTo(wednesday), ...onTo(friday), ...describe.slice(1), { at: button("Post shift") }];
  }

  const first = today.add({ days: 1 });
  const repeat = planDemoRecurrence(first);
  const sweep = planDemoSweep(today.add({ months: 1 }));
  const plan: Step[] =
    version === "recurrence"
      ? [
          { at: field("Shift Date") },
          ...onTo(isoOfPlain(first)),
          // Repeat opens on the shift's own weekday.
          { at: field("Repeat this shift on other days") },
          ...repeat.weekdays.slice(1).map((key): Step => ({ at: button(WEEKDAYS[WEEKDAY_KEYS.indexOf(key)]) })),
          { at: field("Until") },
          ...onTo(isoOfPlain(repeat.lastShift)),
        ]
      : [
          { at: date(isoOfPlain(sweep.from)), to: date(isoOfPlain(sweep.to)) },
          { at: date(isoOfPlain(sweep.drop)) },
          { at: date(isoOfPlain(sweep.add)) },
        ];

  return [
    ...visit("Shifts"),
    open,
    ...plan,
    { at: button("Next"), hold: 700 },
    ...describe,
    { at: button("Next"), hold: 900 },
    { at: button("Post shift") },
  ];
}

/**
 * Weekdays AM opened from this week's Shifts, or next week's once this week's are past, and its schedule edited: next week's
 * Wednesday and Friday cancelled, then the two weeks after its last day swept in, a drag a month. Each month is brought
 * to the calendar's middle, the only one in full view, before it's touched.
 */
function editSchedule(root: Root): Step[] {
  const { all, button, date, visit } = finders(root);
  const dialog = '[role=dialog][aria-label="Edit schedule"]';
  const today = isoOf(new Date());
  const sunday = weekOf(today)[0];
  const last = seedSeries(today).find((each) => each.id === "weekdays")!.dates.at(-1)!;
  const added = Array.from({ length: 14 }, (_, i) => addDays(last, i + 1)).filter((day) => weekdayOf(day) % 6 !== 0);
  const months = [...new Set(added.map((day) => day.slice(0, 7)))].map((month) => added.filter((day) => day.startsWith(month)));
  const cancelled = [addDays(sunday, 10), addDays(sunday, 12)];
  const shift: Target = () => all("[data-when=ahead] button").find((each) => each.textContent?.startsWith("Weekdays AM")) ?? null;
  // The months slide when brought along; a cell's box is only where it stays once they've stopped.
  const still = (target: Target): Target => () =>
    all(`${dialog} [data-toggle]`)[0]?.parentElement?.getAnimations().some((each) => each.playState === "running") ? null : target();
  const middle = () => all(`${dialog} [data-toggle]`)[1]?.querySelector<HTMLElement>("button[data-date]")?.dataset.date?.slice(0, 7);
  const centre = (day: Iso): Step[] =>
    Array.from({ length: 2 }, (): Step => ({
      at: () => {
        const shown = middle();
        if (!shown || shown === day.slice(0, 7)) return null;
        return button(shown < day ? "Next month" : "Previous month", dialog)();
      },
      optional: true,
      hold: 700,
    }));
  // Level with `rowOf`'s cell, in `columnOf`'s column: a month's rows start on a Sunday, so its first and last days
  // needn't be the rectangle's corners.
  const corner = (columnOf: Iso, rowOf: Iso) => (): Point | null => {
    const [column, row] = [date(columnOf)(), date(rowOf)()].map((cell) => cell?.getBoundingClientRect());
    return column && row ? { x: column.left + column.width / 2, y: row.top + row.height / 2 } : null;
  };
  const sweep = (days: Iso[]): Step[] => {
    if (days.length === 1) return [...centre(days[0]), { at: still(date(days[0])), hold: 700 }];
    const byWeekday = [...days].sort((a, b) => weekdayOf(a) - weekdayOf(b));
    return [
      ...centre(days[0]),
      { at: still(date(days[0])), on: corner(byWeekday[0], days[0]), to: corner(byWeekday.at(-1)!, days.at(-1)!), hold: 900 },
    ];
  };
  return [
    ...visit("Shifts"),
    { at: () => (shift() ? null : button("Next week")()), optional: true, hold: 700 },
    { at: shift, hold: 1200 },
    { at: button("Edit schedule..."), hold: 900 },
    ...centre(cancelled[0]),
    ...cancelled.map((day): Step => ({ at: still(date(day)), hold: 600 })),
    ...months.flatMap(sweep),
    { at: button("Save changes", dialog) },
  ];
}

const row = (worker: string) => `[data-worker="${worker}"]`;

/**
 * Clip 1 on the company's page. On the Spotwork admin's, clip 3: where Brittany has been scrubbed from her 13th report to
 * her 20th, then back to when she left the job site, and the time it shows put in the note sent with the message asking
 * if she's coming back.
 */
function checkIns(root: Root, version: string): Step[] {
  const { button, field, visit } = finders(root);
  if (version === "admin") {
    const location = '[role=dialog][aria-label^="View location"]';
    const handle: Target = () => root()?.querySelector<HTMLElement>(`${location} [role=slider]`) ?? null;
    const track: Target = () => handle()?.parentElement ?? null;
    // Her reports, and which she left at, are the same whatever the hour.
    const brittany = rowsFor(AUTHORED_NOW).today.find((each) => each.id === "brittany")!;
    const reports = brittany.trace!.length;
    const left = brittany.trace!.indexOf(departure(brittany)!);
    // The track under her report `index`, level with the handle.
    const report = (index: number) => () => {
      const box = track()?.getBoundingClientRect();
      const at = handle()?.getBoundingClientRect();
      return box && at ? { x: box.left + (index / (reports - 1)) * box.width, y: at.top + at.height / 2 } : null;
    };
    let time = "";
    return [
      ...visit("Check-ins dashboard"),
      { at: () => [...(root()?.querySelectorAll(`${row("Brittany Pilz")} button`) ?? [])].find((each) => /km$/.test(each.textContent?.trim() ?? "")) as HTMLElement ?? null, hold: 1800 },
      // One press: forward a report each of Play's steps, so the map keeps up with where she went, then quickly back to
      // when she left.
      { at: track, on: report(12), to: report(19), ms: 7 * PLAY_STEP, then: [{ to: report(left) }], hold: 2400 },
      { at: () => ((time = handle()?.getAttribute("aria-valuetext") ?? time), button("Close", location)()) },
      { at: button("Send message", row("Brittany Pilz")), hold: 700 },
      { at: button("Are you on site?"), hold: 600 },
      { at: field("Note"), type: () => leftSiteNote(time) },
      { at: button("Send message") },
    ];
  }
  return [
    ...visit("Overview"),
    { at: button("Check in...", row("Maria Franci")), hold: 700 },
    { at: field("Excuse late check-in") },
    { at: field("Notes"), hold: 2400 },
    { at: button("Check in"), hold: 900 },
    { at: button("Edit check-in", row("Aspen Curtis")), hold: 700 },
    { at: button("Mark absent"), hold: 700 },
    { at: field("Excuse this absence") },
    { at: field("Notes"), hold: 1600 },
    { at: button("Mark absent") },
  ];
}

/**
 * The Spotwork admin's dashboard: Brittany's high no-show risk in her sheet's Risk factor card, then Sikander's medium and
 * Jeff's low in the same sheet, a factor or two pointed at so the chart lights it, and each one's unread risk
 * acknowledged before the next.
 */
function riskSignals(root: Root): Step[] {
  const { all, field, visit } = finders(root);
  const acknowledge: Step = { at: field("Acknowledge Risk"), hold: 900 };
  const sheetOf = (worker: string, hold: number): Step => ({
    at: () => root()?.querySelector<HTMLElement>(`${row(worker)} button[data-sheet-trigger]`) ?? null,
    hold,
  });
  const factor = (name: string): Step => ({
    at: () => all("[role=dialog] [data-risk] li").find((each) => each.lastElementChild?.textContent === name) ?? null,
    hover: true,
    hold: 1200,
  });
  return [
    ...visit("Check-ins dashboard"),
    sheetOf("Brittany Pilz", 1500),
    factor("Cancellation request"),
    factor("Location"),
    acknowledge,
    sheetOf("Sikander Mazumdar", 1500),
    factor("Late check-ins and absences"),
    acknowledge,
    sheetOf("Jeff Gwartzmann", 1200),
    acknowledge,
  ];
}

/** The company's Timesheet, in the week it opens on: the hours Rayna sent in, started 15 minutes later with a note, then confirmed. */
function timesheet(root: Root): Step[] {
  const { all, button, field, visit } = finders(root);
  const sentIn: Target = () =>
    all("[role=row]")
      .find((row) => row.textContent?.includes(PEOPLE.rayna.name))
      ?.querySelector<HTMLElement>("button[data-status=submitted]") ?? null;
  const later: Target = () => {
    const times = all("[role=option]");
    const shown = times.findIndex((each) => each.getAttribute("aria-selected") === "true");
    return shown < 0 ? null : times[shown + 1] ?? null;
  };
  return [
    ...visit("Timesheets"),
    { at: sentIn, hold: 900 },
    { at: button("Adjust hours..."), hold: 700 },
    { at: field("Shift Start Time") },
    { at: later, hold: 600 },
    { at: field("Note"), type: DEMO.note },
    { at: button("Adjust hours"), hold: 1200 },
    { at: button("Confirm hours") },
  ];
}

/** The presets the activation demo duplicates as GoodLeaf Farms' templates. */
export const GOODLEAF_TEMPLATES = ["Vertical Farming Technician", "Picker/Packer", "Sanitation Worker"];

// GoodLeaf's logo upload (assets/companies/goodleaf-farms.png, Figma 26022:13511) is square with its mark centred, half
// its width: zoomed this much, the mark fills four fifths of the crop.
const LOGO_ZOOM = 1.6;

/**
 * GoodLeaf Farms set up before it signs up, from its company's settings: approved from review and invited, its logo
 * uploaded and cropped, then given a team at its Guelph farm, the team's templates duplicated from Spotwork's presets,
 * and the workers round the farm with the templates' skills added to its pool all at once.
 */
function activation(root: Root): Step[] {
  const { all, button, option, field, visit } = finders(root);
  const prospect = '[data-prospect="Anika Septimus"]';
  const settings = '[role=dialog][aria-label="Company settings"]';
  const company = '[role=dialog][aria-label="Edit company workspace"]';
  const crop = '[role=dialog][aria-label="Company logo"]';
  const team = '[role=dialog][aria-label="New team"]';
  const templates = '[role=dialog][aria-label="Manage templates"]';
  const pool = '[role=dialog][aria-label="Manage worker pool"]';
  const record = (title: string): Target => () =>
    all(`${settings} [data-sheet-trigger]`).find((each) => each.textContent?.startsWith(title)) ?? null;
  // The action bar's button over ticked rows, after the rows' own of its name.
  const act = (name: string, within: string): Target => () =>
    all(`${within} button`).filter((each) => each.textContent?.trim() === name).at(-1) ?? null;
  const suggested: Target = () => all("[role=option]")[0] ?? null;
  // Add team once the address picked has set the team's timezone.
  const zoned: Target = () => (all(`${team} button`).some((each) => each.textContent?.startsWith("(GMT")) ? button("Add team", team)() : null);
  const skillsFilter: Target = () =>
    all(`${pool} button[aria-haspopup=listbox]`).find((each) => each.textContent?.startsWith("Skills")) ?? null;
  const zoom: Target = () => root()?.querySelector<HTMLElement>(`${crop} [role=slider]`) ?? null;
  // Where on the zoom's track it reads `LOGO_ZOOM`.
  const zoomed = (): Point | null => {
    const box = root()?.querySelector(`${crop} [data-track]`)?.getBoundingClientRect();
    return box ? { x: box.left + (box.width * (LOGO_ZOOM - MIN_ZOOM)) / (MAX_ZOOM - MIN_ZOOM), y: box.top + box.height / 2 } : null;
  };
  // A–Z, as the filter lists them; those no one found has aren't there to pick.
  const skills = [
    ...new Set(presetsSeed().flatMap((preset) => (GOODLEAF_TEMPLATES.includes(preset.title) ? preset.skills : []))),
  ].sort();
  return [
    ...visit("Companies"),
    { at: button("GoodLeaf Farms", prospect), hold: 900 },
    { at: button("Approve", settings), hold: 700 },
    { at: button("Send invitation", settings), hold: 900 },
    { at: button("Edit company...", settings), hold: 700 },
    { at: button("Update company logo", company), hold: 900 },
    { at: zoom, to: zoomed, ms: 900, hold: 700 },
    { at: button("Save logo", crop), hold: 700 },
    { at: button("Save changes", company), hold: 900 },
    { at: button("Add team...", settings), hold: 700 },
    { at: field("Team Name"), type: "GoodLeaf Farms Guelph" },
    { at: field(`Team ${ADDRESS}`), type: "35 Cooper Drive Guelph" },
    { at: suggested, hold: 600 },
    { at: zoned, hold: 900 },
    { at: record("Manage templates"), hold: 700 },
    { at: button("Template presets", templates), hold: 600 },
    ...GOODLEAF_TEMPLATES.map((title): Step => ({ at: button(title, templates) })),
    { at: act("Duplicate", templates), hold: 700 },
    { at: button("Team's templates", templates), hold: 900 },
    { at: button("Close", templates), hold: 500 },
    { at: record("Manage worker pool"), hold: 700 },
    { at: button("Find workers", pool), hold: 600 },
    { at: button("Search", pool), hold: 900 },
    { at: skillsFilter, hold: 600 },
    ...skills.map((skill): Step => ({ at: option(skill), optional: true })),
    { at: skillsFilter, hold: 700 },
    { at: button("Select all", `${pool} [aria-label="Find workers"]`), hold: 600 },
    { at: act("Add to pool", pool), hold: 700 },
    { at: button("Team's worker pool", pool), hold: 900 },
    { at: button("Close", pool) },
  ];
}

/** CCLS's building at First Gulf, outlined on Google's map: Picker Packer's fence once its demo is done. */
export const BUILDING: Geofence = [
  { lat: 43.6740518, lng: -79.7155635 },
  { lat: 43.6733453, lng: -79.7146791 },
  { lat: 43.6732673, lng: -79.7145199 },
  { lat: 43.6748066, lng: -79.7122433 },
  { lat: 43.6752135, lng: -79.7127834 },
  { lat: 43.6750737, lng: -79.7129806 },
  { lat: 43.6753935, lng: -79.7134014 },
  { lat: 43.6747627, lng: -79.714309 },
  { lat: 43.674843, lng: -79.7144207 },
];

/**
 * Picker Packer's fence as its demo starts it: the building without the bend in its south-west wall or the step in its
 * north-west one, and two of its corners off.
 */
const PICKER_FENCE: Geofence = [
  BUILDING[0],
  { lat: 43.6732441, lng: -79.7145526 },
  ...BUILDING.slice(3, 6),
  { lat: 43.6754724, lng: -79.7135031 },
];

// Google's map zooms a level for this much of a pinch's wheel travel.
const LEVEL = 80;

/**
 * Picker Packer's geofence put on its building from the template's Address & wage map, turned to Satellite. Zoomed in
 * on the north-west wall's step: its far corner added where the wall passes nearest, the north corner moved onto the
 * building, and the near corner added and moved there. Zoomed out, and in on the south: the bend in the south-west
 * wall added where the wall passes nearest, and the south corner moved. Then saved.
 */
function geofence(root: Root): Step[] {
  const { all, button, visit } = finders(root);
  const drawing = () => root()?.querySelector<SVGPolygonElement>("[data-map][data-size=wide] polygon")?.ownerSVGElement ?? null;
  const cornersOf = (svg: SVGSVGElement) =>
    svg
      .querySelector("polygon")!
      .getAttribute("points")!
      .split(" ")
      .map((pair): Point => {
        const [x, y] = pair.split(",").map(Number);
        return { x, y };
      });
  // As the drawing reads the pointer: the window may be scaled.
  const inWindow = (svg: SVGSVGElement, { x, y }: Point): Point => {
    const box = svg.getBoundingClientRect();
    const [left, top, width] = svg.getAttribute("viewBox")!.split(" ").map(Number);
    const scale = box.width / width || 1;
    return { x: box.left + (x - left) * scale, y: box.top + (y - top) * scale };
  };
  // The map is flat and north-up, so a place's point in the drawing is its world pixel scaled and moved: the fence's
  // west and east ends, which stay where the demo starts them, place the rest.
  const drawnAt = (svg: SVGSVGElement, place: LatLng): Point => {
    const corners = cornersOf(svg);
    const p = corners.reduce((west, each) => (each.x < west.x ? each : west));
    const q = corners.reduce((east, each) => (each.x > east.x ? each : east));
    const [a, b, at] = [BUILDING[0], BUILDING[3], place].map((each) => worldPixel(each, 0));
    const scale = Math.hypot(q.x - p.x, q.y - p.y) / Math.hypot(b.x - a.x, b.y - a.y);
    return { x: p.x + (at.x - a.x) * scale, y: p.y + (at.y - a.y) * scale };
  };
  const svgOf = (part: Element) => (part as SVGElement).ownerSVGElement!;
  const nth = (selector: string, index: number): Target => () => drawing()?.querySelectorAll<HTMLElement>(selector)[index] ?? null;

  const move = (index: number, place: LatLng): Step => ({
    at: nth("[data-anchor]", index),
    on: (corner) => inWindow(svgOf(corner), cornersOf(svgOf(corner))[index]),
    to: () => {
      const svg = drawing();
      return svg && inWindow(svg, drawnAt(svg, place));
    },
    hold: 600,
  });
  // Add Marker pressed where the edge after corner `index` comes nearest `place`.
  const addNear = (index: number, place: LatLng): Step => ({
    at: nth("[data-edge]", index),
    on: (line) => {
      const svg = svgOf(line);
      const corners = cornersOf(svg);
      return inWindow(svg, alongEdge(corners[index], corners[(index + 1) % corners.length], drawnAt(svg, place), HIT));
    },
    hold: 600,
  });
  // The corner it adds dragged on to `place`.
  const add = (index: number, place: LatLng): Step[] => [addNear(index, place), move(index + 1, place)];
  // Google's map pinched `levels` in, or out, where that brings `points` in the drawing to the middle of the map below
  // its toolbar: a pinch holds the point it's at still, and everything else goes `scale` times as far from it.
  const zoom = (levels: number, points: (svg: SVGSVGElement) => Point[]): Step => ({
    at: () => {
      const map = root()?.querySelector<HTMLElement>("[data-map][data-size=wide]");
      return map?.querySelector(".gm-style") ? map : null;
    },
    on: (map) => {
      const svg = drawing()!;
      const seen = points(svg).map((point) => inWindow(svg, point));
      const [xs, ys] = [seen.map(({ x }) => x), seen.map(({ y }) => y)];
      const at = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
      const box = map.getBoundingClientRect();
      const bar = map.querySelector("[aria-label=View]")!.closest("[data-map] > *")!.getBoundingClientRect();
      const middle = { x: box.left + box.width / 2, y: (bar.bottom + box.bottom) / 2 };
      const scale = 2 ** levels;
      const still = { x: at.x + (at.x - middle.x) / (scale - 1), y: at.y + (at.y - middle.y) / (scale - 1) };
      // Google's map takes the pointer's distance from its centre in the window's pixels for its own, which the window
      // may scale.
      const centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      const scaled = box.width / map.offsetWidth || 1;
      return { x: centre.x + (still.x - centre.x) / scaled, y: centre.y + (still.y - centre.y) / scaled };
    },
    pinch: -levels * LEVEL,
    optional: true,
    hold: 900,
  });
  const edit: Target = () =>
    all("[role=listitem]")
      .find((card) => card.querySelector("h2")?.textContent === "Picker Packer")
      ?.querySelector<HTMLElement>("button[aria-label=Edit]") ?? null;
  const formStep = (name: string): Target => () => all("button").find((each) => each.lastElementChild?.textContent === name) ?? null;
  // Its segment repeats its label, hidden, for its width.
  const satellite: Target = () =>
    all("[data-map][data-size=wide] [aria-label=View] button").find((each) => each.textContent?.startsWith("Satellite")) ?? null;

  return [
    ...visit("Manage templates"),
    { at: edit, hold: 900 },
    { at: formStep("Address & wage"), hold: 1500 },
    { at: satellite, hold: 1200 },
    zoom(1.5, (svg) => [cornersOf(svg)[5], ...BUILDING.slice(6).map((place) => drawnAt(svg, place))]),
    addNear(5, BUILDING[8]),
    move(5, BUILDING[6]),
    ...add(5, BUILDING[7]),
    zoom(-1.5, cornersOf),
    zoom(3, (svg) => [cornersOf(svg)[1], ...BUILDING.slice(1, 3).map((place) => drawnAt(svg, place))]),
    addNear(0, BUILDING[1]),
    move(2, BUILDING[2]),
    { at: formStep("Review template summary"), hold: 1500 },
    { at: button(PRESETS.save) },
  ];
}

/** The templates' fences, by id, a demo starts the app with where its story starts one off its building. */
export function demoFencesOf(choice: Choice, name?: string): Record<string, Geofence> | undefined {
  return choice.project === "check-ins" && name === "geofence" ? { picker: PICKER_FENCE } : undefined;
}

/** The steps Play takes for a project and its version, if it has a demo; `name` picks another of the version's. */
export function demoOf(choice: Choice, root: Root, name?: string): Step[] | undefined {
  if (choice.project === "activation-and-retention") {
    if (name === "schedule") return editSchedule(root);
    return !choice.version || choice.version === "activation" ? activation(root) : schedulingShift(root, choice.version);
  }
  if (choice.project === "check-ins") {
    if (name === "timesheet") return timesheet(root);
    if (name === "geofence") return geofence(root);
    return name === "risk" ? riskSignals(root) : checkIns(root, choice.version ?? "company");
  }
  return undefined;
}
