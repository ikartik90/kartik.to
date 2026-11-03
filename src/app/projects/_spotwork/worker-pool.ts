import type { StaticImageData } from "next/image";
import type { Team } from "./activations";
import { BRIANNA, CRISTOFER, GIANA, MARILYN } from "./dashboard";
import { profile, type Person, type Tier } from "./data";
import type { LatLng } from "./geofence";
import { DIRECTORY, holds } from "./timesheet";
import jeremiahSchwartzmann from "./assets/faces/jeremiah-schwartzmann.jpg";
import samanthaStevens from "./assets/faces/samantha-stevens.jpg";
import nathanielBlake from "./assets/faces/nathaniel-blake.jpg";
import destinyPorter from "./assets/faces/destiny-porter.jpg";
import jackDaniels from "./assets/faces/jack-daniels.jpg";
import drishtiSuresh from "./assets/faces/drishti-suresh.jpg";
import giorgiaMorone from "./assets/faces/giorgia-morone.jpg";
import siobhanKelly from "./assets/faces/siobhan-kelly.jpg";
import emmaLindqvist from "./assets/faces/emma-lindqvist.jpg";
import anjaliKapoor from "./assets/faces/anjali-kapoor.jpg";
import meiLinWong from "./assets/faces/mei-lin-wong.jpg";
import nadiaHaddad from "./assets/faces/nadia-haddad.jpg";
import amaraNwosu from "./assets/faces/amara-nwosu.jpg";
import graceMwangi from "./assets/faces/grace-mwangi.jpg";
import sofiaMarchetti from "./assets/faces/sofia-marchetti.jpg";
import lucasTremblay from "./assets/faces/lucas-tremblay.jpg";
import ethanKowalski from "./assets/faces/ethan-kowalski.jpg";
import diegoHerrera from "./assets/faces/diego-herrera.jpg";
import omarFarouk from "./assets/faces/omar-farouk.jpg";
import rohanDesai from "./assets/faces/rohan-desai.jpg";
import kwameMensah from "./assets/faces/kwame-mensah.jpg";
import tundeAdeyemi from "./assets/faces/tunde-adeyemi.jpg";
import priyaRaghunathan from "./assets/faces/priya-raghunathan.jpg";
import danielOkafor from "./assets/faces/daniel-okafor.jpg";
import harpreetGill from "./assets/faces/harpreet-gill.jpg";
import marcusThompson from "./assets/faces/marcus-thompson.jpg";
import anaLuciaReyes from "./assets/faces/ana-lucia-reyes.jpg";
import weiChen from "./assets/faces/wei-chen.jpg";
import fatimaYusuf from "./assets/faces/fatima-yusuf.jpg";
import jordanCampbell from "./assets/faces/jordan-campbell.jpg";
import arjunMehta from "./assets/faces/arjun-mehta.jpg";
import chloeGagnon from "./assets/faces/chloe-gagnon.jpg";
import tyroneEdwards from "./assets/faces/tyrone-edwards.jpg";
import isabelaCosta from "./assets/faces/isabela-costa.jpg";
import simranKaur from "./assets/faces/simran-kaur.jpg";
import nikolaiPetrov from "./assets/faces/nikolai-petrov.jpg";
import kevinNguyen from "./assets/faces/kevin-nguyen.jpg";

// Find workers' roster: everyone a search can find, each with their skills; and the company app's pool, each worker's
// bookings with its team.

/** A worker as Find workers knows them. */
export type PoolWorker = Person & { skills: string[] };

const SKILLS: Record<string, string[]> = {
  maria: ["Packer", "Forklift", "Warehouse"],
  aspen: ["Packer", "Assembly"],
  angel: ["Forklift", "Packer", "Warehouse"],
  rayna: ["Cashier", "Customer Service"],
  alejandro: ["Construction", "General Labourer", "Driver"],
  brittany: ["Packer", "General Labourer"],
  gamander: ["Assembly", "Manufacturing", "General Labourer"],
  disha: ["Forklift", "Warehouse", "Clamp Truck"],
  jeff: ["Delivery", "Driver"],
  sikander: ["Manufacturing", "Forklift"],
  tashonda: ["Manufacturing", "Assembly"],
  miguel: ["Cook", "Hospitality"],
  shreyasee: ["Data Entry", "Customer Service"],
  marilyn: ["Picker", "Packer", "Shipping and Receiving"],
  cristofer: ["Reach Truck", "Forklift", "Warehouse"],
  giana: ["Quality Control", "Assembly"],
  brianna: ["Packer", "Picker"],
};

