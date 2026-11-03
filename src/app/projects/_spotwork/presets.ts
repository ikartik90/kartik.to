// The template presets sales copies to a new company (SW Curie's Manage Template Presets, 25595:60582), and the
// four-step Create a Template Preset that makes them (25600:66992…67034).

import { PRESETS } from "./copy";
import type { Geofence, LatLng, Place } from "./geofence";

export type PresetStatus = "active" | "draft";

export type Requirement = "equipment" | "physical" | "certificates" | "conditions";

export interface Preset {
  id: string;
  title: string;
  /** What the Shifts page groups and filters it by, as its chips. */
  tags: string[];
  offSite: boolean;
  skills: string[];
  /** Address & Wage's: blank on a preset until one's picked, a company's template starting at its address. */
  address: Place | null;
  unit: string;
  directions: string;
  /** CAD, as typed. */
  wage: string;
  /** The building's outline on the address's map, or `null` until the map draws its default. */
  geofence: Geofence | null;
  /** Where the building's entered, its pin, dragged along the outline; `null` for the wall nearest the address. */
  entrance: LatLng | null;
  /** Each list's picks, or `null` with none. */
  requirements: Record<Requirement, string[] | null>;
  description: string;
  status: PresetStatus;
}

export type PresetDraft = Omit<Preset, "id" | "status">;

export interface PresetFilter {
  query: string;
  status: PresetStatus | "all";
}

export const DESCRIPTION_LIMIT = 3000;

// Figma's lists: the skills from the preset's step 2, with Agriculture and Food Processing added, the rest from Create a
// Position (5062:9496) and Mandatory Requirements (13359:33993).
export const SKILLS = [
  "Agriculture",
  "Assembly",
  "Bartender",
  "Brand Ambassador",
  "Carpenter",
  "Cashier",
  "Clamp Truck",
  "Cleaning Services",
  "Construction",
  "Contracting",
  "Cook",
  "Customer Service",
  "Data Entry",
  "Delivery",
  "Driver",
  "Event Worker",
  "Food Processing",
  "General Labourer",
  "Greeter",
  "Healthcare",
  "Hospitality",
  "Host/Hostess",
  "Landscaper",
  "Manufacturing",
  "Nursing",
  "PSW",
  "Sales Associate",
];

export const EQUIPMENT = [
  "5-Panel Drug Screen",
  "Alberta Driver Abstract",
  "Alberta Driver License—Class 1",
  "Alberta Driver License—Class 5",
  "AZ License",
  "Basic Life Support Certification",
  "Bilingual—English/French",
  "Black Informal Pants",
  "Black Informal Shift",
  "Black Pressed Dress Pants",
  "Black Pressed Dress Shirt",
  "Black Pressed Tie",
  "Black Pressed Vest",
  "Black Shoes",
  "Black Shoes (Polishable/Shiny)",
  "British Columbia Driver Abstract",
  "British Columbia Driver License—Class 1",
  "British Columbia Driver License—Class 3",
  "British Columbia Driver License—Class 5",
  "Closed Toe Shoes",
  "Confidentiality Form—IHL",
  "Consent for C, U, D, PI—IHL",
  "COVID-19 Vaccination (2 Doses)",
  "Driver's Abstract",
  "Driver's License (G2 or Above)",
  "Ontario Drivers' License-Class 5",
];

export const PHYSICAL_REQUIREMENTS = [
  "Standing",
  "Walking",
  "Bending Over",
  "Lifting Weights up to 15 kg",
  "Lifting Weights up to 30 kg",
  "Sitting for Long Hours",
  "Crouching",
  "Crawling into Tight Spaces",
  "Skating on Rollerblades",
  "Twisting",
  "Leaping up to 0.75 m",
  "Climbing up to 100 Stairs",
  "Swimming",
  "Holding Breath Underwater up to 1 minute",
  "Pushing Weights up to 50 kg",
  "Balancing Multiple Plates Simultaneously",
];

export const CERTIFICATES = [
  "COVID-19 Safety Certificate",
  "Criminal Background Check",
  "Good Manufacturing Practices Certificate",
  "Health & Safety Certificate",
  "Workplace Hazardous Material Information System (WHMIS) Certificate",
  "Workplace Violence & Harassment Certificate",
];

export const WORKING_CONDITIONS = [
  "Handling Inflammable Material",
  "Working with Industrial Chemicals",
  "Wheelchair Accessible",
  "Working with Power Tools",
  "Workplace Hazardous Material Information System (WHMIS) Certificate",
  "Heavy Machinery",
  "Handling Bio-hazardous Material",
  "Working in High Temperature Environment",
  "High-voltage Equipment",
  "Proximity to Wild Animals",
  "Exposure to Pollens",
  "Exposure to Fertilizers",
];

