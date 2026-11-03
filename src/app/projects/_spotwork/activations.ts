// The Companies page's prospects (SW Curie's Activations dashboard, 25519:34937): sales adds a company's contact, then
// approves or rejects them; an approved prospect gets an invitation, and becomes onboarded once their company signs up.

import type { StaticImageData } from "next/image";
import { COMPANY_PLACE } from "./geo";
import type { Place } from "./geofence";
import { TEMPLATES } from "./shifts";
import cclsLogo from "./assets/company-ccls.png";
import dempstersLogo from "./assets/companies/dempsters.png";
import dircksLogo from "./assets/companies/dircks-logistics.png";
import goodLeafUpload from "./assets/companies/goodleaf-farms.png";
import northWestLogo from "./assets/companies/north-west-company.png";
import brittanyPilz from "./assets/faces/brittany-pilz.jpg";
import dulceGouse from "./assets/faces/dulce-gouse.png";
import jakobBergson from "./assets/faces/jakob-bergson.png";

export type Country = "usa" | "canada";
export const SIZES = ["<25", "25–100", "100–250", "250+"] as const;
export type Size = (typeof SIZES)[number];
export const SOURCES = ["Organic", "Marketing Campaign", "Outreach"] as const;
export type Source = (typeof SOURCES)[number];
export type ProspectStatus = "pending" | "approved" | "rejected" | "onboarded";
/** What sales decides; a company is onboarded by signing up. */
export type Decision = Exclude<ProspectStatus, "onboarded">;
/** Its status, unless it's deactivated. */
export type Standing = ProspectStatus | "deactivated";
/** Every standing, in the order a company moves through them. */
export const STANDINGS: Standing[] = ["pending", "approved", "onboarded", "rejected", "deactivated"];

export type Role = "Owner" | "Team Admin" | "Editor" | "Viewer";

/** The roles a member can be given; a team has one owner. */
export const ROLES: Role[] = ["Team Admin", "Editor", "Viewer"];

/** A team's template, as Manage templates lists it. */
export type TeamTemplate = { title: string; tags: string[] };

/** A team's member, or someone invited who hasn't joined yet. */
export type Member = { name: string; email: string; role: Role; face?: StaticImageData } | { email: string; role: Role; invited: true };

export interface Team {
  name: string;
  address: Place;
  zone: string;
  /** Its logo's picture, once one's been given. */
  logo?: StaticImageData | string;
  /** Its owner first. */
  members: Member[];
  templates: TeamTemplate[];
  /** The workers in its pool, by id, in the order they joined. */
  pool: string[];
  /** Its own tags on the workers in its pool, by id. */
  workerTags?: Record<string, string[]>;
  /** The workers in its pool it's made favourites, by id. */
  favourites?: string[];
  checkInCodes: boolean;
  /** What every one of its templates requires, as Skills & requirements' values. */
  requirements?: string[];
  /** Its settings kept for when it's brought back. */
  deactivated?: boolean;
}

/** The features a company's flags turn on, in Manage feature flags' order. */
export const FLAGS = ["betaDashboard", "geofencing", "checkInCodes"] as const;
export type Flag = (typeof FLAGS)[number];

/** The company's workspace; its teams can be set up once it's approved. */
export interface Workspace {
  /** Its enabled feature flags, in `FLAGS`' order. */
  flags: Flag[];
  teams: Team[];
}

/** Who in sales is signed in to the Companies page, and writes the notes added there. */
export const SALES = "Michael M.";

/** A line of a company's Notes & history: a status it or its `team` moved to, a note, or a status with the note saying why. */
export type HistoryEntry = { status?: Standing; team?: string; text?: string; by: string; at: Date };

export interface Prospect {
  id: string;
  name: string;
  designation: string;
  /** Ten digits, or empty. */
  phone: string;
  email: string;
  company: string;
  /** Its company's logo's picture, once one's been given. */
  logo?: StaticImageData | string;
  /** The picture its logo's upload takes, without asking for a file. */
  upload?: StaticImageData;
  country: Country;
  size: Size;
  source: Source;
  added: Date;
  status: ProspectStatus;
  /** Oldest first, from its Pending review when it was added. */
  history: HistoryEntry[];
  workspace: Workspace;
  /** Set once its owner's been sent the invitation. */
  invited?: true;
  /** When its company signed up; onboarded companies only. */
  activeSince?: Date;
  /** When it was rejected; rejected companies only. */
  rejectedAt?: Date;
  /** Set while it's deactivated; its status is what reactivating it brings back. */
  deactivatedAt?: Date;
}

