import type { StaticImageData } from "next/image";
import mariaFranci from "./assets/faces/maria-franci.jpg";
import aspenCurtis from "./assets/faces/aspen-curtis.jpg";
import angelSaris from "./assets/faces/angel-saris.jpg";
import raynaRhielMadsen from "./assets/faces/rayna-rhiel-madsen.jpg";
import alejandroVasquez from "./assets/faces/alejandro-vasquez.jpg";
import brittanyPilz from "./assets/faces/brittany-pilz.jpg";
import gamanderLopez from "./assets/faces/gamander-lopez.jpg";
import dishaPatil from "./assets/faces/disha-patil.jpg";
import jeffGwartzmann from "./assets/faces/jeff-gwartzmann.jpg";
import sikanderMazumdar from "./assets/faces/sikander-mazumdar.jpg";
import canadaCartage from "./assets/company-ccls.png";
import bolt from "./assets/companies/bolt.png";
import canadaBread from "./assets/companies/canada-bread.png";
import reliableLogistics from "./assets/companies/reliable-logistics.png";
import stalco from "./assets/companies/stalco.png";
import chitChats from "./assets/companies/chit-chats.png";

// The Check-ins page's workers, as the Figma frame (SW Curie 19031:50678) and the first walkthrough clip show them.
// The AM shift's are SW Curie's no-show risk rows (23423:124261).

export type Status = "absent" | "late" | "lateCheckIn" | "checkedIn" | "checkedOut" | "upcoming";

/** Spotwork's tiers, lowest first. */
export type Tier = "Super" | "Pro" | "Elite";

/** What the profile card shows (SW Curie 10679:34884). */
export interface Profile {
  tier: Tier;
  /** Spotscore, out of 100. */
  score: number;
  pool: string;
  phone: string;
  location: string;
  shifts: number;
  hours: number;
}

export interface Worker {
  id: string;
  name: string;
  face: StaticImageData;
  profile: Profile;
  status: Status;
  /** Minutes after midnight on the shift's day; past 24 × 60 is the next day. */
  checkIn?: number;
  checkOut?: number;
  /** Unpaid minutes between check-in and check-out. */
  unpaidBreak?: number;
  note?: string;
  excused?: boolean;
  /** Marked absent by someone, as against not checked in. */
  marked?: boolean;
  /** Who last checked them in or marked them absent, and when; kept off the history when untracked. */
  by?: string;
  at?: number;
  untracked?: boolean;
}

export interface Shift {
  id: string;
  position: string;
  name: string;
  /** The shift's own start and end, in the same minutes as a worker's times. */
  start: number;
  end: number;
  codes: { checkIn: string; checkOut: string };
  workers: Worker[];
}

export const DAY = 24 * 60;

// As the clip shows them, the afternoon shift at 3:00 PM; `shiftsFrom` moves every time to start it elsewhere.
const AUTHORED_START = 15 * 60;

/** Who a worker is, apart from any one shift. */
export type Person = Pick<Worker, "id" | "name" | "face" | "profile">;

// Phone numbers in 555-0100–0199, the range set aside for fiction.
export const profile = (tier: Tier, score: number, phone: string, location: string, shifts: number, hours: number): Profile => ({
  tier,
  score,
  pool: "CCLS Pool",
  phone: `+1 ${phone}`,
  location: `${location}, ON`,
  shifts,
  hours,
});