/** What a skill or requirement is: a skill, or the requirement list it's in. */
export type Kind = "skill" | Requirement;

export interface Choice {
  kind: Kind;
  name: string;
}

const LISTS: [Kind, string[]][] = [
  ["skill", SKILLS],
  ["equipment", EQUIPMENT],
  ["physical", PHYSICAL_REQUIREMENTS],
  ["certificates", CERTIFICATES],
  ["conditions", WORKING_CONDITIONS],
];

/** Skills & requirements' table: every skill, then each requirement list, in the form's order. */
export const CHOICES: Choice[] = LISTS.flatMap(([kind, names]) => names.map((name) => ({ kind, name })));

/** A choice's value in Skills & requirements' table: its kind and name, as a name can be in two lists. */
export const keyOf = ({ kind, name }: Choice) => `${kind}:${name}`;

type Picks = Pick<PresetDraft, "skills" | "requirements">;

const picksOf = (draft: Picks, kind: Kind) => (kind === "skill" ? draft.skills : draft.requirements[kind]) ?? [];

/** The draft's picks as the table's values. */
export const pickedKeys = (draft: Picks) =>
  CHOICES.filter((choice) => picksOf(draft, choice.kind).includes(choice.name)).map(keyOf);

/** The draft's lists from the table's values, each in the table's order; a requirement list left empty, `null`. */
export function picksFrom(keys: string[]): Picks {
  const names = (kind: Kind) => CHOICES.filter((choice) => choice.kind === kind && keys.includes(keyOf(choice))).map(({ name }) => name);
  const requirements = Object.fromEntries(
    LISTS.slice(1).map(([kind]) => [kind, names(kind).length ? names(kind) : null]),
  ) as Picks["requirements"];
  return { skills: names("skill"), requirements };
}

const NO_REQUIREMENTS: Preset["requirements"] = { equipment: null, physical: null, certificates: null, conditions: null };

// Figma's names in New company's order (25603:74372); Manage Template Presets marks these five drafts.
const NAMES = [
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
];
const DRAFTS = ["Grooming Agent", "Warehouse Supervisor", "Outbound Coordinator", "Cashier", "Offloader"];

// The presets' tags, from the copywriter, mostly in the company templates' words; three have none. Forklift Operator's
// first is Figma's department.
const TAGS_OF: Record<string, string[]> = {
  "Warehouse Associate": ["Warehouse", "Assembly Line"],
  "Forklift Operator": ["Manufacturing", "Warehouse", "Licensed"],
  "Warehouse Supervisor": ["Warehouse", "Manufacturing"],
  "Picker/Packer": ["Warehouse", "Packing", "Assembly Line"],
  "Container Associate": ["Dockyard", "Loading"],
  "Vertical Farming Technician": ["Agriculture"],
  "Oven Operator": ["Manufacturing", "Food Production"],
  "Bakery Production": ["Manufacturing", "Food Production", "Assembly Line"],
  "Outbound Coordinator": ["Warehouse", "Loading"],
  Receptionist: ["Front Desk"],
  Decanter: ["Manufacturing"],
  Cashier: ["Retail"],
  "Reach Operator": ["Licensed", "Reach Truck", "Warehouse"],
  Offloader: ["Loading", "Warehouse"],
};

const SKILLS_OF: Record<string, string[]> = {
  "Warehouse Associate": ["General Labourer", "Assembly", "Data Entry"],
  "Grooming Agent": ["Cleaning Services", "General Labourer"],
  "Warehouse Supervisor": ["General Labourer", "Data Entry", "Manufacturing"],
  "Picker/Packer": ["Food Processing", "Manufacturing"],
  "Container Associate": ["General Labourer", "Delivery"],
  "Vertical Farming Technician": ["Agriculture", "Food Processing"],
  "Oven Operator": ["Cook", "Manufacturing"],
  "Bakery Production": ["Cook", "Manufacturing", "Assembly"],
  "Sanitation Worker": ["Cleaning Services"],
  "Outbound Coordinator": ["Data Entry", "Delivery", "Customer Service"],
  Receptionist: ["Customer Service", "Greeter", "Data Entry"],
  Decanter: ["General Labourer", "Manufacturing"],
  Cashier: ["Cashier", "Customer Service", "Sales Associate"],
  "Reach Operator": ["Driver", "General Labourer"],
  Carpenter: ["Carpenter", "Construction", "Contracting"],
  Offloader: ["General Labourer", "Delivery"],
};

