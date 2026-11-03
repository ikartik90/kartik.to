import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckInsApp, type Page } from "../check-ins-app";
import { shiftStart } from "../data";
import { CERTIFICATES, CHOICES, presetsSeed } from "../presets";

const NOW = new Date(2026, 9, 18, 10, 0);

beforeEach(() => vi.useFakeTimers({ toFake: ["Date"], now: NOW }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function openPresets() {
  const user = userEvent.setup();
  const pages: Page[] = [];
  render(
    <CheckInsApp
      anchor={shiftStart(new Date())}
      width={1440}
      height={900}
      initialPage="activations"
      onPage={(page) => pages.push(page)}
    />,
  );
  await user.click(within(screen.getByRole("navigation", { name: "Main" })).getByRole("button", { name: "Manage presets" }));
  const cards = () => within(screen.getByRole("list", { name: "Template Presets" })).queryAllByRole("listitem");
  const names = () => cards().map((card) => within(card).getByRole("heading").textContent);
  const card = (name: string) => cards().find((c) => within(c).getByRole("heading").textContent === name)!;
  const sheet = () => screen.getByRole("dialog", { name: "Create a template preset" });
  const next = () => user.click(within(sheet()).getByRole("button", { name: "Next" }));
  return { user, pages, cards, names, card, sheet, next };
}

/** A field's look (`data-state`), found by its label. */
const fieldState = (scope: HTMLElement, label: string) =>
  within(scope).getByText(label, { selector: "label" }).closest("[data-field]")!.getAttribute("data-state");

describe("Manage Template Presets", () => {
  it("opens from the Companies page, with Manage presets current in the sidebar", async () => {
    const { pages } = await openPresets();
    expect(screen.getByRole("heading", { level: 1, name: "Manage Template Presets" })).toBeDefined();
    expect(pages).toEqual(["presets"]);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("button", { name: "Manage presets" }).getAttribute("aria-current")).toBe("page");
  });

  it("lists Figma's presets as cards, the active ones first, each with its actions", async () => {
    const { names, card } = await openPresets();
    expect(names()).toHaveLength(17);
    expect(names().slice(0, 2)).toEqual(["Bakery Production", "Carpenter"]);
    expect(names().slice(-5)).toEqual([
      "Cashier",
      "Grooming Agent",
      "Offloader",
      "Outbound Coordinator",
      "Warehouse Supervisor",
    ]);
    // An active preset carries no status; a draft says so.
    expect(card("Carpenter").textContent).not.toMatch(/Active|Draft/);
    const actions = (name: string) => within(card(name)).getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(actions("Carpenter")).toEqual(["Edit", "Duplicate", "Delete"]);
    expect(within(card("Cashier")).getByText("Draft")).toBeDefined();
    expect(actions("Cashier")).toEqual(["Edit", "Delete"]);
    expect(screen.queryByRole("button", { name: "Post new shift..." })).toBeNull();
  });

  it("shows a preset's first two tags on its card, then how many more, and nothing for one without", async () => {
    const { card } = await openPresets();
    const tags = (name: string) =>
      [...(within(card(name)).queryByRole("group", { name: "Tags" })?.children ?? [])].map((tag) => tag.firstChild!.textContent);
    const seeded = presetsSeed();
    for (const preset of seeded) {
      const [first, second, ...rest] = preset.tags;
      expect(tags(preset.title)).toEqual([first, second, rest.length && `+${rest.length}`].filter(Boolean));
      expect(within(card(preset.title)).queryByRole("group", { name: "Skills" })).toBeNull();
    }
    // Most have a tag; a few have none.
    const tagged = seeded.filter((preset) => preset.tags.length > 0).length;
    expect(tagged).toBeGreaterThan(seeded.length / 2);
    expect(tagged).toBeLessThan(seeded.length);
  });

  it("holds the page still while the sheet is open", async () => {
    const { user, card } = await openPresets();
    const opener = screen.getByRole("button", { name: "New template preset..." });
    const edit = within(card("Carpenter")).getByRole("button", { name: "Edit" });
    await user.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Create a template preset" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.closest("[inert]")).toBeNull();
    expect(opener.closest("[inert]")).not.toBeNull();
    expect(edit.closest("[inert]")).not.toBeNull();
    fireEvent.pointerDown(dialog.previousElementSibling!);
    expect(screen.getByRole("dialog", { name: "Create a template preset" })).toBe(dialog);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(edit.closest("[inert]")).toBeNull());
    expect(opener.closest("[inert]")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("narrows them by status and by what's typed", async () => {
    const { user, names } = await openPresets();
    await user.click(within(screen.getByRole("group", { name: "Status" })).getByRole("button", { name: "Draft" }));
    expect(names()).toHaveLength(5);
    await user.type(screen.getByRole("searchbox", { name: "Find a preset..." }), "ware");
    expect(names()).toEqual(["Warehouse Supervisor"]);
    await user.click(within(screen.getByRole("group", { name: "Status" })).getByRole("button", { name: "All" }));
    expect(names()).toEqual(["Warehouse Associate", "Warehouse Supervisor"]);
  });

  it("creates a preset through its four steps, generic, with no address or wage, and lists it", async () => {
    const { user, sheet, next, names, card } = await openPresets();
    await user.click(screen.getByRole("button", { name: "New template preset..." }));
    const nextButton = () => within(sheet()).getByRole("button", { name: "Next" });

    expect(within(sheet()).getAllByRole("button", { name: /^Step \d/ }).map((step) => step.textContent)).toEqual([
      "Step 1Basic information",
      "Step 2Skills & requirements",
      "Step 3Template details",
      "Step 4Review template summary",
    ]);

    // Basic information: Next always answers; without a title it stays put, the title's field Alert
    const state = (label: string) => fieldState(sheet(), label);
    const current = () => within(sheet()).getByRole("button", { current: "step" }).textContent;
    expect(nextButton()).toHaveProperty("disabled", false);
    expect(state("Template Title")).not.toBe("alert");
    await next();
    expect(current()).toBe("Step 1Basic information");
    expect(state("Template Title")).toBe("alert");
    await user.type(within(sheet()).getByLabelText("Template Title"), "Shipping Clerk");
    expect(state("Template Title")).not.toBe("alert");
    await user.type(within(sheet()).getByRole("combobox", { name: "Tags" }), "Logistics");
    await user.click(within(sheet()).getByRole("option", { name: 'Create "Logistics" tag' }));
    await next();

    // Skills & requirements: one table of them all, each a checkbox, its name, then its kind's pill
    expect(within(sheet()).queryByRole("switch")).toBeNull();
    const table = within(sheet()).getByRole("table", { name: "Skills & requirements" });
    // Next with no skill stays put, the table and its hint Alert.
    expect(table.parentElement!.getAttribute("data-state")).toBeNull();
    await next();
    expect(current()).toBe("Step 2Skills & requirements");
    expect(table.parentElement!.getAttribute("data-state")).toBe("alert");
    expect(within(sheet()).getByText("Select at least one skill").getAttribute("data-tone")).toBe("alert");
    const read = () =>
      within(table).getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent));
    const kinds = within(sheet()).getByRole("group", { name: "Type" });
    const segment = (name: string) => within(kinds).getByRole("button", { name });
    expect(within(kinds).getAllByRole("button")).toHaveLength(6);
    expect(segment("All").getAttribute("aria-pressed")).toBe("true");
    expect(read()).toHaveLength(CHOICES.length);
    for (const [name, pill] of [
      ["Skills", "Skill"],
      ["Equipment", "Equipment"],
      ["Physical", "Physical"],
      ["Certificates", "Certificate"],
      ["Conditions", "Working condition"],
    ]) {
      await user.click(segment(name));
      expect(new Set(read().map((cells) => cells.at(-1))), name).toEqual(new Set([pill]));
    }
    await user.click(segment("Certificates"));
    expect(read()).toEqual(CERTIFICATES.map((name) => ["", name, "Certificate"]));

    // The search in its header narrows what the kind shows.
    await user.click(segment("Equipment"));
    const search = within(table).getByRole("searchbox", { name: "Skills & requirements" });
    await user.type(search, "shoes");
    expect(read().map(([, name]) => name)).toEqual(["Black Shoes", "Black Shoes (Polishable/Shiny)", "Closed Toe Shoes"]);
    await user.click(within(table).getByRole("checkbox", { name: "Closed Toe Shoes" }));
    await user.clear(search);
    await user.click(segment("Skills"));
    await user.click(within(table).getByRole("checkbox", { name: "Data Entry" }));
    await user.click(within(table).getByRole("checkbox", { name: "Delivery" }));
    expect(within(table).getByRole("checkbox", { name: "Delivery" }).getAttribute("aria-checked")).toBe("true");
    // Filled in, it's a field with focus: Active.
    expect(table.parentElement!.getAttribute("data-state")).toBe("active");
    expect(within(sheet()).getByText("Select at least one skill").getAttribute("data-tone")).toBeNull();
    await user.click(segment("Equipment"));
    expect(within(table).getByRole("checkbox", { name: "Closed Toe Shoes" }).getAttribute("aria-checked")).toBe("true");
    await next();

    // Template details
    expect(within(sheet()).getByText("3000 characters remaining")).toBeDefined();
    await user.type(within(sheet()).getByLabelText("Job Description"), "Checks orders.");
    expect(within(sheet()).getByText("2986 characters remaining")).toBeDefined();
    await next();

    // Review template summary
    const review = within(sheet()).getByRole("heading", { name: "Review template summary" }).parentElement!;
    expect(review.textContent).toContain("Shipping Clerk");
    expect(review.textContent).toContain("Logistics");
    expect(within(review).getByText("Delivery")).toBeDefined();
    expect(within(review).getByText("Equipment Requirements")).toBeDefined();
    expect(within(review).getByText("Closed Toe Shoes")).toBeDefined();
    expect(within(review).queryByText("Certificates")).toBeNull();
    expect(review.textContent).toContain("Checks orders.");
    expect(within(review).queryByRole("heading", { name: "Address & wage" })).toBeNull();
    expect(review.querySelector("[data-map]")).toBeNull();
    await user.click(within(sheet()).getByRole("button", { name: "Create template preset" }));

    expect(screen.queryByRole("dialog", { name: "Create a template preset" })).toBeNull();
    expect(names()).toContain("Shipping Clerk");
    expect(names().indexOf("Shipping Clerk")).toBe(10);
    expect(card("Shipping Clerk").textContent).not.toContain("Draft");
    expect(within(card("Shipping Clerk")).getByRole("button", { name: "Duplicate" })).toBeDefined();
  });

  it("goes back to a step from its tab or from the review", async () => {
    const { user, sheet, next } = await openPresets();
    await user.click(screen.getByRole("button", { name: "New template preset..." }));
    await user.type(within(sheet()).getByLabelText("Template Title"), "Shipping Clerk");
    await next();
    await user.click(within(within(sheet()).getByRole("table", { name: "Skills & requirements" })).getByLabelText("Driver"));
    await next();
    fireEvent.change(within(sheet()).getByLabelText("Job Description"), { target: { value: "Drives." } });
    await next();

    await user.click(within(sheet()).getByRole("button", { name: "Edit skills & requirements" }));
    expect(within(sheet()).getByRole("table", { name: "Skills & requirements" })).toBeDefined();
    await user.click(within(sheet()).getByRole("button", { name: /Basic information/ }));
    expect(within(sheet()).getByLabelText("Template Title")).toHaveProperty("value", "Shipping Clerk");
  });

  it("saves a draft from any step once it has a title, and asks for one without", async () => {
    const { user, sheet, card, names } = await openPresets();
    await user.click(screen.getByRole("button", { name: "New template preset..." }));
    const draft = () => within(sheet()).getByRole("button", { name: "Save as draft" });
    expect(draft()).toHaveProperty("disabled", false);
    await user.click(draft());
    expect(names()).toHaveLength(17);
    expect(fieldState(sheet(), "Template Title")).toBe("alert");
    await user.type(within(sheet()).getByLabelText("Template Title"), "Shipping Clerk");
    await user.click(draft());
    expect(screen.queryByRole("dialog", { name: "Create a template preset" })).toBeNull();
    expect(within(card("Shipping Clerk")).getByText("Draft")).toBeDefined();
  });

  it("keeps Next pressable with every skill unticked, staying put with the table and its hint Alert", async () => {
    const { user, card } = await openPresets();
    await user.click(within(card("Carpenter")).getByRole("button", { name: "Edit" }));
    const sheet = screen.getByRole("dialog", { name: "Edit template preset" });
    await user.click(within(sheet).getByRole("button", { name: /Skills & requirements/ }));
    await user.click(within(within(sheet).getByRole("group", { name: "Type" })).getByRole("button", { name: "Skills" }));
    const table = within(sheet).getByRole("table", { name: "Skills & requirements" });
    for (const box of within(table).getAllByRole("checkbox").filter((box) => box.getAttribute("aria-checked") === "true")) {
      await user.click(box);
    }
    const next = within(sheet).getByRole("button", { name: "Next" });
    expect(next).toHaveProperty("disabled", false);
    await user.click(next);
    expect(within(sheet).getByRole("button", { name: /Skills & requirements/ }).getAttribute("aria-current")).toBe("step");
    expect(table.parentElement!.getAttribute("data-state")).toBe("alert");
    expect(within(sheet).getByText("Select at least one skill").getAttribute("data-tone")).toBe("alert");
    await user.click(within(table).getByRole("checkbox", { name: "Carpenter" }));
    expect(table.parentElement!.getAttribute("data-state")).toBe("active");
    await user.click(next);
    expect(within(sheet).getByRole("button", { name: /Template details/ }).getAttribute("aria-current")).toBe("step");
  });

  it("cancels without saving", async () => {
    const { user, sheet, names } = await openPresets();
    await user.click(screen.getByRole("button", { name: "New template preset..." }));
    await user.type(within(sheet()).getByLabelText("Template Title"), "Shipping Clerk");
    await user.click(within(sheet()).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Create a template preset" })).toBeNull();
    expect(names()).not.toContain("Shipping Clerk");
  });

  it("duplicates a preset into a new one, to be named", async () => {
    const { user, sheet, card } = await openPresets();
    await user.click(within(card("Forklift Operator")).getByRole("button", { name: "Duplicate" }));
    expect(within(sheet()).getByLabelText("Template Title")).toHaveProperty("value", "");
    expect(within(sheet()).getByRole("button", { name: "Remove Manufacturing" })).toBeDefined();
  });

  it("edits a draft from the step it was left on, keeping it a draft", async () => {
    const { user, card, names } = await openPresets();
    await user.click(within(card("Cashier")).getByRole("button", { name: "Edit" }));
    const sheet = screen.getByRole("dialog", { name: "Edit template preset" });
    expect(within(sheet).getByRole("button", { name: /Template details/ }).getAttribute("aria-current")).toBe("step");
    expect(within(sheet).getByRole("button", { name: /Review template summary/ })).toHaveProperty("disabled", true);
    // Without a description, Next stays put and its field turns Alert.
    await user.click(within(sheet).getByRole("button", { name: "Next" }));
    expect(within(sheet).getByRole("button", { name: /Template details/ }).getAttribute("aria-current")).toBe("step");
    expect(fieldState(sheet, "Job Description")).toBe("alert");
    await user.click(within(sheet).getByRole("button", { name: /Basic information/ }));
    const title = within(sheet).getByLabelText("Template Title");
    expect(title).toHaveProperty("value", "Cashier");
    fireEvent.change(title, { target: { value: "Head Cashier" } });
    await user.click(within(sheet).getByRole("button", { name: "Save as draft" }));
    expect(names()).not.toContain("Cashier");
    expect(within(card("Head Cashier")).getByText("Draft")).toBeDefined();
  });

  it("edits an active preset from its review", async () => {
    const { user, card } = await openPresets();
    await user.click(within(card("Forklift Operator")).getByRole("button", { name: "Edit" }));
    const sheet = screen.getByRole("dialog", { name: "Edit template preset" });
    expect(within(sheet).getByRole("button", { name: /Review template summary/ }).getAttribute("aria-current")).toBe("step");
    await user.click(within(sheet).getByRole("button", { name: "Edit basic information" }));
    await user.type(within(sheet).getByRole("combobox", { name: "Tags" }), "Shipping{Enter}");
    await user.click(within(sheet).getByRole("button", { name: /Review template summary/ }));
    expect(within(sheet).getByRole("region", { name: "Basic information" }).textContent).toContain("Shipping");
    await user.click(within(sheet).getByRole("button", { name: "Save changes" }));
    expect(screen.queryByRole("dialog", { name: "Edit template preset" })).toBeNull();
    expect(card("Forklift Operator").textContent).not.toContain("Draft");
  });

  it("deletes a preset", async () => {
    const { user, card, names } = await openPresets();
    await user.click(within(card("Offloader")).getByRole("button", { name: "Delete" }));
    expect(names()).toHaveLength(16);
    expect(names()).not.toContain("Offloader");
  });

  it("generates a job description from the draft", async () => {
    const { user, sheet, next } = await openPresets();
    await user.click(screen.getByRole("button", { name: "New template preset..." }));
    await user.type(within(sheet()).getByLabelText("Template Title"), "Shipping Clerk");
    await next();
    await user.click(within(within(sheet()).getByRole("table", { name: "Skills & requirements" })).getByLabelText("Driver"));
    await next();
    await user.click(within(sheet()).getByRole("button", { name: "Generate job description" }));
    await waitFor(() =>
      expect(within(sheet()).getByLabelText("Job Description")).toHaveProperty(
        "value",
        expect.stringMatching(/^The worker would fill/),
      ),
      // It types itself in, at 50 characters a second.
      { timeout: 3000 },
    );
  }, 15_000);

  it("offers a new preset to a team's Manage templates", async () => {
    const { user, sheet } = await openPresets();
    await user.click(screen.getByRole("button", { name: "New template preset..." }));
    await user.type(within(sheet()).getByLabelText("Template Title"), "Shipping Clerk");
    await user.click(within(sheet()).getByRole("button", { name: "Save as draft" }));

    await user.click(within(screen.getByRole("navigation", { name: "Main" })).getByRole("button", { name: "Companies" }));
    await user.click(screen.getByRole("button", { name: "North West Company" }));
    await user.click(within(screen.getByRole("dialog", { name: "Company settings" })).getAllByRole("button", { name: /^Manage templates/ })[0]);
    const templates = screen.getByRole("dialog", { name: "Manage templates" });
    await user.click(within(templates).getByRole("tab", { name: "Template presets" }));
    const rows = within(within(templates).getAllByRole("rowgroup").at(-1)!).getAllByRole("row");
    expect(rows).toHaveLength(18);
    expect(within(rows.at(-1)!).getByText("Shipping Clerk")).toBeDefined();
  });

  it("keeps the prospects' decisions while it's open", async () => {
    const user = userEvent.setup();
    render(<CheckInsApp anchor={shiftStart(new Date())} width={1440} height={900} initialPage="activations" />);
    const gustavo = () =>
      within(screen.getByRole("table", { name: "Companies" }))
        .getAllByRole("row")
        .find((r) => r.textContent?.includes("Gustavo Donin"))!;
    await user.click(within(gustavo()).getByRole("button", { name: "SaraLee" }));
    const settings = () => screen.queryByRole("dialog", { name: "Company settings" });
    await user.click(within(settings()!).getByRole("button", { name: "Approve" }));
    await user.click(within(settings()!).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(settings()).toBeNull());
    await user.click(within(screen.getByRole("navigation", { name: "Main" })).getByRole("button", { name: "Manage presets" }));
    await user.click(within(screen.getByRole("navigation", { name: "Main" })).getByRole("button", { name: "Companies" }));
    expect(within(gustavo()).getByText("Onboarding")).toBeDefined();
  });
});
