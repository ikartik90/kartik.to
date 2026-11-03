import { describe, expect, it } from "vitest";
import type { Team } from "../activations";
import { COMPANY_PLACE } from "../geo";
import {
  addToPool,
  bookedText,
  favourite,
  findByName,
  findNearby,
  foundText,
  listPool,
  poolRecords,
  poolTags,
  poolWorkers,
  removeFromPool,
  ROSTER,
  SHIFT_STEPS,
  skillsOf,
  tagWorker,
  withSkills,
} from "../worker-pool";

const names = (workers: { name: string }[]) => workers.map((worker) => worker.name);

describe("a team's worker pool", () => {
  it("lists its workers in the order they joined, each with their skills", () => {
    expect(poolWorkers(["disha", "maria"]).map(({ name, skills }) => [name, skills])).toEqual([
      ["Disha Patil", ["Forklift", "Warehouse", "Clamp Truck"]],
      ["Maria Franci", ["Packer", "Forklift", "Warehouse"]],
    ]);
  });
});

describe("the roster", () => {
  it("gives every worker a picture of their own", () => {
    expect(ROSTER.filter((worker) => !worker.face).map((worker) => worker.name)).toEqual([]);
    expect(new Set(ROSTER.map((worker) => worker.face)).size).toBe(ROSTER.length);
  });
});

describe("finding workers", () => {
  it("finds them by name or phone number, leaving out the pool's", () => {
    expect(names(findByName("disha", []))).toEqual(["Disha Patil"]);
    expect(names(findByName("905 555 0118", []))).toEqual(["Aspen Curtis"]);
    expect(names(findByName("(647) 555-0142", ["maria"]))).toEqual([]);
    expect(findByName("  ", [])).toEqual([]);
  });

  it("finds anyone on its roster, not only those in the check-ins", () => {
    expect(names(findByName("priya", []))).toEqual(["Priya Raghunathan"]);
    expect(names(findByName("416 555 0101", []))).toEqual(["Priya Raghunathan"]);
  });

  // Elsewhere in the GTA: Mississauga, Etobicoke, Vaughan, Oakville.
  const PLACES = [
    COMPANY_PLACE,
    { lat: 43.589, lng: -79.644 },
    { lat: 43.644, lng: -79.565 },
    { lat: 43.836, lng: -79.498 },
    { lat: 43.467, lng: -79.687 },
  ];
  const CCLS = ["tashonda", "rayna", "angel", "aspen", "alejandro", "maria"];

  it("finds 30 to 40 workers round any address, none twice and none from the pool", () => {
    for (const place of PLACES)
      for (const pool of [[], CCLS]) {
        const found = findNearby(place, 5, pool);
        expect(found.length, `${place.lat}, ${pool.length} in the pool`).toBeGreaterThanOrEqual(30);
        expect(found.length).toBeLessThanOrEqual(40);
        expect(new Set(found.map((worker) => worker.id)).size).toBe(found.length);
        expect(found.filter((worker) => pool.includes(worker.id))).toEqual([]);
      }
  });

  it("finds the same workers in the same order round the same address, and others round another", () => {
    expect(names(findNearby({ ...COMPANY_PLACE }, 5, CCLS))).toEqual(names(findNearby(COMPANY_PLACE, 5, CCLS)));
    expect(names(findNearby(COMPANY_PLACE, 10, CCLS))).toEqual(names(findNearby(COMPANY_PLACE, 5, CCLS)));
    const [first, ...rest] = PLACES.map((place) => names(findNearby(place, 5, CCLS)));
    for (const other of rest) expect(other).not.toEqual(first);
  });

  it("finds workers of many skills", () => {
    expect(new Set(findNearby(COMPANY_PLACE, 5, CCLS).flatMap((worker) => worker.skills)).size).toBeGreaterThanOrEqual(12);
  });

  it("counts those it finds", () => {
    expect([0, 1, 38].map(foundText)).toEqual(["No workers", "1 worker", "38 workers"]);
  });
});

describe("filtering found workers by skill", () => {
  const everyone = findNearby(COMPANY_PLACE, 5, ["tashonda", "rayna", "angel", "aspen", "alejandro", "maria"]);

  it("offers the skills of the workers listed, once each, A to Z", () => {
    expect(skillsOf(poolWorkers(["disha", "maria"]))).toEqual(["Clamp Truck", "Forklift", "Packer", "Warehouse"]);
  });

  it("keeps everyone while no skill is picked", () => {
    expect(withSkills(everyone, [])).toEqual(everyone);
  });

  it("keeps those with any skill picked, the most matched first, in their order among equals", () => {
    const picked = ["Packer", "Forklift", "Warehouse"];
    const matched = (worker: { skills: string[] }) => picked.filter((skill) => worker.skills.includes(skill)).length;
    const found = withSkills(everyone, picked);
    expect(found.length).toBeGreaterThan(0);
    expect(found.length).toBeLessThan(everyone.length);
    expect(found).toEqual(everyone.filter((worker) => matched(worker) > 0).sort((a, b) => matched(b) - matched(a)));
  });

  it("matches a skill whole, not a word in another", () => {
    const trucks = poolWorkers(["disha", "cristofer"]);
    expect(withSkills(trucks, ["Truck"])).toEqual([]);
    expect(names(withSkills(trucks, ["Reach Truck"]))).toEqual(["Cristofer Dorwart"]);
  });
});

