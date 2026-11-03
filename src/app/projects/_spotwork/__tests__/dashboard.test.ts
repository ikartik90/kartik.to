import { describe, expect, it } from "vitest";
import { CHECK_INS } from "../sheet-words";
import { overall } from "../risk-levels";
import { clock, daysFrom, duration } from "../data";
import {
  MESSAGE_TYPES,
  OPERATOR,
  SPOTTRACE,
  apply,
  customerRows,
  departure,
  filter,
  history,
  inSlice,
  late,
  leftSiteNote,
  metresAway,
  noShowRisk,
  reportedAt,
  rowsFor,
  shiftTimes,
  siteTemplate,
  siteOf,
  tiles,
  tracking,
  workedTimes,
  type Ping,
  type Row,
  type RowStatus,
} from "../dashboard";
import { COMPANY_PLACE } from "../geo";
import { metresBetween } from "../geofence";
import { TEMPLATES } from "../shifts";

// The Missing check-ins frame (SW Curie 23423:122193) reads as at 11:03 PM.
const AUTHORED = 23 * 60 + 3;
const ids = (rows: { id: string }[]) => rows.map((row) => row.id);
const byId = (rows: Row[], id: string) => rows.find((row) => row.id === id)!;
const NO_FILTERS = { teams: [], statuses: [], signals: [] };

describe("rowsFor", () => {
  it("has Figma's missing check-ins in the United States, in its order", () => {
    const us = rowsFor(AUTHORED).today.filter((row) => row.country === "us");
    expect(ids(us.filter((row) => inSlice(row, "missing")))).toEqual(["brittany", "gamander", "disha", "jeff", "sikander"]);
  });

  it("has Sikander and Brittany checked in, then gone from the job site, still among the missing", () => {
    const today = rowsFor(AUTHORED).today;
    for (const row of [byId(today, "sikander"), byId(today, "brittany")]) {
      expect(row.status).toBe("leftSite");
      expect(row.checkIn).toBeLessThan(row.trace!.at(-1)!.at);
      expect(inSlice(row, "missing")).toBe(true);
    }
  });

  // Only a floor manager may check a worker in early.
  it("has no worker check themselves in before their shift starts", () => {
    const days = rowsFor(AUTHORED);
    for (const row of [...days.yesterday, ...days.today].filter((row) => row.checkIn !== undefined && row.action?.kind !== "checkIn"))
      expect(row.checkIn).toBeGreaterThanOrEqual(row.start);
  });

  it("reads as Figma does at its moment", () => {
    const today = rowsFor(AUTHORED).today;
    expect(shiftTimes(byId(today, "brittany"))).toBe("6:15 PM–1:45 AM (+1 Day) EST");
    expect(shiftTimes(byId(today, "gamander"))).toBe("9:30 PM–5:30 AM (+1 Day) PST");
    expect(["gamander", "disha", "jeff"].map((id) => late(byId(today, id), AUTHORED).text)).toEqual(["+1h 33m", "+2h 03m", "+33m"]);
    expect(workedTimes(byId(today, "tashonda"))).toBe("12:05 PM–9:00 PM EST");
  });

  it("moves every time with the clock, in quarter hours, keeping nothing after now, phones' reports too", () => {
    const now = 15 * 60 + 43;
    const today = rowsFor(now).today;
    const authored = rowsFor(AUTHORED).today;
    for (const row of today) {
      const was = byId(authored, row.id);
      expect(((row.start % 15) + 15) % 15).toBe(0);
      expect(row.end - row.start).toBe(was.end - was.start);
      if (row.status === "missing") expect(Math.abs(now - row.start - (AUTHORED - was.start))).toBeLessThanOrEqual(7.5);
      for (const time of [row.checkIn, row.checkOut, ...history(row).map((entry) => entry.at), ...(row.trace ?? []).map((ping) => ping.at)])
        if (time !== undefined) expect(time).toBeLessThanOrEqual(now);
    }
  });

  it("logs each status a shift moved to: SpotTrace's, the worker's own check-in and out, and the operations team's with its note", () => {
    const { yesterday, today } = rowsFor(AUTHORED);
    const log = (row: Row) => history(row).filter((entry) => entry.status).map(({ status, at, by, note }) => [status, at - row.start, by, note]).reverse();
    const brittany = byId(today, "brittany");
    expect(log(brittany)).toEqual([
      ["checkedIn", 0, "Brittany Pilz", ""],
      ["leftSite", departure(brittany)!.at - brittany.start, SPOTTRACE, ""],
    ]);
    expect(log(byId(today, "gamander"))).toEqual([["missing", 0, SPOTTRACE, ""]]);
    const tashonda = byId(today, "tashonda");
    expect(log(tashonda)).toEqual([
      ["missing", 0, SPOTTRACE, ""],
      ["lateCheckIn", 5, "Tashonda Williams", ""],
      ["checkedOut", tashonda.end - tashonda.start, "Tashonda Williams", ""],
    ]);
    const cristofer = byId(today, "cristofer");
    expect(log(cristofer)).toEqual([
      ["missing", 0, SPOTTRACE, ""],
      ["lateCheckIn", AUTHORED - 8 - cristofer.start, OPERATOR, "Worker couldn't scan the check-in code at the door."],
    ]);
    expect(log(byId(today, "marilyn")).map(([status, , by]) => [status, by])).toEqual([["missing", SPOTTRACE], ["absent", OPERATOR]]);
    expect(log(byId(today, "brianna"))).toEqual([]);
    const disha = byId(yesterday, "disha");
    expect(log(disha)).toEqual([["missing", 0, SPOTTRACE, ""], ["absent", disha.end - disha.start, SPOTTRACE, ""]]);
  });

  it("has yesterday settled and tomorrow upcoming", () => {
    const { yesterday, tomorrow } = rowsFor(AUTHORED);
    for (const row of yesterday) expect(["checkedOut", "absent"]).toContain(row.status);
    for (const row of tomorrow) expect(row.status).toBe("upcoming");
  });
});

