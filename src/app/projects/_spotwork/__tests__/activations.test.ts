import { describe, expect, it } from "vitest";
import {
  SALES,
  TIMEZONES,
  addNote,
  addProspect,
  addTeam,
  addedOnText,
  archivedOn,
  companyLine,
  flagsText,
  deactivate,
  deleteTeam,
  deactivateTeam,
  decide,
  draftOf,
  emptyDraft,
  failingInvites,
  filterProspects,
  findMembers,
  formatPhone,
  membersText,
  noteAtText,
  noteCount,
  notesText,
  phoneText,
  poolText,
  prospectsFrom,
  requirementsText,
  teamRequirements,
  appTeam,
  appTeams,
  updateAppTeam,
  reactivate,
  ready,
  restoreTeam,
  sortProspects,
  standing,
  teamLine,
  teamLogo,
  templatesText,
  uniqueTitle,
  updateCompany,
  updateProspect,
  updateTeam,
  updateWorkspace,
  withCopy,
  withFlag,
  withInvites,
  withRole,
  zoneAt,
  type Draft,
  type Member,
  type ProspectFilters,
} from "../activations";
import { COMPANY_PLACE } from "../geo";
import { ROSTER } from "../worker-pool";

const NOW = new Date(2026, 9, 17, 16, 0);
const SEED = prospectsFrom(NOW);
const names = (list: { name: string }[]) => list.map((p) => p.name);
const ALL: ProspectFilters = { query: "", country: "all", sizes: [], sources: [], statuses: [] };

const DRAFT: Draft = {
  ...emptyDraft(),
  name: "Jason Spooner",
  phone: "4165550142",
  email: "jason.spooner@shipfusion.com",
  designation: "Operations Manager",
  country: "canada",
  company: "ShipFusion",
  size: "25–100",
};

describe("the activations' prospects", () => {
  it("are Figma's, once each, added over the two days before today, then CCLS, long onboarded", () => {
    expect(SEED).toHaveLength(10);
    expect(new Set(names(SEED)).size).toBe(10);
    const [ccls, ...figma] = SEED.toSorted((a, b) => a.added.getTime() - b.added.getTime());
    expect(figma.every((p) => p.added < NOW && p.added.getTime() > NOW.getTime() - 3 * 86_400_000)).toBe(true);
    expect(ccls.company).toBe("CCLS");
    expect(SEED.find((p) => p.name === "Anika Septimus")?.added).toEqual(new Date(2026, 9, 16, 21, 44));
  });

  it("start in Figma's states", () => {
    const status = Object.fromEntries(SEED.map((p) => [p.name, p.status]));
    expect(status["Gustavo Donin"]).toBe("pending");
    expect(status["Jocelyn Levin"]).toBe("rejected");
    expect(status["Paityn Aminoff"]).toBe("approved");
    expect(status["Nolan Gouse"]).toBe("onboarded");
  });

  it("carry their logos once active, or once sales has added one, none while pending or rejected", () => {
    const logo = (p: (typeof SEED)[number]) => p.logo !== undefined;
    expect(SEED.filter((p) => p.status === "onboarded").every(logo)).toBe(true);
    expect(SEED.filter((p) => p.status === "pending" || p.status === "rejected").some(logo)).toBe(false);
    expect(SEED.filter((p) => p.status === "approved" && logo(p)).map((p) => p.company)).toEqual(["Dempster's"]);
  });

  it("give a team its company's logo until it has its own", () => {
    const dircks = SEED.find((p) => p.company === "Dircks Logistics")!;
    const [team] = dircks.workspace.teams;
    expect(team.logo).toBeUndefined();
    expect(teamLogo(dircks, team)).toBe(dircks.logo);
    expect(teamLogo(dircks, { ...team, logo: "blob:own" })).toBe("blob:own");
    expect(teamLogo({ ...dircks, logo: undefined }, team)).toBeUndefined();
  });

  it("start Dempster's, onboarding, with the team sales set up, its templates and workers in place", () => {
    const [team, ...others] = SEED.find((p) => p.company === "Dempster's")!.workspace.teams;
    expect(others).toHaveLength(0);
    expect(team.name).toBe("Dempster's Hamilton");
    expect(team.members).toEqual([{ name: "Craig Curtis", email: "craig@dempsters.ca", role: "Owner" }]);
    expect(team.templates.map((t) => t.title)).toEqual(["Production Line Associate", "Mixer Operator", "Shipping Associate"]);
    expect(team.pool.length).toBeGreaterThan(0);
    expect(team.pool.every((id) => ROSTER.some((worker) => worker.id === id))).toBe(true);
  });

  it("read as Figma writes them", () => {
    const anika = SEED.find((p) => p.name === "Anika Septimus")!;
    const maren = SEED.find((p) => p.name === "Maren Dorwart")!;
    expect(phoneText(anika)).toBe("+1 (618) 474-9169");
    expect(phoneText(maren)).toBe("-");
    expect(companyLine(anika)).toBe("Canada • 250+ employees");
    expect(companyLine(maren)).toBe("USA • 100–250 employees");
    expect(addedOnText(new Date(2026, 9, 16, 21, 44))).toBe("10/16/2026 9:44 PM");
    expect(addedOnText(new Date(2026, 9, 5, 7, 17))).toBe("10/05/2026 7:17 AM");
  });
});

