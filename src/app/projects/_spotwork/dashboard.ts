import { CHECK_INS } from "./sheet-words";
import type { Level } from "./risk-levels";
import {
  DAY,
  PEOPLE,
  chipOf,
  clock,
  lateBy,
  profile,
  type Day,
  type OverlayResult,
  type Person,
  type Shift,
  type Worker,
} from "./data";
import { COMPANY_PLACE } from "./geo";
import { metresBetween, offset, type LatLng, type Place } from "./geofence";
import type { Template } from "./shifts";
import tashondaWilliams from "./assets/faces/shonda-williams.jpg";
import marilynCalzoni from "./assets/faces/marilyn-calzoni.jpg";
import cristoferDorwart from "./assets/faces/cristofer-dorwart.jpg";
import giannaBaptista from "./assets/faces/giana-baptista.jpg";
import briannaSantos from "./assets/faces/brianna-santos.jpg";

// The operations team's Check-Ins dashboard: SW Curie's Missing Check-Ins (23423:122193) frame for the United States,
// with workers added so every tile has a list. Canada's CCLS rows are the customer's own afternoon shift, kept in step
// with the Check-ins page.

export type Signal = "newWorker" | "flaggedMessage" | "abnormalLastShift" | "locationDisabled";
export type RowStatus = "missing" | "leftSite" | "upcoming" | "lateCheckIn" | "checkedIn" | "checkedOut" | "absent";
export type Country = "us" | "ca";
export type Slice = "missing" | "newWorkers" | "newTeams" | "absences" | "late" | "all";

export const OPERATOR = "Jevonte Fontella";
const REVIEWER = "Gurliv S.";
/** Who a status nobody set is by: a shift's start passing with no check-in, a phone reporting its worker off the job site. */
export const SPOTTRACE = "SpotTrace";

/** An item on a worker's Notes & history, in the dashboard's minutes; with `status`, the one their shift moved to. */
export interface Entry {
  kind: "checkIn" | "absent" | "status" | "message" | "note";
  at: number;
  by: string;
  note: string;
  message?: string;
  status?: RowStatus;
}

/**
 * Where a worker's phone reported them, in the dashboard's minutes; without a `place`, in their job site's middle, or
 * `off` it by as many metres on that bearing.
 */
export type Ping = { at: number; place?: LatLng; off?: [metres: number, bearing: number] };

/** Where `ping` puts its worker, `middle` being their job site's. */
export const reportedAt = (ping: Ping, middle: LatLng) => ping.place ?? (ping.off ? offset(middle, ...ping.off) : middle);

export interface Row {
  id: string;
  country: Country;
  worker: Person;
  position: string;
  role: string;
  team: string;
  zone: string;
  /** A team within its first shifts. */
  newTeam?: boolean;
  /** Minutes after midnight, as data.ts counts them. */
  start: number;
  end: number;
  status: RowStatus;
  checkIn?: number;
  checkOut?: number;
  unpaidBreak?: number;
  excused?: boolean;
  signals: Signal[];
  /** How far from the job site, "On Site", or nothing when unknown. */
  location?: string;
  /** Each time their phone reported where they were, oldest first, the last at `location`. */
  trace?: Ping[];
  unreadSignals: number;
  acknowledged: boolean;
  /** Notes and messages, oldest first. */
  entries: Entry[];
  /** Each status the shift moved to, oldest first. */
  changes: Entry[];
  /** The last check-in or absence, unless it was left untracked. */
  action?: Entry;
  unreadNotes: number;
  /** A row from the customer's shift, which the Check-ins page owns. */
  source?: { day: Day; shift: string };
}

// The moment the frames show: Jeff is 33 minutes late for 10:30 PM.
export const AUTHORED_NOW = 23 * 60 + 3;
const ago = (minutes: number) => AUTHORED_NOW - minutes;

const person = (id: string, name: string, face: Person["face"], p: Person["profile"]): Person => ({ id, name, face, profile: p });

export const TASHONDA = person("tashonda", "Tashonda Williams", tashondaWilliams, profile("Pro", 90, "(416) 555-0196", "Toronto", 41, 337));
export const MARILYN = person("marilyn", "Marilyn Calzoni", marilynCalzoni, profile("Elite", 95, "(905) 555-0147", "Oakville", 58, 470));
export const CRISTOFER = person("cristofer", "Cristofer Dorwart", cristoferDorwart, profile("Pro", 84, "(416) 555-0153", "Etobicoke", 22, 176));
export const GIANA = person("giana", "Giana Baptista", giannaBaptista, profile("Pro", 88, "(647) 555-0109", "Scarborough", 31, 248));
export const BRIANNA = person("brianna", "Brianna Santos", briannaSantos, profile("Super", 76, "(416) 555-0104", "Toronto", 1, 8));

const note = (at: number, by: string, text: string): Entry => ({ kind: "note", at, by, note: text });

const ping = (hours: number, minutes: number, place?: LatLng): Ping => ({ at: hours * 60 + minutes, place });

// Each team's job site, in its row's time zone, which View Location draws its building at.
const SITES: Record<string, Place> = {
  "CCLS First Gulf": COMPANY_PLACE,
  "Reliable Logistics": { id: "delta-progress", label: "7200 Progress Way, Delta, BC", lat: 49.1332981, lng: -123.0245999 },
  "Four Seasons Produce": { id: "winnipeg-inkster", label: "1700 Inkster Boulevard, Winnipeg, MB", lat: 49.9442372, lng: -97.1867748 },
  "Bristol Circle Oakville": { id: "oakville-bristol", label: "2441 Bristol Circle, Oakville, ON", lat: 43.519812, lng: -79.67996 },
  "Sweets from the Earth": { id: "toronto-canarctic", label: "101 Canarctic Drive, North York, ON", lat: 43.7754375, lng: -79.4905625 },
  "Harbourfront Catering": { id: "toronto-queens-quay", label: "235 Queens Quay West, Toronto, ON", lat: 43.6393923, lng: -79.3820257 },
  "Maple Lane Bakery": { id: "brampton-bramwin", label: "8 Bramwin Court, Brampton, ON", lat: 43.7207657, lng: -79.6859226 },
  "Northline Events": { id: "toronto-princes", label: "100 Princes' Boulevard, Toronto, ON", lat: 43.6351375, lng: -79.4151611 },
};