describe("customerRows", () => {
  const anchor = 15 * 60;
  const days = daysFrom(anchor, anchor + 43);

  it("brings the customer's afternoon shift to Canada, Maria's missing check-in included", () => {
    const rows = customerRows(days.today, "today", anchor + 43);
    expect(ids(rows)).toEqual(["maria", "aspen", "angel", "rayna", "alejandro"]);
    expect(rows.every((row) => row.country === "ca" && row.team === "CCLS First Gulf")).toBe(true);
    expect(byId(rows, "maria").status).toBe("missing");
    expect(byId(rows, "aspen").status).toBe("lateCheckIn");
  });

  it("shows who checked a worker in, unless they asked not to track it", () => {
    const [afternoon] = days.today;
    const checked = { ...afternoon, workers: afternoon.workers.map((w) => (w.id === "maria" ? { ...w, status: "lateCheckIn" as const, checkIn: anchor + 10, note: "Phone died", by: "Jesse P.", at: anchor + 40 } : w)) };
    const maria = byId(customerRows([checked], "today", anchor + 43), "maria");
    expect(maria.status).toBe("lateCheckIn");
    expect(history(maria)[0]).toMatchObject({ kind: "checkIn", status: "lateCheckIn", by: "Jesse P.", note: "Phone died" });
    const untracked = { ...checked, workers: checked.workers.map((w) => (w.id === "maria" ? { ...w, untracked: true } : w)) };
    expect(history(byId(customerRows([untracked], "today", anchor + 43), "maria")).map(({ status, by }) => [status, by])).toEqual([
      ["missing", SPOTTRACE],
    ]);
  });

  it("tells a worker marked absent from one who hasn't checked in", () => {
    const [afternoon] = days.today;
    const marked = { ...afternoon, workers: afternoon.workers.map((w) => (w.id === "maria" ? { ...w, marked: true } : w)) };
    expect(byId(customerRows([marked], "today", anchor + 43), "maria").status).toBe("absent");
  });
});