/** New company's fields, Edit company's too. */
export type Draft = Pick<Prospect, "name" | "phone" | "email" | "designation" | "country" | "company" | "size">;

export type Sort = { by: "name" | "company" | "added"; dir: "asc" | "desc" };

export interface ProspectFilters {
  query: string;
  country: Country | "all";
  sizes: Size[];
  sources: Source[];
  statuses: Standing[];
}

/** The company app's company and the team its Manage templates shows. */
export const APP_TEAM = { company: "CCLS", team: "CCLS First Gulf" };

// Figma's rows, its duplicate last one dropped. Its 10/24 is yesterday and its 10/23 the day before.
const SEED: (Omit<Prospect, "id" | "added" | "history" | "workspace"> & { daysAgo: number; at: [number, number] })[] = [
  { name: "Anika Septimus", designation: "Operations Manager", phone: "6184749169", email: "a.septimus@goodleaffarms.com", company: "GoodLeaf Farms", upload: goodLeafUpload, country: "canada", size: "250+", source: "Organic", daysAgo: 1, at: [21, 44], status: "pending" },
  { name: "Gustavo Donin", designation: "Employment Coordinator", phone: "8137525611", email: "gusdonin@saralee.com", company: "SaraLee", country: "usa", size: "250+", source: "Marketing Campaign", daysAgo: 1, at: [15, 15], status: "pending" },
  { name: "Maren Dorwart", designation: "Staffing Manager", phone: "", email: "maren.d@warehouserepublic.com", company: "Warehouse Republic", country: "usa", size: "100–250", source: "Outreach", daysAgo: 1, at: [14, 12], status: "pending" },
  { name: "Jocelyn Levin", designation: "Owner", phone: "7088138989", email: "jolevin@villaggio.com", company: "Villaggio", country: "usa", size: "<25", source: "Organic", daysAgo: 2, at: [19, 10], status: "rejected" },
  { name: "Paityn Aminoff", designation: "HR Staffing Specialist", phone: "", email: "paitynaminoff@sleepcountry.ca", company: "SleepCountry", country: "canada", size: "250+", source: "Outreach", daysAgo: 2, at: [16, 45], status: "approved" },
  { name: "Craig Curtis", designation: "Head of Business Operations", phone: "5048966913", email: "craig@dempsters.ca", company: "Dempster's", logo: dempstersLogo, country: "canada", size: "250+", source: "Organic", daysAgo: 2, at: [11, 21], status: "approved", invited: true },
  { name: "Nolan Gouse", designation: "Project Manager", phone: "5187446291", email: "nolangouse@dircks.com", company: "Dircks Logistics", logo: dircksLogo, country: "canada", size: "250+", source: "Organic", daysAgo: 2, at: [11, 13], status: "onboarded" },
  { name: "Skylar Kenter", designation: "Operations Manager", phone: "3474387215", email: "s.kenter@ihlcanada.com", company: "IHL", country: "canada", size: "25–100", source: "Marketing Campaign", daysAgo: 2, at: [10, 51], status: "rejected" },
  { name: "Brittany Pilz", designation: "COO", phone: "8144139191", email: "britpilz@northwest.ca", company: "North West Company", logo: northWestLogo, country: "canada", size: "250+", source: "Marketing Campaign", daysAgo: 2, at: [7, 17], status: "onboarded" },
  // The company app's own, Jesse P. its contact.
  { name: "Jesse Pereira", designation: "Staffing Manager", phone: "9055550188", email: "jesse.pereira@ccls.ca", company: APP_TEAM.company, logo: cclsLogo, country: "canada", size: "250+", source: "Outreach", daysAgo: 412, at: [10, 5], status: "onboarded" },
];