const SHIFTS: Shift[] = [
  {
    id: "afternoon",
    position: "Picker Packer",
    name: "Weekdays Afternoon Shift",
    start: 15 * 60,
    end: 24 * 60,
    codes: { checkIn: "3725", checkOut: "6835" },
    workers: [
      {
        id: "maria",
        name: "Maria Franci",
        face: mariaFranci,
        profile: profile("Elite", 96, "(647) 555-0142", "Brampton", 64, 517),
        status: "absent",
      },
      {
        id: "aspen",
        name: "Aspen Curtis",
        face: aspenCurtis,
        profile: profile("Pro", 88, "(905) 555-0118", "Mississauga", 23, 186),
        status: "lateCheckIn",
        checkIn: 15 * 60 + 55,
      },
      {
        id: "angel",
        name: "Angel Saris",
        face: angelSaris,
        profile: profile("Elite", 98, "(416) 555-0163", "Brampton", 112, 904),
        status: "checkedIn",
        checkIn: 15 * 60,
      },
      {
        id: "rayna",
        name: "Rayna Rhiel Madsen",
        face: raynaRhielMadsen,
        profile: profile("Pro", 91, "(647) 555-0127", "Etobicoke", 37, 301),
        status: "checkedIn",
        checkIn: 15 * 60,
      },
      {
        id: "alejandro",
        name: "Alejandro Vasquez",
        face: alejandroVasquez,
        profile: profile("Super", 79, "(905) 555-0181", "Vaughan", 9, 72),
        status: "checkedIn",
        checkIn: 15 * 60,
      },
    ],
  },
  {
    id: "am",
    position: "Warehouse Associate",
    name: "Weekdays AM Shift",
    start: 6 * 60,
    end: 14 * 60,
    codes: { checkIn: "3725", checkOut: "5918" },
    workers: [
      {
        id: "brittany",
        name: "Brittany Pilz",
        face: brittanyPilz,
        profile: profile("Super", 78, "(647) 555-0121", "Brampton", 2, 16),
        status: "checkedOut",
        checkIn: 6 * 60,
        checkOut: 14 * 60 + 3,
      },
      {
        id: "gamander",
        name: "Gamander Lopez",
        face: gamanderLopez,
        profile: profile("Super", 80, "(905) 555-0137", "Mississauga", 4, 31),
        status: "checkedOut",
        checkIn: 6 * 60,
        checkOut: 14 * 60,
      },
      {
        id: "disha",
        name: "Disha Patil",
        face: dishaPatil,
        profile: profile("Elite", 97, "(437) 555-0158", "Brampton", 94, 757),
        status: "checkedOut",
        checkIn: 6 * 60,
        checkOut: 14 * 60 + 6,
      },
      {
        id: "jeff",
        name: "Jeff Gwartzmann",
        face: jeffGwartzmann,
        profile: profile("Super", 81, "(905) 555-0172", "Oakville", 14, 109),
        status: "checkedOut",
        checkIn: 6 * 60,
        checkOut: 14 * 60 + 11,
      },
      {
        id: "sikander",
        name: "Sikander Mazumdar",
        face: sikanderMazumdar,
        profile: profile("Pro", 89, "(289) 555-0185", "Milton", 33, 262),
        status: "checkedOut",
        checkIn: 6 * 60,
        checkOut: 14 * 60,
      },
    ],
  },
];

// Yesterday at the same shifts, in today's authored minutes: when each worker came and left, or that they didn't.
const YESTERDAY: Record<string, { checkIn: number; checkOut: number } | "absent"> = {
  maria: { checkIn: 15 * 60, checkOut: 24 * 60 + 3 },
  aspen: "absent",
  angel: { checkIn: 15 * 60, checkOut: 24 * 60 },
  rayna: { checkIn: 15 * 60 + 13, checkOut: 24 * 60 + 9 },
  alejandro: "absent",
  brittany: { checkIn: 6 * 60, checkOut: 14 * 60 + 1 },
  gamander: "absent",
  disha: { checkIn: 6 * 60, checkOut: 14 * 60 + 5 },
  jeff: "absent",
  sikander: { checkIn: 6 * 60, checkOut: 14 * 60 },
};

export const PEOPLE: Record<string, Person> = Object.fromEntries(
  SHIFTS.flatMap((shift) => shift.workers).map(({ id, name, face, profile }) => [id, { id, name, face, profile }]),
);

export const STATUS_LABEL: Record<Status, string> = {
  absent: "Absent",
  late: "Missing Check-in",
  lateCheckIn: "Late Check-in",
  checkedIn: "Checked In",
  checkedOut: "Checked Out",
  upcoming: "Upcoming",
};

