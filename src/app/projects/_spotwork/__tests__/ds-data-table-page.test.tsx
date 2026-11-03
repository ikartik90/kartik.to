import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AVATAR, DATA_TABLE_STORIES } from "../ds-data-table";
import { renderStories } from "./story-harness";

afterEach(cleanup);

// Avatar is listed under Primitives.
const setup = () => renderStories([...DATA_TABLE_STORIES, AVATAR]);

/** The words of each of a table's column heads, and of its body's cells. */
const parts = (preview: HTMLElement) => ({
  heads: within(preview).getAllByRole("columnheader").map((cell) => cell.textContent),
  cells: within(within(preview).getAllByRole("rowgroup")[1]).getAllByRole("cell").map((cell) => cell.textContent),
});

describe("the Data Table page's examples", () => {
  it("keeps the app's tables, then the table cell", () => {
    expect(DATA_TABLE_STORIES.map((story) => story.id)).toEqual(["Table", "Table Cell"]);
  });

  it("composes each of the app's tables, its head over a row, the Check-ins dashboard's first", () => {
    const { titles, preview } = setup();
    expect(titles("Table")).toEqual(["Timesheet", "Shifts", "Companies"]);
    const checkIns = parts(preview("Table"));
    expect(checkIns.heads).toEqual(["", "", "Shift information", "Check-in status", "Risk factor", "Actions"]);
    expect(checkIns.cells).toHaveLength(6);
    expect(within(preview("Table", "Timesheet")).getAllByRole("rowgroup")).toHaveLength(3);
    expect(parts(preview("Table", "Shifts")).heads).toEqual(["", "15Mon", "16Tue"]);
    expect(within(preview("Table", "Shifts")).getByRole("rowheader").textContent).toBe("Forklift OperatorLicensedWarehouse+2");
    const activations = within(preview("Table", "Companies")).getAllByRole("columnheader");
    expect(activations.map((head) => head.getAttribute("aria-label") ?? head.textContent)).toEqual([
      "Company",
      "Owner",
      "Contact information",
      "Added on",
      "Status",
    ]);
    expect(activations.map((head) => head.getAttribute("aria-sort"))).toEqual(["none", "none", null, "none", null]);
  });

  it("shows the cell in its three states, then in a table's head, then holding tags, then its actions", () => {
    const { titles, preview } = setup();
    expect(titles("Table Cell")).toEqual(["State", "Type", "Is active", "Is sortable", "Tags", "Action stack"]);
    const states = [...preview("Table Cell", "State").querySelectorAll("[data-cell]")];
    expect(states.map((cell) => cell.textContent)).toEqual([
      "Brittany PilzCCLS Pool+1 (647) 555-0121",
      "Brittany PilzCCLS Pool+1 (647) 555-0121",
      "",
    ]);
    for (const title of ["Type", "Is active", "Is sortable"]) {
      expect(within(preview("Table Cell", title)).queryAllByRole("cell"), title).toEqual([]);
      expect(within(preview("Table Cell", title)).getAllByRole("columnheader").length, title).toBeGreaterThan(1);
    }
    expect(titles("Avatar")).toEqual(["Picture", "Type", "Size"]);
  });

  it("leaves the status chips to the Chip page", () => {
    const { titles } = setup();
    expect(titles("Table Cell").filter((title) => /Status\//.test(title) || title.endsWith(" Status"))).toEqual([]);
  });

  it("starts with a worker from the store: their face beside three lines", () => {
    const { preview } = setup();
    expect(preview("Table Cell").querySelector("img")).not.toBeNull();
    expect(preview("Table Cell").textContent).toBe(`Brittany PilzCCLS Pool+1 (647) 555-0121`);
  });

  it("writes a cell's text as Typography, in Figma's words for the worker", () => {
    const { preview } = setup();
    expect(preview("Table Cell").querySelectorAll("[data-typography=body], [data-typography=metadata]").length).toBeGreaterThan(1);
    expect(document.body.textContent).not.toContain("Spotter");
  });

  it("shows the timesheet's worker over their Spotscore, their pending total under its Confirm, and the day's hours below", () => {
    const { preview } = setup();
    const timesheet = preview("Table", "Timesheet");
    expect(within(timesheet).getByRole("rowheader").querySelector("[data-tier]")?.textContent).toBe("Super78");
    const [body, foot] = within(timesheet).getAllByRole("rowgroup").slice(1);
    const pending = within(body).getAllByRole("cell").at(-1)!;
    expect(within(pending).getByRole("button").textContent).toBe("Confirm 8.00 h");
    expect(pending.textContent).toBe("Confirm 8.00 h1 Shift");
    expect(within(foot).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Total hours", "8.00 h", "", ""]);
  });

  it("holds a row's actions in a cell, then its hours still to confirm beside confirmed, each confirming and undoing by itself", async () => {
    const { user, preview } = setup();
    const [actions, pending, done] = [...preview("Table Cell", "Action stack").querySelectorAll<HTMLElement>("[data-cell]")];
    expect(within(actions).getAllByRole("cell")).toHaveLength(1);
    expect(within(actions).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Check-in...",
      "Mark absent...",
      "More actions",
    ]);
    expect([pending.textContent, done.textContent]).toEqual(["Confirm 40.00 h5 Shifts • 2 Adjusted", "ConfirmedUndo confirmation40 Hours"]);
    await user.click(within(pending).getByRole("button", { name: "Confirm 40.00 h" }));
    expect(within(pending).getByText("Confirmed")).toBeDefined();
    await user.click(within(done).getByRole("button", { name: "Undo confirmation" }));
    expect(within(done).getByRole("button", { name: "Confirm 40.00 h" })).toBeDefined();
  });

  it("draws the Check-ins dashboard's late check-in as its status cell does, its chip's icon too", () => {
    const { preview } = setup();
    const status = within(preview("Table")).getAllByRole("cell")[3];
    expect(status.querySelector("[data-tone] svg, svg")).not.toBeNull();
    expect(status.textContent).toMatch(/^Late Check-In\d{1,2}:\d{2} [AP]M–\d{1,2}:\d{2} [AP]M.* EST\d{1,2}:\d{2} [AP]M\+\d+m–In Progress EST$/);
  });

  it("shows a scheduled shift's places filled on its progress bar", () => {
    const { preview } = setup();
    const shift = within(preview("Table", "Shifts")).getAllByRole("cell")[0];
    expect(shift.querySelector("[data-progress]")?.textContent).toMatch(/^\d+\/\d+Filled$/);
  });

  it("draws each cell in a table of its own", () => {
    const { preview } = setup();
    for (const title of [undefined, "State", "Type", "Is active", "Is sortable", "Tags", "Action stack"]) {
      const shown = preview("Table Cell", title);
      const cells = shown.querySelectorAll("[role=cell], [role=columnheader]");
      expect(within(shown).getAllByRole("table"), title).toHaveLength(cells.length);
    }
  });

  it("sets a day to come on the page's grey", () => {
    const { preview } = setup();
    const states = [...preview("Table Cell", "State").firstElementChild!.children];
    expect(states.map((cell) => cell.querySelector("[data-ahead]") !== null)).toEqual([false, true, false]);
  });

  it("sets a cell with nothing in it on the disabled surface", () => {
    const { preview } = setup();
    const states = [...preview("Table Cell", "State").firstElementChild!.children];
    expect(states.map((cell) => cell.querySelector("[data-empty]") !== null)).toEqual([false, false, true]);
  });

  it("shows tags as small chips with their Add, and the small type-ahead Add opens with its Save and Cancel", () => {
    const { preview } = setup();
    const [tags, adding] = [...preview("Table Cell", "Tags").querySelectorAll<HTMLElement>("[data-cell]")];
    expect(within(tags).getAllByRole("button", { name: "Remove" })).toHaveLength(3);
    expect(within(tags).getByRole("button", { name: "Add tags" })).toBeDefined();
    const field = within(adding).getByRole("combobox", { name: "Tag name" });
    expect(field.closest("[data-box]")!.getAttribute("data-size")).toBe("small");
    expect(within(adding).getByRole("button", { name: "Save" })).toBeDefined();
    expect(within(adding).getByRole("button", { name: "Cancel" })).toBeDefined();
  });

  it("heads a calendar's day, today's active, and a column that sorts by itself", async () => {
    const { user, preview } = setup();
    const days = within(preview("Table Cell", "Is active")).getAllByRole("columnheader");
    expect(days.map((day) => day.getAttribute("aria-current"))).toEqual([null, "date"]);
    const columns = within(preview("Table Cell", "Is sortable")).getAllByRole("columnheader");
    expect(columns.map((column) => column.getAttribute("aria-sort"))).toEqual(["none", "ascending"]);
    await user.click(within(columns[0]).getByRole("button", { name: "Sort by Company" }));
    expect(columns[0].getAttribute("aria-sort")).toBe("ascending");
  });

  it("shows an avatar's initials without a picture", () => {
    const { preview } = setup();
    // A worker's picture and initials; a company's logo and, without one, the Business icon.
    expect(preview("Avatar", "Picture").querySelectorAll("img")).toHaveLength(2);
    expect(preview("Avatar", "Picture").textContent).toBe("BP");
    expect(preview("Avatar", "Picture").querySelectorAll("[data-type=company] > span > svg")).toHaveLength(1);
    const types = [...preview("Avatar", "Type").querySelectorAll("[data-cell] > span")];
    expect(types.map((avatar) => avatar.getAttribute("data-type"))).toEqual([null, "company"]);
  });

  it("writes each example as the code that draws it", () => {
    const { code } = setup();
    // Tags are chips in the cell's Tags.
    expect(code("Table Cell", "Tags")).toMatch(/<Tags\s+options=\{\["Assembly Line", [^\]]+\]\}\s+defaultAdding\s+>/);
    expect(code("Table Cell", "Tags")).toContain('<Chip state="affirmative">');
    // A scheduled shift's progress reads its places from the shift.
    expect(code("Table", "Shifts")).toMatch(
      /<ProgressBar\s+fill\s+value=\{shift\.filled\}\s+max=\{shift\.total\}\s+tone=\{shift\.tone\}\s+>/,
    );
    // A day's column is as wide as a day on the Shifts page.
    expect(code("Table", "Shifts")).toContain('columns="12.5rem repeat(2, 10.25rem)"');
    expect(code("Table Cell", "Is active")).toContain('columns="10.25rem"');
    // The Action stack's state is held by its Provider.
    expect(code("Table Cell", "Action stack")).toContain("<ActionStack.Provider defaultDone>");
    // A cell's components come from their own files.
    expect(code("Table", "Timesheet")).toContain('import { ActionStack } from "@/components/ui/action-stack"');
    expect(code("Table", "Timesheet")).toContain('<Typography variant="metadata" color="subdued">');
    expect(code("Table", "Timesheet")).toContain("<Table.Foot>");
    expect(code("Table Cell", "Is sortable")).toContain('<Table.Cell sortable defaultSort="ascending">');
    expect(code("Avatar", "Picture")).toContain('<Avatar size="medium">BP</Avatar>');
    // An avatar and its lines go straight in the cell, the cell in its table's row.
    expect(code("Table Cell")).toContain('import { Avatar } from "@/components/ui/avatar"');
    expect(code("Table Cell")).toContain('import { Table } from "@/components/ui/table"');
    expect(code("Table Cell")).toMatch(/<Table\.Row>\n\s+<Table\.Cell>\n(\s+)<Avatar src=\{worker.face\} \/>\n\1<Typography variant="body">\{worker.name\}<\/Typography>\n/);
    // Pictures come from the store, never from files in the code.
    for (const title of [undefined, "Picture", "Size"]) expect(code(title ? "Avatar" : "Table Cell", title)).not.toContain("@/assets");
    expect(code("Avatar", "Size")).toContain("export function AvatarSize({ worker }: { worker: Worker }) {");
    expect(screen.queryAllByText(/\(\) => \{\}/)).toHaveLength(0);
  });
});