describe("narrowing the prospects", () => {
  it("finds a prospect by name, company, email or phone", () => {
    expect(names(filterProspects(SEED, { ...ALL, query: "saralee" }))).toEqual(["Gustavo Donin"]);
    expect(names(filterProspects(SEED, { ...ALL, query: "JOLEVIN@" }))).toEqual(["Jocelyn Levin"]);
    expect(names(filterProspects(SEED, { ...ALL, query: "504" }))).toEqual(["Craig Curtis"]);
  });

  it("keeps a country, and any of the sizes and sources picked", () => {
    const usa = filterProspects(SEED, { ...ALL, country: "usa" });
    expect(usa.every((p) => p.country === "usa")).toBe(true);
    expect(usa.length).toBeGreaterThan(0);
    expect(names(filterProspects(SEED, { ...ALL, sizes: ["250+"] }))).toEqual(["Anika Septimus", "Gustavo Donin", "Paityn Aminoff", "Craig Curtis", "Nolan Gouse", "Brittany Pilz", "Jesse Pereira"]);
    expect(names(filterProspects(SEED, { ...ALL, country: "canada", sources: ["Outreach", "Marketing Campaign"] }))).toEqual(
      ["Paityn Aminoff", "Skylar Kenter", "Brittany Pilz", "Jesse Pereira"],
    );
  });

  it("keeps any of the statuses picked, a deactivated company under its own", () => {
    expect(names(filterProspects(SEED, { ...ALL, statuses: ["onboarded"] }))).toEqual(["Nolan Gouse", "Brittany Pilz", "Jesse Pereira"]);
    expect(names(filterProspects(SEED, { ...ALL, statuses: ["pending", "rejected"] }))).toEqual(
      ["Anika Septimus", "Gustavo Donin", "Maren Dorwart", "Jocelyn Levin", "Skylar Kenter"],
    );
    const nolan = SEED.find((p) => p.name === "Nolan Gouse")!;
    const gone = deactivate(SEED, nolan.id, NOW);
    expect(names(filterProspects(gone, { ...ALL, statuses: ["onboarded"] }))).toEqual(["Brittany Pilz", "Jesse Pereira"]);
    expect(names(filterProspects(gone, { ...ALL, statuses: ["deactivated"] }))).toEqual(["Nolan Gouse"]);
  });

  it("sorts by name, company or when they were added", () => {
    expect(names(sortProspects(SEED, { by: "added", dir: "desc" })).slice(0, 2)).toEqual([
      "Anika Septimus",
      "Gustavo Donin",
    ]);
    expect(names(sortProspects(SEED, { by: "added", dir: "asc" })).slice(0, 2)).toEqual(["Jesse Pereira", "Brittany Pilz"]);
    expect(names(sortProspects(SEED, { by: "name", dir: "asc" })).slice(0, 2)).toEqual(["Anika Septimus", "Brittany Pilz"]);
    expect(sortProspects(SEED, { by: "company", dir: "desc" })[0].company).toBe("Warehouse Republic");
  });
});

