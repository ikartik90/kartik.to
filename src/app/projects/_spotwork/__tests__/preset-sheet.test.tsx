import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GEOFENCE_HINT } from "../copy";
import { COMPANY_PLACE, GeoContext, OFFLINE, entranceAt, suggestionOf } from "../geo";
import { squareAround, type Place } from "../geofence";
import { PresetSheet } from "../preset-sheet";
import { emptyPresetDraft } from "../presets";

afterEach(cleanup);

const FILLED = { ...emptyPresetDraft(), title: "Shipping Clerk", skills: ["Driver"], description: "Loads trucks." };

describe("the Address & wage step's address", () => {
  it("asks only where, how to arrive, and the wage", async () => {
    const user = userEvent.setup();
    render(<PresetSheet addressed initial={{ ...emptyPresetDraft(), title: "Shipping Clerk" }} height={900} onCancel={() => {}} onSave={() => {}} />);
    await user.click(screen.getByRole("button", { name: /Address & wage/ }));
    expect(screen.queryByRole("switch", { name: /Save address/ })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByText("Address Label")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Hourly Wage" })).toBeTruthy();
  });

  it("keeps the browser's own address suggestions away, its label still reading Address", async () => {
    const user = userEvent.setup();
    render(<PresetSheet addressed initial={{ ...emptyPresetDraft(), title: "Shipping Clerk" }} height={900} onCancel={() => {}} onSave={() => {}} />);
    await user.click(screen.getByRole("button", { name: /Address & wage/ }));
    const address = screen.getByRole("combobox", { name: /^Addr\u200Cess$/ });
    // Chrome fills no field whose autocomplete it doesn't know; Safari offers AutoFill to a field labelled "address".
    expect(address.getAttribute("autocomplete")).toBe("no-autofill");
    const label = document.querySelector(`label[for="${address.id}"]`)!;
    expect(label.textContent).not.toMatch(/address/i);
    expect(label.textContent!.replace(/\u200C/g, "")).toBe("Address");
  });

  it("starts the entrance over, with the geofence, where another address is picked", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    // Picked, a suggestion is found in full: where it is, as well as its name.
    const finnigan = { id: "finnigan", label: "250 Finnigan Street, Coquitlam, BC", lat: 49.2, lng: -122.8 };
    const suggest = vi.fn().mockResolvedValue([{ id: finnigan.id, label: finnigan.label, place: async () => finnigan }]);
    const initial = { ...emptyPresetDraft(), title: "Shipping Clerk", address: COMPANY_PLACE, geofence: squareAround(COMPANY_PLACE), entrance: COMPANY_PLACE };
    render(
      <GeoContext value={{ ...OFFLINE, suggest }}>
        <PresetSheet addressed initial={initial} height={900} onCancel={() => {}} onSave={onSave} />
      </GeoContext>,
    );
    await user.click(screen.getByRole("button", { name: /Address & wage/ }));
    const address = screen.getByRole("combobox", { name: /^Addr\u200Cess$/ });
    await user.clear(address);
    await user.type(address, "250 Fi");
    await user.click(await screen.findByRole("option", { name: "250 Finnigan Street, Coquitlam, BC" }));
    await user.click(screen.getByRole("button", { name: "Save as draft" }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ address: finnigan, entrance: null });
  });

  it("starts the entrance at CCLS's door where its First Gulf address is picked", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const finnigan = { id: "finnigan", label: "250 Finnigan Street, Coquitlam, BC", lat: 49.2, lng: -122.8 };
    const initial = { ...emptyPresetDraft(), title: "Shipping Clerk", address: finnigan, entrance: finnigan };
    render(
      <GeoContext value={OFFLINE}>
        <PresetSheet addressed initial={initial} height={900} onCancel={() => {}} onSave={onSave} />
      </GeoContext>,
    );
    await user.click(screen.getByRole("button", { name: /Address & wage/ }));
    const address = screen.getByRole("combobox", { name: /^Addr‌ess$/ });
    await user.clear(address);
    await user.type(address, "250 First");
    await user.click(await screen.findByRole("option", { name: COMPANY_PLACE.label }));
    await user.click(screen.getByRole("button", { name: "Save as draft" }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ address: { id: COMPANY_PLACE.id }, entrance: entranceAt(COMPANY_PLACE) });
  });

  it("hints under the map how to drag its pin and corners, with no map and no hint before an address", async () => {
    const user = userEvent.setup();
    const open = async (address: Place | null) => {
      render(<PresetSheet addressed initial={{ ...emptyPresetDraft(), title: "Shipping Clerk", address }} height={900} onCancel={() => {}} onSave={() => {}} />);
      await user.click(screen.getByRole("button", { name: /Address & wage/ }));
    };
    await open(COMPANY_PLACE);
    const hint = screen.getByText(GEOFENCE_HINT);
    const map = hint.closest("[data-field]")!.querySelector("[data-map]")!;
    expect(map.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    cleanup();
    await open(null);
    expect(document.querySelector("[data-map]")).toBeNull();
    expect(screen.queryByText(GEOFENCE_HINT)).toBeNull();
  });

  it("narrows what it suggests as more is typed, before the next answer comes", async () => {
    const user = userEvent.setup();
    const at = { lat: 43.675, lng: -79.714 };
    const suggest = vi
      .fn()
      .mockResolvedValueOnce(
        [
          { id: "gulf", label: "250 First Gulf Boulevard, Brampton, ON", ...at },
          { id: "finnigan", label: "250 Finnigan Street, Coquitlam, BC", ...at },
        ].map(suggestionOf),
      )
      .mockReturnValue(new Promise(() => {}));
    render(
      <GeoContext value={{ ...OFFLINE, suggest }}>
        <PresetSheet addressed initial={{ ...emptyPresetDraft(), title: "Shipping Clerk" }} height={900} onCancel={() => {}} onSave={() => {}} />
      </GeoContext>,
    );
    await user.click(screen.getByRole("button", { name: /Address & wage/ }));
    const address = screen.getByRole("combobox", { name: /^Addr\u200Cess$/ });
    await user.type(address, "250 Fi");
    expect(await screen.findAllByRole("option")).toHaveLength(2);
    await user.type(address, "rst");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "250 First Gulf Boulevard, Brampton, ON",
    ]);
  });
});