export const siteOf = (team: string) => SITES[team] ?? COMPANY_PLACE;

/** A drive: where it set off, and where its phone reported each minute on the way, the first as it set off. */
type Road = { home: LatLng; minutes: LatLng[] };

// Each worker's drive to their job site along OSRM's route, at its pace.
const ROADS: Record<string, Road> = {
  tashonda: {
    home: { lat: 43.70507, lng: -79.43269 },
    minutes: [
      { lat: 43.70443, lng: -79.433 },
      { lat: 43.70212, lng: -79.432 },
      { lat: 43.69912, lng: -79.43455 },
      { lat: 43.70766, lng: -79.4397 },
      { lat: 43.71666, lng: -79.44422 },
      { lat: 43.72589, lng: -79.44774 },
      { lat: 43.73533, lng: -79.45014 },
      { lat: 43.74317, lng: -79.45576 },
      { lat: 43.74837, lng: -79.4626 },
      { lat: 43.75267, lng: -79.46799 },
      { lat: 43.75549, lng: -79.47488 },
      { lat: 43.75495, lng: -79.48221 },
      { lat: 43.75464, lng: -79.48798 },
      { lat: 43.76052, lng: -79.49016 },
      { lat: 43.7676, lng: -79.49195 },
      { lat: 43.7747, lng: -79.49376 },
      { lat: 43.77586, lng: -79.49075 },
    ],
  },
  sikander: {
    home: { lat: 43.64018, lng: -79.69032 },
    minutes: [
      { lat: 43.64091, lng: -79.69001 },
      { lat: 43.64629, lng: -79.68578 },
      { lat: 43.65189, lng: -79.67734 },
      { lat: 43.65673, lng: -79.68361 },
      { lat: 43.66471, lng: -79.69371 },
      { lat: 43.67231, lng: -79.69698 },
      { lat: 43.68326, lng: -79.69237 },
      { lat: 43.69448, lng: -79.68678 },
      { lat: 43.70534, lng: -79.67976 },
      { lat: 43.71673, lng: -79.6752 },
      { lat: 43.72831, lng: -79.67226 },
      { lat: 43.73638, lng: -79.66015 },
      { lat: 43.74438, lng: -79.64779 },
      { lat: 43.75304, lng: -79.63652 },
      { lat: 43.75697, lng: -79.62093 },
      { lat: 43.76086, lng: -79.60525 },
      { lat: 43.76608, lng: -79.59038 },
      { lat: 43.77166, lng: -79.57574 },
      { lat: 43.77744, lng: -79.56126 },
      { lat: 43.78127, lng: -79.54554 },
      { lat: 43.78461, lng: -79.52963 },
      { lat: 43.78822, lng: -79.51389 },
      { lat: 43.79114, lng: -79.50055 },
      { lat: 43.78632, lng: -79.49593 },
      { lat: 43.77922, lng: -79.49464 },
      { lat: 43.77564, lng: -79.49187 },
    ],
  },
  brittany: {
    home: { lat: 43.68996, lng: -79.74406 },
    minutes: [
      { lat: 43.68946, lng: -79.7433 },
      { lat: 43.68741, lng: -79.73845 },
      { lat: 43.68225, lng: -79.73151 },
      { lat: 43.67712, lng: -79.7246 },
      { lat: 43.67291, lng: -79.71747 },
    ],
  },
  jeff: {
    home: { lat: 43.45499, lng: -79.68498 },
    minutes: [
      { lat: 43.45457, lng: -79.68493 },
      { lat: 43.45484, lng: -79.68396 },
      { lat: 43.45765, lng: -79.68144 },
      { lat: 43.46164, lng: -79.68265 },
      { lat: 43.4714, lng: -79.67384 },
      { lat: 43.48447, lng: -79.67243 },
      { lat: 43.49766, lng: -79.67269 },
      { lat: 43.5071, lng: -79.68489 },
      { lat: 43.51346, lng: -79.6916 },
      { lat: 43.51912, lng: -79.68557 },
      { lat: 43.51973, lng: -79.68001 },
    ],
  },
  cristofer: {
    home: { lat: 43.63667, lng: -79.52444 },
    minutes: [
      { lat: 43.6362, lng: -79.52413 },
      { lat: 43.63681, lng: -79.52055 },
      { lat: 43.63156, lng: -79.51802 },
      { lat: 43.62579, lng: -79.51568 },
      { lat: 43.61916, lng: -79.51318 },
      { lat: 43.62304, lng: -79.49972 },
      { lat: 43.62684, lng: -79.48406 },
      { lat: 43.63405, lng: -79.47159 },
      { lat: 43.63876, lng: -79.45842 },
      { lat: 43.63685, lng: -79.44402 },
      { lat: 43.63244, lng: -79.43072 },
      { lat: 43.63614, lng: -79.4168 },
      { lat: 43.6379, lng: -79.40229 },
      { lat: 43.63944, lng: -79.38767 },
      { lat: 43.6397, lng: -79.38213 },
    ],
  },
  aspen: {
    home: { lat: 43.60995, lng: -79.69006 },
    minutes: [
      { lat: 43.61034, lng: -79.69024 },
      { lat: 43.61322, lng: -79.6892 },
      { lat: 43.61799, lng: -79.69171 },
      { lat: 43.62387, lng: -79.69967 },
      { lat: 43.63024, lng: -79.70049 },
      { lat: 43.63706, lng: -79.69421 },
      { lat: 43.64364, lng: -79.68708 },
      { lat: 43.65033, lng: -79.68792 },
      { lat: 43.65634, lng: -79.6959 },
      { lat: 43.66212, lng: -79.70422 },
      { lat: 43.66788, lng: -79.71143 },
      { lat: 43.67299, lng: -79.71737 },
      { lat: 43.67495, lng: -79.71426 },
    ],
  },
  angel: {
    home: { lat: 43.69004, lng: -79.76001 },
    minutes: [
      { lat: 43.69065, lng: -79.75965 },
      { lat: 43.69137, lng: -79.75577 },
      { lat: 43.69182, lng: -79.74959 },
      { lat: 43.69148, lng: -79.74403 },
      { lat: 43.68638, lng: -79.73706 },
      { lat: 43.68123, lng: -79.73012 },
      { lat: 43.67605, lng: -79.72329 },
      { lat: 43.67384, lng: -79.71644 },
    ],
  },
  rayna: {
    home: { lat: 43.66976, lng: -79.57989 },
    minutes: [
      { lat: 43.66881, lng: -79.58048 },
      { lat: 43.66627, lng: -79.58351 },
      { lat: 43.66652, lng: -79.58908 },
      { lat: 43.66711, lng: -79.59693 },
      { lat: 43.66088, lng: -79.61275 },
      { lat: 43.6529, lng: -79.62726 },
      { lat: 43.64654, lng: -79.64319 },
      { lat: 43.64187, lng: -79.65703 },
      { lat: 43.64562, lng: -79.66853 },
      { lat: 43.65416, lng: -79.68013 },
      { lat: 43.66123, lng: -79.68759 },
      { lat: 43.65704, lng: -79.69417 },
      { lat: 43.66066, lng: -79.70179 },
      { lat: 43.66649, lng: -79.70955 },
      { lat: 43.67163, lng: -79.71651 },
      { lat: 43.67495, lng: -79.71426 },
    ],
  },
  alejandro: {
    home: { lat: 43.79001, lng: -79.59995 },
    minutes: [
      { lat: 43.78882, lng: -79.59968 },
      { lat: 43.78527, lng: -79.59881 },
      { lat: 43.78054, lng: -79.5977 },
      { lat: 43.77727, lng: -79.60314 },
      { lat: 43.77523, lng: -79.61255 },
      { lat: 43.77289, lng: -79.62156 },
      { lat: 43.76468, lng: -79.61929 },
      { lat: 43.7586, lng: -79.61797 },
      { lat: 43.75469, lng: -79.63206 },
      { lat: 43.74743, lng: -79.64472 },
      { lat: 43.73902, lng: -79.65642 },
      { lat: 43.73136, lng: -79.66914 },
      { lat: 43.72069, lng: -79.67543 },
      { lat: 43.70891, lng: -79.6779 },
      { lat: 43.69804, lng: -79.68493 },
      { lat: 43.68985, lng: -79.69155 },
      { lat: 43.69397, lng: -79.69944 },
      { lat: 43.69077, lng: -79.70621 },
      { lat: 43.68421, lng: -79.71339 },
      { lat: 43.67871, lng: -79.71478 },
      { lat: 43.67495, lng: -79.71426 },
    ],
  },
  // To where her car broke down in Highway 401's express lanes, 13.6 km short of the bakery.
  giana: {
    home: { lat: 43.77352, lng: -79.25844 },
    minutes: [
      { lat: 43.77297, lng: -79.2589 },
      { lat: 43.77207, lng: -79.26102 },
      { lat: 43.7775, lng: -79.26392 },
      { lat: 43.77968, lng: -79.26482 },
      { lat: 43.77625, lng: -79.28064 },
      { lat: 43.77219, lng: -79.29796 },
      { lat: 43.76861, lng: -79.31543 },
      { lat: 43.7684, lng: -79.33361 },
      { lat: 43.76721, lng: -79.35062 },
      { lat: 43.76632, lng: -79.36715 },
      { lat: 43.76413, lng: -79.38334 },
      { lat: 43.75986, lng: -79.39839 },
      { lat: 43.75205, lng: -79.41081 },
      { lat: 43.74325, lng: -79.42204 },
      { lat: 43.73557, lng: -79.43469 },
      { lat: 43.72998, lng: -79.44908 },
      { lat: 43.72655, lng: -79.46494 },
      { lat: 43.72289, lng: -79.48071 },
      { lat: 43.71937, lng: -79.49649 },
      { lat: 43.7172, lng: -79.51274 },
    ],
  },
};