/** A team's default timezone: North America's, east to west. */
export const TIMEZONES = [
  "(GMT-3:30) Newfoundland Standard Time (NST)",
  "(GMT-4) Atlantic Standard Time (AST)",
  "(GMT-5) Eastern Standard Time (EST)",
  "(GMT-6) Central Standard Time (CST)",
  "(GMT-7) Mountain Standard Time (MST)",
  "(GMT-8) Pacific Standard Time (PST)",
  "(GMT-9) Alaska Standard Time (AKST)",
  "(GMT-10) Hawaii-Aleutian Standard Time (HST)",
];
const [, , EASTERN, , MOUNTAIN, PACIFIC] = TIMEZONES;

// January, when North America keeps standard time.
const WINTER = new Date(Date.UTC(2026, 0, 15));

/** Of `TIMEZONES`, the one a place keeps in standard time; none for a place outside them, or without a timezone. */
export function zoneAt({ timezone }: Place) {
  if (!timezone) return undefined;
  try {
    const offset = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "shortOffset" })
      .formatToParts(WINTER)
      .find((part) => part.type === "timeZoneName")?.value;
    return TIMEZONES.find((zone) => zone.startsWith(`(${offset})`));
  } catch {
    return undefined;
  }
}

const newWorkspace = (): Workspace => ({ flags: [], teams: [] });