describe("apply", () => {
  const today = rowsFor(AUTHORED).today;
  const brittany = byId(today, "brittany");
  const result = { note: "Found her at the gate", excused: false, absent: false };

  it("checks a worker in, late past the shift's start, with the note on the history", () => {
    const row = apply(brittany, { type: "submit", result: { ...result, checkIn: brittany.start + 18 }, at: AUTHORED, by: OPERATOR });
    expect(row.status).toBe("lateCheckIn");
    expect(row.checkIn).toBe(brittany.start + 18);
    expect(history(row)[0]).toMatchObject({ kind: "checkIn", status: "lateCheckIn", by: OPERATOR, note: "Found her at the gate" });
    expect(apply(brittany, { type: "submit", result: { ...result, checkIn: brittany.start }, at: AUTHORED, by: OPERATOR }).status).toBe("checkedIn");
  });

  it("checks a worker out with a check-out time", () => {
    const row = apply(brittany, { type: "submit", result: { ...result, checkIn: brittany.start, checkOut: brittany.end }, at: AUTHORED, by: OPERATOR });
    expect(row.status).toBe("checkedOut");
  });

  it("marks a worker absent, the statuses before it kept on the history", () => {
    const row = apply(brittany, { type: "submit", result: { ...result, absent: true }, at: AUTHORED, by: OPERATOR });
    expect(row.status).toBe("absent");
    expect(row.checkIn).toBeUndefined();
    expect(history(row).filter((entry) => entry.status).map(({ kind, status }) => [kind, status])).toEqual([
      ["absent", "absent"],
      ["status", "leftSite"],
      ["status", "checkedIn"],
    ]);
  });

  it("logs every check-in or absence in turn, each with the status it moved the shift to", () => {
    const disha = byId(today, "disha");
    const checkedIn = apply(disha, { type: "submit", result: { ...result, checkIn: disha.start + 18 }, at: AUTHORED, by: OPERATOR });
    const out = apply(checkedIn, { type: "submit", result: { ...result, checkIn: disha.start + 18, checkOut: disha.end }, at: AUTHORED + 5, by: OPERATOR });
    expect(history(out).filter((entry) => entry.status).map(({ status, at }) => [status, at])).toEqual([
      ["checkedOut", AUTHORED + 5],
      ["lateCheckIn", AUTHORED],
      ["missing", disha.start],
    ]);
  });

  it("keeps an untracked action off the history", () => {
    const row = apply(brittany, { type: "submit", result: { ...result, absent: true, untracked: true }, at: AUTHORED, by: OPERATOR });
    expect(history(row)).toEqual(history(brittany));
  });

  it("records a message", () => {
    const disha = byId(today, "disha");
    const row = apply(disha, { type: "message", message: "Are you on site?", note: "No answer on the phone", at: AUTHORED });
    expect(history(row)[0]).toMatchObject({ kind: "message", message: "Are you on site?", note: "No answer on the phone" });
  });

  it("adds a note, and reading clears the unread ones", () => {
    const row = apply(brittany, { type: "note", note: "Called again", at: AUTHORED });
    expect(history(row)).toHaveLength(history(brittany).length + 1);
    expect(brittany.unreadNotes).toBeGreaterThan(0);
    expect(apply(row, { type: "read" }).unreadNotes).toBe(0);
  });

  it("clears unread risk signals once the risk is acknowledged", () => {
    expect(brittany.unreadSignals).toBe(1);
    expect(apply(brittany, { type: "acknowledge", on: true })).toMatchObject({ acknowledged: true, unreadSignals: 0 });
  });
});

describe("tiles", () => {
  it("counts each slice of the rows it's given, with their badges", () => {
    const anchor = 15 * 60;
    const rows = [...rowsFor(anchor + 43).today, ...customerRows(daysFrom(anchor, anchor + 43).today, "today", anchor + 43)];
    const [us, ca] = (["us", "ca"] as const).map((country) => tiles(rows.filter((row) => row.country === country)));
    expect(us.missing.count).toBe(5);
    // Brittany, Gamander, Jeff and Sikander have unread notes or risk signals.
    expect(us.missing.badge).toBe(4);
    expect(ca.missing.count).toBe(1);
    expect(tiles(rows).missing.count).toBe(6);
    expect(tiles(rows).all.count).toBe(rows.length);
    for (const counts of [us, ca])
      for (const key of ["newWorkers", "newTeams", "absences", "late"] as const) expect(counts[key].count).toBeGreaterThan(0);
  });
});