/** The chip a worker wears on `day`: not checked in today and not marked absent, they're missing a check-in. */
export const chipOf = (w: Pick<Worker, "status" | "marked">, day: Day): Status =>
  w.status === "absent" && day === "today" && !w.marked ? "late" : w.status;

/** The last :00 or :30 at least half an hour before `date`, in minutes after its midnight (negative the day before). */
export function shiftStart(date: Date) {
  return Math.floor((date.getHours() * 60 + date.getMinutes() - 30) / 30) * 30;
}

/** The time now in the minutes of `anchor`'s day, so past midnight reads as the next day. */
export function minutesNow(anchor: number, date = new Date()) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes < anchor - DAY / 2 ? minutes + DAY : minutes;
}

/**
 * The shifts with the afternoon shift starting at `anchor` and the schedule moved with it, as they stand at `now`:
 * on a shift under way, the times after its start spread evenly, in order, between it and now; a shift yet to start
 * has no times, its workers upcoming; a finished shift keeps its times.
 */
export function shiftsFrom(anchor: number, now: number): Shift[] {
  const by = anchor - AUTHORED_START;
  return SHIFTS.map((authored) => {
    const start = authored.start + by;
    const shift = { ...authored, start, end: authored.end + by };
    if (start > now) {
      const upcoming = { status: "upcoming" as const, checkIn: undefined, checkOut: undefined };
      return { ...shift, workers: authored.workers.map((w) => ({ ...w, ...upcoming })) };
    }
    if (shift.end <= now) {
      const moved = (minutes?: number) => (minutes === undefined ? undefined : minutes + by);
      return { ...shift, workers: authored.workers.map((w) => ({ ...w, checkIn: moved(w.checkIn), checkOut: moved(w.checkOut) })) };
    }

    const keys = ["checkIn", "checkOut"] as const;
    const later = authored.workers
      .flatMap((w) => keys.filter((key) => w[key] !== undefined && w[key]! + by > start).map((key) => ({ w, key })))
      .sort((a, b) => a.w[a.key]! - b.w[b.key]!);
    const place = (w: Worker, key: (typeof keys)[number]) => {
      if (w[key] === undefined) return undefined;
      const at = later.findIndex((entry) => entry.w === w && entry.key === key);
      return at < 0 ? w[key]! + by : start + Math.round(((at + 1) * (now - start)) / (later.length + 1));
    };
    return { ...shift, workers: authored.workers.map((w) => ({ ...w, checkIn: place(w, "checkIn"), checkOut: place(w, "checkOut") })) };
  });
}

export type Day = "yesterday" | "today" | "tomorrow";

/**
 * The same shifts on each day: yesterday's done (checked out or absent), today's as they stand at `now` with the one
 * under way first, tomorrow's upcoming. Yesterday and tomorrow run in time order.
 */
export function daysFrom(anchor: number, now: number): Record<Day, Shift[]> {
  const inOrder = (shifts: Shift[]) => [...shifts].sort((a, b) => a.start - b.start);
  const by = anchor - AUTHORED_START - DAY;
  const yesterday = SHIFTS.map((authored) => ({
    ...authored,
    start: authored.start + by,
    end: authored.end + by,
    workers: authored.workers.map((w) => {
      const day = YESTERDAY[w.id];
      return day === "absent"
        ? { ...w, status: "absent" as const, checkIn: undefined, checkOut: undefined }
        : { ...w, status: "checkedOut" as const, checkIn: day.checkIn + by, checkOut: day.checkOut + by };
    }),
  }));
  return { yesterday: inOrder(yesterday), today: shiftsFrom(anchor, now), tomorrow: inOrder(shiftsFrom(anchor + DAY, now)) };
}

const dayOf = (minutes: number) => Math.floor(minutes / DAY);