describe("acting on a prospect", () => {
  it("approves, rejects and reverts", () => {
    const id = SEED.find((p) => p.name === "Gustavo Donin")!.id;
    const approved = decide(SEED, id, "approved");
    expect(approved.find((p) => p.id === id)?.status).toBe("approved");
    expect(decide(approved, id, "pending").find((p) => p.id === id)?.status).toBe("pending");
    expect(SEED.find((p) => p.id === id)?.status).toBe("pending");
  });

  it("records when it rejects a company, and forgets it once reverted", () => {
    const id = SEED.find((p) => p.name === "Gustavo Donin")!.id;
    const at = new Date(2026, 9, 17, 15, 12);
    const rejected = decide(SEED, id, "rejected", at);
    expect(rejected.find((p) => p.id === id)?.rejectedAt).toEqual(at);
    expect(decide(rejected, id, "pending").find((p) => p.id === id)?.rejectedAt).toBeUndefined();
  });

  it("deactivates a company as it is, and reactivates it as it was", () => {
    const byName = (list: typeof SEED, name: string) => list.find((p) => p.name === name)!;
    const zeus = byName(SEED, "Nolan Gouse");
    const at = new Date(2026, 9, 17, 15, 12);
    const deactivated = byName(deactivate(SEED, zeus.id, at), "Nolan Gouse");
    expect(deactivated).toEqual({ ...zeus, deactivatedAt: at, history: [...zeus.history, { status: "deactivated", by: SALES, at }] });
    expect(standing(deactivated)).toBe("deactivated");
    expect(standing(zeus)).toBe("onboarded");
    const back = byName(reactivate([deactivated], zeus.id), "Nolan Gouse");
    expect(back.deactivatedAt).toBeUndefined();
    expect(back.status).toBe("onboarded");
    expect(back.workspace).toBe(zeus.workspace);
  });

  it("deactivates one team, keeping its settings and the other teams", () => {
    const zeus = SEED.find((p) => p.name === "Nolan Gouse")!;
    const [mississauga, calgary] = deactivateTeam(SEED, zeus.id, 1).find((p) => p.id === zeus.id)!.workspace.teams;
    expect(mississauga).toBe(zeus.workspace.teams[0]);
    expect(calgary).toEqual({ ...zeus.workspace.teams[1], deactivated: true });
  });

  it("logs each status it moves to, by whoever in sales is signed in, with the note saying why", () => {
    const gustavo = SEED.find((p) => p.name === "Gustavo Donin")!;
    const at = new Date(2026, 9, 17, 15, 12);
    const rejected = decide(SEED, gustavo.id, "rejected", at, "Their sites are outside the cities we serve.");
    const pending = decide(rejected, gustavo.id, "pending", NOW);
    expect(pending.find((p) => p.id === gustavo.id)!.history.slice(1)).toEqual([
      { status: "rejected", text: "Their sites are outside the cities we serve.", by: SALES, at },
      { status: "pending", by: SALES, at: NOW },
    ]);
  });

  it("logs a company's deactivation with its note, then the status reactivating it brings back", () => {
    const zeus = SEED.find((p) => p.name === "Nolan Gouse")!;
    const at = new Date(2026, 9, 17, 15, 12);
    const back = reactivate(deactivate(SEED, zeus.id, at, "Their contract ended."), zeus.id, NOW);
    expect(back.find((p) => p.id === zeus.id)!.history.slice(-2)).toEqual([
      { status: "deactivated", text: "Their contract ended.", by: SALES, at },
      { status: "onboarded", by: SALES, at: NOW },
    ]);
  });

  it("logs a team's deactivation with its note, then its coming back", () => {
    const zeus = SEED.find((p) => p.name === "Nolan Gouse")!;
    const at = new Date(2026, 9, 17, 15, 12);
    const back = restoreTeam(deactivateTeam(SEED, zeus.id, 1, at, "Their Calgary site closed for the winter."), zeus.id, 1, NOW);
    const restored = back.find((p) => p.id === zeus.id)!;
    expect(restored.workspace.teams[1]).toEqual({ ...zeus.workspace.teams[1], deactivated: false });
    expect(restored.history.slice(-2)).toEqual([
      { status: "deactivated", team: "Dircks Logistics Calgary", text: "Their Calgary site closed for the winter.", by: SALES, at },
      { status: "onboarded", team: "Dircks Logistics Calgary", by: SALES, at: NOW },
    ]);
  });

  it("adds one by hand, pending and newest", () => {
    const list = addProspect(SEED, DRAFT, NOW);
    const added = list[0];
    expect(list).toHaveLength(11);
    expect(added).toMatchObject({
      name: "Jason Spooner",
      company: "ShipFusion",
      country: "canada",
      status: "pending",
      source: "Outreach",
      added: NOW,
      history: [{ status: "pending", by: SALES, at: NOW }],
      workspace: { flags: [], teams: [] },
    });
    expect(phoneText(added)).toBe("+1 (416) 555-0142");
  });

  it("edits one, keeping its state", () => {
    const paityn = SEED.find((p) => p.name === "Paityn Aminoff")!;
    const list = updateProspect(SEED, paityn.id, { ...draftOf(paityn), company: "Sleep Country Canada" });
    expect(list.find((p) => p.id === paityn.id)).toMatchObject({ company: "Sleep Country Canada", status: "approved" });
  });
});

