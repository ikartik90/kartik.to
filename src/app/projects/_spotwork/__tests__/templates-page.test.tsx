import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckInsApp, type AppHandle, type Page } from "../check-ins-app";
import { shiftStart } from "../data";
import { isoOf, longDate } from "../shifts";

const NOW = new Date(2026, 9, 18, 10, 0);

beforeEach(() => vi.useFakeTimers({ toFake: ["Date"], now: NOW }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderApp(initialPage: Page) {
  const user = userEvent.setup();
  const pages: Page[] = [];
  const app = createRef<AppHandle>();
  render(
    <CheckInsApp
      ref={app}
      anchor={shiftStart(new Date())}
      width={1440}
      height={900}
      initialPage={initialPage}
      shiftVersion="old"
      onPage={(page) => pages.push(page)}
    />,
  );
  const main = () => screen.getByRole("main");
  const nav = () => screen.getByRole("navigation", { name: "Main" });
  const cards = () => within(screen.getByRole("list", { name: "Templates" })).queryAllByRole("listitem");
  const names = () => cards().map((card) => within(card).getByRole("heading").textContent);
  const card = (name: string) => cards().find((c) => within(c).getByRole("heading").textContent === name)!;
  // As the overlay goes to another project's page.
  const go = (page: Page) => act(() => app.current!.go(page));
  return { user, pages, main, nav, cards, names, card, go };
}

async function openTemplates() {
  const app = renderApp("shifts");
  await app.user.click(within(app.main()).getByRole("button", { name: "Manage templates" }));
  return app;
}

/** Fills the five steps with a title, the company's address, a skill and a description, then creates the template. */
async function createTemplate(user: ReturnType<typeof userEvent.setup>, title: string) {
  const sheet = screen.getByRole("dialog", { name: "Create a template" });
  const next = () => user.click(within(sheet).getByRole("button", { name: "Next" }));
  fireEvent.change(within(sheet).getByLabelText("Template Title"), { target: { value: title } });
  await next();
  await next();
  await user.click(within(within(sheet).getByRole("table", { name: "Skills & requirements" })).getByLabelText("Delivery"));
  await next();
  fireEvent.change(within(sheet).getByLabelText("Job Description"), { target: { value: "Checks orders." } });
  await next();
  await user.click(within(sheet).getByRole("button", { name: "Create template" }));
}

/** The company app's team's card in CCLS's settings. */
const firstGulf = () =>
  within(screen.getByRole("dialog", { name: "Company settings" }))
    .getByRole("heading", { level: 3, name: "CCLS First Gulf" })
    .closest<HTMLElement>("[data-card]")!;

describe("Manage Templates", () => {
  it("opens from the Shifts page, and is current in the company's sidebar", async () => {
    const { pages, nav } = await openTemplates();
    expect(screen.getByRole("heading", { level: 1, name: "Manage Templates" })).toBeDefined();
    expect(pages).toEqual(["templates"]);
    expect(within(nav()).getByRole("button", { name: "Manage templates" }).getAttribute("aria-current")).toBe("page");
    // Its team in the sidebar, named for the team, not its company, with no card of its own.
    expect(within(nav()).getByRole("button", { name: "CCLS First Gulf" })).toBeDefined();
    expect(screen.queryByRole("heading", { level: 2, name: /CCLS/ })).toBeNull();
    expect(screen.getByRole("searchbox", { name: "Find a template..." })).toBeDefined();
  });

  it("lists the company's templates as cards, with their active shifts and Post New shift", async () => {
    const { names, card } = await openTemplates();
    expect(names()).toEqual([
      "Forklift Operator",
      "General Labour",
      "Picker Packer",
      "Warehouse Manager",
      "Warehouse Associate",
      "Warehouse Supervisor",
    ]);
    expect(within(card("Forklift Operator")).getByText("2 Active Shifts")).toBeDefined();
    expect(within(card("General Labour")).getByText("1 Active Shift")).toBeDefined();
    expect(within(card("Warehouse Supervisor")).getByText("Draft")).toBeDefined();
    const actions = (name: string) =>
      within(card(name))
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label") ?? b.textContent);
    expect(actions("Forklift Operator")).toEqual(["Post new shift...", "Edit", "Duplicate", "Delete"]);
    expect(actions("Warehouse Supervisor")).toEqual(["Edit", "Delete"]);
    expect([...within(card("Forklift Operator")).getByRole("group", { name: "Tags" }).children].map((tag) => tag.firstChild!.textContent)).toEqual([
      "Licensed",
      "Warehouse",
      "+2",
    ]);
    // Its drafts are tagged too.
    expect(within(card("Warehouse Supervisor")).getByRole("group", { name: "Tags" })).toBeDefined();
  });

  it("creates a template through the presets' form, with no shifts yet", async () => {
    const { user, main, card } = await openTemplates();
    await user.click(within(main()).getByRole("button", { name: "New template..." }));
    await createTemplate(user, "Shipping Clerk");
    expect(screen.queryByRole("dialog", { name: "Create a template" })).toBeNull();
    expect(within(card("Shipping Clerk")).getByText("No Active Shifts")).toBeDefined();
  });

  it("starts a new template at the company's address, its map showing", async () => {
    const { user, main } = await openTemplates();
    await user.click(within(main()).getByRole("button", { name: "New template..." }));
    const sheet = screen.getByRole("dialog", { name: "Create a template" });
    fireEvent.change(within(sheet).getByLabelText("Template Title"), { target: { value: "Shipping Clerk" } });
    await user.click(within(sheet).getByRole("button", { name: "Next" }));
    expect(within(sheet).getByRole("combobox", { name: /^Addr\u200Cess$/ })).toHaveProperty("value", "250 First Gulf Boulevard, Brampton, ON");
    await waitFor(() => expect(sheet.querySelectorAll("[data-map] [data-anchor]")).toHaveLength(4));
  });

  it("keeps a template's dragged geofence when it's saved and edited again", async () => {
    const { user, card } = await openTemplates();
    const edit = async () => {
      await user.click(within(card("Forklift Operator")).getByRole("button", { name: "Edit" }));
      const sheet = screen.getByRole("dialog", { name: "Edit template" });
      await user.click(within(sheet).getByRole("button", { name: /^Step 2/ }));
      await waitFor(() => expect(sheet.querySelectorAll("[data-map] [data-anchor]")).toHaveLength(4));
      return sheet;
    };
    const outline = (sheet: HTMLElement) => sheet.querySelector("[data-map] polygon")!.getAttribute("points");

    let sheet = await edit();
    const before = outline(sheet);
    const corner = sheet.querySelector("[data-map] [data-anchor]")!;
    fireEvent.pointerDown(corner, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 30, clientY: 20 });
    fireEvent.pointerUp(corner, { pointerId: 1 });
    const dragged = outline(sheet);
    expect(dragged).not.toBe(before);
    await user.click(within(sheet).getByRole("button", { name: /Review template summary/ }));
    await user.click(within(sheet).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit template" })).toBeNull());

    sheet = await edit();
    expect(outline(sheet)).toBe(dragged);
  });

  it("edits a template in the same form", async () => {
    const { user, card } = await openTemplates();
    await user.click(within(card("Forklift Operator")).getByRole("button", { name: "Edit" }));
    const sheet = screen.getByRole("dialog", { name: "Edit template" });
    expect(within(sheet).getByLabelText("Template Title")).toHaveProperty("value", "Forklift Operator");
  });

  it("tags a template from the other templates' tags, and the Shifts page shows them", async () => {
    const { user, card, go } = await openTemplates();
    await user.click(within(card("General Labour")).getByRole("button", { name: "Edit" }));
    const sheet = screen.getByRole("dialog", { name: "Edit template" });
    await user.click(within(sheet).getByRole("button", { name: "Edit basic information" }));
    expect(within(sheet).queryByLabelText("Department")).toBeNull();
    await user.type(within(sheet).getByRole("combobox", { name: "Tags" }), "lic");
    await user.click(within(sheet).getByRole("option", { name: "Licensed" }));
    await user.click(within(sheet).getByRole("button", { name: /Review template summary/ }));
    await user.click(within(sheet).getByRole("button", { name: "Save changes" }));

    go("shifts");
    expect(screen.getByRole("rowheader", { name: /General Labour/ }).textContent).toContain("+1");
    await user.click(screen.getByRole("button", { name: /Tags/ }));
    await user.click(screen.getByRole("option", { name: "Licensed" }));
    expect(screen.getAllByRole("rowheader").map((header) => header.textContent)).toEqual([
      expect.stringContaining("Forklift Operator"),
      expect.stringContaining("General Labour"),
    ]);
  });

  it("posts a new shift from a card, its template picked, and counts it", async () => {
    const { user, card } = await openTemplates();
    await user.click(within(card("Forklift Operator")).getByRole("button", { name: "Post new shift..." }));
    const dialog = screen.getByRole("dialog", { name: "New shift" });
    expect(within(dialog).getByRole("combobox", { name: "Template" })).toHaveProperty("value", "Forklift Operator");
    fireEvent.change(within(dialog).getByLabelText("Shift Title"), { target: { value: "Night Shift" } });
    await user.click(within(dialog).getByRole("button", { name: longDate(isoOf(new Date())) }));
    await user.click(within(dialog).getByRole("button", { name: "Post shift" }));
    expect(screen.queryByRole("dialog", { name: "New shift" })).toBeNull();
    expect(within(card("Forklift Operator")).getByText("3 Active Shifts")).toBeDefined();
  });

  it("offers a new template to New shift and the Shifts page", async () => {
    const { user, main, card, go } = await openTemplates();
    await user.click(within(main()).getByRole("button", { name: "New template..." }));
    await createTemplate(user, "Shipping Clerk");
    await user.click(within(card("Shipping Clerk")).getByRole("button", { name: "Post new shift..." }));
    const dialog = screen.getByRole("dialog", { name: "New shift" });
    expect(within(dialog).getByRole("combobox", { name: "Template" })).toHaveProperty("value", "Shipping Clerk");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    go("shifts");
    expect(screen.getByRole("rowheader", { name: /Shipping Clerk/ })).toBeDefined();
    // A draft isn't on offer.
    expect(screen.queryByRole("rowheader", { name: /Warehouse Supervisor/ })).toBeNull();
  });
});

describe("the Check-ins page's Manage templates", () => {
  it("goes to Manage Templates from its item, where Create template was", async () => {
    const { user, main, pages } = renderApp("check-ins");
    expect(within(main()).queryByRole("button", { name: /Create template/ })).toBeNull();
    await user.click(within(screen.getByRole("navigation", { name: "Main" })).getByRole("button", { name: "Manage templates" }));
    expect(screen.getByRole("heading", { level: 1, name: "Manage Templates" })).toBeDefined();
    expect(pages).toEqual(["templates"]);
  });
});

describe("New shift's Add New Template", () => {
  it("opens the same form over New shift, then picks the template it creates", async () => {
    const user = userEvent.setup();
    render(
      <CheckInsApp anchor={shiftStart(new Date())} width={1440} height={900} initialPage="shifts" shiftVersion="final" />,
    );
    await user.click(within(screen.getByRole("main")).getByRole("button", { name: "New shift..." }));
    const shift = screen.getByRole("dialog", { name: "New shift" });
    await user.click(within(shift).getByRole("button", { name: longDate(isoOf(new Date())) }));
    await user.click(within(shift).getByRole("button", { name: "Next" }));
    await user.click(within(shift).getByRole("button", { name: "Add new template..." }));
    expect(screen.getByRole("dialog", { name: "Create a template" })).toBeDefined();
    expect(shift.closest("[inert]")).not.toBeNull();

    await createTemplate(user, "Shipping Clerk");
    expect(screen.queryByRole("dialog", { name: "Create a template" })).toBeNull();
    await waitFor(() => expect(shift.closest("[inert]")).toBeNull());
    expect(within(shift).getByRole("combobox", { name: "Template" })).toHaveProperty("value", "Shipping Clerk");
    expect(within(shift).getByRole("heading", { name: "Shipping Clerk" })).toBeDefined();
  });
});

describe("CCLS First Gulf's mandatory requirements", () => {
  it("come ticked and kept in its templates' form once Spotwork sets them, new or edited, and are saved with each", async () => {
    const { user, main, card, go } = renderApp("activations");
    const ccls = within(screen.getByRole("table", { name: "Companies" }))
      .getAllByRole("row")
      .find((row) => row.textContent?.includes("Jesse Pereira"))!;
    await user.click(within(ccls).getByRole("button", { name: "CCLS" }));
    await user.click(within(firstGulf()).getByRole("button", { name: /^Mandatory requirements/ }));
    const requirements = screen.getByRole("dialog", { name: "Mandatory requirements" });
    await user.click(within(requirements).getByRole("checkbox", { name: "Closed Toe Shoes" }));
    await user.click(within(requirements).getByRole("button", { name: "Save changes" }));
    await go("templates");

    const shoes = (sheet: HTMLElement) =>
      within(within(sheet).getByRole("table", { name: "Skills & requirements" })).getByRole("checkbox", { name: "Closed Toe Shoes" });
    const kept = (sheet: HTMLElement) => {
      expect(shoes(sheet).getAttribute("aria-checked")).toBe("true");
      expect(shoes(sheet)).toHaveProperty("disabled", true);
    };
    await user.click(within(main()).getByRole("button", { name: "New template..." }));
    const sheet = screen.getByRole("dialog", { name: "Create a template" });
    const next = () => user.click(within(sheet).getByRole("button", { name: "Next" }));
    fireEvent.change(within(sheet).getByLabelText("Template Title"), { target: { value: "Shipping Clerk" } });
    await next();
    await next();
    kept(sheet);
    await user.click(shoes(sheet));
    kept(sheet);
    await user.click(within(within(sheet).getByRole("table", { name: "Skills & requirements" })).getByLabelText("Delivery"));
    await next();
    fireEvent.change(within(sheet).getByLabelText("Job Description"), { target: { value: "Checks orders." } });
    await next();
    expect(within(sheet.querySelector<HTMLElement>("[data-review]")!).getByText("Closed Toe Shoes")).toBeDefined();
    await user.click(within(sheet).getByRole("button", { name: "Create template" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Create a template" })).toBeNull());

    for (const title of ["Shipping Clerk", "Forklift Operator"]) {
      await user.click(within(card(title)).getByRole("button", { name: "Edit" }));
      const edit = screen.getByRole("dialog", { name: "Edit template" });
      await user.click(within(edit).getByRole("button", { name: /Skills & requirements/ }));
      kept(edit);
      await user.click(within(edit).getByRole("button", { name: "Close" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit template" })).toBeNull());
    }
  });

  it("come ticked and kept in New shift's Add new template too", async () => {
    const user = userEvent.setup();
    const app = createRef<AppHandle>();
    render(
      <CheckInsApp ref={app} anchor={shiftStart(new Date())} width={1440} height={900} initialPage="activations" shiftVersion="final" />,
    );
    const main = () => screen.getByRole("main");
    const go = (page: Page) => act(() => app.current!.go(page));
    const ccls = within(screen.getByRole("table", { name: "Companies" }))
      .getAllByRole("row")
      .find((row) => row.textContent?.includes("Jesse Pereira"))!;
    await user.click(within(ccls).getByRole("button", { name: "CCLS" }));
    await user.click(within(firstGulf()).getByRole("button", { name: /^Mandatory requirements/ }));
    const requirements = screen.getByRole("dialog", { name: "Mandatory requirements" });
    await user.click(within(requirements).getByRole("checkbox", { name: "Standing" }));
    await user.click(within(requirements).getByRole("button", { name: "Save changes" }));
    await go("shifts");
    await user.click(within(main()).getByRole("button", { name: "New shift..." }));
    const shift = within(screen.getByRole("dialog", { name: "New shift" }));
    await user.click(shift.getByRole("button", { name: longDate(isoOf(new Date())) }));
    await user.click(shift.getByRole("button", { name: "Next" }));
    await user.click(shift.getByRole("button", { name: "Add new template..." }));
    const sheet = screen.getByRole("dialog", { name: "Create a template" });
    fireEvent.change(within(sheet).getByLabelText("Template Title"), { target: { value: "Shipping Clerk" } });
    await user.click(within(sheet).getByRole("button", { name: "Next" }));
    await user.click(within(sheet).getByRole("button", { name: "Next" }));
    const standing = within(within(sheet).getByRole("table", { name: "Skills & requirements" })).getByRole("checkbox", { name: "Standing" });
    expect(standing.getAttribute("aria-checked")).toBe("true");
    expect(standing).toHaveProperty("disabled", true);
  });
});

describe("the admin's Manage presets", () => {
  it("opens Manage Template Presets, current in the sidebar instead of Companies", async () => {
    const { user, nav, pages } = renderApp("activations");
    await user.click(within(nav()).getByRole("button", { name: "Manage presets" }));
    expect(screen.getByRole("heading", { level: 1, name: "Manage Template Presets" })).toBeDefined();
    expect(pages).toEqual(["presets"]);
    expect(within(nav()).getByRole("button", { name: "Manage presets" }).getAttribute("aria-current")).toBe("page");
    expect(within(nav()).getByRole("button", { name: "Companies" }).getAttribute("aria-current")).toBeNull();
  });
});