describe("the sheet's steps", () => {
  const tabs = () => within(screen.getByRole("dialog")).getAllByRole<HTMLButtonElement>("button", { name: /^Step \d/ });
  const current = () => tabs().find((tab) => tab.getAttribute("aria-current") === "step")!.textContent;
  // A step looks reached exactly when it can be gone to.
  const open = () => tabs().map((tab) => !tab.disabled && tab.hasAttribute("data-reached"));

  it("open an edit with every step filled in on its review, every step reached", () => {
    render(<PresetSheet editing initial={FILLED} height={900} onCancel={() => {}} onSave={() => {}} />);
    expect(current()).toBe("Step 4Review template summary");
    expect(open()).toEqual([true, true, true, true]);
  });

  it("open a draft on its first step left unfinished, going back but not on", async () => {
    const user = userEvent.setup();
    render(<PresetSheet editing initial={{ ...FILLED, skills: [] }} height={900} onCancel={() => {}} onSave={() => {}} />);
    expect(current()).toBe("Step 2Skills & requirements");
    expect(open()).toEqual([true, true, false, false]);
    expect(tabs().map((tab) => tab.disabled)).toEqual([false, false, true, true]);
    await user.click(tabs()[0]);
    expect(current()).toBe("Step 1Basic information");
    expect(open()).toEqual([true, true, false, false]);
  });

  it("stay reached on going back from the review", async () => {
    const user = userEvent.setup();
    render(<PresetSheet addressed editing initial={FILLED} height={900} onCancel={() => {}} onSave={() => {}} />);
    expect(current()).toBe("Step 5Review template summary");
    await user.click(tabs()[0]);
    expect(current()).toBe("Step 1Basic information");
    expect(open()).toEqual([true, true, true, true, true]);
  });

  it("open a new one on its first step, the rest shut", () => {
    render(<PresetSheet initial={emptyPresetDraft()} height={900} onCancel={() => {}} onSave={() => {}} />);
    expect(current()).toBe("Step 1Basic information");
    expect(tabs().map((tab) => tab.disabled)).toEqual([false, true, true, true]);
    expect(open().slice(1)).toEqual([false, false, false]);
  });
});

describe("opening", () => {
  const sheet = () => <PresetSheet initial={emptyPresetDraft()} height={900} onCancel={() => {}} onSave={() => {}} />;

  it("focuses its first step's first field", () => {
    render(sheet());
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: /Template Title/i }));
  });

  it("focuses it once it's in and has built its steps, where it can watch its way in", async () => {
    Element.prototype.getAnimations = () => [];
    try {
      render(sheet());
      expect(screen.getByRole("textbox", { name: /Template Title/i }).closest("[aria-busy=true]")).not.toBeNull();
      expect(document.activeElement).toBe(document.body);
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: /Template Title/i })));
    } finally {
      Reflect.deleteProperty(Element.prototype, "getAnimations");
    }
  });

  it("shows only the step it opens on as it comes in, loading", () => {
    Element.prototype.getAnimations = () => [];
    try {
      render(<PresetSheet addressed editing initial={FILLED} height={900} onCancel={() => {}} onSave={() => {}} />);
      const steps = screen.getAllByRole("heading", { level: 3, hidden: true });
      expect(steps.map((step) => step.textContent)).toEqual(["Review template summary"]);
      expect(steps[0].closest("[aria-busy=true]")).not.toBeNull();
    } finally {
      Reflect.deleteProperty(Element.prototype, "getAnimations");
    }
  });
});