// Brittany's drive north from the job site up Highway 410, till she disabled her location; Sikander's to Seneca's Newnham
// Campus by Highways 407 and 404, and the start of his drive back: each as its phone reported it each minute.
const TRIPS: Record<"brittany" | "seneca" | "back", LatLng[]> = {
  brittany: [
    { lat: 43.6759, lng: -79.71341 },
    { lat: 43.6807, lng: -79.71686 },
    { lat: 43.68554, lng: -79.71 },
    { lat: 43.69368, lng: -79.72194 },
    { lat: 43.70227, lng: -79.7335 },
    { lat: 43.71077, lng: -79.74516 },
    { lat: 43.71934, lng: -79.75673 },
    { lat: 43.72845, lng: -79.76737 },
  ],
  seneca: [
    { lat: 43.77561, lng: -79.492 },
    { lat: 43.7779, lng: -79.49453 },
    { lat: 43.78502, lng: -79.49534 },
    { lat: 43.79198, lng: -79.49595 },
    { lat: 43.79785, lng: -79.48551 },
    { lat: 43.80881, lng: -79.47984 },
    { lat: 43.81986, lng: -79.47476 },
    { lat: 43.82593, lng: -79.46065 },
    { lat: 43.82948, lng: -79.4448 },
    { lat: 43.83382, lng: -79.42939 },
    { lat: 43.83847, lng: -79.41429 },
    { lat: 43.83703, lng: -79.39788 },
    { lat: 43.8367, lng: -79.38244 },
    { lat: 43.83754, lng: -79.37093 },
    { lat: 43.82852, lng: -79.36432 },
    { lat: 43.81613, lng: -79.35834 },
    { lat: 43.80709, lng: -79.34643 },
    { lat: 43.79647, lng: -79.34504 },
    { lat: 43.79427, lng: -79.35063 },
    { lat: 43.79726, lng: -79.35066 },
    { lat: 43.79829, lng: -79.34573 },
    { lat: 43.79534, lng: -79.34694 },
  ],
  back: [
    { lat: 43.79643, lng: -79.34589 },
    { lat: 43.79802, lng: -79.34771 },
    { lat: 43.7965, lng: -79.35164 },
    { lat: 43.794, lng: -79.34903 },
    { lat: 43.79517, lng: -79.34121 },
    { lat: 43.80602, lng: -79.34579 },
    { lat: 43.81542, lng: -79.35684 },
    { lat: 43.82756, lng: -79.36353 },
    { lat: 43.83642, lng: -79.36595 },
    { lat: 43.83772, lng: -79.37839 },
    { lat: 43.837, lng: -79.39442 },
    { lat: 43.83881, lng: -79.41081 },
    { lat: 43.83543, lng: -79.42637 },
    { lat: 43.83061, lng: -79.44151 },
  ],
};

