import type { StaticImageData } from "next/image";
import { PEOPLE } from "./data";
import type { Iso, Series } from "./shifts";
import jeremiahSchwartzmann from "./assets/faces/jeremiah-schwartzmann.jpg";
import samanthaStevens from "./assets/faces/samantha-stevens.jpg";
import nathanielBlake from "./assets/faces/nathaniel-blake.jpg";
import briannaSantos from "./assets/faces/brianna-santos.jpg";
import destinyPorter from "./assets/faces/destiny-porter.jpg";
import jackDaniels from "./assets/faces/jack-daniels.jpg";
import drishtiSuresh from "./assets/faces/drishti-suresh.jpg";
import giorgiaMorone from "./assets/faces/giorgia-morone.jpg";
import marilynCalzoni from "./assets/faces/marilyn-calzoni.jpg";
import tashondaWilliams from "./assets/faces/shonda-williams.jpg";
import gianaBaptista from "./assets/faces/giana-baptista.jpg";
import cristoferDorwart from "./assets/faces/cristofer-dorwart.jpg";
import miguelFernandoMarquez from "./assets/faces/miguel-fernando-marquez.jpg";
import shreyaseePangaonkar from "./assets/faces/shreyasee-pangaonkar.jpg";

// The Shift Planner's people (SW Curie's 22217:158037): who's hired for a shift, who has applied and who's available,
// and each one's booking on each of its days. Figma's Weekdays AM people are Figma's; the other shifts' crews are mine.

export interface Person {
  id: string;
  name: string;
  /** Without one, the initials show on Figma's placeholder. */
  face?: StaticImageData;
  /** In the company's worker pool. */
  pool: boolean;
  /** Found the shift through its public posting. */
  applicant: boolean;
}

const person = (id: string, name: string, face: StaticImageData | undefined, pool: boolean, applicant: boolean) => ({
  id,
  name,
  face,
  pool,
  applicant,
});

const regular = (id: string) => person(id, PEOPLE[id].name, PEOPLE[id].face, true, false);

const EVERYONE: Person[] = [
  person("jeremiah", "Jeremiah Schwartzmann", jeremiahSchwartzmann, true, true),
  person("samantha", "Samantha Stevens", samanthaStevens, true, true),
  person("nathaniel", "Nathaniel Blake", nathanielBlake, true, true),
  person("brianna", "Brianna Santos", briannaSantos, true, false),
  person("destiny", "Destiny Porter", destinyPorter, false, true),
  person("jack", "Jack Daniels", jackDaniels, false, true),
  person("giorgia", "Giorgia Morone", giorgiaMorone, false, true),
  person("drishti", "Drishti Suresh", drishtiSuresh, false, true),
  person("sikander", PEOPLE.sikander.name, PEOPLE.sikander.face, true, true),
  ...["maria", "aspen", "angel", "rayna", "alejandro", "brittany", "gamander", "disha", "jeff"].map(regular),
  person("marilyn", "Marilyn Calzoni", marilynCalzoni, true, false),
  person("tashonda", "Tashonda Williams", tashondaWilliams, true, false),
  person("giana", "Giana Baptista", gianaBaptista, true, false),
  person("cristofer", "Cristofer Dorwart", cristoferDorwart, true, false),
  person("miguel", "Miguel Fernando Marquez", miguelFernandoMarquez, false, true),
  person("shreyasee", "Shreyasee Pangaonkar", shreyaseePangaonkar, false, true),
];

const BY_ID = Object.fromEntries(EVERYONE.map((p) => [p.id, p]));

// No one hired on two shifts whose hours and days overlap, nor available for one that overlaps a shift they're hired on.
const WEEKDAY_CREW = ["jeremiah", "samantha", "nathaniel", "brianna", "destiny", "jack"];
const MORNING_CREW = ["maria", "aspen", "angel"];
const CREWS: Record<string, { hired: string[]; applied: string[]; available: string[] }> = {
  weekdays: { hired: WEEKDAY_CREW, applied: ["giorgia", "drishti"], available: ["marilyn", "miguel", "giana", "shreyasee"] },
  morning: { hired: MORNING_CREW, applied: ["sikander", "giorgia"], available: ["tashonda", "shreyasee"] },
  holiday: {
    hired: ["rayna", "alejandro", "brittany", "gamander"],
    applied: ["drishti", "sikander"],
    available: ["cristofer", "miguel"],
  },
  "weekend-picker": {
    hired: [...WEEKDAY_CREW, ...MORNING_CREW, "marilyn", "tashonda", "giana", "cristofer"],
    applied: ["giorgia", "drishti"],
    available: ["jeff", "miguel"],
  },
  "weekend-manager": { hired: ["disha", "jeff"], applied: ["sikander", "drishti"], available: ["maria", "shreyasee"] },
};
const POSTED = { hired: [], applied: ["giorgia", "drishti"], available: ["marilyn", "miguel"] };

export function rosterOf(series: Series): { hired: Person[]; applied: Person[]; available: Person[] } {
  const { hired, applied, available } = CREWS[series.id] ?? POSTED;
  const people = (ids: string[]) => ids.map((id) => BY_ID[id]);
  return { hired: people(hired), applied: people(applied), available: people(available) };
}

export interface Row {
  person: Person;
  /** Where they sit among those hired; who applied have none. */
  place?: number;
  /** Neither hired nor applied, so nothing's booked for them until they're sent an offer. */
  available?: boolean;
}