const worker = (
  id: string,
  name: string,
  face: StaticImageData,
  [tier, score]: [Tier, number],
  phone: string,
  city: string,
  shifts: number,
  skills: string[],
): PoolWorker => ({ id, name, face, profile: profile(tier, score, phone, city, shifts, shifts * 8), skills });

/** Everyone a search can find. */
export const ROSTER: PoolWorker[] = [
  ...[...Object.values(DIRECTORY), MARILYN, CRISTOFER, GIANA, BRIANNA].map((person) => ({ ...person, skills: SKILLS[person.id] })),
  worker("jeremiah", "Jeremiah Schwartzmann", jeremiahSchwartzmann, ["Pro", 87], "(416) 555-0103", "Toronto", 46, ["Forklift", "Reach Truck", "Shipping and Receiving"]),
  worker("samantha", "Samantha Stevens", samanthaStevens, ["Elite", 94], "(647) 555-0105", "Mississauga", 71, ["Picker", "Packer", "Quality Control"]),
  worker("nathaniel", "Nathaniel Blake", nathanielBlake, ["Pro", 85], "(905) 555-0107", "Brampton", 38, ["General Labourer", "Construction"]),
  worker("destiny", "Destiny Porter", destinyPorter, ["Super", 80], "(437) 555-0110", "Etobicoke", 12, ["Cashier", "Retail", "Customer Service"]),
  worker("jack", "Jack Daniels", jackDaniels, ["Pro", 83], "(289) 555-0112", "Milton", 29, ["Driver", "Delivery", "General Labourer"]),
  worker("giorgia", "Giorgia Morone", giorgiaMorone, ["Super", 77], "(416) 555-0114", "Woodbridge", 6, ["Line Cook", "Dishwasher", "Hospitality"]),
  worker("drishti", "Drishti Suresh", drishtiSuresh, ["Pro", 90], "(647) 555-0116", "Brampton", 52, ["Data Entry", "Quality Control", "Assembly"]),
  worker("siobhan", "Siobhan Kelly", siobhanKelly, ["Pro", 86], "(905) 555-0119", "Oakville", 33, ["Event Staff", "Hospitality", "Cashier"]),
  worker("emma", "Emma Lindqvist", emmaLindqvist, ["Super", 74], "(416) 555-0122", "Toronto", 5, ["Retail", "Customer Service"]),
  worker("anjali", "Anjali Kapoor", anjaliKapoor, ["Elite", 93], "(647) 555-0124", "Brampton", 88, ["Picker", "Packer", "Warehouse"]),
  worker("meilin", "Mei Lin Wong", meiLinWong, ["Pro", 89], "(905) 555-0126", "Markham", 41, ["Assembly", "Quality Control", "Machine Operator"]),
  worker("nadia", "Nadia Haddad", nadiaHaddad, ["Pro", 84], "(289) 555-0129", "Mississauga", 27, ["Data Entry", "Customer Service", "Shipping and Receiving"]),
  worker("amara", "Amara Nwosu", amaraNwosu, ["Elite", 96], "(437) 555-0131", "Scarborough", 102, ["Cleaning Services", "General Labourer"]),
  worker("grace", "Grace Mwangi", graceMwangi, ["Pro", 88], "(416) 555-0133", "North York", 44, ["Cook", "Line Cook", "Hospitality"]),
  worker("sofia", "Sofia Marchetti", sofiaMarchetti, ["Super", 79], "(905) 555-0135", "Vaughan", 15, ["Event Staff", "Retail"]),
  worker("lucas", "Lucas Tremblay", lucasTremblay, ["Pro", 85], "(647) 555-0138", "Etobicoke", 36, ["Forklift", "Clamp Truck", "Warehouse"]),
  worker("ethan", "Ethan Kowalski", ethanKowalski, ["Super", 72], "(905) 555-0140", "Burlington", 3, ["Agriculture", "General Labourer", "Packer"]),
  worker("diego", "Diego Herrera", diegoHerrera, ["Elite", 95], "(416) 555-0143", "Toronto", 97, ["Construction", "General Labourer", "Driver"]),
  worker("omar", "Omar Farouk", omarFarouk, ["Pro", 87], "(289) 555-0145", "Mississauga", 39, ["Machine Operator", "Manufacturing", "Forklift"]),
  worker("rohan", "Rohan Desai", rohanDesai, ["Pro", 91], "(647) 555-0148", "Brampton", 58, ["Reach Truck", "Shipping and Receiving", "Warehouse"]),
  worker("kwame", "Kwame Mensah", kwameMensah, ["Super", 81], "(437) 555-0150", "Scarborough", 19, ["Delivery", "Driver"]),
  worker("tunde", "Tunde Adeyemi", tundeAdeyemi, ["Pro", 86], "(905) 555-0152", "Ajax", 31, ["Cleaning Services", "Dishwasher", "Hospitality"]),
  worker("priya", "Priya Raghunathan", priyaRaghunathan, ["Pro", 89], "(416) 555-0101", "Mississauga", 48, ["Food Processing", "Packer", "Quality Control"]),
  worker("daniel", "Daniel Okafor", danielOkafor, ["Super", 78], "(647) 555-0155", "Brampton", 9, ["Agriculture", "General Labourer", "Cleaning Services"]),
  worker("harpreet", "Harpreet Gill", harpreetGill, ["Elite", 97], "(905) 555-0157", "Brampton", 121, ["Forklift", "Reach Truck", "Clamp Truck"]),
  worker("marcus", "Marcus Thompson", marcusThompson, ["Pro", 84], "(289) 555-0160", "Hamilton", 34, ["Construction", "Machine Operator"]),
  worker("analucia", "Ana Lucía Reyes", anaLuciaReyes, ["Pro", 88], "(416) 555-0162", "North York", 42, ["Cook", "Dishwasher"]),
  worker("wei", "Wei Chen", weiChen, ["Super", 80], "(647) 555-0165", "Markham", 11, ["Data Entry", "Retail"]),
  worker("fatima", "Fatima Yusuf", fatimaYusuf, ["Pro", 86], "(905) 555-0167", "Mississauga", 30, ["Picker", "Packer", "Assembly"]),
  worker("jordan", "Jordan Campbell", jordanCampbell, ["Super", 75], "(437) 555-0169", "Toronto", 4, ["Event Staff", "Customer Service"]),
  worker("arjun", "Arjun Mehta", arjunMehta, ["Pro", 90], "(416) 555-0173", "Brampton", 55, ["Shipping and Receiving", "Forklift", "Data Entry"]),
  worker("chloe", "Chloé Gagnon", chloeGagnon, ["Super", 79], "(647) 555-0176", "Oakville", 14, ["Cashier", "Retail"]),
  worker("tyrone", "Tyrone Edwards", tyroneEdwards, ["Pro", 85], "(905) 555-0178", "Pickering", 37, ["Agriculture", "Driver", "General Labourer"]),
  worker("isabela", "Isabela Costa", isabelaCosta, ["Elite", 94], "(289) 555-0183", "Milton", 79, ["Food Processing", "Manufacturing", "Quality Control"]),
  worker("simran", "Simran Kaur", simranKaur, ["Pro", 87], "(437) 555-0187", "Brampton", 43, ["Food Processing", "Picker", "Packer"]),
  worker("nikolai", "Nikolai Petrov", nikolaiPetrov, ["Super", 76], "(416) 555-0190", "Etobicoke", 8, ["Machine Operator", "Manufacturing"]),
  worker("kevin", "Kevin Nguyen", kevinNguyen, ["Pro", 88], "(647) 555-0193", "Scarborough", 47, ["Line Cook", "Cook", "Event Staff"]),
];