// Marilyn's home, 1.4 km from Bristol Circle, where Giana's car broke down, and where Sikander parked at Seneca.
const MARILYN_HOME = { lat: 43.50766, lng: -79.67547 };
const BROKE_DOWN = { lat: 43.71675, lng: -79.51698 };
const SENECA_LOT = { lat: 43.79566, lng: -79.34782 };

/** Location tracking begins this many minutes before a shift starts. */
const TRACKING = 30;

// How long a parked phone goes before reporting again (soon after it's arrived, then about half-hourly), and how far
// each report strays from where it lies, in metres, and which way: lists of coprime lengths, so no spot comes twice.
const SETTLE = 9;
const STILL = [34, 37, 31, 36];
const STRAY = [1.2, 2.1, 0.8, 2.6, 1.7];
const WAY = [40, 190, 300, 115, 250, 15, 160];

/** A phone lying at `place` (none for the job site's middle) from `from` to `until`. */
function stay(place: LatLng | undefined, from: number, until: number): Ping[] {
  const pings: Ping[] = [{ at: from, place }];
  for (let i = 0, at = from + SETTLE; at <= until; at += STILL[i++ % STILL.length]) {
    const off: [number, number] = [STRAY[i % STRAY.length], WAY[i % WAY.length]];
    pings.push(place ? { at, place: offset(place, ...off) } : { at, off });
  }
  return pings;
}

/** A phone on the move from `at`, reporting each minute where `minutes` has it. */
const onRoad = (minutes: LatLng[], at: number): Ping[] => minutes.map((place, i) => ({ at: at + i, place }));

/** A phone's reports from `from`, when tracking began, on `road` to the job site, reached at `arrived`. */
function drive({ home, minutes }: Road, from: number, arrived: number): Ping[] {
  const left = arrived - minutes.length;
  return [...(left > from ? stay(home, from, left - 1) : []), ...onRoad(minutes, left).filter((ping) => ping.at >= from)];
}

/** Tracked from before the shift at `start`: the drive in, then on site from `arrived` until `until`. */
const cameIn = (road: Road, start: number, arrived: number, until: number) => [
  ...drive(road, start - TRACKING, arrived),
  ...stay(undefined, arrived, until),
];

// Sikander checked in, drove to Seneca's Newnham Campus, and is on his way back; Brittany checked in, worked till
// lunch, drove off and hasn't come back, disabling her location on the road; Jeff arrived late and hasn't checked
// in. Marilyn stayed home and Giana's car broke down on the way, each tracked till marked absent.
export const TRACES: Record<"sikander" | "brittany" | "jeff" | "cristofer" | "tashonda" | "marilyn" | "giana", Ping[]> = {
  sikander: [
    ...cameIn(ROADS.sikander, 21 * 60, 20 * 60 + 47, 21 * 60 + 14),
    ...onRoad(TRIPS.seneca, 21 * 60 + 15),
    ...stay(SENECA_LOT, 21 * 60 + 15 + TRIPS.seneca.length, 22 * 60 + 48),
    ...onRoad(TRIPS.back, 22 * 60 + 49),
  ],
  brittany: [...cameIn(ROADS.brittany, 18 * 60 + 15, 18 * 60 + 10, 22 * 60 + 14), ...onRoad(TRIPS.brittany, 22 * 60 + 15)],
  jeff: cameIn(ROADS.jeff, 22 * 60 + 30, 22 * 60 + 33, ago(8)),
  cristofer: cameIn(ROADS.cristofer, 22 * 60 + 30, 22 * 60 + 46, ago(8)),
  tashonda: [...cameIn(ROADS.tashonda, 12 * 60, 12 * 60 + 2, 20 * 60 + 59), { ...ping(21, 0), off: [1.4, 345] }],
  marilyn: stay(MARILYN_HOME, 22 * 60 - TRACKING, ago(45)),
  giana: [
    ...drive(ROADS.giana, 18 * 60 - TRACKING, 17 * 60 + 43),
    ...stay(BROKE_DOWN, 17 * 60 + 43, 18 * 60 + 40),
  ],
};

const blank = { unreadSignals: 0, acknowledged: false, entries: [] as Entry[], changes: [] as Entry[], unreadNotes: 0 };