// The workspaces set up past a new one's, by company.
const WORKSPACES: Record<string, Workspace> = {
  "Dempster's": {
    flags: ["betaDashboard"],
    teams: [
      {
        name: "Dempster's Hamilton",
        address: { id: "dempsters-hamilton", label: "745 Nebo Road, Hamilton, ON", city: "Hamilton", lat: 43.1755, lng: -79.8435 },
        zone: EASTERN,
        members: [{ name: "Craig Curtis", email: "craig@dempsters.ca", role: "Owner" }],
        templates: [
          { title: "Production Line Associate", tags: ["Assembly Line", "Packing", "Food Production"] },
          { title: "Mixer Operator", tags: ["Manufacturing", "Food Production"] },
          { title: "Shipping Associate", tags: ["Loading", "Warehouse"] },
        ],
        pool: ["marcus", "ethan", "isabela", "fatima", "samantha"],
        checkInCodes: false,
      },
    ],
  },
  "Dircks Logistics": {
    flags: ["betaDashboard", "geofencing", "checkInCodes"],
    teams: [
      {
        name: "Dircks Logistics Mississauga",
        address: { id: "dircks-toronto", label: "50 Bermondsey Road, Toronto, ON", city: "Toronto", lat: 43.7106, lng: -79.3155 },
        zone: EASTERN,
        members: [
          { name: "Nolan Gouse", email: "nolangouse@dircks.com", role: "Owner" },
          { name: "Hana Kowalczyk", email: "h.kowalczyk@dircks.com", role: "Team Admin" },
          { name: "Daniel Osei", email: "d.osei@dircks.com", role: "Team Admin" },
          { name: "Leah Fontaine", email: "l.fontaine@dircks.com", role: "Editor" },
          { name: "Arjun Mehta", email: "arjun.mehta@dircks.com", role: "Editor" },
          { name: "Sofia Marchetti", email: "s.marchetti@dircks.com", role: "Editor" },
          { name: "Ethan Choi", email: "e.choi@dircks.com", role: "Viewer" },
          { name: "Grace Liu", email: "g.liu@dircks.com", role: "Viewer" },
          { name: "Mateo Alvarez", email: "m.alvarez@dircks.com", role: "Viewer" },
          { email: "r.singh@dircks.com", role: "Editor", invited: true },
        ],
        templates: [
          { title: "Forklift Operator", tags: ["Manufacturing", "Warehouse", "Licensed"] },
          { title: "Container Associate", tags: ["Dockyard", "Loading"] },
          { title: "Reach Operator", tags: ["Licensed", "Reach Truck", "Warehouse"] },
          { title: "Offloader", tags: ["Loading", "Warehouse"] },
        ],
        pool: ["sikander", "jeff"],
        checkInCodes: true,
      },
      {
        name: "Dircks Logistics Calgary",
        address: { id: "dircks-calgary", label: "4000 4 Street SE, Calgary, AB", city: "Calgary", lat: 51.0156, lng: -114.0547 },
        zone: MOUNTAIN,
        members: [
          { name: "Dulce Gouse", email: "d.gouse@dircks.com", role: "Owner", face: dulceGouse },
          { name: "Jakob Bergson", email: "jbergson@dircks.com", role: "Team Admin", face: jakobBergson },
          { name: "Marcus Okafor", email: "m.okafor@dircks.com", role: "Editor" },
          { name: "Priya Raman", email: "priya.raman@dircks.com", role: "Editor" },
          { name: "Owen Tremblay", email: "o.tremblay@dircks.com", role: "Viewer" },
        ],
        templates: [
          { title: "Forklift Operator", tags: ["Manufacturing", "Warehouse", "Licensed"] },
          { title: "Reach Operator", tags: ["Licensed", "Reach Truck", "Warehouse"] },
          { title: "Offloader", tags: ["Loading", "Warehouse"] },
        ],
        pool: [],
        checkInCodes: true,
      },
    ],
  },
  [APP_TEAM.company]: {
    flags: ["betaDashboard", "checkInCodes"],
    teams: [
      {
        name: APP_TEAM.team,
        address: COMPANY_PLACE,
        zone: EASTERN,
        members: [
          { name: "Jesse Pereira", email: "jesse.pereira@ccls.ca", role: "Owner" },
          { name: "Amara Okoye", email: "a.okoye@ccls.ca", role: "Team Admin" },
          { name: "Liam Chen", email: "l.chen@ccls.ca", role: "Editor" },
        ],
        templates: TEMPLATES.map(({ name, tags }) => ({ title: name, tags })),
        pool: ["tashonda", "rayna", "angel", "aspen", "alejandro", "maria"],
        workerTags: {
          tashonda: ["AM", "Weekdays", "Warehouse"],
          rayna: ["Afternoon Shift", "Weekdays", "Dock Consolidation"],
          angel: ["AM", "Weekdays", "Warehouse"],
          aspen: ["Afternoon Shift", "Weekends", "Dock Consolidation"],
          alejandro: ["PM", "Weekends", "Warehouse"],
          maria: ["PM", "Weekdays", "Warehouse"],
        },
        favourites: ["tashonda", "angel"],
        checkInCodes: true,
      },
      {
        name: "CCLS White Hart",
        address: { id: "ccls-mississauga", label: "6090 White Hart Lane, Mississauga, ON", city: "Mississauga", lat: 43.6532, lng: -79.6814 },
        zone: EASTERN,
        members: [{ name: "Jesse Pereira", email: "jesse.pereira@ccls.ca", role: "Owner" }],
        templates: [],
        pool: [],
        checkInCodes: true,
      },
      {
        name: "CCLS Derwent",
        address: { id: "ccls-delta", label: "101-1005 Derwent Way, Delta, BC", city: "Delta", lat: 49.1717, lng: -122.9562 },
        zone: PACIFIC,
        members: [{ name: "Jesse Pereira", email: "jesse.pereira@ccls.ca", role: "Owner" }],
        templates: [],
        pool: [],
        checkInCodes: true,
      },
      {
        name: "CCLS Thornton",
        address: { id: "ccls-oshawa", label: "1180 Thornton Road, Oshawa, ON", city: "Oshawa", lat: 43.8826, lng: -78.8912 },
        zone: EASTERN,
        members: [{ name: "Jesse Pereira", email: "jesse.pereira@ccls.ca", role: "Owner" }],
        templates: [],
        pool: [],
        checkInCodes: true,
      },
    ],
  },
  "North West Company": {
    flags: ["geofencing", "checkInCodes"],
    teams: [
      {
        name: "North West Company Ottawa",
        address: { id: "northwest-ottawa", label: "100 Queen Street, Ottawa, ON", city: "Ottawa", lat: 45.4222, lng: -75.6985 },
        zone: EASTERN,
        members: [
          { name: "Brittany Pilz", email: "britpilz@northwest.ca", role: "Owner", face: brittanyPilz },
          { name: "Allison George", email: "a.george@northwest.ca", role: "Team Admin" },
          { name: "Kadin Baptista", email: "kadin.b@northwest.ca", role: "Viewer" },
          { email: "phil.lubin@northwest.ca", role: "Viewer", invited: true },
        ],
        templates: [
          { title: "Receptionist", tags: ["Front Desk"] },
          { title: "Security Guard", tags: ["Security", "Licensed"] },
        ],
        pool: [],
        checkInCodes: false,
      },
    ],
  },
};

/** The company app's teams as they start out, the one it opens on first. */
export const APP_TEAMS = WORKSPACES[APP_TEAM.company].teams;

