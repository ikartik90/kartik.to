import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionStack, Avatar, type Sort, Table, RiskMatrix, nextSort } from "../data-table";
import { Dropdown } from "../dropdown";
import { Search } from "../search";
import { Button, Chip, Pill, Tooltip, Typography, glyph } from "../ui";
import ConfirmedIcon from "../assets/confirmed.svg";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** `cells` in a row of a table's body, or of its head. */
function inTable(cells: ReactNode, head?: boolean) {
  const Section = head ? Table.Head : Table.Body;
  return (
    <Table aria-label="Shifts" columns="repeat(3, 1fr)">
      <Section>
        <Table.Row>{cells}</Table.Row>
      </Section>
    </Table>
  );
}

describe("Table", () => {
  it("lays its head, body and foot out as row groups, a cell heading its column in the head, its row given header, and a cell elsewhere", () => {
    render(
      <Table aria-label="Timesheet" columns="12.5rem 1fr">
        <Table.Head>
          <Table.Row>
            <Table.Cell>
              <Typography variant="metadata">Worker</Typography>
            </Table.Cell>
            <Table.Cell>
              <Typography variant="metadata">Mon</Typography>
            </Table.Cell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          <Table.Row>
            <Table.Cell header>
              <Typography variant="body">Brittany Pilz</Typography>
            </Table.Cell>
            <Table.Cell>
              <Typography variant="body">8 h</Typography>
            </Table.Cell>
          </Table.Row>
        </Table.Body>
        <Table.Foot>
          <Table.Row>
            <Table.Cell>
              <Typography variant="body">Total</Typography>
            </Table.Cell>
            <Table.Cell>
              <Typography variant="body">8 h</Typography>
            </Table.Cell>
          </Table.Row>
        </Table.Foot>
      </Table>,
    );
    const table = screen.getByRole("table", { name: "Timesheet" });
    expect(table.style.gridTemplateColumns).toBe("12.5rem 1fr");
    const [head, body, foot] = within(table).getAllByRole("rowgroup");
    expect(within(head).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Worker", "Mon"]);
    expect(within(body).getByRole("rowheader").textContent).toBe("Brittany Pilz");
    expect(within(body).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["8 h"]);
    expect(within(foot).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Total", "8 h"]);
  });

  it("names itself and its parts for the code view", () => {
    expect(Table.displayName).toBe("Table");
    expect([Table.Head, Table.Body, Table.Foot, Table.Row, Table.Cell].map((part) => part.displayName)).toEqual([
      "Table.Head",
      "Table.Body",
      "Table.Foot",
      "Table.Row",
      "Table.Cell",
    ]);
  });

  it("throws for a part outside the one it sits in", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Table.Body />)).toThrow("Table.Body must be used inside Table");
    expect(() =>
      render(
        <Table aria-label="Shifts" columns="1fr">
          <Table.Row />
        </Table>,
      ),
    ).toThrow("Table.Row must be used inside Table.Head, Table.Body or Table.Foot");
    expect(() =>
      render(
        <Table aria-label="Shifts" columns="1fr">
          <Table.Body>
            <Table.Cell />
          </Table.Body>
        </Table>,
      ),
    ).toThrow("Table.Cell must be used inside Table.Row");
  });

  it("throws for a head cell's option outside the head, and a body cell's in it", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(inTable(<Table.Cell sortable />))).toThrow("Table.Cell's sortable is for a cell in Table.Head");
    expect(() => render(inTable(<Table.Cell ahead />, true))).toThrow("Table.Cell's ahead is for a cell outside Table.Head");
    expect(() => render(inTable(<Table.Cell empty />, true))).toThrow("Table.Cell's empty is for a cell outside Table.Head");
  });
});

