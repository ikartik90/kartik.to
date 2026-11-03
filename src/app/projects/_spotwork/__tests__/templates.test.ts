import { describe, expect, it } from "vitest";
import { COMPANY_TEMPLATES } from "../copy";
import { SKILLS, addPreset, emptyPresetDraft, updatePreset, draftOfPreset } from "../presets";
import { TEMPLATES, addDays, seedSeries } from "../shifts";
import { COMPANY_PLACE, entranceAt } from "../geo";
import { activeShifts, newTemplateDraft, shiftTemplates, templatesSeed } from "../templates";

const TODAY = "2025-12-03";
const SEED = templatesSeed();

describe("the company's templates", () => {
  it("are the Shifts page's four, active, then Manage Templates' two drafts", () => {
    expect(SEED.map((t) => [t.title, t.status])).toEqual([
      ["Forklift Operator", "active"],
      ["General Labour", "active"],
      ["Picker Packer", "active"],
      ["Warehouse Manager", "active"],
      ["Warehouse Associate", "draft"],
      ["Warehouse Supervisor", "draft"],
    ]);
    expect(SEED.slice(0, 4).map((t) => t.id)).toEqual(TEMPLATES.map((t) => t.id));
    expect(new Set(SEED.map((t) => t.id)).size).toBe(6);
  });

  it("each pick at least one skill", () => {
    for (const template of SEED) {
      expect(template.skills.length, template.title).toBeGreaterThan(0);
      expect(template.skills.every((skill) => SKILLS.includes(skill)), template.title).toBe(true);
    }
  });

  it("count the shifts still running for each", () => {
    const series = seedSeries(TODAY);
    expect(activeShifts(series, "forklift", TODAY)).toBe(2);
    expect(activeShifts(series, "manager", TODAY)).toBe(1);
    expect(activeShifts(series, "nobody", TODAY)).toBe(0);
    // One whose days have all gone isn't.
    expect(activeShifts([{ ...series[0], dates: [addDays(TODAY, -1)] }], "forklift", TODAY)).toBe(0);
  });

  it("offer New shift the active ones, with the details a shift takes", () => {
    const draft = { ...newTemplateDraft(), title: "Shipping Clerk", tags: ["Logistics"], skills: ["Delivery"] };
    const offered = shiftTemplates(addPreset(SEED, draft, "active", new Date(2025, 11, 3)));
    expect(offered.map((t) => t.name)).toEqual([
      "Forklift Operator",
      "General Labour",
      "Picker Packer",
      "Warehouse Manager",
      "Shipping Clerk",
    ]);
    expect(offered[0]).toEqual(TEMPLATES[0]);
    // A new one is at the company's address; the rest of what a shift shows is blank.
    expect(offered.at(-1)).toMatchObject({
      name: "Shipping Clerk",
      address: TEMPLATES[0].address,
      unit: "",
      directions: "",
      wage: "",
      tags: ["Logistics"],
    });
  });

  it("start a new one at the company's address, where a preset starts blank", () => {
    expect(newTemplateDraft().address).toEqual(COMPANY_PLACE);
    expect(COMPANY_PLACE.label).toBe(TEMPLATES[0].address);
    expect(emptyPresetDraft().address).toBeNull();
    expect(SEED.every((template) => template.address?.id === COMPANY_PLACE.id)).toBe(true);
  });

  it("stand their pins at CCLS's entrance, a new one's too", () => {
    const entrance = entranceAt(COMPANY_PLACE);
    expect(entrance).not.toBeNull();
    expect(SEED.every((template) => template.entrance === entrance)).toBe(true);
    expect(newTemplateDraft().entrance).toBe(entrance);
    expect(TEMPLATES.every((template) => template.entrance === entrance)).toBe(true);
  });

  it("carry the address and wage the form gives them into New shift", () => {
    const draft = {
      ...newTemplateDraft(),
      title: "Shipping Clerk",
      skills: ["Delivery"],
      unit: "Dock 4",
      directions: "Ring at the side door",
      wage: "25.00",
    };
    expect(shiftTemplates(addPreset(SEED, draft, "active", new Date(2025, 11, 3))).at(-1)).toMatchObject({
      address: COMPANY_PLACE.label,
      unit: "Dock 4",
      directions: "Ring at the side door",
      wage: "CAD 25.00",
    });
    const blank = { ...emptyPresetDraft(), title: "Nowhere", skills: ["Delivery"] };
    expect(shiftTemplates(addPreset(SEED, blank, "active", new Date(2025, 11, 3))).at(-1)).toMatchObject({ address: "", wage: "" });
  });

  it("carry the address's place and its geofence into New shift, for its card's map", () => {
    const fence = [
      { lat: 43.6756, lng: -79.7151 },
      { lat: 43.6757, lng: -79.7135 },
      { lat: 43.6744, lng: -79.7134 },
    ];
    const forklift = SEED[0];
    const fenced = updatePreset(SEED, forklift.id, { ...draftOfPreset(forklift), geofence: fence, entrance: fence[1] }, "active");
    expect(shiftTemplates(fenced)[0]).toMatchObject({ place: COMPANY_PLACE, geofence: fence, entrance: fence[1] });
    expect(shiftTemplates(SEED)[1]).toMatchObject({ place: COMPANY_PLACE, geofence: null, entrance: entranceAt(COMPANY_PLACE) });
    const blank = { ...emptyPresetDraft(), title: "Nowhere", skills: ["Delivery"] };
    expect(shiftTemplates(addPreset(SEED, blank, "active", new Date(2025, 11, 3))).at(-1)).toMatchObject({ place: null, geofence: null });
  });

  it("carry an edit into New shift", () => {
    const forklift = SEED[0];
    const renamed = updatePreset(SEED, forklift.id, { ...draftOfPreset(forklift), title: "Forklift Driver" }, "active");
    expect(shiftTemplates(renamed)[0]).toMatchObject({ name: "Forklift Driver", unit: "Unit 308" });
  });
});

describe("a template card's pill", () => {
  it("counts its active shifts in Figma's words", () => {
    expect(COMPANY_TEMPLATES.activeShifts(0)).toBe("No Active Shifts");
    expect(COMPANY_TEMPLATES.activeShifts(1)).toBe("1 Active Shift");
    expect(COMPANY_TEMPLATES.activeShifts(6)).toBe("6 Active Shifts");
  });
});