const AUTHORED: Row[] = [
  {
    ...blank,
    id: "brittany",
    country: "us",
    worker: PEOPLE.brittany,
    position: "Packaging Worker - Overnight Shift",
    role: "General Labourer",
    team: "CCLS First Gulf",
    zone: "EST",
    start: 18 * 60 + 15,
    end: DAY + 60 + 45,
    status: "leftSite",
    checkIn: 18 * 60 + 15,
    signals: ["newWorker", "flaggedMessage", "abnormalLastShift", "locationDisabled"],
    location: "7.3 km",
    trace: TRACES.brittany,
    unreadSignals: 1,
    entries: [
      { kind: "message", at: ago(15), by: OPERATOR, note: "" },
      note(ago(10), REVIEWER, "Called worker twice, it went straight to voicemail."),
      note(ago(5), REVIEWER, "Floor manager says she left for lunch and hasn't come back."),
    ],
    unreadNotes: 2,
  },
  {
    ...blank,
    id: "gamander",
    country: "us",
    worker: PEOPLE.gamander,
    position: "Can Filling Production Operator - Shift A",
    role: "Can Filling Production Operator",
    team: "Reliable Logistics",
    zone: "PST",
    start: 21 * 60 + 30,
    end: DAY + 5 * 60 + 30,
    status: "missing",
    signals: ["newWorker", "locationDisabled"],
    entries: [note(ago(40), OPERATOR, "Sent the check-in code by text."), note(ago(20), REVIEWER, "Called worker, no answer.")],
    unreadNotes: 2,
  },
  {
    ...blank,
    id: "disha",
    country: "us",
    worker: PEOPLE.disha,
    position: "Training - 2",
    role: "Warehouse Selector",
    team: "Four Seasons Produce",
    zone: "CST",
    start: 21 * 60,
    end: DAY + 5 * 60,
    status: "missing",
    signals: ["locationDisabled"],
    entries: [note(ago(60), OPERATOR, "Called worker, no answer."), note(ago(30), OPERATOR, "Asked the floor manager to look for her.")],
  },
  {
    ...blank,
    id: "jeff",
    country: "us",
    worker: PEOPLE.jeff,
    position: "Packer",
    role: "General Labour",
    team: "Bristol Circle Oakville",
    zone: "EST",
    start: 22 * 60 + 30,
    end: DAY + 6 * 60,
    status: "missing",
    signals: ["flaggedMessage"],
    location: "On Site",
    trace: TRACES.jeff,
    unreadSignals: 1,
    entries: [
      note(ago(28), OPERATOR, "Worker called in, he's at the front gate."),
      note(ago(25), OPERATOR, "Asked the floor manager for the check-in code."),
    ],
  },
  {
    ...blank,
    id: "sikander",
    country: "us",
    worker: PEOPLE.sikander,
    position: "Cutting Machine Operator",
    role: "Cutting Machine Operator",
    team: "Sweets from the Earth",
    zone: "EST",
    start: 21 * 60,
    end: DAY + 5 * 60,
    status: "leftSite",
    checkIn: 21 * 60,
    signals: ["flaggedMessage", "abnormalLastShift"],
    location: "7.3 km",
    trace: TRACES.sikander,
    unreadSignals: 1,
    entries: [note(ago(90), OPERATOR, "Called worker, no answer."), note(ago(15), REVIEWER, "Worker texted that he's on his way.")],
    unreadNotes: 1,
  },
  {
    ...blank,
    id: "tashonda",
    country: "us",
    worker: TASHONDA,
    position: "Cutting Machine Operator",
    role: "Cutting Machine Operator",
    team: "Sweets from the Earth",
    zone: "EST",
    start: 12 * 60,
    end: 21 * 60,
    status: "checkedOut",
    checkIn: 12 * 60 + 5,
    checkOut: 21 * 60,
    signals: [],
    location: "On Site",
    trace: TRACES.tashonda,
  },
  {
    ...blank,
    id: "marilyn",
    country: "us",
    worker: MARILYN,
    position: "Warehouse Associate - Night Shift",
    role: "General Labourer",
    team: "Bristol Circle Oakville",
    zone: "EST",
    start: 22 * 60,
    end: DAY + 6 * 60,
    status: "absent",
    excused: true,
    signals: ["abnormalLastShift"],
    location: "1.4 km",
    trace: TRACES.marilyn,
    action: { kind: "absent", at: ago(45), by: OPERATOR, note: "Worker called in sick." },
  },
  {
    ...blank,
    id: "cristofer",
    country: "us",
    worker: CRISTOFER,
    position: "Line Cook - Evening Shift",
    role: "Kitchen Staff",
    team: "Harbourfront Catering",
    newTeam: true,
    zone: "EST",
    start: 22 * 60 + 30,
    end: DAY + 6 * 60 + 30,
    status: "lateCheckIn",
    checkIn: 22 * 60 + 52,
    signals: [],
    location: "On Site",
    trace: TRACES.cristofer,
    action: { kind: "checkIn", at: ago(8), by: OPERATOR, note: "Worker couldn't scan the check-in code at the door." },
  },
  {
    ...blank,
    id: "giana",
    country: "ca",
    worker: GIANA,
    position: "Packer - Evening Shift",
    role: "General Labour",
    team: "Maple Lane Bakery",
    newTeam: true,
    zone: "EST",
    start: 18 * 60,
    end: DAY + 2 * 60,
    status: "absent",
    excused: true,
    signals: [],
    location: "13.6 km",
    trace: TRACES.giana,
    action: { kind: "absent", at: 18 * 60 + 40, by: OPERATOR, note: "Worker's car broke down on the way." },
  },
  {
    ...blank,
    id: "brianna",
    country: "ca",
    worker: BRIANNA,
    position: "Server - Late Shift",
    role: "Event Staff",
    team: "Northline Events",
    newTeam: true,
    zone: "EST",
    start: 23 * 60 + 30,
    end: DAY + 7 * 60 + 30,
    status: "upcoming",
    signals: ["newWorker"],
  },
];

const UNTRACKED = new Set<RowStatus>(["upcoming", "checkedOut", "absent"]);

/** Whether a row's worker's phone still reports where they are: not before their shift, nor once they've checked out or been marked absent. */
export const tracking = (row: Pick<Row, "status">) => !UNTRACKED.has(row.status);

/** How far from the job site a row's location puts its worker: "7.3 km" is 7,300; `null` without one. */
export function metresAway(location?: string) {
  if (location === "On Site") return 0;
  const km = parseFloat(location ?? "");
  return Number.isNaN(km) ? null : km * 1000;
}