describe("Table.Cell", () => {
  it("holds whatever goes in it, with the attributes it's given", () => {
    render(
      inTable(
        <Table.Cell data-date="2026-10-19">
          <span>Anything</span>
        </Table.Cell>,
      ),
    );
    const cell = screen.getByRole("cell");
    expect(cell.textContent).toBe("Anything");
    expect(cell.getAttribute("data-date")).toBe("2026-10-19");
    expect(cell.hasAttribute("data-ahead")).toBe(false);
  });

  it("marks a day still to come", () => {
    render(inTable(<Table.Cell ahead />));
    expect(screen.getByRole("cell").hasAttribute("data-ahead")).toBe(true);
  });

  it("marks a cell with nothing in it, and only when it's given", () => {
    render(inTable(<Table.Cell empty />));
    expect(screen.getByRole("cell").hasAttribute("data-empty")).toBe(true);
    cleanup();
    render(inTable(<Table.Cell />));
    expect(screen.getByRole("cell").hasAttribute("data-empty")).toBe(false);
  });

  it("names each component a cell holds for the code view", () => {
    const components = { ActionStack, RiskMatrix };
    for (const [name, component] of Object.entries(components)) expect(component.displayName).toBe(name);
    expect(ActionStack.Secondary.displayName).toBe("ActionStack.Secondary");
    expect(ActionStack.Status.displayName).toBe("ActionStack.Status");
    expect(RiskMatrix.Metric.displayName).toBe("RiskMatrix.Metric");
  });

  it("puts its first part on its lead line and each of the rest on a line of its own, as they're given", () => {
    render(
      inTable(
        <Table.Cell>
          <Typography variant="body">Warehouse Associate</Typography>
          <Typography variant="metadata" className={glyph.subdued}>
            General Labourer
          </Typography>
          <Chip size="small" state="affirmative">Licensed</Chip>
        </Table.Cell>,
      ),
    );
    const cell = screen.getByRole("cell");
    expect([...cell.children].map((part) => part.textContent)).toEqual(["Warehouse Associate", "General Labourer", "Licensed"]);
    expect(cell.children[0].hasAttribute("data-lead")).toBe(true);
    expect(screen.getByText("Warehouse Associate").dataset.typography).toBe("body");
    expect(screen.getByText("General Labourer").dataset.typography).toBe("metadata");
  });

  it("keeps a lead part's own element as it is", () => {
    render(
      inTable(
        <Table.Cell>
          <button type="button">Picker Packer</button>
        </Table.Cell>,
      ),
    );
    expect(screen.getByRole("button", { name: "Picker Packer" }).parentElement!.hasAttribute("data-lead")).toBe(true);
  });

  it("puts its avatar first, beside its parts' lines, wherever the avatar goes", () => {
    render(
      inTable(
        <Table.Cell>
          <Typography variant="body">Brittany Pilz</Typography>
          <Avatar>BP</Avatar>
          <Typography variant="metadata">Employer Name</Typography>
        </Table.Cell>,
      ),
    );
    const cell = screen.getByRole("cell");
    expect([...cell.children].map((part) => part.textContent)).toEqual(["BP", "Brittany Pilz", "Employer Name"]);
    expect(cell.children[0].hasAttribute("data-avatar")).toBe(true);
    expect(cell.children[1].hasAttribute("data-lead")).toBe(true);
  });

  it("puts a status's value before its chip, and its action after", () => {
    render(
      <ActionStack>
        <ActionStack.Status>
          <Typography variant="body">Brittany Pilz</Typography>
          <Pill state="success">
            <ConfirmedIcon aria-hidden />
            Confirmed
          </Pill>
          <Button size="icon" aria-label="Undo confirmation" />
        </ActionStack.Status>
      </ActionStack>,
    );
    const line = screen.getByRole("button", { name: "Undo confirmation" }).parentElement!;
    expect([...line.children].map((child) => child.textContent)).toEqual(["Brittany Pilz", "Confirmed", ""]);
  });

  it("stacks a row's secondary actions before its menu", () => {
    render(
      <ActionStack>
        <ActionStack.Secondary>
          <button type="button">Check-in...</button>
        </ActionStack.Secondary>
        <Button size="icon" aria-label="CTA Text" />
      </ActionStack>,
    );
    const actions = screen.getByRole("button", { name: "Check-in..." }).parentElement!;
    expect(actions.nextElementSibling).toBe(screen.getByRole("button", { name: "CTA Text" }));
  });

  const STACK = (
    <>
      <ActionStack>
        <ActionStack.Pending>
          <ActionStack.Secondary>
            <ActionStack.Complete>
              <Button size="small">Confirm 40.00 h</Button>
            </ActionStack.Complete>
          </ActionStack.Secondary>
        </ActionStack.Pending>
        <ActionStack.Done>
          <ActionStack.Status>
            <Pill state="success">Confirmed</Pill>
            <ActionStack.Undo>
              <Button size="icon" aria-label="Undo confirmation" />
            </ActionStack.Undo>
          </ActionStack.Status>
        </ActionStack.Done>
      </ActionStack>
      <ActionStack.Pending>
        <Typography variant="metadata">5 Shifts • 2 Adjusted</Typography>
      </ActionStack.Pending>
      <ActionStack.Done>
        <Typography variant="metadata">40 Hours</Typography>
      </ActionStack.Done>
    </>
  );

  it("swaps a row's actions for its status once one is taken, and back once it's undone, the cell's line with them", async () => {
    const user = userEvent.setup();
    render(<ActionStack.Provider>{STACK}</ActionStack.Provider>);
    expect(screen.queryByText("Confirmed")).toBeNull();
    expect(screen.getByText("5 Shifts • 2 Adjusted")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Confirm 40.00 h" }));
    expect(screen.getByText("Confirmed")).toBeDefined();
    expect(screen.getByText("40 Hours")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Confirm 40.00 h" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Undo confirmation" }));
    expect(screen.getByRole("button", { name: "Confirm 40.00 h" })).toBeDefined();
    expect(screen.getByText("5 Shifts • 2 Adjusted")).toBeDefined();
  });

  it("shows the state its owner says, telling it of each press", async () => {
    const user = userEvent.setup();
    const heard: boolean[] = [];
    function Owned() {
      const [done, setDone] = useState(true);
      return (
        <ActionStack.Provider done={done} onDoneChange={(next) => (heard.push(next), setDone(next))}>
          {STACK}
        </ActionStack.Provider>
      );
    }
    render(<Owned />);
    await user.click(screen.getByRole("button", { name: "Undo confirmation" }));
    await user.click(screen.getByRole("button", { name: "Confirm 40.00 h" }));
    expect(heard).toEqual([false, true]);
    expect(screen.getByText("Confirmed")).toBeDefined();
  });

  it("shows a status alone when it holds nothing else", () => {
    render(
      <ActionStack>
        <ActionStack.Status>
          <Pill state="success">Approved</Pill>
        </ActionStack.Status>
      </ActionStack>,
    );
    expect(screen.getByText("Approved")).toBeDefined();
  });

  it("names each risk matrix metric by its tooltip's words", () => {
    render(
      <RiskMatrix>
        <RiskMatrix.Metric>
          <svg aria-hidden />
          <Tooltip>New Worker</Tooltip>
        </RiskMatrix.Metric>
      </RiskMatrix>,
    );
    expect(screen.getByRole("button", { name: "New Worker" }).textContent).toBe("New Worker");
  });
});

