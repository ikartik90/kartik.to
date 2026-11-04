import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { TeamTemplates } from "../team-templates";
import { SideSheet } from "../ui";

afterEach(cleanup);

describe("Manage templates", () => {
  it("says the presets will appear in their tab while there are none, with nothing to press", async () => {
    const user = userEvent.setup();
    render(
      <SideSheet label="Manage templates">
        <TeamTemplates
          subline="North West Company Ottawa • 1 template"
          own={[{ title: "Receptionist", tags: [] }]}
          presets={[]}
          onDelete={() => {}}
          onDuplicate={() => {}}
        />
      </SideSheet>,
    );
    await user.click(screen.getByRole("tab", { name: "Template presets" }));
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).queryByRole("table")).toBeNull();
    const empty = within(panel).getByText("Spotwork's template presets will appear here");
    expect(empty.parentElement!.textContent).toBe("Spotwork's template presets will appear here");
    expect(within(panel).queryByRole("button")).toBeNull();
  });

  it("sizes the Tags column apart from the tags listed, so it holds still as the list narrows", () => {
    render(
      <SideSheet label="Manage templates">
        <TeamTemplates
          subline="North West Company Ottawa • 1 template"
          own={[{ title: "Receptionist", tags: ["Front Desk"] }]}
          presets={[]}
          onDelete={() => {}}
          onDuplicate={() => {}}
        />
      </SideSheet>,
    );
    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader").map((header) => header.textContent);
    const tracks = table.style.gridTemplateColumns.split(/\s+(?![^(]*\))/);
    expect(tracks[headers.indexOf("Tags")]).not.toMatch(/auto|content/);
  });

  it("narrows each tab's templates to those with any tag picked, out of the tab's own tags, each still acting on its own", async () => {
    const user = userEvent.setup();
    const deleted: number[] = [];
    const duplicated: number[] = [];
    render(
      <SideSheet label="Manage templates">
        <TeamTemplates
          subline="North West Company Ottawa • 3 templates"
          own={[
            { title: "Receptionist", tags: ["Front Desk"] },
            { title: "Security Guard", tags: ["Security", "Licensed"] },
            { title: "Night Guard", tags: ["Security"] },
          ]}
          presets={[
            { title: "Warehouse Associate", tags: ["Warehouse"] },
            { title: "Forklift Operator", tags: ["Warehouse", "Licensed"] },
          ]}
          onDelete={(at) => deleted.push(...at)}
          onDuplicate={(at) => duplicated.push(...at)}
        />
      </SideSheet>,
    );
    const rows = () => within(within(screen.getByRole("table")).getAllByRole("rowgroup").at(-1)!).getAllByRole("row");
    const titles = () => rows().map((row) => within(row).getAllByRole("cell")[1].textContent);
    const tags = () => screen.getByRole("button", { name: /^Tags/ });
    const options = () => within(screen.getByRole("listbox", { name: "Tags" })).getAllByRole("option");
    const toggle = async (tag: string) => {
      await user.click(tags());
      await user.click(within(screen.getByRole("listbox", { name: "Tags" })).getByRole("option", { name: tag }));
      await user.click(tags());
    };

    expect(titles()).toEqual(["Receptionist", "Security Guard", "Night Guard"]);
    await user.click(tags());
    expect(options().map((option) => option.textContent)).toEqual(["Front Desk", "Licensed", "Security"]);
    await user.click(tags());
    await toggle("Security");
    expect(titles()).toEqual(["Security Guard", "Night Guard"]);
    await toggle("Front Desk");
    expect(titles()).toEqual(["Receptionist", "Security Guard", "Night Guard"]);
    await toggle("Front Desk");
    await user.click(within(rows()[1]).getByRole("button", { name: "Delete" }));
    expect(deleted).toEqual([2]);

    // The presets' own tags, none picked.
    await user.click(screen.getByRole("tab", { name: "Template presets" }));
    expect(titles()).toEqual(["Warehouse Associate", "Forklift Operator"]);
    await user.click(tags());
    expect(options().map((option) => option.textContent)).toEqual(["Licensed", "Warehouse"]);
    await user.click(tags());
    await toggle("Licensed");
    expect(titles()).toEqual(["Forklift Operator"]);
    await user.click(within(rows()[0]).getByRole("button", { name: "Duplicate" }));
    expect(duplicated).toEqual([1]);

    await user.click(screen.getByRole("tab", { name: "Team's templates" }));
    expect(titles()).toEqual(["Security Guard", "Night Guard"]);
  });

  it("counts each tab's templates shown, in their names' style, and finds them by title from its header", async () => {
    const user = userEvent.setup();
    render(
      <SideSheet label="Manage templates">
        <TeamTemplates
          subline="North West Company Ottawa • 3 templates"
          own={[
            { title: "Receptionist", tags: ["Front Desk"] },
            { title: "Security Guard", tags: ["Security"] },
            { title: "Night Guard", tags: ["Security"] },
          ]}
          presets={[{ title: "Warehouse Associate", tags: ["Warehouse"] }]}
          onDelete={() => {}}
          onDuplicate={() => {}}
        />
      </SideSheet>,
    );
    const count = () => screen.getByText(/^(\d+ templates?|No templates)$/);
    const titles = () =>
      within(screen.getByRole("table"))
        .getAllByRole("rowgroup")
        .slice(1)
        .flatMap((body) => within(body).getAllByRole("row"))
        .map((row) => within(row).getAllByRole("cell")[1].textContent);
    expect(count().textContent).toBe("3 templates");
    const name = screen.getByText("Receptionist");
    expect(count().getAttribute("data-typography")).toBe(name.getAttribute("data-typography"));
    // Its colour too: none of its own, as the names have none.
    expect(count().className).toBe(name.className);

    const find = within(screen.getByRole("columnheader", { name: "Template title" })).getByRole("searchbox", { name: "Find a template..." });
    await user.type(find, "guard");
    expect(titles()).toEqual(["Security Guard", "Night Guard"]);
    expect(count().textContent).toBe("2 templates");
    await user.clear(find);
    await user.type(find, "Nothing like it");
    // The head stays, its search to clear.
    expect(titles()).toEqual([]);
    expect(screen.getByRole("columnheader", { name: "Template title" })).toBeDefined();
    expect(count().textContent).toBe("No templates");

    await user.click(screen.getByRole("tab", { name: "Template presets" }));
    expect(count().textContent).toBe("1 template");
  });

  it("acts from an action bar at the sheet's foot on the templates ticked, each tab's own action, Cancel unticking them", async () => {
    const user = userEvent.setup();
    const deleted: number[][] = [];
    const duplicated: number[][] = [];
    render(
      <SideSheet label="Manage templates">
        <TeamTemplates
          subline="North West Company Ottawa • 3 templates"
          own={[
            { title: "Receptionist", tags: ["Front Desk"] },
            { title: "Security Guard", tags: ["Security"] },
            { title: "Night Guard", tags: ["Security"] },
          ]}
          presets={[
            { title: "Warehouse Associate", tags: ["Warehouse"] },
            { title: "Forklift Operator", tags: ["Warehouse"] },
          ]}
          onDelete={(at) => deleted.push(at)}
          onDuplicate={(at) => duplicated.push(at)}
        />
      </SideSheet>,
    );
    const sheet = screen.getByRole("dialog", { name: "Manage templates" });
    const bar = () => sheet.querySelector<HTMLElement>("[data-action-bar]");
    const box = (title: string) => screen.getByRole("checkbox", { name: title });
    const all = () => within(screen.getByRole("table")).getByRole("checkbox", { name: "Select all" });
    const row = (title: string) => box(title).closest("[role=row]")!;

    expect(bar()).toBeNull();
    await user.click(box("Receptionist"));
    await user.click(box("Night Guard"));
    expect(row("Night Guard").hasAttribute("data-picked")).toBe(true);
    expect(row("Security Guard").hasAttribute("data-picked")).toBe(false);
    expect(all().getAttribute("aria-checked")).toBe("false");
    // Outside the panel that scrolls, at the sheet's foot.
    expect(screen.getByRole("tabpanel").contains(bar())).toBe(false);
    expect(within(bar()!).getAllByRole("button").map((button) => button.textContent)).toEqual(["Cancel", "Delete"]);
    await user.click(within(bar()!).getByRole("button", { name: "Delete" }));
    expect(deleted).toEqual([[0, 2]]);
    await waitFor(() => expect(bar()).toBeNull());

    // Select all ticks every template shown, and only those.
    await user.type(within(screen.getByRole("columnheader", { name: "Template title" })).getByRole("searchbox"), "guard");
    await user.click(all());
    expect(all().getAttribute("aria-checked")).toBe("true");
    expect([box("Security Guard"), box("Night Guard")].map((each) => each.getAttribute("aria-checked"))).toEqual(["true", "true"]);
    await user.click(within(bar()!).getByRole("button", { name: "Delete" }));
    expect(deleted.at(-1)).toEqual([1, 2]);

    await user.click(all());
    await user.click(within(bar()!).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(bar()).toBeNull());
    expect(all().getAttribute("aria-checked")).toBe("false");

    // Another tab starts with none ticked.
    await user.click(box("Night Guard"));
    await user.click(screen.getByRole("tab", { name: "Template presets" }));
    await waitFor(() => expect(bar()).toBeNull());
    await user.click(all());
    expect(within(bar()!).getAllByRole("button").map((button) => button.textContent)).toEqual(["Cancel", "Duplicate"]);
    await user.click(within(bar()!).getByRole("button", { name: "Duplicate" }));
    expect(duplicated).toEqual([[0, 1]]);
  });
});