/** The template a row's position names, where it's at the row's job site, for its geofence and entrance. */
export function siteTemplate(row: Pick<Row, "team" | "position">, templates: Template[]): Template | undefined {
  const site = siteOf(row.team);
  return templates.find(
    (template) => template.place?.id === site.id && (row.position === template.name || row.position.startsWith(`${template.name} - `)),
  );
}

/** Reports farther than this many metres from the job site's middle are off it. */
const OFF_SITE = 100;

/** A worker's first report off the job site after checking in. */
export function departure(row: Pick<Row, "team" | "checkIn" | "trace">): Ping | undefined {
  const site = siteOf(row.team);
  return row.trace?.find((ping) => row.checkIn !== undefined && ping.at > row.checkIn && metresBetween(site, reportedAt(ping, site)) > OFF_SITE);
}

/** The operations team's note on Brittany leaving the job site at `time`. */
export const leftSiteNote = (time: string) =>
  `Worker left the job site at ${time} and has disabled her location. Waiting 15 minutes for her to reply. If she doesn't, I'll mark her absent and block her.`;

/** The Send Message overlay's message types, Figma's own words for "Are you on site?", but for a worker who left. */
export const MESSAGE_TYPES: { label: string; text: (row: Row) => string }[] = [
  {
    label: "Check-In Message",
    text: (row) =>
      `Hey ${row.worker.name.split(" ")[0]}, please check in for your shift with ${row.team} with the code on site.`,
  },
  {
    label: "Are you on site?",
    text: (row) => {
      const left = row.status === "leftSite" ? departure(row) : undefined;
      return left
        ? `Hey ${row.worker.name.split(" ")[0]}, you left the job site at ${clock(left.at)}. Are you coming back to your shift with ${row.team}?`
        : `Hey ${row.worker.name.split(" ")[0]}, are you on site? Your shift with ${row.team} started at ${clock(row.start)}.`;
    },
  },
];

const moved = (minutes: number | undefined, by: number) => (minutes === undefined ? undefined : minutes + by);

function move(row: Row, by: number): Row {
  const entry = (e: Entry) => ({ ...e, at: e.at + by });
  return {
    ...row,
    start: row.start + by,
    end: row.end + by,
    checkIn: moved(row.checkIn, by),
    checkOut: moved(row.checkOut, by),
    entries: row.entries.map(entry),
    action: row.action && entry(row.action),
    trace: row.trace?.map((p) => ({ ...p, at: p.at + by })),
  };
}

const fresh = { ...blank, action: undefined, trace: undefined, unreadSignals: 0 };

// Yesterday's no-shows; everyone else came and stayed the shift.
const ABSENT_YESTERDAY = new Set(["disha", "marilyn", "giana"]);

function settled(row: Row): Row {
  const day = move(row, -DAY);
  if (ABSENT_YESTERDAY.has(row.id))
    return { ...day, ...fresh, status: "absent", checkIn: undefined, checkOut: undefined, excused: false };
  return { ...day, ...fresh, status: "checkedOut", checkIn: day.start + (row.id.length % 4), checkOut: day.end, excused: false };
}

function upcoming(row: Row): Row {
  return { ...move(row, DAY), ...fresh, status: "upcoming", checkIn: undefined, checkOut: undefined, excused: false };
}

/** The dashboard's own rows on each day, every time moved with `now` in quarter hours. */
export function rowsFor(now: number): Record<Day, Row[]> {
  const by = Math.round((now - AUTHORED_NOW) / 15) * 15;
  const today = AUTHORED.map((authored) => {
    const row = move(authored, by);
    const left = departure(row);
    const entries = row.entries.map((e) =>
      e.kind === "message" && !e.message ? { ...e, message: MESSAGE_TYPES[1].text(row), note: left ? leftSiteNote(clock(left.at)) : e.note } : e,
    );
    return { ...row, entries, trace: row.trace?.filter((ping) => ping.at <= now) };
  });
  const logged = (row: Row) => ({ ...row, changes: changesOf(row, now) });
  return { yesterday: today.map(settled).map(logged), today: today.map(logged), tomorrow: today.map(upcoming).map(logged) };
}

/**
 * The statuses `row`'s shift moved to by `now`, oldest first: SpotTrace's, the worker's own check-in and out if
 * they checked themselves in (`theirs`), and its last check-in or absence.
 */
export function changesOf(row: Row, now: number, theirs = row.action?.kind !== "checkIn"): Entry[] {
  if (row.status === "upcoming") return [];
  const change = (status: RowStatus, at: number, by: string): Entry => ({ kind: "status", status, at, by, note: "" });
  const own = theirs ? row.checkIn : undefined;
  const changes: Entry[] = [];
  const settled = own ?? row.action?.at;
  if (settled === undefined || settled > row.start) changes.push(change("missing", row.start, SPOTTRACE));
  if (own !== undefined) changes.push(change(own > row.start ? "lateCheckIn" : "checkedIn", own, row.worker.name));
  const left = row.status === "leftSite" ? departure(row) : undefined;
  if (left) changes.push(change("leftSite", left.at, SPOTTRACE));
  if (own !== undefined && row.checkOut !== undefined) changes.push(change("checkedOut", row.checkOut, row.worker.name));
  if (row.action) changes.push({ ...row.action, status: statusAfter(row, row.action.kind === "absent", row.checkIn, row.checkOut) });
  else if (row.status === "absent" && row.end <= now) changes.push(change("absent", row.end, SPOTTRACE));
  return changes;
}

/** The status a check-in at `checkIn`, out at `checkOut`, or an absence moves `row`'s shift to. */
function statusAfter(row: Pick<Row, "start">, absent: boolean, checkIn?: number, checkOut?: number): RowStatus {
  if (absent) return "absent";
  if (checkOut !== undefined) return "checkedOut";
  return checkIn! > row.start ? "lateCheckIn" : "checkedIn";
}