// The review step's preset (25600:67034).
const FORKLIFT: Partial<PresetDraft> = {
  skills: ["Clamp Truck", "Driver", "General Labourer", "Manufacturing"],
  requirements: {
    ...NO_REQUIREMENTS,
    equipment: [
      "5-Panel Drug Screen",
      "Basic Life Support Certification",
      "Bilingual—English/French",
      "Ontario Drivers' License-Class 5",
    ],
    certificates: ["COVID-19 Safety Certificate", "Workplace Hazardous Material Information System (WHMIS) Certificate"],
  },
  description:
    "The person would be responsible for carefully carrying and organizing stacked pallets of packaged goods between the packaging and holding area in the warehouse. They would also be responsible for unloading deliveries from trucks and stacking boxes for storage purposes throughout a warehouse. The operator must possess a valid special-purpose forklift operation license.",
};

export function emptyPresetDraft(): PresetDraft {
  return {
    title: "",
    tags: [],
    offSite: false,
    address: null,
    unit: "",
    directions: "",
    wage: "",
    geofence: null,
    entrance: null,
    skills: [],
    requirements: { ...NO_REQUIREMENTS },
    description: "",
  };
}

export function presetsSeed(): Preset[] {
  return NAMES.map((title, i) => {
    const draft: PresetDraft = {
      ...emptyPresetDraft(),
      title,
      tags: TAGS_OF[title] ?? [],
      skills: SKILLS_OF[title] ?? [],
      ...(title === "Forklift Operator" ? FORKLIFT : {}),
    };
    const active = !DRAFTS.includes(title);
    return {
      ...draft,
      description: draft.description || (active ? PRESETS.description(draft) : ""),
      id: `preset-${i}`,
      status: active ? "active" : "draft",
    };
  });
}

/** Manage Template Presets' rows: the active presets A–Z, then the drafts. */
export function listPresets(list: Preset[], { query, status }: PresetFilter) {
  const text = query.trim().toLowerCase();
  return list
    .filter((p) => (status === "all" || p.status === status) && p.title.toLowerCase().includes(text))
    .toSorted((a, b) => (a.status === b.status ? a.title.localeCompare(b.title) : a.status === "active" ? -1 : 1));
}

/** Whether each step has what it needs to move on: a title, a skill, a description, then all three. */
export function stepsReady(draft: PresetDraft) {
  const steps = [!!draft.title.trim(), true, draft.skills.length > 0, !!draft.description.trim()];
  return [...steps, steps.every(Boolean)];
}

/** The step a sheet opens on: the first one left unfinished, or the last, its review. */
export function openingStep(ready: boolean[]) {
  const unfinished = ready.indexOf(false);
  return unfinished < 0 ? ready.length - 1 : unfinished;
}

export function charactersLeft(description: string) {
  return DESCRIPTION_LIMIT - description.length;
}

/** The requirements switched on with something picked, in the form's order. */
export function listed(requirements: Preset["requirements"]) {
  return (Object.entries(requirements) as [Requirement, string[] | null][]).filter(
    (entry): entry is [Requirement, string[]] => !!entry[1]?.length,
  );
}

const copied = (draft: PresetDraft): PresetDraft => ({
  ...draft,
  tags: [...draft.tags],
  skills: [...draft.skills],
  requirements: Object.fromEntries(
    Object.entries(draft.requirements).map(([key, picks]) => [key, picks && [...picks]]),
  ) as Preset["requirements"],
});

const trimmed = (draft: PresetDraft): PresetDraft => ({
  ...copied(draft),
  title: draft.title.trim(),
  unit: draft.unit.trim(),
  directions: draft.directions.trim(),
  wage: draft.wage.trim(),
  description: draft.description.trim(),
});

export function draftOfPreset({ id: _id, status: _status, ...draft }: Preset): PresetDraft {
  return copied(draft);
}

/** A new preset from another's details, to be named afresh. */
export function duplicateOf(preset: Preset): PresetDraft {
  return { ...draftOfPreset(preset), title: "" };
}

export function addPreset(list: Preset[], draft: PresetDraft, status: PresetStatus, now: Date): Preset[] {
  return [...list, { ...trimmed(draft), id: `preset-${now.getTime()}`, status }];
}

export function updatePreset(list: Preset[], id: string, draft: PresetDraft, status: PresetStatus) {
  return list.map((p) => (p.id === id ? { ...trimmed(draft), id, status } : p));
}

/** Every tag `list` holds, A–Z. */
export const tagsOf = (list: { tags: string[] }[]) =>
  [...new Set(list.flatMap(({ tags }) => tags))].sort((a, b) => a.localeCompare(b));

/** How many templates a list shows, from the copywriter. */
export const shownText = (count: number) => (count ? `${count} ${count === 1 ? "template" : "templates"}` : "No templates");

export function removePreset(list: Preset[], id: string) {
  return list.filter((p) => p.id !== id);
}