describe("filter", () => {
  const today = rowsFor(AUTHORED).today.filter((row) => row.country === "us");

  it("keeps everyone with no filters and an empty query", () => {
    expect(filter(today, NO_FILTERS, "  ")).toEqual(today);
  });

  it("finds a worker by name, shift or team, in any case", () => {
    expect(ids(filter(today, NO_FILTERS, "pilz"))).toEqual(["brittany"]);
    expect(ids(filter(today, NO_FILTERS, "Four Seasons"))).toEqual(["disha"]);
  });

  it("matches any choice within a filter and every filter across them", () => {
    expect(ids(filter(today, { ...NO_FILTERS, signals: ["newWorker"] }, ""))).toEqual(["brittany", "gamander"]);
    expect(ids(filter(today, { ...NO_FILTERS, teams: ["Reliable Logistics", "Four Seasons Produce"] }, ""))).toEqual(["gamander", "disha"]);
    expect(ids(filter(today, { ...NO_FILTERS, teams: ["Reliable Logistics"], statuses: ["checkedOut"] }, ""))).toEqual([]);
  });
});

describe("noShowRisk", () => {
  const { spider } = CHECK_INS.signals;
  const days = daysFrom(15 * 60, 15 * 60 + 43);
  const everyone = [...rowsFor(AUTHORED).today, ...customerRows(days.today, "today", 15 * 60 + 43)];

  const levels = (row: Row) => noShowRisk(row.worker).map((reading) => reading.level);

  it("reads every factor on the project sheet's chart for every worker, none to high, with what it found", () => {
    for (const row of everyone) {
      const readings = noShowRisk(row.worker);
      expect(readings).toHaveLength(spider.factors.length);
      for (const { level, text } of readings) {
        expect([0, 1, 2, 3]).toContain(level);
        expect(text).not.toBe("");
      }
    }
  });

  it("counts the shift a worker is on from the shifts their profile has completed", () => {
    const worker = spider.factors.findIndex((f) => f.id === "worker");
    for (const row of everyone) expect(parseInt(noShowRisk(row.worker)[worker].text)).toBe(row.worker.profile.shifts + 1);
  });

  it("dates a worker's last late cancellation in shifts since, fewer than they've worked, never in weeks or months", () => {
    const lateCancel = spider.factors.findIndex((f) => f.id === "lateCancel");
    const dated = everyone.map((row) => [row, noShowRisk(row.worker)[lateCancel].text] as const).filter(([, text]) => text.includes("ago"));
    expect(dated.length).toBeGreaterThan(0);
    for (const [row, text] of dated) {
      const [, since] = text.match(/^\d+ late cancellations?, (\d+) shifts ago$/)!;
      expect(Number(since)).toBeLessThanOrEqual(row.worker.profile.shifts);
    }
    for (const row of everyone) expect(noShowRisk(row.worker)[lateCancel].text).not.toMatch(/week|month/);
  });

  it("has workers at low, medium and high", () => {
    expect(new Set(everyone.map((row) => overall(levels(row))))).toEqual(new Set([1, 2, 3]));
  });
});

describe("duration", () => {
  it("writes minutes, then hours with two-digit minutes", () => {
    expect(duration(18)).toBe("18m");
    expect(duration(93)).toBe("1h 33m");
    expect(duration(123)).toBe("2h 03m");
  });
});

describe("a row's job site", () => {
  it("is its team's own, CCLS's at the company's address", () => {
    const teams = [...new Set(rowsFor(AUTHORED).today.map((row) => row.team))];
    const sites = teams.map(siteOf);
    expect(siteOf("CCLS First Gulf")).toBe(COMPANY_PLACE);
    expect(new Set(sites.map((site) => site.id)).size).toBe(teams.length);
  });

  it("is as far away as its location says, and nowhere known without one", () => {
    expect(metresAway("On Site")).toBe(0);
    expect(metresAway("7.3 km")).toBe(7300);
    expect(metresAway(undefined)).toBeNull();
  });

  it("finds the template its position names, at the same site, for its geofence and entrance", () => {
    const fence = [
      { lat: 43.6756, lng: -79.7151 },
      { lat: 43.6757, lng: -79.7135 },
      { lat: 43.6744, lng: -79.7134 },
    ];
    const templates = TEMPLATES.map((t) => (t.name === "Picker Packer" ? { ...t, geofence: fence, entrance: fence[1] } : t));
    const picker = templates.find((t) => t.name === "Picker Packer");
    const row = { ...byId(rowsFor(AUTHORED).today, "brittany"), team: "CCLS First Gulf" };
    expect(siteTemplate({ ...row, position: "Picker Packer - Afternoon" }, templates)).toBe(picker);
    expect(siteTemplate({ ...row, position: "Picker Packer" }, templates)).toMatchObject({ geofence: fence, entrance: fence[1] });
    expect(siteTemplate({ ...row, position: "Packer - Evening Shift" }, templates)).toBeUndefined();
    expect(siteTemplate({ ...row, position: "Picker Packer", team: "Bristol Circle Oakville" }, templates)).toBeUndefined();
  });
});