// What the dashboard knows of the customer's workers that the Check-ins page doesn't show.
const CUSTOMER_EXTRAS: Record<string, Pick<Row, "signals" | "location">> = {
  maria: { signals: ["locationDisabled"] },
  aspen: { signals: [], location: "On Site" },
  angel: { signals: [], location: "On Site" },
  rayna: { signals: [], location: "On Site" },
  alejandro: { signals: ["newWorker"], location: "On Site" },
};

// Mock readings on the project sheet's no-show risk factors (check-ins-content.ts), in its words, in keeping with each
// row's signals, profile and team. Brittany's are the sheet's own.
type Reading = [Level, string];
const NO_SHOW_RISK: Record<string, Record<string, Reading>> = {
  brittany: {
    worker: [3, "3rd shift"],
    cancel: [3, "Wants to cancel"],
    lateCancel: [2, "Cancelled 3.5 h before last shift"],
    attendance: [1, "1 late check-in"],
    location: [3, "7.3 km away"],
    company: [0, "Team's 213th shift"],
  },
  gamander: {
    worker: [2, "5th shift"],
    cancel: [0, "No request"],
    lateCancel: [1, "1 late cancellation, 3 shifts ago"],
    attendance: [1, "1 late check-in"],
    location: [2, "Location disabled"],
    company: [0, "Team's 87th shift"],
  },
  disha: {
    worker: [0, "95th shift"],
    cancel: [0, "No request"],
    lateCancel: [0, "No late cancellations"],
    attendance: [1, "1 absence"],
    location: [2, "Location disabled"],
    company: [0, "Team's 156th shift"],
  },
  jeff: {
    worker: [1, "15th shift"],
    cancel: [0, "No request"],
    lateCancel: [1, "1 late cancellation, 8 shifts ago"],
    attendance: [1, "1 late check-in"],
    location: [0, "On site"],
    company: [0, "Team's 64th shift"],
  },
  sikander: {
    worker: [0, "34th shift"],
    cancel: [2, "Wants a later shift"],
    lateCancel: [0, "No late cancellations"],
    attendance: [3, "2 absences, 1 late check-in"],
    location: [3, "7.3 km away"],
    company: [0, "Team's 48th shift"],
  },
  tashonda: {
    worker: [0, "42nd shift"],
    cancel: [0, "No request"],
    lateCancel: [1, "1 late cancellation, 26 shifts ago"],
    attendance: [1, "1 late check-in"],
    location: [0, "On site"],
    company: [0, "Team's 48th shift"],
  },
  marilyn: {
    worker: [0, "59th shift"],
    cancel: [0, "No request"],
    lateCancel: [3, "Cancelled 1 h before last shift"],
    attendance: [2, "2 absences"],
    location: [1, "1.4 km away"],
    company: [0, "Team's 64th shift"],
  },
  cristofer: {
    worker: [1, "23rd shift"],
    cancel: [0, "No request"],
    lateCancel: [0, "No late cancellations"],
    attendance: [2, "2 late check-ins"],
    location: [0, "On site"],
    company: [3, "Team's 3rd shift"],
  },
  giana: {
    worker: [0, "32nd shift"],
    cancel: [0, "No request"],
    lateCancel: [1, "1 late cancellation, 21 shifts ago"],
    attendance: [3, "3 absences"],
    location: [3, "13.6 km away"],
    company: [3, "Team's 2nd shift"],
  },
  brianna: {
    worker: [3, "2nd shift"],
    cancel: [0, "No request"],
    lateCancel: [0, "No late cancellations"],
    attendance: [0, "No late check-ins"],
    location: [1, "2.6 km away"],
    company: [3, "Team's 1st shift"],
  },
  maria: {
    worker: [0, "65th shift"],
    cancel: [0, "No request"],
    lateCancel: [1, "1 late cancellation, 52 shifts ago"],
    attendance: [1, "1 absence"],
    location: [2, "Location disabled"],
    company: [0, "Team's 213th shift"],
  },
  aspen: {
    worker: [1, "24th shift"],
    cancel: [0, "No request"],
    lateCancel: [1, "1 late cancellation, 17 shifts ago"],
    attendance: [2, "2 late check-ins"],
    location: [0, "On site"],
    company: [0, "Team's 213th shift"],
  },
  angel: {
    worker: [0, "113th shift"],
    cancel: [0, "No request"],
    lateCancel: [1, "1 late cancellation, 64 shifts ago"],
    attendance: [1, "1 late check-in"],
    location: [0, "On site"],
    company: [0, "Team's 213th shift"],
  },
  rayna: {
    worker: [0, "38th shift"],
    cancel: [0, "No request"],
    lateCancel: [1, "1 late cancellation, 31 shifts ago"],
    attendance: [2, "1 absence, 1 late check-in"],
    location: [0, "On site"],
    company: [0, "Team's 213th shift"],
  },
  alejandro: {
    worker: [2, "10th shift"],
    cancel: [0, "No request"],
    lateCancel: [1, "1 late cancellation, 6 shifts ago"],
    attendance: [1, "1 late check-in"],
    location: [0, "On site"],
    company: [0, "Team's 213th shift"],
  },
};

export type RiskReading = { level: Level; text: string };

/** A worker's no-show risk: each factor's level and what was found, in the sheet's order. */
export function noShowRisk(worker: Person): RiskReading[] {
  return CHECK_INS.signals.spider.factors.map((factor) => {
    const [level, text] = NO_SHOW_RISK[worker.id][factor.id];
    return { level, text };
  });
}

function customerStatus(w: Worker, day: Day): RowStatus {
  const status = chipOf(w, day);
  return status === "late" ? "missing" : status;
}