// What happened to each company after it was added, oldest first: sales' notes, and the statuses it moved to. A
// rejection carries the note saying why; an onboarded company's contact signed it up.
const HISTORY: Record<string, (Omit<HistoryEntry, "at"> & { daysAgo: number; at: [number, number] })[]> = {
  "GoodLeaf Farms": [
    {
      text: "Called Anika. She needs about 20 general labourers for weekend harvest and packing shifts at their Guelph farm and wants to talk again once her budget is signed off.",
      by: "Priya S.",
      daysAgo: 0,
      at: [9, 12],
    },
  ],
  Villaggio: [
    { text: "Emailed Jocelyn to ask which roles she needs.", by: SALES, daysAgo: 2, at: [19, 38] },
    { text: "Jocelyn replied that she needs one barista for two weekend markets a month.", by: SALES, daysAgo: 1, at: [9, 51] },
    { status: "rejected", text: "Two shifts a month are too few for us to staff.", by: SALES, daysAgo: 1, at: [10, 24] },
  ],
  SleepCountry: [{ status: "approved", by: "Priya S.", daysAgo: 2, at: [17, 20] }],
  "Dempster's": [
    { text: "Called Craig. He needs 6 production line associates for the holiday peak, so approving.", by: "Priya S.", daysAgo: 2, at: [13, 5] },
    { status: "approved", by: "Priya S.", daysAgo: 2, at: [13, 6] },
    {
      text: "Sent Craig the invitation, no sign-up yet. Will follow up if he hasn't signed up by end of week.",
      by: SALES,
      daysAgo: 1,
      at: [10, 40],
    },
  ],
  "Dircks Logistics": [
    {
      text: "Spoke with Nolan, who needs forklift operators and offloaders at their Mississauga and Calgary warehouses. Approved.",
      by: "Priya S.",
      daysAgo: 2,
      at: [14, 20],
    },
    { status: "approved", by: "Priya S.", daysAgo: 2, at: [14, 21] },
    { status: "onboarded", by: "Nolan Gouse", daysAgo: 1, at: [9, 32] },
  ],
  IHL: [
    { text: "Skylar wants to hire 2 permanent, full-time staff for their Woodbridge warehouse.", by: SALES, daysAgo: 2, at: [11, 30] },
    { status: "rejected", text: "Skylar is hiring permanent staff. We only fill shifts.", by: SALES, daysAgo: 2, at: [16, 5] },
  ],
  "North West Company": [
    { text: "Brittany needs licensed security guards and receptionists for their Ottawa office. Approved and sent her the invitation.", by: "Priya S.", daysAgo: 2, at: [9, 30] },
    { status: "approved", by: "Priya S.", daysAgo: 2, at: [9, 31] },
    { status: "onboarded", by: "Brittany Pilz", daysAgo: 2, at: [15, 48] },
  ],
  [APP_TEAM.company]: [
    { status: "approved", by: "Priya S.", daysAgo: 411, at: [11, 40] },
    { status: "onboarded", by: "Jesse Pereira", daysAgo: 410, at: [9, 15] },
  ],
};

const daysBefore = (now: Date, daysAgo: number, [hours, minutes]: [number, number]) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hours, minutes);

export function prospectsFrom(now: Date): Prospect[] {
  return SEED.map(({ daysAgo, at, ...prospect }, i) => {
    const added = daysBefore(now, daysAgo, at);
    const history: HistoryEntry[] = [
      // Sales added a company it reached out to; any other's contact signed it up for review.
      { status: "pending", by: prospect.source === "Outreach" ? SALES : prospect.name, at: added },
      ...(HISTORY[prospect.company] ?? []).map(({ daysAgo, at, ...entry }) => ({ ...entry, at: daysBefore(now, daysAgo, at) })),
    ];
    const last = (status: Standing) => history.findLast((entry) => entry.status === status)?.at;
    return {
      ...prospect,
      id: `prospect-${i}`,
      added,
      history,
      workspace: WORKSPACES[prospect.company] ?? newWorkspace(),
      ...(prospect.status === "onboarded" && { activeSince: last("onboarded") }),
      ...(prospect.status === "rejected" && { rejectedAt: last("rejected") }),
    };
  });
}

const two = (n: number) => String(n).padStart(2, "0");

