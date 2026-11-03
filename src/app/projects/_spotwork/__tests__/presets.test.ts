import { describe, expect, it } from "vitest";
import { PRESETS } from "../copy";
import {
  CERTIFICATES,
  CHOICES,
  DESCRIPTION_LIMIT,
  EQUIPMENT,
  PHYSICAL_REQUIREMENTS,
  SKILLS,
  WORKING_CONDITIONS,
  addPreset,
  charactersLeft,
  draftOfPreset,
  duplicateOf,
  emptyPresetDraft,
  listPresets,
  listed,
  openingStep,
  keyOf,
  pickedKeys,
  picksFrom,
  presetsSeed,
  removePreset,
  stepsReady,
  updatePreset,
  type PresetDraft,
} from "../presets";

const SEED = presetsSeed();
const titles = (list: { title: string }[]) => list.map((p) => p.title);
const ALL = { query: "", status: "all" } as const;

const DRAFT: PresetDraft = {
  ...emptyPresetDraft(),
  title: "  Shipping Clerk ",
  tags: ["Logistics"],
  skills: ["Data Entry", "Delivery"],
  requirements: { equipment: ["Closed Toe Shoes"], physical: null, certificates: [], conditions: null },
  description: "Checks outbound orders against their packing slips.",
};

describe("the template presets", () => {
  it("are Figma's seventeen, in New company's order", () => {
    expect(titles(SEED)).toEqual([
      "Warehouse Associate",
      "Forklift Operator",
      "Grooming Agent",
      "Warehouse Supervisor",
      "Picker/Packer",
      "Container Associate",
      "Vertical Farming Technician",
      "Oven Operator",
      "Bakery Production",
      "Sanitation Worker",
      "Outbound Coordinator",
      "Receptionist",
      "Decanter",
      "Cashier",
      "Reach Operator",
      "Carpenter",
      "Offloader",
    ]);
    expect(new Set(SEED.map((p) => p.id)).size).toBe(17);
  });

  it("list as Manage Template Presets does: the active ones A–Z, then the drafts", () => {
    expect(titles(listPresets(SEED, ALL))).toEqual([
      "Bakery Production",
      "Carpenter",
      "Container Associate",
      "Decanter",
      "Forklift Operator",
      "Oven Operator",
      "Picker/Packer",
      "Reach Operator",
      "Receptionist",
      "Sanitation Worker",
      "Vertical Farming Technician",
      "Warehouse Associate",
      "Cashier",
      "Grooming Agent",
      "Offloader",
      "Outbound Coordinator",
      "Warehouse Supervisor",
    ]);
  });

  it("narrow by status and by what's typed", () => {
    expect(titles(listPresets(SEED, { query: "", status: "draft" }))).toHaveLength(5);
    expect(listPresets(SEED, { query: "", status: "active" }).every((p) => p.status === "active")).toBe(true);
    expect(titles(listPresets(SEED, { query: " WARE", status: "all" }))).toEqual([
      "Warehouse Associate",
      "Warehouse Supervisor",
    ]);
    expect(titles(listPresets(SEED, { query: "ware", status: "draft" }))).toEqual(["Warehouse Supervisor"]);
  });

  it("hold Figma's Forklift Operator in full", () => {
    const forklift = SEED.find((p) => p.title === "Forklift Operator")!;
    expect(forklift).toMatchObject({
      tags: ["Manufacturing", "Warehouse", "Licensed"],
      skills: ["Clamp Truck", "Driver", "General Labourer", "Manufacturing"],
      requirements: {
        equipment: [
          "5-Panel Drug Screen",
          "Basic Life Support Certification",
          "Bilingual—English/French",
          "Ontario Drivers' License-Class 5",
        ],
        certificates: ["COVID-19 Safety Certificate", "Workplace Hazardous Material Information System (WHMIS) Certificate"],
      },
    });
    expect(forklift.description).toMatch(/^The person would be responsible/);
  });

  it("give every active one each step filled in, the drafts not", () => {
    expect(SEED.filter((p) => p.status === "active").every((p) => stepsReady(p).at(-1))).toBe(true);
    expect(SEED.filter((p) => p.status === "draft").some((p) => stepsReady(p).at(-1))).toBe(false);
  });
});