describe("the workers' location history", () => {
  const today = rowsFor(AUTHORED).today;
  const customer = customerRows(daysFrom(15 * 60, 15 * 60 + 43).today, "today", 15 * 60 + 43);
  // Seneca Polytechnic's Newnham Campus, plus code QMW2+CH.
  const SENECA = { lat: 43.7960291, lng: -79.3485875 };
  const placesOf = (row: Row) => row.trace!.map((ping: Ping) => reportedAt(ping, siteOf(row.team)));
  const tracked = [...today, ...customer].filter((row) => row.trace);
  const arrival = (row: Row) => row.trace!.find((ping) => !ping.place)!.at;

  it("puts Sweets from the Earth at 101 Canarctic Drive, at its plus code QGG5+5Q", () => {
    const site = siteOf("Sweets from the Earth");
    expect(site.label).toBe("101 Canarctic Drive, North York, ON");
    expect(site.lat).toBeCloseTo(43.7754375, 4);
    expect(site.lng).toBeCloseTo(-79.4905625, 4);
  });

  it("tracks every worker who's come in or been marked absent today, and nobody yet to start or with their location off", () => {
    expect(ids(tracked)).toEqual([
      "brittany",
      "jeff",
      "sikander",
      "tashonda",
      "marilyn",
      "cristofer",
      "giana",
      "aspen",
      "angel",
      "rayna",
      "alejandro",
    ]);
    for (const row of [...today, ...customer]) expect(row.trace !== undefined).toBe(row.location !== undefined);
    for (const row of rowsFor(AUTHORED).yesterday) expect(row.trace).toBeUndefined();
  });

  it.each(tracked.map((row) => row.id))(
    "tracks %s from half an hour before their shift, never quiet for more than 40 minutes, last seen where their location says",
    (id) => {
      const row = byId(tracked, id);
      const places = placesOf(row);
      const times = row.trace!.map((ping) => ping.at);
      expect(times[0]).toBe(row.start - 30);
      expect(times).toEqual([...new Set(times)].sort((a, b) => a - b));
      expect(Math.max(...times.slice(1).map((time, i) => time - times[i]))).toBeLessThanOrEqual(40);
      expect(Math.max(...places.slice(1).map((place, i) => metresBetween(places[i], place)))).toBeLessThan(3500);
      expect(metresBetween(siteOf(row.team), places.at(-1)!)).toBeCloseTo(metresAway(row.location)!, -2);
    },
  );

  it.each(tracked.map((row) => row.id))("has %s's phone report each minute on the move, at a road's pace", (id) => {
    const row = byId(tracked, id);
    const places = placesOf(row);
    places.slice(1).forEach((place, i) => {
      const metres = metresBetween(places[i], place);
      if (metres > 200) expect({ minutes: row.trace![i + 1].at - row.trace![i].at, fast: metres > 2000 }).toEqual({ minutes: 1, fast: false });
    });
  });

  it.each(tracked.map((row) => row.id))("never has %s's phone report the same spot twice", (id) => {
    const places = placesOf(byId(tracked, id));
    expect(new Set(places.map(({ lat, lng }) => `${lat},${lng}`)).size).toBe(places.length);
  });

  it.each(tracked.filter((row) => row.id !== "marilyn").map((row) => row.id))("has %s set off from over 2 km away", (id) => {
    expect(metresBetween(siteOf(byId(tracked, id).team), placesOf(byId(tracked, id))[0])).toBeGreaterThan(2000);
  });

  it.each(["marilyn", "giana"])("stops tracking %s once they're marked absent", (id) => {
    const row = byId(today, id);
    expect(row.status).toBe("absent");
    expect(row.trace!.at(-1)!.at).toBeLessThanOrEqual(row.action!.at);
    expect(row.action!.at - row.trace!.at(-1)!.at).toBeLessThanOrEqual(40);
  });

  it("keeps Marilyn at home, 1.4 km from the job site, until she calls in sick", () => {
    const marilyn = byId(today, "marilyn");
    const places = placesOf(marilyn);
    expect(marilyn.action!.note).toBe("Worker called in sick.");
    expect(metresBetween(siteOf(marilyn.team), places[0])).toBeCloseTo(1400, -2);
    expect(Math.max(...places.map((place) => metresBetween(places[0], place)))).toBeLessThan(3);
  });

  it("drives Giana toward the bakery until her car breaks down on Highway 401, 13.6 km short of it, and keeps her there till she's marked absent", () => {
    const giana = byId(today, "giana");
    const places = placesOf(giana);
    const away = places.map((place) => metresBetween(siteOf(giana.team), place));
    const stopped = giana.trace!.findIndex((_, i) => places.slice(i).every((place) => metresBetween(places[i], place) < 60));
    expect(giana.action!.note).toBe("Worker's car broke down on the way.");
    expect(away[0]).toBeGreaterThan(25_000);
    expect(Math.min(...away)).toBeCloseTo(13_600, -2);
    expect(away.slice(1, stopped + 1).every((metres, i) => metres < away[i] + 500)).toBe(true);
    expect(giana.trace![stopped].at).toBeLessThan(giana.start);
    expect(giana.trace!.length - stopped).toBeGreaterThan(1);
  });

  it.each(tracked.map((row) => row.id))("reads %s's location on their no-show risk as their row does", (id) => {
    const row = byId(tracked, id);
    const location = noShowRisk(row.worker)[CHECK_INS.signals.spider.factors.findIndex((f) => f.id === "location")].text;
    expect(location).toBe(row.location === "On Site" ? "On site" : `${row.location} away`);
  });

  it.each(tracked.filter((row) => row.checkIn !== undefined).map((row) => row.id))(
    "has %s on the job site when they check in",
    (id) => {
      const row = byId(tracked, id);
      const before = row.trace!.filter((ping) => ping.at <= row.checkIn!);
      expect(arrival(row)).toBeLessThanOrEqual(row.checkIn!);
      expect(metresBetween(siteOf(row.team), before.at(-1)!.place ?? siteOf(row.team))).toBeLessThan(100);
    },
  );

  it.each(["jeff", "tashonda", "cristofer", "aspen", "angel", "rayna", "alejandro"])(
    "keeps %s at one spot on the job site from arriving, each report a step or two from it",
    (id) => {
      const row = byId(tracked, id);
      const there = placesOf(row).filter((_, i) => row.trace![i].at >= arrival(row));
      expect(there.length).toBeGreaterThan(1);
      for (const place of there.slice(1)) {
        expect(metresBetween(there[0], place)).toBeGreaterThan(0);
        expect(metresBetween(there[0], place)).toBeLessThan(3);
      }
    },
  );

  it("stops tracking Tashonda when she checks out", () => {
    const tashonda = byId(today, "tashonda");
    expect(tashonda.trace!.at(-1)!.at).toBe(tashonda.checkOut);
  });

  it("brings Jeff to the job site after his shift began, though he hasn't checked in", () => {
    const jeff = byId(today, "jeff");
    expect(arrival(jeff)).toBeGreaterThan(jeff.start);
    expect(jeff.checkIn).toBeUndefined();
  });

  it("keeps the customer's reports to now, wherever its shift and check-ins move", () => {
    const now = 15 * 60 + 31;
    for (const row of customerRows(daysFrom(15 * 60, now).today, "today", now).filter((r) => r.trace))
      expect(row.trace!.at(-1)!.at).toBeLessThanOrEqual(now);
  });

  /** A worker's first report off the job site after checking in. */
  const leftAt = (row: Row) =>
    row.trace!.find((ping, i) => ping.at > row.checkIn! && metresBetween(siteOf(row.team), placesOf(row)[i]) > 100)!.at;

  it.each(["sikander", "brittany"])("has %s leave the job site a while after checking in, and stay away", (id) => {
    const row = byId(today, id);
    const after = placesOf(row).filter((_, i) => row.trace![i].at > row.checkIn!);
    expect(leftAt(row) - row.checkIn!).toBeGreaterThanOrEqual(15);
    expect(Math.min(...after.slice(-3).map((place) => metresBetween(siteOf(row.team), place)))).toBeGreaterThan(1000);
  });

  it("takes Sikander to Seneca's Newnham Campus for over an hour and part of the way back", () => {
    const sikander = byId(today, "sikander");
    const nearest = placesOf(sikander).map((place) => metresBetween(SENECA, place));
    const arrived = nearest.findIndex((metres) => metres < 200);
    const left = nearest.findIndex((metres, i) => i > arrived && metres >= 200);
    expect(nearest[0]).toBeGreaterThan(5000);
    expect(nearest.at(-1)).toBeGreaterThan(5000);
    expect(sikander.trace![left].at - sikander.trace![arrived].at).toBeGreaterThan(60);
  });

  it("has Brittany work from her check-in till lunch, then gone over half an hour, her phone quiet before she's messaged", () => {
    const brittany = byId(today, "brittany");
    const left = leftAt(brittany);
    expect(left - brittany.checkIn!).toBeGreaterThanOrEqual(3.5 * 60);
    expect(AUTHORED - left).toBeGreaterThan(30);
    expect(brittany.entries[0].at).toBeGreaterThan(left + 30);
    expect(brittany.trace!.at(-1)!.at).toBeLessThan(brittany.entries[0].at);
  });

  it.each(["sikander", "brittany"])("finds when %s left the job site", (id) => {
    const row = byId(today, id);
    expect(departure(row)?.at).toBe(leftAt(row));
  });

  it.each(["cristofer", "jeff", "gamander"])("finds no time %s left the job site, never having left it", (id) => {
    expect(departure(byId(today, id))).toBeUndefined();
  });
});