describe("archiving what's rejected or deactivated", () => {
  const zeus = SEED.find((p) => p.name === "Nolan Gouse")!;
  const gustavo = SEED.find((p) => p.name === "Gustavo Donin")!;
  const at = new Date(2026, 9, 17, 15, 12);
  const after = (list: typeof SEED, id: string) => list.find((p) => p.id === id)!;

  it("archives a rejected or deactivated company six months to the day after", () => {
    expect(archivedOn(after(decide(SEED, gustavo.id, "rejected", at), gustavo.id))).toEqual(new Date(2027, 3, 17));
    expect(archivedOn(after(deactivate(SEED, zeus.id, at), zeus.id))).toEqual(new Date(2027, 3, 17));
  });

  it("archives a deactivated team six months after its own deactivation", () => {
    const later = deactivate(deactivateTeam(SEED, zeus.id, 1, at), zeus.id, new Date(2026, 10, 2, 9, 0));
    const company = after(later, zeus.id);
    expect(archivedOn(company, company.workspace.teams[1])).toEqual(new Date(2027, 3, 17));
    expect(archivedOn(company)).toEqual(new Date(2027, 4, 2));
  });

  it("falls on the month's last day when the sixth month is shorter", () => {
    expect(archivedOn(after(decide(SEED, gustavo.id, "rejected", new Date(2026, 7, 31, 9, 0)), gustavo.id))).toEqual(
      new Date(2027, 1, 28),
    );
  });

  it("archives nothing still active", () => {
    expect(archivedOn(zeus)).toBeUndefined();
    expect(archivedOn(zeus, zeus.workspace.teams[0])).toBeUndefined();
  });
});

describe("a company's notes and history", () => {
  const byCompany = (company: string) => SEED.find((p) => p.company === company)!;

  it("start pending review when it was added, by its contact, or by sales for one sales reached out to", () => {
    for (const p of SEED) expect(p.history[0]).toEqual({ status: "pending", by: p.source === "Outreach" ? SALES : p.name, at: p.added });
  });

  it("count every note and status change as one, in order, none yet to come", () => {
    expect(Object.fromEntries(SEED.map((p) => [p.company, noteCount(p)]))).toEqual({
      "GoodLeaf Farms": 2,
      "SaraLee": 1,
      "Warehouse Republic": 1,
      "Villaggio": 4,
      "SleepCountry": 2,
      "Dempster's": 4,
      "Dircks Logistics": 4,
      "IHL": 3,
      "North West Company": 4,
      CCLS: 3,
    });
    for (const p of SEED) {
      const times = p.history.map((entry) => entry.at.getTime());
      expect(times).toEqual(times.toSorted());
      expect(times.at(-1)!).toBeLessThanOrEqual(NOW.getTime());
      for (const entry of p.history) expect(entry.status || entry.text?.trim()).toBeTruthy();
    }
  });

  it("move each company to the status it has, a rejection with the note saying why, when it was rejected or signed up", () => {
    for (const p of SEED) expect(p.history.findLast((entry) => entry.status && !entry.team)!.status).toBe(p.status);
    for (const company of ["Villaggio", "IHL"]) {
      const { history, rejectedAt } = byCompany(company);
      const rejection = history.findLast((entry) => entry.status === "rejected")!;
      expect(rejection.at).toEqual(rejectedAt);
      expect(rejection.text).toBeTruthy();
    }
    for (const company of ["Dircks Logistics", "North West Company"]) {
      const { history, activeSince, name } = byCompany(company);
      expect(history.findLast((entry) => entry.status === "onboarded")).toEqual({ status: "onboarded", by: name, at: activeSince });
    }
  });

  it("take a note from whoever in sales is signed in", () => {
    const craig = byCompany("Dempster's");
    const list = addNote(SEED, craig.id, "Craig signed up for a demo.", NOW);
    const noted = list.find((p) => p.id === craig.id)!;
    expect(noted.history.at(-1)).toEqual({ text: "Craig signed up for a demo.", by: SALES, at: NOW });
    expect(noteCount(noted)).toBe(5);
    expect(noteCount(craig)).toBe(4);
  });

  it("date their bylines as SW Curie's Notes overlay does", () => {
    expect(noteAtText(new Date(2026, 9, 16, 21, 44))).toBe("Oct 16, 2026, 9:44 PM");
    expect(noteAtText(new Date(2026, 9, 5, 9, 5))).toBe("Oct 5, 2026, 9:05 AM");
  });
});

