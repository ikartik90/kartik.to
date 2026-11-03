import { createContext, useContext } from "react";
import { PRESETS } from "./copy";
import { COMPANY_PLACE, entranceAt } from "./geo";
import { emptyPresetDraft, type Preset, type PresetDraft } from "./presets";
import { TEMPLATES, type Iso, type Series, type Template } from "./shifts";

// A company's own templates (SW Curie's Manage Templates, 25637:25933), made in the presets' form. Each starts at the
// company's address and its entrance; the Shifts page's four keep the rest of the details a shift takes.

const SKILLS_OF: Record<string, string[]> = {
  forklift: ["Clamp Truck", "Driver", "General Labourer", "Manufacturing"],
  general: ["General Labourer", "Delivery"],
  picker: ["General Labourer", "Assembly"],
  manager: ["General Labourer", "Data Entry", "Manufacturing"],
};

// Manage Templates' drafts.
const DRAFTS = [
  { title: "Warehouse Associate", tags: ["Warehouse", "Assembly Line"], skills: ["General Labourer", "Assembly", "Data Entry"] },
  { title: "Warehouse Supervisor", tags: ["Warehouse", "Manufacturing"], skills: ["General Labourer", "Data Entry", "Manufacturing"] },
];

export function templatesSeed(): Preset[] {
  const active = TEMPLATES.map(({ id, name, tags, unit, directions, wage }) => {
    const draft: PresetDraft = {
      ...newTemplateDraft(),
      title: name,
      tags: [...tags],
      unit,
      directions,
      wage: wage.replace(/^CAD /, ""),
      skills: SKILLS_OF[id],
    };
    return { ...draft, description: PRESETS.description(draft), id, status: "active" as const };
  });
  const drafts = DRAFTS.map((draft, i) => ({ ...newTemplateDraft(), ...draft, id: `template-${i}`, status: "draft" as const }));
  return [...active, ...drafts];
}

/** A new template, at the company's address and entrance. */
export function newTemplateDraft(): PresetDraft {
  return { ...emptyPresetDraft(), address: COMPANY_PLACE, entrance: entranceAt(COMPANY_PLACE) };
}

/** How many of a template's shifts still have a day to run, today's included. */
export function activeShifts(series: Series[], template: string, today: Iso) {
  return series.filter((s) => s.template === template && s.dates.some((date) => date >= today)).length;
}

/** The active templates, as New Shift and the Shifts page take them. */
export function shiftTemplates(templates: Preset[]): Template[] {
  return templates
    .filter((template) => template.status === "active")
    .map(({ id, title, tags, address, unit, directions, wage, geofence, entrance }) => ({
      id,
      name: title,
      tags,
      address: address?.label ?? "",
      unit,
      directions,
      wage: wage ? `CAD ${wage}` : "",
      place: address,
      geofence,
      entrance,
    }));
}

export const TemplatesContext = createContext<Template[]>(TEMPLATES);

export const useTemplates = () => useContext(TemplatesContext);