const BY_ID = Object.fromEntries(ROSTER.map((worker) => [worker.id, worker]));

/** A team's pool, its workers in the order they joined. */
export const poolWorkers = (pool: string[]) => pool.map((id) => BY_ID[id]);

/** Workers whose name or phone number holds `query`, but those in `pool`. */
export const findByName = (query: string, pool: string[]) => ROSTER.filter((worker) => !pool.includes(worker.id) && holds(worker, query));

/** Numbers in [0, 1) that run the same for the same `key`. */
function seeded(key: string) {
  let seed = 1779033703 ^ key.length;
  for (const char of key) seed = Math.imul(seed ^ char.charCodeAt(0), 3432918353) ^ (seed >>> 13);
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Those a search round `place` finds, but those in `pool`: 30 to 40 off the roster, its own few in its own order round each place, each some way inside `km`. */
function nearby(place: LatLng, km: number, pool: string[]) {
  const random = seeded(`${place.lat.toFixed(4)},${place.lng.toFixed(4)}`);
  const count = 30 + Math.floor(random() * 11);
  return ROSTER.map((worker) => ({ worker, rank: random(), away: random() * km * 1000 }))
    .filter(({ worker }) => !pool.includes(worker.id))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, count);
}

/** Workers a search round `place` finds, but those in `pool`, the nearest first. */
export const findNearby = (place: LatLng, km: number, pool: string[]) =>
  nearby(place, km, pool)
    .sort((a, b) => a.away - b.away)
    .map(({ worker }) => worker);