/** "10/16/2026". */
export const dayText = (date: Date) => `${two(date.getMonth() + 1)}/${two(date.getDate())}/${date.getFullYear()}`;

/** "10/16/2026 9:44 PM". */
export function addedOnText(date: Date) {
  const hours = date.getHours();
  return `${dayText(date)} ${hours % 12 || 12}:${two(date.getMinutes())} ${hours < 12 ? "AM" : "PM"}`;
}

/** "(416) 555-0142", as far as it's typed. */
export function formatPhone(digits: string) {
  if (!digits) return "";
  const [area, exchange, line] = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)];
  return `(${area})${exchange ? ` ${exchange}` : ""}${line ? `-${line}` : ""}`;
}

export function phoneText(prospect: Prospect) {
  return prospect.phone ? `+1 ${formatPhone(prospect.phone)}` : "-";
}

export function companyLine(prospect: Prospect) {
  return `${prospect.country === "usa" ? "USA" : "Canada"} • ${prospect.size} employees`;
}

export function filterProspects(list: Prospect[], { query, country, sizes, sources, statuses }: ProspectFilters) {
  const text = query.trim().toLowerCase();
  // A phone number, however it's punctuated.
  const digits = /^[\d\s()+-]+$/.test(text) ? text.replace(/\D/g, "") : "";
  return list.filter(
    (p) =>
      (country === "all" || p.country === country) &&
      (!sizes.length || sizes.includes(p.size)) &&
      (!sources.length || sources.includes(p.source)) &&
      (!statuses.length || statuses.includes(standing(p))) &&
      (!text ||
        [p.name, p.email, p.company, p.designation].some((field) => field.toLowerCase().includes(text)) ||
        (digits.length > 0 && p.phone.includes(digits))),
  );
}

export function sortProspects(list: Prospect[], { by, dir }: Sort) {
  const sign = dir === "asc" ? 1 : -1;
  return list.toSorted(
    (a, b) => sign * (by === "added" ? a.added.getTime() - b.added.getTime() : a[by].localeCompare(b[by])),
  );
}

/** `prospect` with `entry` at the end of its history, by whoever in sales is signed in. */
const logged = (prospect: Prospect, entry: Omit<HistoryEntry, "by" | "at">, now: Date): Prospect => ({
  ...prospect,
  history: [...prospect.history, { ...entry, by: SALES, at: now }],
});

/** `text`, as a history entry's note, if there is one. */
const noted = (text?: string) => (text ? { text } : {});

export function decide(list: Prospect[], id: string, status: ProspectStatus, now = new Date(), note?: string) {
  return list.map((p) =>
    p.id === id ? logged({ ...p, status, rejectedAt: status === "rejected" ? now : undefined }, { status, ...noted(note) }, now) : p,
  );
}

export const standing = (prospect: Prospect): Standing => (prospect.deactivatedAt ? "deactivated" : prospect.status);

/** Its status, workspace and teams stay as they are, for `reactivate` to bring back. */
export function deactivate(list: Prospect[], id: string, now = new Date(), note?: string) {
  return list.map((p) => (p.id === id ? logged({ ...p, deactivatedAt: now }, { status: "deactivated", ...noted(note) }, now) : p));
}

export function reactivate(list: Prospect[], id: string, now = new Date()) {
  return list.map((p) => (p.id === id ? logged({ ...p, deactivatedAt: undefined }, { status: p.status }, now) : p));
}

/** The day a rejected or deactivated company, or `team` deactivated on its own, is archived: six months after. */
export function archivedOn(prospect: Prospect, team?: Team) {
  const since = team
    ? team.deactivated
      ? prospect.history.findLast((entry) => entry.team === team.name && entry.status === "deactivated")?.at
      : undefined
    : (prospect.deactivatedAt ?? (prospect.status === "rejected" ? prospect.rejectedAt : undefined));
  if (!since) return undefined;
  const last = new Date(since.getFullYear(), since.getMonth() + 7, 0).getDate();
  return new Date(since.getFullYear(), since.getMonth() + 6, Math.min(since.getDate(), last));
}

/** Deactivates the company's team at `team`, keeping its settings for when it's brought back. */
export function deactivateTeam(list: Prospect[], id: string, team: number, now = new Date(), note?: string) {
  return teamTo(list, id, team, true, now, note);
}