/** "3:00 PM". */
export function clock(minutes: number) {
  const m = ((minutes % DAY) + DAY) % DAY;
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "18m", "1h 33m". */
export function duration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${String(minutes % 60).padStart(2, "0")}m` : `${minutes}m`;
}

/** A typed time ("3:07 pm", "307p", "15:07") in minutes after midnight, or null. Without AM or PM, 1–12 is whichever is nearer `around`. */
export function parseClock(text: string, around: number) {
  const match = text.trim().toLowerCase().match(/^(\d{1,2})(?:[:.]?(\d{2}))?\s*(?:([ap])\.?\s*m?\.?)?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const half = match[3];
  if (minute > 59) return null;
  if (half) return hour < 1 || hour > 12 ? null : ((hour % 12) + (half === "p" ? 12 : 0)) * 60 + minute;
  if (hour > 23) return null;
  if (hour === 0 || hour > 12) return hour * 60 + minute;
  const am = (hour % 12) * 60 + minute;
  const pm = am + 12 * 60;
  const from = ((around % DAY) + DAY) % DAY;
  const distance = (minutes: number) => Math.min(Math.abs(minutes - from), DAY - Math.abs(minutes - from));
  return distance(pm) < distance(am) ? pm : am;
}

export function shiftHours(shift: Shift) {
  const next = dayOf(shift.end) > dayOf(shift.start) ? " (+1 day)" : "";
  return `${clock(shift.start)}–${clock(shift.end)}${next}`;
}

export function timeRange(worker: Worker) {
  if (worker.checkIn === undefined) return "";
  return `${clock(worker.checkIn)}${untilOf(worker)}`;
}

/** What follows a check-in's time: "–In progress", or its check-out's. */
export function untilOf(worker: Worker) {
  if (worker.checkOut === undefined) return "–In progress";
  const next = dayOf(worker.checkOut) > dayOf(worker.checkIn!) ? " (+1 Day)" : "";
  return `–${clock(worker.checkOut)}${next}`;
}

/** How late, `minutes` past a shift's start: "+18m" or "+1h 33m", a warning under an hour and an alert after. */
export function lateBy(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const text = hours ? `+${hours}h ${String(minutes % 60).padStart(2, "0")}m` : `+${minutes}m`;
  return { text, tone: minutes < 60 ? ("warning" as const) : ("alert" as const) };
}

/** On site: checked in and not yet out. */
export function onSite(shift: Shift) {
  return shift.workers.filter((w) => w.checkIn !== undefined && w.checkOut === undefined && w.status !== "absent").length;
}

/** The status a check-in at `minutes` earns: late past the shift's start. */
export function statusFor(shift: Pick<Shift, "start">, minutes: number): Status {
  return minutes > shift.start ? "lateCheckIn" : "checkedIn";
}

/** Who the customer's Check-ins page is signed in as ("Hello, Jesse!", JP). */
export const CUSTOMER = "Jesse P.";

/** What the Check In overlay hands back. */
export interface OverlayResult {
  checkIn?: number;
  checkOut?: number;
  unpaidBreak?: number;
  note: string;
  excused: boolean;
  absent: boolean;
  /** "Do not track this action": kept off notes and history. */
  untracked?: boolean;
  blocked?: boolean;
}

/** A worker after `by` submits the overlay at `at`. */
export function submitted(w: Worker, shift: Pick<Shift, "start">, result: OverlayResult, by: string, at: number): Worker {
  const who = { note: result.note, excused: result.excused, by, at, untracked: result.untracked };
  if (result.absent)
    return { ...w, ...who, status: "absent", marked: true, checkIn: undefined, checkOut: undefined, unpaidBreak: undefined };
  const checkIn = result.checkIn ?? w.checkIn!;
  const status = result.checkOut !== undefined ? "checkedOut" : statusFor(shift, checkIn);
  return { ...w, ...who, status, marked: false, checkIn, checkOut: result.checkOut, unpaidBreak: result.unpaidBreak };
}

/** Each company's logo. */
export const LOGOS = {
  Bolt: bolt,
  "Canada Bread": canadaBread,
  "Reliable Logistics": reliableLogistics,
  Stalco: stalco,
  "Chit Chats": chitChats,
  "Canada Cartage": canadaCartage,
} satisfies Record<string, StaticImageData>;

export type Company = keyof typeof LOGOS;