/** The customer's afternoon shift on `day`, as Canada's CCLS rows. */
export function customerRows(shifts: Shift[], day: Day, now: number): Row[] {
  const shift = shifts.find((s) => s.id === "afternoon");
  if (!shift) return [];
  return shift.workers.map((w) => {
    const status = customerStatus(w, day);
    const action: Entry | undefined =
      w.by && w.at !== undefined && !w.untracked
        ? { kind: status === "absent" ? "absent" : "checkIn", at: w.at, by: w.by, note: w.note ?? "" }
        : undefined;
    const row: Row = {
      ...blank,
      ...CUSTOMER_EXTRAS[w.id],
      id: w.id,
      country: "ca" as const,
      worker: { id: w.id, name: w.name, face: w.face, profile: w.profile },
      position: `${shift.position} - ${shift.name}`,
      role: "General Labourer",
      team: "CCLS First Gulf",
      zone: "EST",
      start: shift.start,
      end: shift.end,
      status,
      checkIn: w.checkIn,
      checkOut: w.checkOut,
      unpaidBreak: w.unpaidBreak,
      excused: w.excused,
      action,
      trace:
        day === "today" && ROADS[w.id] && w.checkIn !== undefined
          ? cameIn(ROADS[w.id], shift.start, w.checkIn - 4, now - 5)
          : undefined,
      source: { day, shift: shift.id },
    };
    return { ...row, changes: changesOf(row, now, !w.by) };
  });
}

/** The row's notes and history, newest first. */
export function history(row: Row): Entry[] {
  return [...row.entries, ...row.changes].sort((a, b) => b.at - a.at);
}

export type Action =
  | { type: "submit"; result: OverlayResult; at: number; by: string }
  | { type: "message"; message: string; note: string; at: number }
  | { type: "note"; note: string; at: number }
  | { type: "acknowledge"; on: boolean }
  | { type: "read" };

export function apply(row: Row, action: Action): Row {
  switch (action.type) {
    case "submit": {
      const { result } = action;
      const checkIn = result.checkIn ?? row.checkIn;
      const status = statusAfter(row, result.absent, checkIn, result.checkOut);
      const entry: Entry = { kind: result.absent ? "absent" : "checkIn", status, at: action.at, by: action.by, note: result.note };
      const logged = result.untracked ? {} : { action: entry, changes: [...row.changes, entry] };
      if (result.absent)
        return { ...row, status, checkIn: undefined, checkOut: undefined, excused: result.excused, ...logged };
      return {
        ...row,
        status,
        checkIn,
        checkOut: result.checkOut,
        unpaidBreak: result.unpaidBreak,
        excused: result.excused,
        ...logged,
      };
    }
    case "message": {
      const entry: Entry = { kind: "message", at: action.at, by: OPERATOR, note: action.note, message: action.message };
      return { ...row, entries: [...row.entries, entry] };
    }
    case "note":
      return { ...row, entries: [...row.entries, note(action.at, OPERATOR, action.note)] };
    case "acknowledge":
      return { ...row, acknowledged: action.on, unreadSignals: action.on ? 0 : row.unreadSignals };
    case "read":
      return { ...row, unreadNotes: 0 };
  }
}

export function inSlice(row: Row, slice: Slice) {
  switch (slice) {
    case "missing":
      return row.status === "missing" || row.status === "leftSite";
    case "newWorkers":
      return row.signals.includes("newWorker");
    case "newTeams":
      return !!row.newTeam;
    case "absences":
      return row.status === "absent";
    case "late":
      return row.status === "lateCheckIn";
    case "all":
      return true;
  }
}

const unread = (row: Row) => row.unreadNotes > 0 || row.unreadSignals > 0;
const onTime = (row: Row) =>
  row.status === "checkedIn" || (row.status === "checkedOut" && row.checkIn !== undefined && row.checkIn <= row.start);

/** The tiles: how many of `rows` each slice has, and how many of those its badge counts. */
export function tiles(rows: Row[]) {
  return Object.fromEntries(
    (["missing", "newWorkers", "newTeams", "absences", "late", "all"] as const).map((slice) => {
      const list = rows.filter((row) => inSlice(row, slice));
      const badge = slice === "absences" ? 0 : slice === "all" ? list.filter(onTime).length : list.filter(unread).length;
      return [slice, { count: list.length, badge }];
    }),
  ) as Record<Slice, { count: number; badge: number }>;
}

export interface Filters {
  teams: string[];
  statuses: RowStatus[];
  signals: Signal[];
}

/** The rows matching `query` and every filter that has a choice: any of a filter's choices will do. */
export function filter(rows: Row[], filters: Filters, query: string) {
  const text = query.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (!text || [row.worker.name, row.position, row.role, row.team].some((field) => field.toLowerCase().includes(text))) &&
      (!filters.teams.length || filters.teams.includes(row.team)) &&
      (!filters.statuses.length || filters.statuses.includes(row.status)) &&
      (!filters.signals.length || filters.signals.some((signal) => row.signals.includes(signal))),
  );
}

const dayOf = (minutes: number) => Math.floor(minutes / DAY);

const span = (from: number, to: number, zone: string) =>
  `${clock(from)}–${clock(to)}${dayOf(to) > dayOf(from) ? " (+1 Day)" : ""} ${zone}`;

/** "10:45 PM–6:15 AM (+1 Day) EST". */
export function shiftTimes(row: Row) {
  return span(row.start, row.end, row.zone);
}

/** The checked-in and out times, as `shiftTimes` writes the shift's. */
export function workedTimes(row: Row) {
  return row.checkIn === undefined || row.checkOut === undefined ? "" : span(row.checkIn, row.checkOut, row.zone);
}

/** How late a check-in is, or a missing one is at `now`: "+18m", "+1h 33m". */
export const late = (row: Row, now: number) => lateBy((row.checkIn ?? now) - row.start);

/** The anchor day's midnight: today's, or yesterday's once `now` has passed midnight. */
export function dayStartFor(now: number, date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  if (now >= DAY) start.setDate(start.getDate() - 1);
  return start;
}

/** "Oct 16, 2026, 9:05 AM" for `minutes` after `dayStart`; without the comma, as View Location writes it. */
export function stamp(dayStart: Date, minutes: number, comma = true) {
  const at = new Date(dayStart.getTime() + minutes * 60_000);
  const date = at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${date}${comma ? "," : ""} ${clock(minutes)}`;
}