/** The skills `workers` have, once each, A–Z. */
export const skillsOf = (workers: PoolWorker[]) => [...new Set(workers.flatMap((worker) => worker.skills))].sort();

/** Those of `workers` with any of `skills`, the most matched first, in their own order among equals; all without any. */
export function withSkills(workers: PoolWorker[], skills: string[]) {
  if (!skills.length) return workers;
  const matched = (worker: PoolWorker) => skills.filter((skill) => worker.skills.includes(skill)).length;
  return workers.filter((worker) => matched(worker) > 0).sort((a, b) => matched(b) - matched(a));
}

/** "38 workers", "1 worker", "No workers". */
export const foundText = (count: number) => (count ? `${count} ${count === 1 ? "worker" : "workers"}` : "No workers");

// How the company app's team has booked each worker: days since their last shift with it, and how many they've worked.
const BOOKED: Record<string, { daysAgo: number; shifts: number }> = {
  tashonda: { daysAgo: 2, shifts: 15 },
  rayna: { daysAgo: 26, shifts: 72 },
  angel: { daysAgo: 26, shifts: 42 },
  aspen: { daysAgo: 48, shifts: 111 },
  alejandro: { daysAgo: 70, shifts: 45 },
  maria: { daysAgo: 261, shifts: 72 },
  brittany: { daysAgo: 12, shifts: 28 },
  gamander: { daysAgo: 40, shifts: 9 },
  disha: { daysAgo: 5, shifts: 33 },
  jeff: { daysAgo: 95, shifts: 4 },
  sikander: { daysAgo: 150, shifts: 12 },
  miguel: { daysAgo: 300, shifts: 2 },
  shreyasee: { daysAgo: 18, shifts: 21 },
};

/** Bookings for a worker the team's added off the roster: some time in the last 200 days, up to 40 shifts. */
function bookedBefore(id: string) {
  const random = seeded(id);
  return { daysAgo: 1 + Math.floor(random() * 200), shifts: 1 + Math.floor(random() * 40) };
}

/** "10 June, 2025". */
export const bookedText = (date: Date) => `${date.getDate()} ${date.toLocaleString("en-US", { month: "long" })}, ${date.getFullYear()}`;

export type PoolRecord = PoolWorker & { lastBooked: Date; shifts: number; tags: string[]; favourite: boolean };

/** The team's pool as Manage worker pool lists it, in the order they joined. */
export const poolRecords = (team: Team, today: Date): PoolRecord[] =>
  poolWorkers(team.pool).map((worker) => {
    const { daysAgo, shifts } = BOOKED[worker.id] ?? bookedBefore(worker.id);
    return {
      ...worker,
      lastBooked: new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo),
      shifts,
      tags: team.workerTags?.[worker.id] ?? [],
      favourite: team.favourites?.includes(worker.id) ?? false,
    };
  });

/** The Total shifts filter's stops, the most any worker has booked under the last. */
export const SHIFT_STEPS = [0, 25, 50, 75, 100, 125];

/** Those whose name or phone number holds `query`, with total shifts in `shifts` (its ends included), and with any of `tags` if some are picked. */
export function listPool(
  records: PoolRecord[],
  { query, tags, shifts: [low, high] = [-Infinity, Infinity] }: { query: string; tags: string[]; shifts?: [number, number] },
) {
  return records.filter(
    (record) =>
      (!query.trim() || holds(record, query)) &&
      record.shifts >= low &&
      record.shifts <= high &&
      (!tags.length || record.tags.some((tag) => tags.includes(tag))),
  );
}

/** The tags on the team's pool, once each, in order. */
export const poolTags = (team: Team) => [...new Set(team.pool.flatMap((id) => team.workerTags?.[id] ?? []))].sort();

export const addToPool = (team: Team, id: string): Team => ({ ...team, pool: [...team.pool, id] });

/** The team without `id` in its pool, its tags on them or its favourite. */
export function removeFromPool(team: Team, id: string): Team {
  const { [id]: _, ...workerTags } = team.workerTags ?? {};
  return {
    ...team,
    pool: team.pool.filter((worker) => worker !== id),
    workerTags,
    favourites: (team.favourites ?? []).filter((worker) => worker !== id),
  };
}

export const favourite = (team: Team, id: string, on: boolean): Team => ({
  ...team,
  favourites: on ? [...(team.favourites ?? []), id] : (team.favourites ?? []).filter((worker) => worker !== id),
});

export const tagWorker = (team: Team, id: string, tags: string[]): Team => ({ ...team, workerTags: { ...team.workerTags, [id]: tags } });