/** Brings back the company's team at `team` as it was. */
export function restoreTeam(list: Prospect[], id: string, team: number, now = new Date()) {
  return teamTo(list, id, team, false, now);
}

function teamTo(list: Prospect[], id: string, at: number, deactivated: boolean, now: Date, note?: string) {
  return list.map((p) => {
    if (p.id !== id) return p;
    const team = p.workspace.teams[at];
    const workspace = { ...p.workspace, teams: p.workspace.teams.with(at, { ...team, deactivated }) };
    return logged({ ...p, workspace }, { status: deactivated ? "deactivated" : "onboarded", team: team.name, ...noted(note) }, now);
  });
}

export function updateWorkspace(list: Prospect[], id: string, change: (workspace: Workspace) => Workspace) {
  return list.map((p) => (p.id === id ? { ...p, workspace: change(p.workspace) } : p));
}

/** What the team form sets on a team. */
export type TeamDetails = Pick<Team, "name" | "address" | "zone" | "logo">;

/** Adds a team to the company, owned by its contact. */
export function addTeam(list: Prospect[], id: string, details: TeamDetails) {
  return list.map((p) => {
    if (p.id !== id) return p;
    const team: Team = { ...details, members: [{ name: p.name, email: p.email, role: "Owner" }], templates: [], pool: [], checkInCodes: false };
    return { ...p, workspace: { ...p.workspace, teams: [...p.workspace.teams, team] } };
  });
}

export const updateTeam = (list: Prospect[], id: string, at: number, details: TeamDetails) =>
  updateWorkspace(list, id, (workspace) => ({ ...workspace, teams: workspace.teams.with(at, { ...workspace.teams[at], ...details }) }));

/** Deletes a team set up before the company signed up. */
export const deleteTeam = (list: Prospect[], id: string, at: number) =>
  updateWorkspace(list, id, (workspace) => ({ ...workspace, teams: workspace.teams.toSpliced(at, 1) }));

/** Its own logo, or else its company's. */
export const teamLogo = (prospect: Pick<Prospect, "logo">, team?: Pick<Team, "logo">) => team?.logo ?? prospect.logo;

export function teamLine(team: Team) {
  return `${team.address.city ?? team.address.label} • ${team.zone}`;
}

const counted = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export const requirementsText = (team: Team) =>
  team.requirements?.length ? `${counted(team.requirements.length, "requirement", "requirements")} set` : "No requirement set";

const NO_REQUIREMENTS: string[] = [];

/** The company app's team, whose templates its Manage templates lists and whose pool its Manage worker pool does. */
export const appTeam = (list: Prospect[]) =>
  list.find((p) => p.company === APP_TEAM.company)?.workspace.teams.find((team) => team.name === APP_TEAM.team);

/** The teams the company app switches between, its deactivated ones left out. */
export const appTeams = (list: Prospect[]) =>
  list.find((p) => p.company === APP_TEAM.company)?.workspace.teams.filter((team) => !team.deactivated) ?? [];

/** `list` with the company app's team changed by `change`. */
export const updateAppTeam = (list: Prospect[], change: (team: Team) => Team) =>
  list.map((p) =>
    p.company !== APP_TEAM.company
      ? p
      : { ...p, workspace: { ...p.workspace, teams: p.workspace.teams.map((team) => (team.name === APP_TEAM.team ? change(team) : team)) } },
  );

/** The mandatory requirements of the company app's team. */
export const teamRequirements = (list: Prospect[]) => appTeam(list)?.requirements ?? NO_REQUIREMENTS;

export const poolText = (team: Team) => counted(team.pool.length, "worker", "workers");

export const membersText = (team: Team) =>
  counted(team.members.filter((member) => !("invited" in member)).length, "member", "members");

/** The members whose name or email holds `query`, whatever its case. */
export function findMembers(members: Member[], query: string) {
  const sought = query.trim().toLowerCase();
  return members.filter((member) =>
    [member.email, "name" in member ? member.name : ""].some((words) => words.toLowerCase().includes(sought)),
  );
}

export const withRole = (team: Team, email: string, role: Role): Team => ({
  ...team,
  members: team.members.map((member) => ("invited" in member || member.email !== email ? member : { ...member, role })),
});

export type Invite = { email: string; role: Role };