describe("Are you on site?", () => {
  const onSite = MESSAGE_TYPES.find((type) => type.label === "Are you on site?")!;

  it("tells a worker who hasn't come when their shift started", () => {
    const jeff = byId(rowsFor(AUTHORED).today, "jeff");
    expect(onSite.text(jeff)).toContain(clock(jeff.start));
  });

  it("tells a worker who left the job site when they left it, not when their shift started", () => {
    for (const row of ["brittany", "sikander"].map((id) => byId(rowsFor(AUTHORED).today, id))) {
      expect(onSite.text(row)).toContain(clock(departure(row)!.at));
      expect(onSite.text(row)).not.toContain(clock(row.start));
    }
  });

  it("has Brittany sent it, with a note on when she left, her location off, and what happens if she doesn't reply", () => {
    for (const now of [AUTHORED, AUTHORED + 75]) {
      const brittany = byId(rowsFor(now).today, "brittany");
      const sent = brittany.entries.find((entry) => entry.kind === "message")!;
      const left = clock(departure(brittany)!.at);
      expect(sent.message).toBe(onSite.text(brittany));
      expect(sent.note).toBe(leftSiteNote(left));
      for (const said of [left, /location/, /15 minutes/, /absent/, /block/]) expect(sent.note).toMatch(said);
    }
  });
});

describe("tracking", () => {
  it("tracks a worker's location until they check out or are marked absent, and not while their shift's upcoming", () => {
    const statuses: RowStatus[] = ["missing", "leftSite", "upcoming", "lateCheckIn", "checkedIn", "checkedOut", "absent"];
    expect(statuses.filter((status) => tracking({ status }))).toEqual(["missing", "leftSite", "lateCheckIn", "checkedIn"]);
  });

  it("tracks no one on yesterday's or tomorrow's dashboard", () => {
    const { yesterday, tomorrow } = rowsFor(23 * 60 + 3);
    expect([...yesterday, ...tomorrow].filter(tracking)).toEqual([]);
  });
});