describe("Table.Cell in Table.Head", () => {
  function SortableHeader() {
    const [sort, setSort] = useState<Sort | undefined>();
    return inTable(
      <Table.Cell sort={sort} onSort={setSort}>
        <Typography variant="metadata">Mon</Typography>
      </Table.Cell>,
      true,
    );
  }

  it("sorts by its column ascending first, then turns the order round with each press", () => {
    expect(nextSort(undefined)).toBe("ascending");
    expect(nextSort("ascending")).toBe("descending");
    expect(nextSort("descending")).toBe("ascending");
  });

  it("is unsorted until its sort button is pressed, then sorted, its button turned the order's way", async () => {
    const user = userEvent.setup();
    render(<SortableHeader />);
    const header = screen.getByRole("columnheader");
    const button = screen.getByRole("button", { name: "Sort by Mon" });
    expect(header.getAttribute("aria-sort")).toBe("none");
    expect(button.hasAttribute("data-dir")).toBe(false);
    await user.click(button);
    expect(header.getAttribute("aria-sort")).toBe("ascending");
    expect(button.getAttribute("data-dir")).toBe("ascending");
    await user.click(button);
    expect(header.getAttribute("aria-sort")).toBe("descending");
  });

  it("sorts by itself when sortable, starting from its default order", async () => {
    const user = userEvent.setup();
    render(
      inTable(
        <>
          <Table.Cell sortable>
            <Typography variant="metadata">Mon</Typography>
          </Table.Cell>
          <Table.Cell sortable defaultSort="descending">
            <Typography variant="metadata">Tue</Typography>
          </Table.Cell>
        </>,
        true,
      ),
    );
    const [unsorted, sorted] = screen.getAllByRole("columnheader");
    expect(unsorted.getAttribute("aria-sort")).toBe("none");
    expect(sorted.getAttribute("aria-sort")).toBe("descending");
    await user.click(screen.getByRole("button", { name: "Sort by Mon" }));
    expect(unsorted.getAttribute("aria-sort")).toBe("ascending");
    await user.click(screen.getByRole("button", { name: "Sort by Tue" }));
    expect(sorted.getAttribute("aria-sort")).toBe("ascending");
  });

  it("marks its date as today's in a calendar's header, and has nothing to press", () => {
    render(
      inTable(
        <Table.Cell active>
          <Typography variant="metadata">15</Typography>
          <Typography variant="metadata">Mon</Typography>
        </Table.Cell>,
        true,
      ),
    );
    const header = screen.getByRole("columnheader");
    expect(header.getAttribute("aria-current")).toBe("date");
    expect(header.hasAttribute("aria-sort")).toBe(false);
    expect(header.textContent).toBe("15Mon");
    // Of a day's two words, the first is its date, the ringed one.
    expect(screen.getByText("15").hasAttribute("data-date")).toBe(true);
    expect(screen.getByText("Mon").hasAttribute("data-date")).toBe(false);
    expect(within(header).queryByRole("button")).toBeNull();
  });

  it("takes a press anywhere in a search's cell into its search, and keeps it there", async () => {
    const user = userEvent.setup();
    render(
      inTable(
        <Table.Cell search aria-label="Shift">
          <Search size="small" aria-label="Find a shift" placeholder="Find a shift..." />
        </Table.Cell>,
        true,
      ),
    );
    const search = screen.getByRole("searchbox", { name: "Find a shift" });
    await user.click(screen.getByRole("columnheader", { name: "Shift" }));
    expect(document.activeElement).toBe(search);
    await user.click(screen.getByRole("columnheader", { name: "Shift" }));
    expect(document.activeElement).toBe(search);
  });
});

describe("a small Dropdown across its cell", () => {
  it("still lists its options and takes the one picked", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = useState("Selected Value");
      return (
        <Dropdown size="small" value={value} onChange={setValue} fill>
          <Dropdown.Item><Typography variant="bodyLarge">One</Typography></Dropdown.Item>
          <Dropdown.Item><Typography variant="bodyLarge">Two</Typography></Dropdown.Item>
        </Dropdown>
      );
    }
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Selected Value" }));
    await user.click(screen.getByRole("option", { name: "Two" }));
    expect(screen.getByRole("button", { name: "Two" }).getAttribute("aria-expanded")).toBe("false");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });
});