describe("a team's members", () => {
  const teamOf = (name: string) => SEED.flatMap((p) => p.workspace.teams).find((team) => team.name === name)!;

  it("are each team's own, its owner first, as many as its card counts", () => {
    const lantern = teamOf("North West Company Ottawa");
    expect(lantern.members.map((m) => ("invited" in m ? `${m.email} (invited)` : `${m.name}, ${m.role}`))).toEqual([
      "Brittany Pilz, Owner",
      "Allison George, Team Admin",
      "Kadin Baptista, Viewer",
      "phil.lubin@northwest.ca (invited)",
    ]);
    expect(membersText(lantern)).toBe("3 members");
    expect(membersText(teamOf("Dircks Logistics Mississauga"))).toBe("9 members");
    expect(membersText(teamOf("Dircks Logistics Calgary"))).toBe("5 members");
    for (const team of SEED.flatMap((p) => p.workspace.teams))
      expect(team.members.filter((m) => !("invited" in m) && m.role === "Owner")).toHaveLength(1);
  });

  it("hold the company app's own, CCLS, onboarded with its four teams, First Gulf first, and no requirement set yet", () => {
    const ccls = SEED.find((p) => p.company === "CCLS")!;
    expect(ccls.status).toBe("onboarded");
    expect(ccls.workspace.teams.map((t) => [t.name, t.address.label, requirementsText(t)])).toEqual([
      ["CCLS First Gulf", COMPANY_PLACE.label, "No requirement set"],
      ["CCLS White Hart", "6090 White Hart Lane, Mississauga, ON", "No requirement set"],
      ["CCLS Derwent", "101-1005 Derwent Way, Delta, BC", "No requirement set"],
      ["CCLS Thornton", "1180 Thornton Road, Oshawa, ON", "No requirement set"],
    ]);
    expect(teamRequirements(SEED)).toEqual([]);
    const set = SEED.map((p) =>
      p.company === "CCLS" ? { ...p, workspace: { ...p.workspace, teams: [{ ...p.workspace.teams[0], requirements: ["equipment:Gloves"] }] } } : p,
    );
    expect(teamRequirements(set)).toEqual(["equipment:Gloves"]);
  });

  it("hold the teams the company app switches between, leaving out a deactivated one", () => {
    const names = (list: typeof SEED) => appTeams(list).map((team) => team.name);
    expect(names(SEED)).toEqual(["CCLS First Gulf", "CCLS White Hart", "CCLS Derwent", "CCLS Thornton"]);
    const off = SEED.map((p) =>
      p.company === "CCLS"
        ? { ...p, workspace: { ...p.workspace, teams: p.workspace.teams.map((t) => ({ ...t, deactivated: t.name === "CCLS Derwent" })) } }
        : p,
    );
    expect(names(off)).toEqual(["CCLS First Gulf", "CCLS White Hart", "CCLS Thornton"]);
  });

  it("hold the company app's team, whose pool Manage worker pool lists, as Figma has it, and change it there alone", () => {
    expect(appTeam(SEED)?.pool).toEqual(["tashonda", "rayna", "angel", "aspen", "alejandro", "maria"]);
    expect(appTeam(SEED)?.favourites).toEqual(["tashonda", "angel"]);
    expect(appTeam(SEED)?.workerTags?.aspen).toEqual(["Afternoon Shift", "Weekends", "Dock Consolidation"]);
    const changed = updateAppTeam(SEED, (team) => ({ ...team, pool: ["jeff"] }));
    expect(appTeam(changed)?.pool).toEqual(["jeff"]);
    expect(changed.filter((p) => p.company !== "CCLS")).toEqual(SEED.filter((p) => p.company !== "CCLS"));
  });

  it("are found by name or email, whatever the case", () => {
    const { members } = teamOf("North West Company Ottawa");
    const emails = (query: string) => findMembers(members, query).map((m) => m.email);
    expect(emails("")).toHaveLength(4);
    expect(emails("kad")).toEqual(["kadin.b@northwest.ca"]);
    expect(emails("GEORGE")).toEqual(["a.george@northwest.ca"]);
    expect(emails("phil")).toEqual(["phil.lubin@northwest.ca"]);
    expect(emails("dircks")).toEqual([]);
  });

  it("change role one at a time", () => {
    const lantern = teamOf("North West Company Ottawa");
    const changed = withRole(lantern, "kadin.b@northwest.ca", "Editor");
    expect(changed.members[2]).toEqual({ ...lantern.members[2], role: "Editor" });
    expect(changed.members.filter((m, i) => m !== lantern.members[i])).toHaveLength(1);
  });

  it("are invited after the rest, each with their role, not counting till they join", () => {
    const lantern = teamOf("North West Company Ottawa");
    const invited = withInvites(lantern, [
      { email: "m.chen@northwest.ca", role: "Team Admin" },
      { email: "o.ward@northwest.ca", role: "Editor" },
    ]);
    expect(invited.members).toEqual([
      ...lantern.members,
      { email: "m.chen@northwest.ca", role: "Team Admin", invited: true },
      { email: "o.ward@northwest.ca", role: "Editor", invited: true },
    ]);
    expect(membersText(invited)).toBe(membersText(lantern));
  });

  it("turn an invite down that isn't an email, is on the team already, or was typed above it, passing empty ones", () => {
    const lantern = teamOf("North West Company Ottawa");
    const emails = [
      "",
      "m.chen@northwest",
      "m.chen@northwest.ca",
      " M.Chen@NorthWest.ca ",
      "KADIN.B@northwest.ca",
      "phil.lubin@northwest.ca",
      "o ward@northwest.ca",
      "  ",
    ];
    expect(failingInvites(lantern, emails)).toEqual([false, true, false, true, true, true, true, false]);
  });
});