export type Booking = "booked" | "cancelled" | "offered" | "waitlisted" | null;

/** A worker's day in the planner, as its selection and `Offers` hold it. */
export const dayKey = (row: Row, iso: Iso) => `${row.person.id} ${iso}`;

/** The bookings Send offers and Withdraw offers have changed, by `dayKey`, over what the shift itself books. */
export type Offers = Record<string, Booking>;

/** `series`' offers on `dates` alone. */
export const offersOn = (series: Series, dates: Iso[]): Offers =>
  Object.fromEntries(Object.entries(series.offers ?? {}).filter(([day]) => dates.includes(day.split(" ")[1])));

/**
 * On a day ahead nobody was booked for, those hired are offered it while SpotFill sends offers, and have nothing
 * otherwise; those who applied have nothing on the days gone; those available, nothing. The shift's `offers` override
 * them all.
 */
export function bookingOn(series: Series, row: Row, iso: Iso, today: Iso): Booking {
  const key = dayKey(row, iso);
  if (series.offers && key in series.offers) return series.offers[key];
  if (row.available) return null;
  const filled = series.filled?.[iso];
  if (row.place !== undefined && filled === undefined) return iso >= today && series.spotFill !== false ? "offered" : null;
  if (row.place !== undefined) return row.place < filled! ? "booked" : "cancelled";
  if (iso < today) return null;
  return (filled ?? 0) < series.workers && series.spotFill !== false ? "offered" : "waitlisted";
}

/** The offers out on `dates`, to everyone on the shift's roster. */
export const offeredOn = (series: Series, dates: Iso[], today: Iso): number =>
  rowsOf(series).reduce(
    (count, row) => count + dates.filter((iso) => bookingOn(series, row, iso, today) === "offered").length,
    0,
  );

/** Those booked on a day, its fill: the places filled, less the bookings withdrawn. An offer fills none till it's booked. */
export function bookedOn(series: Series, iso: Iso): number {
  const filled = series.filled?.[iso] ?? 0;
  const offers = series.offers ?? {};
  const withdrawn = rosterOf(series)
    .hired.slice(0, filled)
    .filter((person) => {
      const key = dayKey({ person }, iso);
      return key in offers && offers[key] !== "booked";
    }).length;
  return filled - withdrawn;
}

export type Show = "all" | "candidates" | "offered" | "booked";

export interface Filter {
  show: Show;
  /** Shows those who applied from outside the worker pool. */
  publicApplicants: boolean;
  search: string;
}

const rowsOf = (series: Series): Row[] => {
  const { hired, applied, available } = rosterOf(series);
  return [
    ...hired.map((person, place) => ({ person, place })),
    ...applied.map((person) => ({ person })),
    ...available.map((person) => ({ person, available: true })),
  ];
};

export function plannerRows(series: Series, today: Iso, { show, publicApplicants, search }: Filter): Row[] {
  const rows = rowsOf(series);
  const typed = search.trim().toLowerCase();
  const offered = (row: Row) => series.dates.some((date) => bookingOn(series, row, date, today) === "offered");
  return rows.filter((row) => {
    const isHired = row.place !== undefined;
    if (show === "booked" && !isHired) return false;
    if (show === "candidates" && isHired) return false;
    if (show === "offered" && (isHired || !offered(row))) return false;
    if (!publicApplicants && !isHired && !row.person.pool) return false;
    return !typed || row.person.name.toLowerCase().includes(typed);
  });
}

const WITHDRAWABLE: Booking[] = ["offered", "booked", "waitlisted"];

/** Each of `days` (`dayKey`s) with what's booked on it. */
function bookingsOf(series: Series, today: Iso, days: string[]) {
  const byId = new Map(rowsOf(series).map((row) => [row.person.id, row]));
  return days.map((day) => {
    const [id, iso] = day.split(" ");
    return { day, iso, booking: bookingOn(series, byId.get(id)!, iso, today) };
  });
}

/** How many of `days` Send offers and Withdraw offers would each change. */
export function offerActions(series: Series, today: Iso, days: string[]) {
  const bookings = bookingsOf(series, today, days).map(({ booking }) => booking);
  return {
    send: bookings.filter((booking) => booking === null).length,
    withdraw: bookings.filter((booking) => WITHDRAWABLE.includes(booking)).length,
  };
}

/** Withdraw offers: each of `days` offered, booked or waitlisted turns available. The shift's offers after it. */
export function withdrawOffers(series: Series, today: Iso, days: string[]): Offers {
  const withdrawn = bookingsOf(series, today, days).filter(({ booking }) => WITHDRAWABLE.includes(booking));
  return { ...series.offers, ...Object.fromEntries(withdrawn.map(({ day }) => [day, null])) };
}

/**
 * Send offers: each of `days` available is offered while fewer are booked on it than the shift needs, or waitlisted.
 * An offer takes no place, so everyone sent one that day is offered. The shift's offers after it.
 */
export function sendOffers(series: Series, today: Iso, days: string[]): Offers {
  const sent = bookingsOf(series, today, days).filter(({ booking }) => booking === null);
  const vacant = (iso: Iso) => bookedOn(series, iso) < series.workers;
  return { ...series.offers, ...Object.fromEntries(sent.map(({ day, iso }) => [day, vacant(iso) ? "offered" : "waitlisted"])) };
}