describe("the choices a preset picks from", () => {
  it("are Figma's lists, its skills with Agriculture and Food Processing added", () => {
    expect(SKILLS).toHaveLength(27);
    expect([SKILLS[0], SKILLS.at(-1)]).toEqual(["Agriculture", "Sales Associate"]);
    expect(SKILLS).toContain("Food Processing");
    expect(SKILLS).toEqual([...SKILLS].sort());
    // Figma's 25 chips, cut off at Driver's, and the Ontario licence its review shows.
    expect(EQUIPMENT).toHaveLength(26);
    expect([EQUIPMENT[0], EQUIPMENT.at(-1)]).toEqual(["5-Panel Drug Screen", "Ontario Drivers' License-Class 5"]);
    expect(PHYSICAL_REQUIREMENTS).toHaveLength(16);
    expect(CERTIFICATES).toHaveLength(6);
    expect(WORKING_CONDITIONS).toHaveLength(12);
  });

  it("give every seeded preset at least one skill", () => {
    for (const preset of SEED) {
      expect(preset.skills.length, preset.title).toBeGreaterThan(0);
      expect(preset.skills.every((skill) => SKILLS.includes(skill)), preset.title).toBe(true);
    }
  });

  it("hold every pick the seed makes", () => {
    const forklift = SEED.find((p) => p.title === "Forklift Operator")!;
    expect(forklift.skills.every((skill) => SKILLS.includes(skill))).toBe(true);
    expect(forklift.requirements.equipment!.every((e) => EQUIPMENT.includes(e))).toBe(true);
    expect(forklift.requirements.certificates!.every((c) => CERTIFICATES.includes(c))).toBe(true);
  });

  it("list as one table, every skill, then each requirement in the form's order", () => {
    const lists = [SKILLS, EQUIPMENT, PHYSICAL_REQUIREMENTS, CERTIFICATES, WORKING_CONDITIONS];
    expect(CHOICES.map(({ name }) => name)).toEqual(lists.flat());
    expect([...new Set(CHOICES.map(({ kind }) => kind))]).toEqual(["skill", "equipment", "physical", "certificates", "conditions"]);
  });

  it("are the table's values by kind and name, so a name in two lists is two values", () => {
    const whmis = CHOICES.filter(({ name }) => /whmis/i.test(name)).map(keyOf);
    expect(whmis).toHaveLength(2);
    expect(new Set(whmis).size).toBe(2);
  });

  it("go into the draft's lists in the table's order from the table's values, a list left empty none at all", () => {
    const empty = emptyPresetDraft();
    expect(pickedKeys(empty)).toEqual([]);
    const picks = picksFrom(["equipment:Closed Toe Shoes", "skill:Delivery", "equipment:5-Panel Drug Screen"]);
    expect(picks).toEqual({
      skills: ["Delivery"],
      requirements: { ...empty.requirements, equipment: ["5-Panel Drug Screen", "Closed Toe Shoes"] },
    });
    expect(pickedKeys(picks)).toEqual(["skill:Delivery", "equipment:5-Panel Drug Screen", "equipment:Closed Toe Shoes"]);
    expect(picksFrom(["skill:Delivery"]).requirements).toEqual(empty.requirements);
  });
});