const TODAY = new Date(2026, 9, 29);

const team = (change: Partial<Team> = {}): Team => ({
  name: "CCLS First Gulf",
  address: COMPANY_PLACE,
  zone: "Eastern",
  members: [],
  templates: [],
  pool: ["maria", "disha"],
  workerTags: { maria: ["PM", "Weekdays"] },
  favourites: ["disha"],
  checkInCodes: false,
  ...change,
});

describe("Manage worker pool's list", () => {
  it("gives each worker their last booking with the team and their shifts there, its tags on them and whether they're a favourite", () => {
    expect(
      poolRecords(team(), TODAY).map(({ name, lastBooked, shifts, tags, favourite }) => [name, bookedText(lastBooked), shifts, tags, favourite]),
    ).toEqual([
      ["Maria Franci", "10 February, 2026", 72, ["PM", "Weekdays"], false],
      ["Disha Patil", "24 October, 2026", 33, [], true],
    ]);
  });

  it("writes a day as Figma does", () => {
    expect(bookedText(new Date(2025, 5, 10))).toBe("10 June, 2025");
  });

  it("finds workers by name or phone number, and by any of the tags picked", () => {
    const records = poolRecords(team({ workerTags: { maria: ["PM", "Weekdays"], disha: ["AM"] } }), TODAY);
    expect(names(listPool(records, { query: "dish", tags: [] }))).toEqual(["Disha Patil"]);
    expect(names(listPool(records, { query: "(647) 555-0142", tags: [] }))).toEqual(["Maria Franci"]);
    expect(names(listPool(records, { query: "", tags: ["AM"] }))).toEqual(["Disha Patil"]);
    expect(names(listPool(records, { query: "", tags: ["AM", "PM"] }))).toEqual(["Maria Franci", "Disha Patil"]);
    expect(names(listPool(records, { query: "maria", tags: ["AM"] }))).toEqual([]);
  });

  it("lists a worker added from anywhere on the roster, with bookings of their own, found by name or number", () => {
    const [, priya] = poolRecords(team({ pool: ["maria", "priya"] }), TODAY);
    expect(priya.name).toBe("Priya Raghunathan");
    expect(priya.lastBooked.getTime()).toBeLessThan(TODAY.getTime());
    expect(priya.shifts).toBeGreaterThan(0);
    const records = poolRecords(team({ pool: ["maria", "priya"] }), TODAY);
    expect(names(listPool(records, { query: "priya", tags: [] }))).toEqual(["Priya Raghunathan"]);
    expect(names(listPool(records, { query: "416 555 0101", tags: [] }))).toEqual(["Priya Raghunathan"]);
  });

  it("finds those whose total shifts lie in a range of the filter's steps, its ends included", () => {
    const records = poolRecords(team(), TODAY);
    expect(SHIFT_STEPS).toEqual([0, 25, 50, 75, 100, 125]);
    expect(names(listPool(records, { query: "", tags: [], shifts: [0, 125] }))).toEqual(["Maria Franci", "Disha Patil"]);
    expect(names(listPool(records, { query: "", tags: [], shifts: [50, 75] }))).toEqual(["Maria Franci"]);
    expect(names(listPool(records, { query: "", tags: [], shifts: [25, 50] }))).toEqual(["Disha Patil"]);
    expect(names(listPool(records, { query: "", tags: [], shifts: [0, 25] }))).toEqual([]);
    expect(names(listPool(records, { query: "maria", tags: [], shifts: [25, 50] }))).toEqual([]);
  });

  it("offers the tags on its workers once each, in order, but those on workers it no longer has", () => {
    expect(poolTags(team({ workerTags: { maria: ["Weekdays", "PM"], disha: ["AM", "PM"], jeff: ["Driver"] } }))).toEqual(["AM", "PM", "Weekdays"]);
  });
});

describe("changing a team's pool", () => {
  it("adds a worker after the rest", () => {
    expect(addToPool(team(), "jeff").pool).toEqual(["maria", "disha", "jeff"]);
  });

  it("takes a worker out with its tags on them, and its favourite", () => {
    const out = removeFromPool(team(), "maria");
    expect([out.pool, out.workerTags, out.favourites]).toEqual([["disha"], {}, ["disha"]]);
    expect(removeFromPool(team(), "disha").favourites).toEqual([]);
  });

  it("makes a worker a favourite, or stops", () => {
    expect(favourite(team(), "maria", true).favourites).toEqual(["disha", "maria"]);
    expect(favourite(team(), "disha", false).favourites).toEqual([]);
  });

  it("sets its tags on a worker", () => {
    expect(tagWorker(team(), "disha", ["AM"]).workerTags).toEqual({ maria: ["PM", "Weekdays"], disha: ["AM"] });
  });
});