describe("the prospect form", () => {
  it("is ready once a name, an email, a designation and a company are in", () => {
    expect(ready(emptyDraft())).toBe(false);
    expect(ready(DRAFT)).toBe(true);
    expect(ready({ ...DRAFT, phone: "" })).toBe(true);
    expect(ready({ ...DRAFT, company: "  " })).toBe(false);
    expect(ready({ ...DRAFT, email: "jason" })).toBe(false);
  });

  it("writes a phone number as it's typed", () => {
    expect(formatPhone("")).toBe("");
    expect(formatPhone("416")).toBe("(416)");
    expect(formatPhone("41655")).toBe("(416) 55");
    expect(formatPhone("4165550142")).toBe("(416) 555-0142");
  });
});

describe("a company's workspace", () => {
  const byName = (list: typeof SEED, name: string) => list.find((p) => p.name === name)!;

  it("is seeded for every company, with teams once it's onboarded, or set up by sales while it awaits sign-up", () => {
    expect(Object.fromEntries(SEED.map((p) => [p.company, p.workspace.teams.length]))).toEqual({
      "GoodLeaf Farms": 0,
      "SaraLee": 0,
      "Warehouse Republic": 0,
      "Villaggio": 0,
      "SleepCountry": 0,
      "Dempster's": 1,
      "Dircks Logistics": 2,
      "IHL": 0,
      "North West Company": 1,
      CCLS: 4,
    });
  });

  it("gives each team its own templates, each with its tags", () => {
    expect(Object.fromEntries(SEED.flatMap((p) => p.workspace.teams).map((team) => [team.name, team.templates]))).toEqual({
      "Dircks Logistics Mississauga": [
        { title: "Forklift Operator", tags: ["Manufacturing", "Warehouse", "Licensed"] },
        { title: "Container Associate", tags: ["Dockyard", "Loading"] },
        { title: "Reach Operator", tags: ["Licensed", "Reach Truck", "Warehouse"] },
        { title: "Offloader", tags: ["Loading", "Warehouse"] },
      ],
      "Dircks Logistics Calgary": [
        { title: "Forklift Operator", tags: ["Manufacturing", "Warehouse", "Licensed"] },
        { title: "Reach Operator", tags: ["Licensed", "Reach Truck", "Warehouse"] },
        { title: "Offloader", tags: ["Loading", "Warehouse"] },
      ],
      "North West Company Ottawa": [
        { title: "Receptionist", tags: ["Front Desk"] },
        { title: "Security Guard", tags: ["Security", "Licensed"] },
      ],
      "Dempster's Hamilton": [
        { title: "Production Line Associate", tags: ["Assembly Line", "Packing", "Food Production"] },
        { title: "Mixer Operator", tags: ["Manufacturing", "Food Production"] },
        { title: "Shipping Associate", tags: ["Loading", "Warehouse"] },
      ],
      // The company app's templates.
      "CCLS First Gulf": [
        { title: "Forklift Operator", tags: ["Licensed", "Warehouse", "Reach Truck", "Night Shift"] },
        { title: "General Labour", tags: ["Dockyard", "Warehouse"] },
        { title: "Picker Packer", tags: ["Assembly Line", "Packing", "Warehouse"] },
        { title: "Warehouse Manager", tags: ["Warehouse", "Loading", "Inventory"] },
      ],
      "CCLS White Hart": [],
      "CCLS Derwent": [],
      "CCLS Thornton": [],
    });
  });

  it("names a template apart from the team's others, numbering it from 2", () => {
    expect(uniqueTitle([], "Picker/Packer")).toBe("Picker/Packer");
    expect(uniqueTitle(["Receptionist"], "Picker/Packer")).toBe("Picker/Packer");
    expect(uniqueTitle(["Picker/Packer"], "Picker/Packer")).toBe("Picker/Packer 2");
    expect(uniqueTitle(["Picker/Packer", "Picker/Packer 2"], "Picker/Packer")).toBe("Picker/Packer 3");
    expect(uniqueTitle(["Picker/Packer", "Picker/Packer 3"], "Picker/Packer")).toBe("Picker/Packer 2");
  });

  it("copies a preset into a team's templates, named apart, its tags its own", () => {
    const picker = { title: "Picker/Packer", tags: ["Warehouse", "Packing"] };
    const once = withCopy([{ title: "Receptionist", tags: [] }], picker);
    const twice = withCopy(once, picker);
    expect(twice).toEqual([
      { title: "Receptionist", tags: [] },
      { title: "Picker/Packer", tags: ["Warehouse", "Packing"] },
      { title: "Picker/Packer 2", tags: ["Warehouse", "Packing"] },
    ]);
    expect(twice[1].tags).not.toBe(picker.tags);
  });

  it("records when each onboarded company signed up, after it was added", () => {
    expect(Object.fromEntries(SEED.filter((p) => p.activeSince).map((p) => [p.company, p.activeSince]))).toEqual({
      "Dircks Logistics": new Date(2026, 9, 16, 9, 32),
      "North West Company": new Date(2026, 9, 15, 15, 48),
      CCLS: new Date(2025, 8, 2, 9, 15),
    });
    expect(SEED.every((p) => !p.activeSince || p.activeSince > p.added)).toBe(true);
  });

  it("records when each rejected company was rejected, after it was added, and has none deactivated", () => {
    expect(Object.fromEntries(SEED.filter((p) => p.rejectedAt).map((p) => [p.company, p.rejectedAt]))).toEqual({
      "Villaggio": new Date(2026, 9, 16, 10, 24),
      "IHL": new Date(2026, 9, 15, 16, 5),
    });
    expect(SEED.every((p) => (p.status === "rejected") === !!p.rejectedAt)).toBe(true);
    expect(SEED.every((p) => !p.rejectedAt || p.rejectedAt > p.added)).toBe(true);
    expect(SEED.some((p) => p.deactivatedAt)).toBe(false);
  });

  it("is kept through every decision", () => {
    const gustavo = byName(SEED, "Gustavo Donin");
    let list = SEED;
    for (const status of ["approved", "pending", "rejected", "pending"] as const) {
      list = decide(list, gustavo.id, status);
      expect(byName(list, "Gustavo Donin").workspace).toBe(gustavo.workspace);
    }
  });

  it("changes a setting, leaving the rest", () => {
    const paityn = byName(SEED, "Paityn Aminoff");
    const list = updateWorkspace(SEED, paityn.id, (workspace) => ({ ...workspace, flags: ["geofencing"] }));
    expect(list.find((p) => p.id === paityn.id)?.workspace).toEqual({ ...paityn.workspace, flags: ["geofencing"] });
    expect(SEED.find((p) => p.id === paityn.id)?.workspace).toBe(paityn.workspace);
  });

  it("turns a feature flag on or off, keeping the flags in Manage feature flags' order", () => {
    expect(withFlag(["checkInCodes"], "betaDashboard", true)).toEqual(["betaDashboard", "checkInCodes"]);
    expect(withFlag(["betaDashboard", "checkInCodes"], "betaDashboard", false)).toEqual(["checkInCodes"]);
    expect(withFlag(["geofencing"], "geofencing", true)).toEqual(["geofencing"]);
  });

  it("reads as Figma writes it", () => {
    const member = (i: number): Member => ({ name: `Member ${i}`, email: `member${i}@ccls.ca`, role: "Viewer" });
    const team = {
      name: "CCLS First Gulf",
      address: { id: "bloor", label: "2 Bloor Street West, Toronto, ON", city: "Toronto", lat: 43.6704, lng: -79.3868 },
      zone: "(GMT-5) Eastern Standard Time (EST)",
      members: [...Array.from({ length: 7 }, (_, i) => member(i)), { email: "new@ccls.ca", role: "Viewer" as const, invited: true as const }],
      templates: Array.from({ length: 3 }, (_, i) => ({ title: `Template ${i}`, tags: [] })),
      pool: ["maria", "aspen"],
      checkInCodes: true,
    };
    expect(teamLine(team)).toBe("Toronto • (GMT-5) Eastern Standard Time (EST)");
    expect(membersText(team)).toBe("7 members");
    expect(templatesText(team)).toBe("3 templates");
    expect(poolText(team)).toBe("2 workers");
    expect(poolText({ ...team, pool: ["maria"] })).toBe("1 worker");
    expect(membersText({ ...team, members: [member(0)] })).toBe("1 member");
    expect(templatesText({ ...team, templates: team.templates.slice(0, 1) })).toBe("1 template");
    expect(flagsText(3)).toBe("3 flags enabled");
    expect(flagsText(1)).toBe("1 flag enabled");
    expect(flagsText(0)).toBe("No flag enabled");
    expect(notesText(2)).toBe("2 notes");
    expect(notesText(1)).toBe("1 note");
    expect(notesText(0)).toBe("No note added");
    expect(requirementsText(team)).toBe("No requirement set");
    expect(requirementsText({ ...team, requirements: ["equipment:Gloves"] })).toBe("1 requirement set");
    expect(requirementsText({ ...team, requirements: ["equipment:Gloves", "physical:Standing"] })).toBe("2 requirements set");
  });

  it("edits the company's name and logo, keeping its contact and workspace", () => {
    const nolan = byName(SEED, "Nolan Gouse");
    const edited = byName(updateCompany(SEED, nolan.id, { company: "Dircks Moving & Logistics", logo: "blob:dircks" }), "Nolan Gouse");
    expect(edited).toEqual({ ...nolan, company: "Dircks Moving & Logistics", logo: "blob:dircks" });
    expect(edited.workspace).toBe(nolan.workspace);
  });

  describe("its teams", () => {
    const BRAMPTON = { id: "first-gulf", label: "250 First Gulf Boulevard, Brampton, ON", city: "Brampton", lat: 43.675, lng: -79.7144 };
    const details = { name: "Dircks Logistics Brampton", address: BRAMPTON, zone: TIMEZONES[2], logo: "blob:dircks" };

    it("adds a team owned by the company's contact, with no templates and check-in codes off", () => {
      const nolan = byName(SEED, "Nolan Gouse");
      const teams = byName(addTeam(SEED, nolan.id, details), "Nolan Gouse").workspace.teams;
      expect(teams.slice(0, -1)).toEqual(nolan.workspace.teams);
      expect(teams.at(-1)).toEqual({
        ...details,
        members: [{ name: "Nolan Gouse", email: nolan.email, role: "Owner" }],
        templates: [],
        pool: [],
        checkInCodes: false,
      });
      expect(teamLine(teams.at(-1)!)).toBe("Brampton • (GMT-5) Eastern Standard Time (EST)");
    });

    it("edits a team's name, address, timezone and logo, keeping its members, templates and settings", () => {
      const nolan = byName(SEED, "Nolan Gouse");
      const [mississauga, calgary] = nolan.workspace.teams;
      const teams = byName(updateTeam(SEED, nolan.id, 1, details), "Nolan Gouse").workspace.teams;
      expect(teams[0]).toBe(mississauga);
      expect(teams[1]).toEqual({ ...calgary, ...details });
      expect(byName(updateTeam(SEED, nolan.id, 1, { ...details, logo: undefined }), "Nolan Gouse").workspace.teams[1].logo).toBeUndefined();
    });

    it("deletes a team, leaving the others and the company's history as they were", () => {
      const nolan = byName(SEED, "Nolan Gouse");
      const [mississauga] = nolan.workspace.teams;
      const deleted = byName(deleteTeam(SEED, nolan.id, 1), "Nolan Gouse");
      expect(deleted.workspace.teams).toEqual([mississauga]);
      expect(deleted.workspace.flags).toBe(nolan.workspace.flags);
      expect(deleted.history).toBe(nolan.history);
    });

    it("offers North America's timezones, east to west, as Figma writes them", () => {
      expect(TIMEZONES).toEqual([
        "(GMT-3:30) Newfoundland Standard Time (NST)",
        "(GMT-4) Atlantic Standard Time (AST)",
        "(GMT-5) Eastern Standard Time (EST)",
        "(GMT-6) Central Standard Time (CST)",
        "(GMT-7) Mountain Standard Time (MST)",
        "(GMT-8) Pacific Standard Time (PST)",
        "(GMT-9) Alaska Standard Time (AKST)",
        "(GMT-10) Hawaii-Aleutian Standard Time (HST)",
      ]);
      expect(SEED.flatMap((p) => p.workspace.teams).every((team) => TIMEZONES.includes(team.zone) && team.address.city)).toBe(true);
    });

    it("finds an address's timezone among them by its standard time, whether or not it keeps daylight time", () => {
      const at = (timezone?: string) => zoneAt({ ...COMPANY_PLACE, timezone });
      expect(
        [
          "America/St_Johns",
          "America/Halifax",
          "America/Toronto",
          "America/New_York",
          "America/Regina",
          "America/Chicago",
          "America/Phoenix",
          "America/Edmonton",
          "America/Vancouver",
          "America/Anchorage",
          "Pacific/Honolulu",
        ].map(at),
      ).toEqual([TIMEZONES[0], TIMEZONES[1], TIMEZONES[2], TIMEZONES[2], TIMEZONES[3], TIMEZONES[3], TIMEZONES[4], TIMEZONES[4], TIMEZONES[5], TIMEZONES[6], TIMEZONES[7]]);
      expect([at("Europe/London"), at(undefined), at("Not/A_Zone")]).toEqual([undefined, undefined, undefined]);
    });
  });
});