describe("a preset's draft", () => {
  it("moves on a step once that step is filled in, Address & wage asking for nothing", () => {
    const empty = emptyPresetDraft();
    expect(stepsReady(empty)).toEqual([false, true, false, false, false]);
    expect(stepsReady({ ...empty, title: " " })[0]).toBe(false);
    expect(stepsReady({ ...empty, title: "Shipping Clerk" })).toEqual([true, true, false, false, false]);
    expect(stepsReady({ ...empty, skills: ["Driver"] })[2]).toBe(true);
    expect(stepsReady({ ...empty, description: "Loads trucks." })[3]).toBe(true);
    expect(stepsReady(DRAFT)).toEqual([true, true, true, true, true]);
  });

  it("opens on its first step left unfinished, or its review once every one is filled in", () => {
    expect(openingStep([false, false, false, false])).toBe(0);
    expect(openingStep([true, false, false, false])).toBe(1);
    expect(openingStep([true, true, false, false])).toBe(2);
    expect(openingStep([true, true, true, true])).toBe(3);
  });

  it("counts down the job description's characters", () => {
    expect(DESCRIPTION_LIMIT).toBe(3000);
    expect(charactersLeft("")).toBe(3000);
    expect(charactersLeft("Loads trucks.")).toBe(2987);
  });

  it("lists only the requirements that are switched on and picked", () => {
    expect(listed(DRAFT.requirements)).toEqual([["equipment", ["Closed Toe Shoes"]]]);
  });
});

describe("Generate job description", () => {
  it("restates the draft in the copywriter's sentences", () => {
    const forklift = SEED.find((p) => p.title === "Forklift Operator")!;
    expect(PRESETS.description(draftOfPreset(forklift))).toBe(
      "The worker would fill the Forklift Operator role. They would need Clamp Truck, Driver, General Labourer and Manufacturing skills. The role requires 5-Panel Drug Screen, Basic Life Support Certification, Bilingual—English/French and Ontario Drivers' License-Class 5. The worker must possess a valid COVID-19 Safety Certificate and Workplace Hazardous Material Information System (WHMIS) Certificate.",
    );
  });

  it("drops what the draft leaves out", () => {
    expect(
      PRESETS.description({
        ...emptyPresetDraft(),
        title: "Shipping Clerk",
        skills: ["Data Entry"],
        requirements: { equipment: [], physical: ["Standing", "Walking"], certificates: null, conditions: null },
      }),
    ).toBe(
      "The worker would fill the Shipping Clerk role. They would need Data Entry skills. Physical requirements include Standing and Walking.",
    );
  });
});

describe("saving a preset", () => {
  const NOW = new Date(2026, 9, 18, 9, 30);

  it("adds it last, trimmed, in the status it's saved as", () => {
    const list = addPreset(SEED, DRAFT, "active", NOW);
    expect(list).toHaveLength(18);
    expect(list.at(-1)).toMatchObject({ title: "Shipping Clerk", status: "active", tags: ["Logistics"] });
    expect(titles(listPresets(list, ALL)).indexOf("Shipping Clerk")).toBe(10);
    expect(addPreset(SEED, DRAFT, "draft", NOW).at(-1)!.status).toBe("draft");
  });

  it("keeps which requirements are switched off", () => {
    const added = addPreset(SEED, DRAFT, "active", NOW).at(-1)!;
    expect(added.requirements).toEqual({ equipment: ["Closed Toe Shoes"], physical: null, certificates: [], conditions: null });
  });

  it("updates one in place", () => {
    const cashier = SEED.find((p) => p.title === "Cashier")!;
    const list = updatePreset(SEED, cashier.id, { ...draftOfPreset(cashier), title: "Head Cashier" }, "active");
    expect(list.findIndex((p) => p.id === cashier.id)).toBe(SEED.indexOf(cashier));
    expect(list.find((p) => p.id === cashier.id)).toMatchObject({ title: "Head Cashier", status: "active" });
  });

  it("removes one", () => {
    const cashier = SEED.find((p) => p.title === "Cashier")!;
    expect(titles(removePreset(SEED, cashier.id))).not.toContain("Cashier");
  });

  it("duplicates one as a new draft without its title", () => {
    const forklift = SEED.find((p) => p.title === "Forklift Operator")!;
    const copy = duplicateOf(forklift);
    expect(copy.title).toBe("");
    expect(copy).toMatchObject({ tags: forklift.tags, skills: forklift.skills, description: forklift.description });
    copy.skills.push("Cook");
    copy.tags.push("Bakery");
    expect(forklift.skills).not.toContain("Cook");
    expect(forklift.tags).not.toContain("Bakery");
  });
});