/** The team with `invites` after its members, each invited until they join. */
export const withInvites = (team: Team, invites: Invite[]): Team => ({
  ...team,
  members: [...team.members, ...invites.map((invite) => ({ ...invite, invited: true as const }))],
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Whether each of `emails` fails: not an email, on the team already, or typed above it. An empty one doesn't. */
export function failingInvites(team: Team, emails: string[]) {
  const typed = emails.map((email) => email.trim().toLowerCase());
  const taken = new Set(team.members.map((member) => member.email.toLowerCase()));
  return typed.map((email, i) => !!email && (!EMAIL.test(email) || taken.has(email) || typed.indexOf(email) < i));
}

export const templatesText = (team: Team) => counted(team.templates.length, "template", "templates");

export const flagsText = (flags: number) => (flags ? `${counted(flags, "flag", "flags")} enabled` : "No flag enabled");

/** `flags` with `flag` turned on or off. */
export const withFlag = (flags: Flag[], flag: Flag, on: boolean) => FLAGS.filter((f) => (f === flag ? on : flags.includes(f)));

export const notesText = (notes: number) => (notes ? counted(notes, "note", "notes") : "No note added");

/** How many notes its Notes & history holds: every entry, a status change with no note among them. */
export const noteCount = (prospect: Prospect) => prospect.history.length;

export function addNote(list: Prospect[], id: string, text: string, now = new Date()) {
  return list.map((p) => (p.id === id ? logged(p, { text }, now) : p));
}

/** "Oct 16, 2026, 9:44 PM", as a note's byline dates it. */
export const noteAtText = (at: Date) =>
  `${at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}, ${at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

export function emptyDraft(): Draft {
  return { name: "", phone: "", email: "", designation: "", country: "usa", company: "", size: "<25" };
}

export function draftOf({ name, phone, email, designation, country, company, size }: Prospect): Draft {
  return { name, phone, email, designation, country, company, size };
}

export const emailValid = (email: string) => /^\S+@\S+\.\S+$/.test(email.trim());

/** No number, or a whole one. */
export const phoneValid = (phone: string) => phone.length === 0 || phone.length === 10;

export function ready(draft: Draft) {
  return [draft.name, draft.designation, draft.company].every((field) => field.trim()) && emailValid(draft.email) && phoneValid(draft.phone);
}

const trimmed = (draft: Draft): Draft => ({
  ...draft,
  name: draft.name.trim(),
  email: draft.email.trim(),
  designation: draft.designation.trim(),
  company: draft.company.trim(),
});

/** A prospect sales adds by hand: pending, and the newest. */
export function addProspect(list: Prospect[], draft: Draft, now: Date): Prospect[] {
  return [
    {
      ...trimmed(draft),
      id: `prospect-${now.getTime()}`,
      source: "Outreach",
      added: now,
      status: "pending",
      history: [{ status: "pending", by: SALES, at: now }],
      workspace: newWorkspace(),
    },
    ...list,
  ];
}

export function updateProspect(list: Prospect[], id: string, draft: Draft) {
  return list.map((p) => (p.id === id ? { ...p, ...trimmed(draft) } : p));
}

/** What the company form sets on a company. */
export type CompanyDetails = Pick<Prospect, "company" | "logo">;

export function updateCompany(list: Prospect[], id: string, details: CompanyDetails) {
  return list.map((p) => (p.id === id ? { ...p, ...details } : p));
}

export function invite(list: Prospect[], id: string) {
  return list.map((p) => (p.id === id ? { ...p, invited: true as const } : p));
}

/** `title`, or with the lowest number from 2 that sets it apart from the `taken` names. */
export function uniqueTitle(taken: string[], title: string) {
  if (!taken.includes(title)) return title;
  let n = 2;
  while (taken.includes(`${title} ${n}`)) n++;
  return `${title} ${n}`;
}

/** A team's templates with a copy of `preset` after them, named apart from them. */
export const withCopy = (templates: TeamTemplate[], preset: TeamTemplate): TeamTemplate[] => [
  ...templates,
  { title: uniqueTitle(templates.map(({ title }) => title), preset.title), tags: [...preset.tags] },
];

/** The link an approved prospect's invitation carries. */
export function invitationLink(prospect: Prospect) {
  return `https://dashboard.spotwork.co/invite/${prospect.id}`;
}
