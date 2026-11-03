import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { CheckInsApp, type AppHandle, type Page } from "../check-ins-app";
import { LOCATION_HISTORY, NOT_TRACKING, SNACKS } from "../copy";
import { shiftStart } from "../data";
import { ticksOf } from "../data-viz";
import { iconButtonStyle } from "../ui";
import { addDays, isoOf, longDate, recentSpend, seedSeries, weekLabel, weekOf, weekSpots } from "../shifts";
import { bookedText } from "../worker-pool";

afterEach(cleanup);

/** The page's parts loading afresh. */
const busy = () => [...document.querySelectorAll("[data-app-scroll] [aria-busy=true]")];

/** Switches the sidebar's team to `name`. */
async function switchTeam(user: ReturnType<typeof userEvent.setup>, name: string) {
  const nav = screen.getByRole("navigation", { name: "Main" });
  await user.click(nav.firstElementChild!.querySelector("button")!);
  await user.click(within(screen.getByRole("dialog", { name: "Switch team" })).getByRole("button", { name: new RegExp(`^${name}`) }));
}

function setup(width: number) {
  const user = userEvent.setup();
  // As the overlay does: the customer's shift started half an hour or more ago.
  render(<CheckInsApp anchor={shiftStart(new Date())} width={width} height={900} />);
  const nav = screen.getByRole("navigation", { name: "Main" });
  const isOpen = () => nav.getAttribute("data-state") === "open" && !nav.hasAttribute("inert");
  return { user, nav, isOpen };
}

describe("the app's sidebar", () => {
  it("lists only what the prototype presents, with Overview as the current page", () => {
    const { nav } = setup(1440);
    // The Check-ins dashboard is the operations team's, under Admin, as are the activations and presets.
    expect([...nav.children[1].children].map((item) => item.textContent)).toEqual([
      "Overview",
      "Shifts",
      "Timesheets",
      "Invoicing",
      "Manage templates",
      "Manage worker pool",
      "Admin",
      "Check-ins dashboard",
      "Companies",
      "Manage presets",
      "Verifications",
      "Cancellations",
      "Platform settings",
    ]);
    expect(within(nav).getByRole("button", { name: "Overview" }).getAttribute("aria-current")).toBe("page");
  });

  it("keeps only its project's pages in reach, the others placeholders", () => {
    const reach = (initialPage: Page) => {
      render(<CheckInsApp anchor={shiftStart(new Date())} width={1440} height={900} initialPage={initialPage} />);
      const items = within(screen.getByRole("navigation", { name: "Main" }))
        .getAllByRole("button")
        .map((item) => item.textContent || item.getAttribute("aria-label"));
      cleanup();
      return items;
    };
    const account = ["Notifications", "Profile settings"];
    expect(reach("check-ins")).toEqual([
      "CCLS First Gulf",
      "Overview",
      "Timesheets",
      "Manage templates",
      "Check-ins dashboard",
      ...account,
    ]);
    expect(reach("presets")).toEqual([
      "CCLS First Gulf",
      "Shifts",
      "Manage worker pool",
      "Companies",
      "Manage presets",
      ...account,
    ]);
  });

  it("heads itself with the team, in place of a team card on the pages, which opens the company's teams to switch to", async () => {
    for (const initialPage of ["check-ins", "shifts", "timesheets", "templates", "pool"] as const) {
      render(<CheckInsApp anchor={shiftStart(new Date())} width={1440} height={900} initialPage={initialPage} />);
      expect(screen.queryByRole("button", { name: "View contact info" }), initialPage).toBeNull();
      expect(screen.queryByRole("heading", { name: "CCLS First Gulf" }), initialPage).toBeNull();
      cleanup();
    }
    const { user, nav } = setup(1440);
    const team = () => nav.firstElementChild!.querySelector("button")!;
    expect(team().textContent).toBe("CCLS First Gulf");
    await user.click(team());
    const records = () => within(screen.getByRole("dialog", { name: "Switch team" })).getAllByRole("button");
    // Its logo, then its name over its address.
    expect(records().map((record) => [...record.firstElementChild!.children].map((part) => part.getAttribute("data-avatar") ?? part.textContent))).toEqual([
      ["", "CCLS First GulfSelected", "250 First Gulf Boulevard, Brampton, ON"],
      ["", "CCLS White Hart", "6090 White Hart Lane, Mississauga, ON"],
      ["", "CCLS Derwent", "101-1005 Derwent Way, Delta, BC"],
      ["", "CCLS Thornton", "1180 Thornton Road, Oshawa, ON"],
    ]);
    await user.click(records()[2]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(team().textContent).toBe("CCLS Derwent");
    await user.click(team());
    expect(records().map((record) => record.getAttribute("aria-current"))).toEqual([null, null, "true", null]);
  });

  it("loads only the team's shifts afresh on Check-ins for a team switched to, as skeletons for a moment, and not for the team it's on", async () => {
    const { user } = setup(1440);
    const main = document.querySelector("[data-app-scroll] [role=main]")!;
    await switchTeam(user, "CCLS First Gulf");
    expect(busy()).toEqual([]);
    await switchTeam(user, "CCLS Thornton");
    const cards = [...main.querySelectorAll("[data-shift]")];
    expect(cards.length).toBeGreaterThan(0);
    expect(busy()).toEqual(cards);
    for (const card of cards) {
      expect(card.hasAttribute("inert")).toBe(true);
      // Its codes, its workers' faces and statuses too, which differ from team to team.
      expect([...card.querySelectorAll("button [data-skeleton]")].map((bar) => bar.textContent).slice(0, 2)).toEqual([
        expect.stringMatching(/^Check-in: \d+$/),
        expect.stringMatching(/^Check-out: \d+$/),
      ]);
      expect(card.querySelector("[data-avatar] img")).toBeNull();
      expect(card.querySelector("[data-shape=pill] [data-skeleton]")).not.toBeNull();
    }
    // The greeting, the section's heading and its days stay as they are.
    expect([...main.querySelectorAll("[data-skeleton]")].every((bar) => bar.closest("[data-shift]"))).toBe(true);
    await waitFor(() => expect(busy()).toEqual([]), { timeout: 2000 });
    expect(main.querySelector("[data-skeleton]")).toBeNull();
  });

  it("loads only a table's rows afresh for a team switched to, its search and headers as they were", async () => {
    for (const [initialPage, name] of [["pool", "Worker pool"], ["timesheets", "Timesheet"], ["shifts", "Shifts"]] as const) {
      const user = userEvent.setup();
      render(<CheckInsApp anchor={shiftStart(new Date())} width={1440} height={900} initialPage={initialPage} />);
      const table = screen.getByRole("table", { name });
      const search = within(table).getByRole("searchbox");
      await user.type(search, "a");
      await switchTeam(user, "CCLS Thornton");
      const [head, body] = within(table).getAllByRole("rowgroup");
      expect(busy(), initialPage).toEqual([body]);
      expect(head.querySelector("[data-skeleton]"), initialPage).toBeNull();
      expect((search as HTMLInputElement).value, initialPage).toBe("a");
      cleanup();
    }
  });

  it("loads Manage templates' cards afresh for a team switched to, and nothing on the operations team's pages", async () => {
    for (const initialPage of ["templates", "dashboard", "activations", "presets"] as const) {
      const user = userEvent.setup();
      render(<CheckInsApp anchor={shiftStart(new Date())} width={1440} height={900} initialPage={initialPage} />);
      await switchTeam(user, "CCLS Thornton");
      const list = screen.queryByRole("list", { name: "Templates" });
      expect(busy(), initialPage).toEqual(initialPage === "templates" ? [list] : []);
      expect(document.querySelectorAll("[data-app-scroll] [data-skeleton]:not([aria-busy=true] *)"), initialPage).toHaveLength(0);
      cleanup();
    }
  });

  it("holds the account at its foot, with no header over the app", () => {
    const { nav } = setup(1440);
    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.queryByRole("img", { name: "Spotwork" })).toBeNull();
    expect(within(nav).getByRole("button", { name: "Notifications" })).toBeDefined();
    expect(within(nav).getByText("Jesse Pereira")).toBeDefined();
    expect(within(nav).getByRole("button", { name: "Profile settings" })).toBeDefined();
  });

  it("stays open when there's room beside the page", () => {
    expect(setup(1440).isOpen()).toBe(true);
  });

  it("starts closed when there isn't", () => {
    expect(setup(1000).isOpen()).toBe(false);
  });

  it("keeps a rail of its items in reach while closed", async () => {
    const { user, nav, isOpen } = setup(1000);
    expect(nav.hasAttribute("inert")).toBe(false);
    await user.click(within(nav).getByRole("button", { name: "Timesheets" }));
    expect(isOpen()).toBe(false);
    expect(within(nav).getByRole("button", { name: "Timesheets" }).getAttribute("aria-current")).toBe("page");
  });

  it("stays open beside the page through a press outside it", async () => {
    const { isOpen } = setup(1440);
    fireEvent.pointerDown(screen.getByRole("heading", { name: "Check-ins" }));
    expect(isOpen()).toBe(true);
  });
});

describe("the page, kept in step with the overlay's versions", () => {
  it("tells the overlay when its sidebar changes the page", async () => {
    const user = userEvent.setup();
    const pages: string[] = [];
    render(<CheckInsApp anchor={shiftStart(new Date())} width={1440} height={900} onPage={(page) => pages.push(page)} />);
    const nav = within(screen.getByRole("navigation", { name: "Main" }));
    const [customer, timesheets, admin] = ["Overview", "Timesheets", "Check-ins dashboard"].map((name) =>
      nav.getByRole("button", { name }),
    );
    await user.click(timesheets);
    await user.click(customer);
    await user.click(admin);
    expect(pages).toEqual(["timesheets", "check-ins", "dashboard"]);
    expect(admin.getAttribute("aria-current")).toBe("page");
  });

  it("goes to the page the overlay asks for", () => {
    const app = createRef<AppHandle>();
    render(<CheckInsApp ref={app} anchor={shiftStart(new Date())} width={1440} height={900} />);
    act(() => app.current?.go("dashboard"));
    expect(screen.getByRole("heading", { level: 1, name: "Check-Ins" })).toBeDefined();
    const admin = within(screen.getByRole("navigation", { name: "Main" })).getByRole("button", { name: "Check-ins dashboard" });
    expect(admin.getAttribute("aria-current")).toBe("page");
  });

  it("opens on the page it's given", () => {
    render(<CheckInsApp anchor={shiftStart(new Date())} width={1440} height={900} initialPage="dashboard" />);
    expect(screen.getByRole("heading", { level: 1, name: "Check-Ins" })).toBeDefined();
  });
});

describe("the Manage worker pool page", () => {
  const app = createRef<AppHandle>();
  function openPool() {
    const user = userEvent.setup();
    render(<CheckInsApp ref={app} anchor={shiftStart(new Date())} width={1440} height={900} initialPage="pool" />);
    return user;
  }
  const table = () => screen.getByRole("table", { name: "Worker pool" });
  const rows = () => within(within(table()).getAllByRole("rowgroup").at(-1)!).queryAllByRole("row");
  const cells = (row: HTMLElement) => within(row).getAllByRole("cell");
  const names = () => rows().map((row) => cells(row)[0].querySelector("button")!.textContent);
  const row = (name: string) => rows().find((r) => cells(r)[0].textContent === name)!;
  const tags = (name: string) =>
    within(cells(row(name))[3]).queryAllByRole("button", { name: /^Remove / }).map((tag) => tag.getAttribute("aria-label")!.slice("Remove ".length));
  const FIGMA = ["Tashonda Williams", "Rayna Rhiel Madsen", "Angel Saris", "Aspen Curtis", "Alejandro Vasquez", "Maria Franci"];

  it("lists the team's pool as Figma has it: each worker's last booking, shifts and tags, the favourites starred", () => {
    openPool();
    expect(screen.getByRole("heading", { level: 1, name: "Manage worker pool" })).toBeDefined();
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("button", { name: "Manage worker pool" }).getAttribute("aria-current")).toBe("page");
    expect(within(table()).getAllByRole("columnheader").map((head) => head.getAttribute("aria-label") ?? head.textContent)).toEqual([
      "Worker",
      "Last booked",
      "Total shifts",
      "Tags",
      "Actions",
    ]);
    expect(names()).toEqual(FIGMA);
    const today = new Date();
    const tashonda = cells(row("Tashonda Williams"));
    expect(within(table()).queryAllByRole("checkbox")).toHaveLength(0);
    expect(tashonda[0].querySelector("img")).not.toBeNull();
    expect(tashonda[1].textContent).toBe(bookedText(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2)));
    expect(tashonda[2].textContent).toBe("15");
    expect(tags("Tashonda Williams")).toEqual(["AM", "Weekdays", "Warehouse"]);
    expect(rows().map((r) => (within(r).queryByRole("button", { name: "Remove favourite" }) ? "★" : "☆"))).toEqual(["★", "☆", "★", "☆", "☆", "☆"]);
  });

  it("finds workers by name or number typed in the Worker column's header, by their total shifts, and by any tag picked", async () => {
    const user = openPool();
    const find = within(screen.getByRole("columnheader", { name: "Worker" })).getByRole("searchbox", { name: "Find a worker..." });
    await user.type(find, "rayna");
    expect(names()).toEqual(["Rayna Rhiel Madsen"]);
    await user.clear(find);

    await user.click(screen.getByRole("button", { name: /^Total shifts/ }));
    const [low, high] = within(screen.getByRole("dialog", { name: "Total shifts" })).getAllByRole("slider");
    for (let step = 0; step < 3; step++) fireEvent.keyDown(high, { key: "ArrowLeft" });
    expect(names()).toEqual(["Tashonda Williams", "Angel Saris", "Alejandro Vasquez"]);
    fireEvent.keyDown(low, { key: "ArrowRight" });
    expect(names()).toEqual(["Angel Saris", "Alejandro Vasquez"]);
    expect(screen.getByRole("button", { name: /^Total shifts/ }).textContent).toContain("25–50");

    await user.click(screen.getByRole("button", { name: "Tags" }));
    await user.click(screen.getByRole("option", { name: "Weekends" }));
    expect(names()).toEqual(["Alejandro Vasquez"]);
    await user.click(screen.getByRole("option", { name: "AM" }));
    expect(names()).toEqual(["Angel Saris", "Alejandro Vasquez"]);
  });

  it("stars a worker, takes their tags off and adds more, and takes them out of the pool", async () => {
    const user = openPool();
    await user.click(within(row("Rayna Rhiel Madsen")).getByRole("button", { name: "Favourite" }));
    expect(within(row("Rayna Rhiel Madsen")).getByRole("button", { name: "Remove favourite" })).toBeDefined();

    await user.click(within(row("Tashonda Williams")).getByRole("button", { name: "Remove AM" }));
    expect(tags("Tashonda Williams")).toEqual(["Weekdays", "Warehouse"]);

    // In the cell: a small type-ahead in Add's place, with its Save and Cancel.
    const cell = () => cells(row("Tashonda Williams"))[3];
    await user.click(within(cell()).getByRole("button", { name: "Add tags" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(within(cell()).queryByRole("button", { name: "Add tags" })).toBeNull();
    const field = within(cell()).getByRole("combobox", { name: "Tag name" });
    expect(document.activeElement).toBe(field);
    await user.type(field, "week");
    // The team's other tags, but those they have.
    const offered = screen.getAllByRole("option").map((option) => option.textContent);
    expect(offered).toContain("Weekends");
    expect(offered).not.toContain("Weekdays");
    expect(offered.at(-1)).toBe('Create "week" tag');
    await user.click(screen.getByRole("option", { name: "Weekends" }));
    await user.click(within(cell()).getByRole("button", { name: "Save" }));
    expect(tags("Tashonda Williams")).toEqual(["Weekdays", "Warehouse", "Weekends"]);
    expect(within(cell()).queryByRole("combobox")).toBeNull();
    expect(document.activeElement).toBe(within(cell()).getByRole("button", { name: "Add tags" }));

    // A new one: Enter takes the suggestion to create it, then saves it.
    await user.click(within(cell()).getByRole("button", { name: "Add tags" }));
    await user.type(within(cell()).getByRole("combobox", { name: "Tag name" }), "Forklift{Enter}{Enter}");
    expect(tags("Tashonda Williams")).toEqual(["Weekdays", "Warehouse", "Weekends", "Forklift"]);

    // Saved with nothing typed, it turns Alert; Cancel puts it away.
    await user.click(within(cell()).getByRole("button", { name: "Add tags" }));
    await user.click(within(cell()).getByRole("button", { name: "Save" }));
    expect(within(cell()).getByRole("combobox", { name: "Tag name" }).closest("[data-box]")!.getAttribute("data-state")).toBe("alert");
    await user.click(within(cell()).getByRole("button", { name: "Cancel" }));
    expect(within(cell()).queryByRole("combobox")).toBeNull();
    expect(tags("Tashonda Williams")).toEqual(["Weekdays", "Warehouse", "Weekends", "Forklift"]);

    await user.click(within(row("Maria Franci")).getByRole("button", { name: "Remove from worker pool" }));
    expect(screen.getByRole("status").textContent).toBe(SNACKS.workerRemoved);
    expect(names()).toEqual(FIGMA.slice(0, -1));
  });

  it("keeps in step with the pool in its company's settings, either way", async () => {
    const user = openPool();
    await user.click(within(row("Maria Franci")).getByRole("button", { name: "Remove from worker pool" }));

    act(() => app.current?.go("activations"));
    await user.click(screen.getByRole("button", { name: "CCLS" }));
    const sheet = screen.getByRole("dialog", { name: "Company settings" });
    await user.click(within(sheet).getByRole("button", { name: "Manage worker pool5 workers" }));
    const pool = screen.getByRole("dialog", { name: "Manage worker pool" });
    await user.click(within(pool).getByRole("tab", { name: "Find workers" }));
    await user.click(within(pool).getByRole("button", { name: "Find by name or number" }));
    await user.type(within(pool).getByRole("combobox", { name: "Find a Worker" }), "disha");
    await user.click(within(pool).getByRole("button", { name: "Add to pool" }));

    act(() => app.current?.go("pool"));
    expect(names()).toEqual([...FIGMA.slice(0, -1), "Disha Patil"]);
    expect(tags("Disha Patil")).toEqual([]);
  });
});

describe("the Check-ins page's cards", () => {
  const cards = () => [...screen.getByRole("main").querySelectorAll("[data-card]")];

  it("lead the page in place of its buttons, opening nothing: this week's shifts, and the last six weeks' spending by week", () => {
    setup(1440);
    const main = within(screen.getByRole("main"));
    expect(main.queryByRole("button", { name: "New shift..." })).toBeNull();
    expect(cards().map((card) => card.querySelector(":scope > [data-card-header]")?.textContent)).toEqual(["Shifts this week", "Spending"]);
    expect(cards().flatMap((card) => [...card.querySelectorAll("button")])).toEqual([]);
    const today = isoOf(new Date());
    const now = new Date().getHours() * 60 + new Date().getMinutes();
    const { checkedIn, absent, filled, vacant } = weekSpots(seedSeries(today), today, now);
    const [shifts, spending] = cards().map((card) => card.textContent);
    expect(shifts).toBe(
      `Shifts this week${checkedIn + absent + filled + vacant}spotsCompleted${checkedIn}Absent${absent}Filled${filled}Vacant${vacant}`,
    );
    const { total, first, last, weeks } = recentSpend(today, now);
    const [dollars, cents] = total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split(".");
    const scale = [...ticksOf(Math.max(...weeks.map(({ amount }) => amount)))]
      .slice(1)
      .reverse()
      .map((amount) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(amount).toLowerCase());
    expect(spending).toBe(
      `Spending${dollars}.${cents} CAD${weekLabel([first, last])}${scale.join("")}Week${weeks
        .map(({ week, amount }, i) => {
          const spent = amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const tip = `${weekLabel(weekOf(addDays(first, i * 7)))}${spent} CAD`;
          // Its tooltip, then its label, then its tooltip again for screen readers.
          return `${tip}${week}${tip}`;
        })
        .join("")}`,
    );
    const amount = [...cards()[1].querySelectorAll("[data-typography]")].find((part) => part.textContent === `.${cents} CAD`)!;
    expect(amount.getAttribute("data-typography")).toBe("metadata");
    expect(cards()[1].querySelectorAll("[data-segment]")).toHaveLength(6);
  });
});

describe("the Check-ins page", () => {
  it("draws a Button's one-colour icons in the button's colour, so they follow its words on hover", () => {
    setup(1440);
    const buttons = screen
      .getAllByRole("button")
      .filter((button) => button.hasAttribute("data-emphasis") || button.className.includes(iconButtonStyle));
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons)
      for (const icon of button.querySelectorAll(":scope > svg")) {
        const paints = new Set(
          [...icon.querySelectorAll("[fill], [stroke]")]
            .flatMap((part) => [part.getAttribute("fill"), part.getAttribute("stroke")])
            .filter((paint) => paint && paint !== "none"),
        );
        if (paints.size === 1) expect([...paints], button.getAttribute("aria-label") ?? button.textContent ?? "").toEqual(["currentColor"]);
      }
  });

  it("copies a shift's check-in and check-out codes from a button each, and says which in a snackbar", async () => {
    const { user } = setup(1440);
    const shift = screen.getAllByRole("group", { name: "Weekdays Afternoon Shift" })[0];
    await user.click(within(shift).getByRole("button", { name: "Check-in: 3725" }));
    expect(await navigator.clipboard.readText()).toBe("3725");
    expect(screen.getByText(SNACKS.checkInCode("3725"))).toBeDefined();
    await user.click(within(shift).getByRole("button", { name: "Check-out: 6835" }));
    expect(await navigator.clipboard.readText()).toBe("6835");
    expect(screen.getByText(SNACKS.checkOutCode("6835"))).toBeDefined();
  });

  it("shows a late check-in in Checked In's colours, how late beside its time in a small warning chip", () => {
    setup(1440);
    const row = (name: string) => document.querySelector<HTMLElement>(`[data-worker='${name}']`)!;
    const pill = (name: string) => within(row(name)).getByText(/^(Late Check-in|Checked In)$/).closest("[data-tone]")!.getAttribute("data-tone");
    expect(pill("Aspen Curtis")).toBe("active");
    expect(pill("Angel Saris")).toBe("active");
    const lateness = within(row("Aspen Curtis")).getByText(/^\+\d+m$/);
    expect(lateness.closest("[data-tone]")!.getAttribute("data-tone")).toBe("warning");
    expect(row("Aspen Curtis").textContent).toMatch(/\d{1,2}:\d{2} [AP]M\+\d+m–In progress/);
    expect(within(row("Angel Saris")).queryByText(/^\+\d+m$/)).toBeNull();
  });

  it("calls a worker who hasn't checked in today Missing Check-in, until someone marks them absent", async () => {
    const { user } = setup(1440);
    const chip = () => document.querySelector("[data-worker='Maria Franci']")!.textContent!.match(/Missing Check-in|Absent/g);
    expect(chip()).toEqual(["Missing Check-in"]);
    const maria = document.querySelector<HTMLElement>("[data-worker='Maria Franci']")!;
    await user.click(within(maria).getByRole("button", { name: "Check in..." }));
    const overlay = screen.getByRole("dialog", { name: "Check in: Maria Franci" });
    await user.click(within(overlay).getByRole("button", { name: "Mark absent" }));
    await user.click(within(overlay).getAllByRole("button", { name: "Mark absent" }).at(-1)!);
    expect(chip()).toEqual(["Absent"]);
  });

  it("blocks a worker marked absent from the Danger zone, as the design system's Mark Absent does", async () => {
    const { user } = setup(1440);
    const maria = document.querySelector<HTMLElement>("[data-worker='Maria Franci']")!;
    await user.click(within(maria).getByRole("button", { name: "Check in..." }));
    const overlay = screen.getByRole("dialog", { name: "Check in: Maria Franci" });
    await user.click(within(overlay).getByRole("button", { name: "Mark absent" }));
    expect(within(overlay).getByText("Danger zone")).toBeDefined();
    expect(within(overlay).getByRole("checkbox", { name: /Block this worker/ })).toBeDefined();
  });

  it("keeps Check in pressable while the time isn't one, checking in nobody until it is", async () => {
    const { user } = setup(1440);
    const maria = document.querySelector<HTMLElement>("[data-worker='Maria Franci']")!;
    await user.click(within(maria).getByRole("button", { name: "Check in..." }));
    const overlay = screen.getByRole("dialog", { name: "Check in: Maria Franci" });
    const checkIn = within(overlay).getByRole("combobox", { name: "Check-in Time" });
    await user.click(checkIn);
    await user.clear(checkIn);
    await user.type(checkIn, "3:75{Enter}");
    const confirm = within(overlay).getByRole("button", { name: "Check in" });
    expect(confirm).toHaveProperty("disabled", false);
    await user.click(confirm);
    expect(screen.getByRole("dialog", { name: "Check in: Maria Franci" })).toBe(overlay);
    expect(checkIn.closest("[data-field]")!.getAttribute("data-state")).toBe("alert");
  });

  it("offers a check-out with how long after the check-in each time falls", async () => {
    const { user } = setup(1440);
    const maria = document.querySelector<HTMLElement>("[data-worker='Maria Franci']")!;
    await user.click(within(maria).getByRole("button", { name: "Check in..." }));
    const overlay = screen.getByRole("dialog", { name: "Check in: Maria Franci" });
    const checkIn = within(overlay).getByRole("combobox", { name: "Check-in Time" });
    await user.click(checkIn);
    await user.clear(checkIn);
    await user.type(checkIn, "8:00 AM{Enter}");
    await user.click(within(overlay).getByRole("button", { name: "Check-out" }));
    await user.click(within(overlay).getByRole("combobox", { name: "Check-out Time" }));
    expect(within(overlay).getAllByRole("option")[0].textContent).toBe("8:15 AM +0.25 hours");
  });
});

describe("the Shifts page", () => {
  function openShifts(shiftVersion?: "final" | "recurrence" | "old") {
    const user = userEvent.setup();
    render(
      <CheckInsApp
        anchor={shiftStart(new Date())}
        width={1440}
        height={900}
        initialPage="shifts"
        shiftVersion={shiftVersion}
      />,
    );
    return user;
  }

  it("opens from its item, a week of the company's shifts by template", async () => {
    const user = userEvent.setup();
    render(<CheckInsApp anchor={shiftStart(new Date())} width={1440} height={900} initialPage="pool" />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    await user.click(within(nav).getByRole("button", { name: "Shifts" }));
    expect(screen.getByRole("heading", { level: 1, name: "Shifts" })).toBeDefined();
    expect(within(nav).getByRole("button", { name: "Shifts" }).getAttribute("aria-current")).toBe("page");
    expect(within(screen.getByRole("main")).getByRole("button", { name: "Manage templates" })).toBeDefined();
    for (const template of ["Forklift Operator", "General Labour", "Picker Packer", "Warehouse Manager"])
      expect(screen.getByRole("rowheader", { name: new RegExp(template) })).toBeDefined();
    // The templates' column, its search at its head, and each day's.
    expect(screen.getAllByRole("columnheader")).toHaveLength(8);
  });

  it("finds a shift from the search at its templates' head", () => {
    openShifts();
    const search = within(screen.getByRole("columnheader", { name: "Shift" })).getByRole<HTMLInputElement>("searchbox", { name: "Find a shift" });
    expect(search.placeholder).toBe("Find a shift...");
  });

  it("steps between weeks", async () => {
    const user = openShifts();
    const label = () => screen.getByRole("button", { name: /Week of/ }).textContent;
    const now = label();
    await user.click(screen.getByRole("button", { name: "Next week" }));
    expect(label()).not.toBe(now);
    await user.click(screen.getByRole("button", { name: "Previous week" }));
    expect(label()).toBe(now);
  });

  it("filters its shifts by Fill %, start time and tags, with no time zone to pick", async () => {
    const user = openShifts();
    const shown = () =>
      ["Forklift Operator", "General Labour", "Picker Packer", "Warehouse Manager"].filter(
        (name) => screen.queryByRole("rowheader", { name: new RegExp(name) }) !== null,
      );
    expect(screen.queryByRole("button", { name: /Eastern Daylight Time/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: /Tags/ }));
    await user.click(screen.getByRole("option", { name: "Packing" }));
    expect(shown()).toEqual(["Picker Packer"]);
    await user.click(screen.getByRole("option", { name: "Packing" }));
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: /Shift start time/ }));
    await user.click(screen.getByRole("option", { name: "12:00 PM–6:00 PM" }));
    expect(shown()).toEqual(["Picker Packer"]);
    await user.click(screen.getByRole("option", { name: "12:00 AM–6:00 AM" }));
    expect(shown()).toEqual(["Picker Packer", "Warehouse Manager"]);
    await user.click(screen.getByRole("option", { name: "12:00 PM–6:00 PM" }));
    await user.click(screen.getByRole("option", { name: "12:00 AM–6:00 AM" }));
    await user.keyboard("{Escape}");

    // Under three quarters filled: Forklift Operator's Friday and Picker Packer's Saturday.
    await user.click(screen.getByRole("button", { name: /Fill %/ }));
    fireEvent.keyDown(within(screen.getByRole("dialog", { name: "Fill %" })).getAllByRole("slider")[1], { key: "ArrowLeft" });
    expect(screen.getByRole("button", { name: /Fill %/ }).textContent).toContain("0–75");
    expect(shown()).toEqual(["Forklift Operator", "Picker Packer"]);
    const forklift = screen.getByRole("row", { name: /Forklift Operator/ }).textContent;
    expect(forklift).toContain("2/3");
    expect(forklift).not.toContain("3/3");
  });

  it("opens New shift in the version it's given, and posts a shift into today's column", async () => {
    const user = openShifts("old");
    await user.click(screen.getByRole("button", { name: "New shift..." }));
    const dialog = screen.getByRole("dialog", { name: "New shift" });
    // Its own project's form, in full.
    expect(dialog.querySelector("[data-placeholder]")).toBeNull();
    // The old design's one form has no steps.
    expect(within(dialog).queryByRole("button", { name: /Shift information/ })).toBeNull();

    fireEvent.change(within(dialog).getByLabelText("Shift Title"), { target: { value: "Day Shift M/W/F" } });
    await user.click(within(dialog).getByRole("combobox", { name: "Template" }));
    await user.click(within(dialog.parentElement!).getByRole("option", { name: "Forklift Operator" }));
    const today = longDate(isoOf(new Date()));
    await user.click(within(dialog).getByRole("button", { name: today }));
    await user.click(within(dialog).getByRole("button", { name: "Post shift" }));

    expect(screen.queryByRole("dialog", { name: "New shift" })).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("1 shift posted");
    // The day's column after the templates', whose cells head their rows.
    const column = screen.getAllByRole("columnheader").findIndex((header) => header.hasAttribute("aria-current")) - 1;
    const forklift = screen.getByRole("row", { name: /Forklift Operator/ });
    expect(within(within(forklift).getAllByRole("cell")[column]).getByText("Day Shift M/W/F")).toBeDefined();
  });

  it("shows the week of the first shift posted", async () => {
    const user = openShifts("old");
    await user.click(screen.getByRole("button", { name: "New shift..." }));
    const dialog = screen.getByRole("dialog", { name: "New shift" });
    fireEvent.change(within(dialog).getByLabelText("Shift Title"), { target: { value: "Day Shift M/W/F" } });
    await user.click(within(dialog).getByRole("combobox", { name: "Template" }));
    await user.click(within(dialog.parentElement!).getByRole("option", { name: "General Labour" }));
    await user.click(within(dialog).getByRole("button", { name: "Next month" }));
    const later = within(dialog).getAllByRole("button", { name: /, 15 / })[0];
    await user.click(later);
    await user.click(within(dialog).getByRole("button", { name: "Post shift" }));
    const day = later.getAttribute("data-date")!.slice(8).replace(/^0/, "");
    expect(screen.getAllByRole("columnheader").some((header) => header.textContent?.startsWith(day))).toBe(true);
    expect(screen.getByRole("row", { name: /General Labour/ }).textContent).toContain("Day Shift M/W/F");
  });

  it("keeps New shift open, and what's in it, when the version changes", async () => {
    const user = userEvent.setup();
    const anchor = shiftStart(new Date());
    const app = (shiftVersion: "final" | "old") => (
      <CheckInsApp anchor={anchor} width={1440} height={900} initialPage="shifts" shiftVersion={shiftVersion} />
    );
    const { rerender } = render(app("final"));
    await user.click(screen.getByRole("button", { name: "New shift..." }));
    const dialog = screen.getByRole("dialog", { name: "New shift" });
    const today = longDate(isoOf(new Date()));
    await user.click(within(dialog).getByRole("button", { name: today }));
    await user.click(within(dialog).getByRole("button", { name: "Next" }));
    fireEvent.change(within(dialog).getByLabelText("Shift Title"), { target: { value: "Day Shift M/W/F" } });

    rerender(app("old"));
    expect(screen.getByRole("dialog", { name: "New shift" })).toBe(dialog);
    expect(within(dialog).queryByRole("button", { name: /Shift information/ })).toBeNull();
    expect((within(dialog).getByLabelText("Shift Title") as HTMLInputElement).value).toBe("Day Shift M/W/F");
    expect(within(dialog).getByRole("button", { name: today }).getAttribute("aria-pressed")).toBe("true");
  });
});

// A side sheet's way in never ends, so it stays coming in.
const holdWayIn = () => {
  Element.prototype.getAnimations = function (this: Element) {
    return this.matches("[role=dialog]") ? [{ finished: new Promise<never>(() => {}) } as unknown as Animation] : [];
  };
};

describe("a shift's Shift planner", () => {
  function openShifts(shiftVersion: "final" | "recurrence" | "old" = "final") {
    const user = userEvent.setup();
    render(
      <CheckInsApp
        anchor={shiftStart(new Date())}
        width={1440}
        height={900}
        initialPage="shifts"
        shiftVersion={shiftVersion}
      />,
    );
    return user;
  }

  const week = () => weekOf(isoOf(new Date()));
  const generalLabour = () => screen.getByRole("row", { name: /General Labour/ });
  const dayCell = (weekday: number) => within(generalLabour()).getAllByRole("cell")[weekday];

  async function openWeekdaysAm(user: ReturnType<typeof userEvent.setup>) {
    await user.click(within(generalLabour()).getAllByRole("button", { name: /^Weekdays AM/ })[0]);
    return screen.getByRole("dialog", { name: "General Labour" });
  }

  it("draws the shift's site and its geofence on the Shift summary's map", async () => {
    const user = openShifts();
    const sheet = await openWeekdaysAm(user);
    await user.click(within(sheet).getByRole("tab", { name: "Shift summary" }));
    const information = within(sheet).getByRole("region", { name: "Shift information" });
    const map = information.querySelector("[data-map]");
    expect(map?.getAttribute("data-size")).toBe("large");
    await waitFor(() => expect(map!.querySelector("polygon")!.getAttribute("points")!.split(" ").length).toBeGreaterThanOrEqual(3));
  });

  it("shows its workers loading as it comes in, and nothing of what's booked", async () => {
    holdWayIn();
    try {
      const user = openShifts();
      const sheet = await openWeekdaysAm(user);
      const planner = within(sheet).getByRole("table", { name: "Shift planner" });
      expect(planner.closest("[aria-busy=true]")).not.toBeNull();
      expect(within(planner).getByRole("rowheader", { name: /Jeremiah Schwartzmann/ })).toBeDefined();
      expect(planner.querySelectorAll("[data-booking]")).toHaveLength(0);
    } finally {
      Reflect.deleteProperty(Element.prototype, "getAnimations");
    }
  });

  it("opens from a shift on the Shifts page, with who's hired and who applied", async () => {
    const user = openShifts();
    const sheet = await openWeekdaysAm(user);
    expect(within(sheet).getByText("Weekdays AM")).toBeDefined();
    expect(within(sheet).getByRole("tab", { name: "Shift planner" }).getAttribute("aria-selected")).toBe("true");
    const planner = within(sheet).getByRole("table", { name: "Shift planner" });
    expect(within(planner).getByRole("rowheader", { name: /Jeremiah Schwartzmann/ })).toBeDefined();
    expect(within(planner).getByRole("rowheader", { name: /Giorgia Morone/ })).toBeDefined();
    expect(within(planner).getAllByText("Booked").length).toBeGreaterThan(0);

    await user.click(within(sheet).getByRole("button", { name: "Booked", pressed: false }));
    expect(within(planner).queryByRole("rowheader", { name: /Giorgia Morone/ })).toBeNull();

    await user.click(within(sheet).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "General Labour" })).toBeNull();
  });

  it("marks only the day pressed on the Shifts page, not the shift's other days, until it closes", async () => {
    const user = openShifts();
    const slots = () => within(generalLabour()).getAllByRole("button", { name: /^Weekdays AM/ });
    expect(slots().length).toBeGreaterThan(2);
    await user.click(slots()[1]);
    expect(slots().map((slot) => slot.hasAttribute("data-sheet"))).toEqual(slots().map((_, i) => i === 1));
    await user.click(within(screen.getByRole("dialog", { name: "General Labour" })).getByRole("button", { name: "Close" }));
    expect(slots().some((slot) => slot.hasAttribute("data-sheet"))).toBe(false);
  });

  const STATES = [
    ["Available", undefined],
    ["Offered", "offered"],
    ["Waitlisted", "waitlisted"],
    ["Booked", "booked"],
    ["Cancelled", "cancelled"],
  ] as const;
  const statesOf = (days: HTMLElement[]) =>
    STATES.filter(([, booking]) => days.some((day) => !day.hasAttribute("data-past") && day.dataset.booking === booking)).map(
      ([label]) => label,
    );

  it("heads its checkbox column with a bulk select, the search beside it", async () => {
    const user = openShifts();
    const sheet = await openWeekdaysAm(user);
    const planner = within(sheet).getByRole("table", { name: "Shift planner" });
    const [pick, search] = within(within(planner).getAllByRole("row")[0]).getAllByRole("columnheader");
    expect(within(pick).getByRole("checkbox", { name: "Select all" })).toBeDefined();
    expect(within(search).getByLabelText("Find a worker")).toBeDefined();
  });

  it("offers each bulk select only the states its days still to come hold", async () => {
    const user = openShifts();
    const sheet = await openWeekdaysAm(user);
    const planner = within(sheet).getByRole("table", { name: "Shift planner" });
    for (const name of [/Giorgia Morone/, /Jeremiah Schwartzmann/, /Jack Daniels/]) {
      const row = within(planner).getByRole("row", { name });
      await user.click(within(row).getByRole("button", { expanded: false }));
      const listed = screen.getAllByRole("menuitem").map((item) => item.textContent);
      expect(listed).toEqual(statesOf(within(row).getAllByRole("cell").slice(1)));
      expect(listed.length).toBeLessThan(STATES.length);
      await user.keyboard("{Escape}");
    }
  });

  it("picks a worker's days still to come from their row: all of them, or those in one state", async () => {
    const user = openShifts();
    const sheet = await openWeekdaysAm(user);
    const planner = within(sheet).getByRole("table", { name: "Shift planner" });
    const row = within(planner).getByRole("row", { name: /Giorgia Morone/ });
    const days = () => within(row).getAllByRole("cell").slice(1);
    const selected = () => days().filter((day) => day.hasAttribute("data-selected"));
    const box = () => within(row).getByRole("checkbox", { name: "Giorgia Morone" });

    await user.click(box());
    expect(selected()).toEqual(days().filter((day) => !day.hasAttribute("data-past")));
    await user.click(box());
    expect(selected()).toEqual([]);

    await user.click(within(row).getByRole("button", { expanded: false }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(statesOf(days()));
    await user.click(screen.getByRole("menuitem", { name: "Offered" }));
    expect(selected().length).toBeGreaterThan(0);
    expect(selected()).toEqual(days().filter((day) => day.dataset.booking === "offered" && !day.hasAttribute("data-past")));
    expect(box().getAttribute("aria-checked")).toBe("true");
  });

  it("picks every worker's days still to come in one state from its head, and none once unticked", async () => {
    const user = openShifts();
    const sheet = await openWeekdaysAm(user);
    const planner = within(sheet).getByRole("table", { name: "Shift planner" });
    const [head, ...rows] = within(planner).getAllByRole("row");
    const pick = within(head).getAllByRole("columnheader")[0];
    const days = rows.flatMap((row) => within(row).getAllByRole("cell").slice(1));
    const selected = () => days.filter((day) => day.hasAttribute("data-selected"));

    await user.click(within(pick).getByRole("button", { expanded: false }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(statesOf(days));
    await user.click(screen.getByRole("menuitem", { name: "Waitlisted" }));
    expect(selected().length).toBeGreaterThan(0);
    expect(selected()).toEqual(days.filter((day) => day.dataset.booking === "waitlisted" && !day.hasAttribute("data-past")));

    await user.click(within(pick).getByRole("checkbox", { name: "Select all" }));
    expect(selected()).toEqual([]);
  });

  it("draws one selection round days selected side by side, each joined to the selected days beside it", async () => {
    const user = openShifts();
    const sheet = await openWeekdaysAm(user);
    const planner = within(sheet).getByRole("table", { name: "Shift planner" });
    const [head, ...rows] = within(planner).getAllByRole("row");
    await user.click(within(within(head).getAllByRole("columnheader")[0]).getByRole("button", { expanded: false }));
    await user.click(screen.getByRole("menuitem", { name: "Waitlisted" }));
    const grid = rows.map((row) => within(row).getAllByRole("cell").slice(1));
    const on = (r: number, c: number) => grid[r]?.[c]?.hasAttribute("data-selected") ?? false;
    let joins = 0;
    grid.forEach((days, r) =>
      days.forEach((day, c) => {
        const sides = on(r, c)
          ? (["top", "right", "bottom", "left"] as const).filter((side) =>
              ({ top: on(r - 1, c), right: on(r, c + 1), bottom: on(r + 1, c), left: on(r, c - 1) })[side],
            )
          : [];
        joins += sides.length;
        expect(day.dataset.joined ?? "").toBe(sides.join(" "));
      }),
    );
    expect(joins).toBeGreaterThan(0);
  });

  // A worker's days in the planner, and the first one still to come in `booking` in Giorgia Morone's row: offered on a
  // day still short, waitlisted on a full one.
  const daysIn = (planner: HTMLElement, name: RegExp) =>
    within(within(planner).getByRole("row", { name })).getAllByRole("cell").slice(1);
  const columnOf = (planner: HTMLElement, booking: string) =>
    daysIn(planner, /Giorgia Morone/).findIndex((day) => !day.hasAttribute("data-past") && day.dataset.booking === booking);
  const actionBar = (sheet: HTMLElement) => sheet.querySelector<HTMLElement>("[data-action-bar]");

  it("lists workers available, nothing booked for them, from the worker pool and the public posting", async () => {
    const user = openShifts();
    const sheet = await openWeekdaysAm(user);
    const planner = within(sheet).getByRole("table", { name: "Shift planner" });
    for (const [name, chip] of [[/Marilyn Calzoni/, "Worker Pool"], [/Miguel Fernando Marquez/, "Applicant"]] as const) {
      expect(within(within(planner).getByRole("rowheader", { name })).getByText(chip)).toBeDefined();
      expect(daysIn(planner, name).every((day) => day.dataset.booking === undefined)).toBe(true);
    }
  });

  it("selects a day still to come when pressed, whatever it holds, and lets it go when pressed again", async () => {
    const user = openShifts();
    const sheet = await openWeekdaysAm(user);
    const planner = within(sheet).getByRole("table", { name: "Shift planner" });
    const ahead = (name: RegExp) => daysIn(planner, name).filter((cell) => !cell.hasAttribute("data-past"));
    expect(daysIn(planner, /Jeremiah Schwartzmann/).filter((cell) => cell.hasAttribute("data-past")).some((cell) => within(cell).queryByRole("button"))).toBe(false);

    const days = [
      ahead(/Marilyn Calzoni/)[0],
      ahead(/Jeremiah Schwartzmann/)[0],
      ahead(/Giorgia Morone/).find((cell) => cell.dataset.booking === "offered")!,
      ahead(/Giorgia Morone/).find((cell) => cell.dataset.booking === "waitlisted")!,
      ahead(/Jack Daniels/).find((cell) => cell.dataset.booking === "cancelled")!,
    ];
    expect(days.map((day) => day.dataset.booking)).toEqual([undefined, "booked", "offered", "waitlisted", "cancelled"]);
    for (const day of days) {
      await user.click(within(day).getByRole("button", { pressed: false }));
      expect(day.hasAttribute("data-selected"), day.dataset.booking).toBe(true);
    }
    await user.click(within(days[1]).getByRole("button", { pressed: true }));
    expect(days[1].hasAttribute("data-selected")).toBe(false);
    expect(within(actionBar(sheet)!).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Cancel",
      "Withdraw offers",
      "Send offers",
    ]);
  });

  it("offers an action bar while days are picked: Cancel, then only those of Withdraw offers and Send offers that apply", async () => {
    const user = openShifts();
    const sheet = await openWeekdaysAm(user);
    const planner = within(sheet).getByRole("table", { name: "Shift planner" });
    const ahead = (name: RegExp, booking?: string) =>
      daysIn(planner, name).find((day) => !day.hasAttribute("data-past") && day.dataset.booking === booking)!;
    const offered = () => {
      const buttons = within(actionBar(sheet)!).getAllByRole("button") as HTMLButtonElement[];
      expect(buttons.some((button) => button.disabled)).toBe(false);
      return buttons.map((button) => button.textContent);
    };
    const pick = async (...days: HTMLElement[]) => {
      for (const day of days) await user.click(within(day).getByRole("button", { pressed: false }));
    };
    const cancel = () => user.click(within(actionBar(sheet)!).getByRole("button", { name: "Cancel" }));
    expect(actionBar(sheet)).toBeNull();

    await pick(ahead(/Marilyn Calzoni/));
    expect(offered()).toEqual(["Cancel", "Send offers"]);
    await cancel();
    await pick(ahead(/Jeremiah Schwartzmann/, "booked"));
    expect(offered()).toEqual(["Cancel", "Withdraw offers"]);
    const withdraw = within(actionBar(sheet)!).getByRole("button", { name: "Withdraw offers" });
    expect([withdraw.dataset.emphasis, withdraw.dataset.tone]).toEqual(["secondary", "destructive"]);
    await cancel();
    await pick(ahead(/Jack Daniels/, "cancelled"));
    expect(offered()).toEqual(["Cancel"]);
    await pick(ahead(/Giorgia Morone/, "waitlisted"), ahead(/Marilyn Calzoni/));
    expect(offered()).toEqual(["Cancel", "Withdraw offers", "Send offers"]);
  });

  it("sends offers to the days picked, waitlisting where the day's places are all filled", async () => {
    const user = openShifts();
    const sheet = await openWeekdaysAm(user);
    const planner = within(sheet).getByRole("table", { name: "Shift planner" });
    const short = columnOf(planner, "offered");
    const full = columnOf(planner, "waitlisted");
    for (const c of [short, full]) await user.click(within(daysIn(planner, /Marilyn Calzoni/)[c]).getByRole("button"));

    await user.click(within(actionBar(sheet)!).getByRole("button", { name: "Send offers" }));
    const days = daysIn(planner, /Marilyn Calzoni/);
    expect([days[short].dataset.booking, days[full].dataset.booking]).toEqual(["offered", "waitlisted"]);
    expect(planner.querySelector("[data-selected]")).toBeNull();
    expect(actionBar(sheet)).toBeNull();
    expect(screen.getByText(SNACKS.offersSent(1, 1))).toBeDefined();
  });

  it("withdraws the offers, bookings and waitlistings picked, making those days available", async () => {
    const user = openShifts();
    const sheet = await openWeekdaysAm(user);
    const planner = within(sheet).getByRole("table", { name: "Shift planner" });
    const ahead = () => daysIn(planner, /Giorgia Morone/).filter((day) => !day.hasAttribute("data-past"));
    const count = ahead().length;
    expect(ahead().every((day) => day.dataset.booking)).toBe(true);

    await user.click(within(within(planner).getByRole("row", { name: /Giorgia Morone/ })).getByRole("checkbox", { name: "Giorgia Morone" }));
    const bar = actionBar(sheet)!;
    expect(within(bar).queryByRole("button", { name: "Send offers" })).toBeNull();
    await user.click(within(bar).getByRole("button", { name: "Withdraw offers" }));
    expect(ahead().map((day) => day.dataset.booking)).toEqual(Array(count).fill(undefined));
    expect(actionBar(sheet)).toBeNull();
    expect(screen.getByText(SNACKS.offersWithdrawn(count))).toBeDefined();

    // Available now, so an offer can go out again.
    await user.click(within(ahead()[0]).getByRole("button"));
    expect(within(actionBar(sheet)!).getAllByRole("button").map((button) => button.textContent)).toEqual(["Cancel", "Send offers"]);
  });

  it("clears the selection with Cancel, the sheet staying open", async () => {
    const user = openShifts();
    const sheet = await openWeekdaysAm(user);
    const planner = within(sheet).getByRole("table", { name: "Shift planner" });
    await user.click(within(within(planner).getByRole("row", { name: /Giorgia Morone/ })).getByRole("checkbox", { name: "Giorgia Morone" }));
    await user.click(within(daysIn(planner, /Marilyn Calzoni/)[columnOf(planner, "offered")]).getByRole("button"));
    expect(planner.querySelectorAll("[data-selected]").length).toBeGreaterThan(1);

    await user.click(within(actionBar(sheet)!).getByRole("button", { name: "Cancel" }));
    expect(planner.querySelector("[data-selected]")).toBeNull();
    expect(actionBar(sheet)).toBeNull();
    expect(screen.getByRole("dialog", { name: "General Labour" })).toBe(sheet);
    expect(daysIn(planner, /Giorgia Morone/).some((day) => day.dataset.booking === "offered")).toBe(true);
  });

  const pickRow = async (user: ReturnType<typeof userEvent.setup>, sheet: HTMLElement, name: string) => {
    const planner = within(sheet).getByRole("table", { name: "Shift planner" });
    await user.click(within(within(planner).getByRole("row", { name: new RegExp(name) })).getByRole("checkbox", { name }));
  };
  const press = (user: ReturnType<typeof userEvent.setup>, sheet: HTMLElement, action: string) =>
    user.click(within(actionBar(sheet)!).getByRole("button", { name: action }));

  it("keeps the offers sent and withdrawn once the sheet closes", async () => {
    const user = openShifts();
    let sheet = await openWeekdaysAm(user);
    await pickRow(user, sheet, "Marilyn Calzoni");
    await press(user, sheet, "Send offers");
    await pickRow(user, sheet, "Giorgia Morone");
    await press(user, sheet, "Withdraw offers");
    await user.click(within(sheet).getByRole("button", { name: "Close" }));

    sheet = await openWeekdaysAm(user);
    const planner = within(sheet).getByRole("table", { name: "Shift planner" });
    const ahead = (name: RegExp) => daysIn(planner, name).filter((day) => !day.hasAttribute("data-past"));
    expect(ahead(/Marilyn Calzoni/).every((day) => day.dataset.booking === "offered" || day.dataset.booking === "waitlisted")).toBe(true);
    expect(ahead(/Giorgia Morone/).every((day) => day.dataset.booking === undefined)).toBe(true);
  });

  it("counts only those booked in a day's fill: a withdrawn booking lowers it, an offer sent doesn't", async () => {
    const user = openShifts();
    await user.click(screen.getByRole("button", { name: "Next week" }));
    const monday = () => dayCell(1).querySelector("[data-progress]")?.textContent;
    expect(monday()).toBe("6/6Filled");

    let sheet = await openWeekdaysAm(user);
    await pickRow(user, sheet, "Marilyn Calzoni");
    await press(user, sheet, "Send offers");
    await user.click(within(sheet).getByRole("button", { name: "Close" }));
    expect(monday()).toBe("6/6Filled");

    sheet = await openWeekdaysAm(user);
    await pickRow(user, sheet, "Jeremiah Schwartzmann");
    await press(user, sheet, "Withdraw offers");
    expect(monday()).toBe("5/6Filled");
  });

  it("walls the page off under a scrim while open, a press on the scrim closing it", async () => {
    const user = openShifts();
    const sheet = await openWeekdaysAm(user);
    expect(sheet.getAttribute("aria-modal")).toBe("true");
    expect(generalLabour().closest("[inert]")).not.toBeNull();
    const scrim = sheet.previousElementSibling!;
    expect(scrim.hasAttribute("data-scrim")).toBe(true);
    fireEvent.pointerDown(scrim);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "General Labour" })).toBeNull());
    expect(generalLabour().closest("[inert]")).toBeNull();
  });

  it("draws each day's icon in its cell's colour, so the days gone are subdued", async () => {
    const user = openShifts();
    const sheet = await openWeekdaysAm(user);
    const planner = within(sheet).getByRole("table", { name: "Shift planner" });
    const cells = within(planner).getAllByRole("cell").filter((cell) => cell.hasAttribute("data-booking"));
    // Jack Daniels cancelled on the Fridays already gone, and those who applied are offered the ones ahead.
    for (const booking of ["cancelled", "offered", "waitlisted", "booked"])
      expect(cells.some((cell) => cell.dataset.booking === booking)).toBe(true);
    expect(cells.some((cell) => cell.dataset.booking === "cancelled" && cell.hasAttribute("data-past"))).toBe(true);
    for (const cell of cells)
      for (const path of cell.querySelectorAll("svg path"))
        expect(path.getAttribute("fill"), `${cell.dataset.booking} icon`).toBe("currentColor");
  });

  it("sums the shift up on its Shift summary tab", async () => {
    const user = openShifts();
    const sheet = await openWeekdaysAm(user);
    await user.click(within(sheet).getByRole("tab", { name: "Shift summary" }));
    expect(within(sheet).getByRole("region", { name: "Shift plan" }).textContent).toContain("9:00 AM—5:00 PM");
    const information = within(sheet).getByRole("region", { name: "Shift information" });
    expect(information.textContent).toContain("General Labour");
    expect(information.textContent).toContain("Pier 37");
  });

  it("opens for a shift just posted, its places still open", async () => {
    const user = openShifts("old");
    await user.click(screen.getByRole("button", { name: "New shift..." }));
    const dialog = screen.getByRole("dialog", { name: "New shift" });
    fireEvent.change(within(dialog).getByLabelText("Shift Title"), { target: { value: "Day Shift M/W/F" } });
    await user.click(within(dialog).getByRole("combobox", { name: "Template" }));
    await user.click(within(dialog.parentElement!).getByRole("option", { name: "Forklift Operator" }));
    await user.click(within(dialog).getByRole("button", { name: longDate(isoOf(new Date())) }));
    await user.click(within(dialog).getByRole("button", { name: "Post shift" }));

    await user.click(screen.getByRole("button", { name: /^Day Shift M\/W\/F/ }));
    const sheet = screen.getByRole("dialog", { name: "Forklift Operator" });
    const planner = within(sheet).getByRole("table", { name: "Shift planner" });
    expect(within(planner).getAllByRole("rowheader").map((row) => row.textContent)).toEqual([
      expect.stringContaining("Giorgia Morone"),
      expect.stringContaining("Drishti Suresh"),
      expect.stringContaining("Marilyn Calzoni"),
      expect.stringContaining("Miguel Fernando Marquez"),
    ]);
  });

  it("has no Edit schedule in the versions before the final one", async () => {
    for (const version of ["recurrence", "old"] as const) {
      const user = openShifts(version);
      const sheet = await openWeekdaysAm(user);
      expect(within(sheet).queryByRole("button", { name: "Edit schedule..." })).toBeNull();
      cleanup();
    }
  });

  it("adds a day to the schedule with Edit schedule", async () => {
    const user = openShifts();
    const saturday = week()[6];
    expect(within(dayCell(6)).queryByText("Weekdays AM")).toBeNull();
    const sheet = await openWeekdaysAm(user);
    await user.click(within(sheet).getByRole("button", { name: "Edit schedule..." }));
    const dialog = screen.getByRole("dialog", { name: "Edit schedule" });
    expect(within(dialog).getByText("General Labour • Weekdays AM")).toBeDefined();
    const changes = within(dialog).getByRole("group", { name: "Changes" });
    expect(changes.textContent).toContain("0Add Shifts");

    await user.click(within(dialog).getByRole("button", { name: longDate(saturday) }));
    expect(changes.textContent).toContain("1Add Shifts");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(screen.queryByRole("dialog", { name: "Edit schedule" })).toBeNull();
    expect(within(dayCell(6)).getByText("Weekdays AM")).toBeDefined();
    expect(dayCell(6).querySelector("[data-progress]")?.textContent).toBe("0/6Filled");
  });

  it("cancels a day, and drops nothing when the edit is cancelled", async () => {
    const user = openShifts();
    const nextMonday = addDays(week()[0], 8);
    const sheet = await openWeekdaysAm(user);

    await user.click(within(sheet).getByRole("button", { name: "Edit schedule..." }));
    let dialog = screen.getByRole("dialog", { name: "Edit schedule" });
    await user.click(within(dialog).getByRole("button", { name: longDate(nextMonday) }));
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await user.click(within(sheet).getByRole("button", { name: "Edit schedule..." }));
    dialog = screen.getByRole("dialog", { name: "Edit schedule" });
    await user.click(within(dialog).getByRole("button", { name: longDate(nextMonday) }));
    expect(within(dialog).getByRole("group", { name: "Changes" }).textContent).toContain("1Cancel Shifts");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await user.click(within(sheet).getByRole("button", { name: "Close" }));

    await user.click(screen.getByRole("button", { name: "Next week" }));
    expect(within(dayCell(1)).queryByText("Weekdays AM")).toBeNull();
    expect(within(dayCell(2)).getByText("Weekdays AM")).toBeDefined();
  });
});

describe("the operations team's dashboard", () => {
  async function openDashboard(width = 1920) {
    const { user, nav, isOpen } = setup(width);
    const customer = within(nav).getByRole("button", { name: "Overview" });
    const admin = within(nav).getByRole("button", { name: "Check-ins dashboard" });
    await user.click(admin);
    const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
    return { user, customer, admin, rows, isOpen };
  }

  it("opens from the Admin item, which becomes the current page", async () => {
    const { customer, admin, rows } = await openDashboard();
    expect(screen.getByRole("heading", { level: 1, name: "Check-Ins" })).toBeDefined();
    expect(admin.getAttribute("aria-current")).toBe("page");
    expect(customer.getAttribute("aria-current")).toBeNull();
    // Both countries' missing check-ins.
    expect(rows()).toHaveLength(6);
  });

  it("lists a row's risk matrix from location disabled to new worker, whatever order its signals came in", async () => {
    const { rows } = await openDashboard();
    const metrics = within(rows()[0]).getAllByRole("button", { name: /^(Location Disabled|Abnormal Last Shift|Flagged Message|New Worker)$/ });
    expect(metrics.map((metric) => metric.getAttribute("aria-label"))).toEqual([
      "Location Disabled",
      "Abnormal Last Shift",
      "Flagged Message",
      "New Worker",
    ]);
  });

  it("shows a worker's no-show risk on their profile card", async () => {
    const { rows } = await openDashboard();
    fireEvent.focus(within(rows()[0]).getByRole("button", { name: "Brittany Pilz" }));
    const chart = await screen.findByRole("img", { name: /^Brittany Pilz's no-show risk: High\. New worker: High, / });
    expect(chart.closest("[data-risk]")?.textContent).toMatch(/No-show risk\s*High/);
  });

  it("opens a row's sheet on Notes & history from its notes, on Shift tracker from its risk or afresh, keeping its tab for another row", async () => {
    const { user, rows } = await openDashboard();
    const brittany = () => rows()[0];
    const selected = () => within(screen.getByRole("dialog")).getByRole("tab", { selected: true }).textContent;
    await user.click(within(brittany()).getByRole("button", { name: /^\d+ notes$/ }));
    expect(selected()).toMatch(/^Notes & history/);
    const disha = rows().find((row) => row.getAttribute("data-worker") === "Disha Patil")!;
    await user.click(within(disha).getByRole("button", { name: "Training - 2" }));
    expect(screen.getByRole("dialog", { name: "Disha Patil" })).toBeDefined();
    expect(selected()).toMatch(/^Notes & history/);
    await user.click(within(disha).getAllByRole("button", { name: "Location Disabled" })[0]);
    expect(selected()).toBe("Shift tracker");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(within(brittany()).getByRole("button", { name: /^\d+ notes$/ }));
    await user.click(within(brittany()).getByRole("button", { name: "Packaging Worker - Overnight Shift" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(within(brittany()).getByRole("button", { name: "Packaging Worker - Overnight Shift" }));
    expect(selected()).toBe("Shift tracker");
  });

  it("splits a worker's side sheet into Shift tracker and Notes & history, each status their shift moved to among the notes", async () => {
    const { user, rows } = await openDashboard();
    await user.click(within(rows()[0]).getByRole("button", { name: "Packaging Worker - Overnight Shift" }));
    const sheet = screen.getByRole("dialog", { name: "Brittany Pilz" });
    const tabs = within(sheet).getAllByRole("tab");
    expect(tabs.map((tab) => [tab.textContent, tab.getAttribute("aria-selected")])).toEqual([
      ["Shift tracker", "true"],
      ["Notes & history2", "false"],
    ]);
    const panel = within(sheet).getByRole("tabpanel", { name: "Shift tracker" });
    expect(within(panel).getAllByRole("region").map((card) => card.getAttribute("aria-label"))).toEqual(["Risk factor", "Check-in status"]);
    expect(within(panel).queryByRole("button", { name: "Add note..." })).toBeNull();

    await user.click(within(sheet).getByRole("tab", { name: "Notes & history" }));
    const notes = within(sheet).getByRole("tabpanel", { name: "Notes & history" });
    expect(within(notes).queryByRole("region")).toBeNull();
    expect(within(notes).getByRole("button", { name: "Add note..." })).toBeDefined();
    const items = within(within(notes).getByRole("list", { name: "Notes & history" })).getAllByRole("listitem");
    const left = items.find((item) => item.textContent?.startsWith("Left Job Site"))!;
    expect(left.textContent).toMatch(/^Left Job SiteBy SpotTrace • \w{3} \d{1,2}, \d{4}, \d{1,2}:\d{2} [AP]M$/);
    expect(items.at(-1)!.textContent).toMatch(/^Checked InBy Brittany Pilz • /);
  });

  it("lists a worker's risk factor in their side sheet, their level beside the heading and Acknowledge Risk at its end", async () => {
    const { user, rows } = await openDashboard();
    await user.click(within(rows()[0]).getByRole("button", { name: "Packaging Worker - Overnight Shift" }));
    const sheet = screen.getByRole("dialog", { name: "Brittany Pilz" });
    expect(within(sheet).queryByRole("button", { name: "Show risk profile" })).toBeNull();
    const card = within(sheet).getByRole("region", { name: "Risk factor" });
    expect(within(card).getByRole("img", { name: /^Brittany Pilz's risk factor: High\. New worker: High, / })).toBeDefined();
    const head = within(card).getByRole("heading", { name: "Risk factor" }).parentElement!;
    expect([...head.children].map((each) => each.textContent)).toEqual(["Risk factor", "High", "Acknowledge Risk"]);
    expect(within(head).getByText("High").closest("[data-shape=pill]")).not.toBeNull();
    expect(within(head).getByRole("checkbox", { name: "Acknowledge Risk" })).toBeDefined();
    // Every factor's reading, its level and its name, as the project sheet lists them.
    const readings = within(card).getAllByRole("listitem").map((item) => item.textContent);
    expect(readings).toEqual([
      "3rd shiftHighNew worker",
      "Wants to cancelHighCancellation request",
      "Cancelled 3.5 h before last shiftMediumLate cancellations",
      "1 late check-inLowLate check-ins and absences",
      "7.3 km awayHighLocation",
      "Team's 213th shiftNoneNew team",
    ]);
  });

  it("maps where a worker with location off was last seen under their check-in status, with its timeline", async () => {
    const { user, rows } = await openDashboard();
    await user.click(within(rows()[0]).getByRole("button", { name: "Packaging Worker - Overnight Shift" }));
    const sheet = screen.getByRole("dialog", { name: "Brittany Pilz" });
    const risks = within(sheet).getByRole("region", { name: "Risk factor" });
    expect(risks.querySelector("[data-map]")).toBeNull();
    const card = within(sheet).getByRole("region", { name: "Check-in status" });
    const map = card.querySelector<HTMLElement>("[data-map]")!;
    expect(map.dataset.size).toBe("wide");
    expect(map.querySelector("polygon")).not.toBeNull();
    expect(map.querySelector("[data-worker][data-untracked]")).not.toBeNull();
    expect(map.querySelector("[data-last-known]")).not.toBeNull();
    // Its timeline under it, on her last report.
    const mapped = map.parentElement!;
    const slider = within(mapped).getByRole("slider", { name: LOCATION_HISTORY.timeline });
    expect(slider.getAttribute("aria-valuenow")).toBe(slider.getAttribute("aria-valuemax"));
    expect(map.compareDocumentPosition(slider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const statusRow = within(card).getByRole("button", { name: "Edit check-in" }).parentElement!;
    expect(mapped.parentElement).toBe(statusRow.parentElement);
    expect(statusRow.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("plays the location history of every worker who's come in in View location, opening on their last report", async () => {
    const { user, rows } = await openDashboard();
    const viewLocation = async (name: string) => {
      const row = rows().find((row) => row.getAttribute("data-worker") === name)!;
      await user.click(within(row).getByRole("button", { name: /km|On Site/ }));
      return screen.getByRole("dialog", { name: `View location: ${name}` });
    };
    for (const name of ["Sikander Mazumdar", "Brittany Pilz", "Jeff Gwartzmann"]) {
      const dialog = await viewLocation(name);
      const slider = within(dialog).getByRole("slider", { name: LOCATION_HISTORY.timeline });
      expect(within(dialog).getByText(/^Last updated on /).textContent).toMatch(new RegExp(`${slider.getAttribute("aria-valuetext")}$`));
      expect(dialog.querySelector("[data-arc]")).toBeNull();
      await user.click(within(dialog).getByRole("button", { name: "Close" }));
    }
  });

  it("maps the job site under the check-in status of every worker with location reports, with the worker where their location's known", async () => {
    const { user, rows } = await openDashboard();
    await user.click(screen.getByRole("button", { name: /^All check-ins/ }));
    const sheet = async (name: string, position: string) => {
      await user.click(within(rows().find((row) => row.getAttribute("data-worker") === name)!).getByRole("button", { name: position }));
      return screen.getByRole("dialog", { name });
    };
    const status = (dialog: HTMLElement) => within(dialog).getByRole("region", { name: "Check-in status" });
    for (const [name, position, located] of [
      ["Jeff Gwartzmann", "Packer", true],
      ["Sikander Mazumdar", "Cutting Machine Operator", true],
      ["Tashonda Williams", "Cutting Machine Operator", true],
    ] as const) {
      const card = status(await sheet(name, position));
      const map = card.querySelector<HTMLElement>("[data-map]")!;
      expect(map.dataset.size).toBe("wide");
      expect(map.querySelector("polygon")).not.toBeNull();
      expect(!!map.querySelector("[data-worker]")).toBe(located);
      expect(map.querySelector("[data-last-known], [data-untracked]")).toBeNull();
      // Its timeline under it, on their last report.
      const mapped = map.parentElement!;
      const slider = within(mapped).getByRole("slider", { name: LOCATION_HISTORY.timeline });
      expect(slider.getAttribute("aria-valuenow")).toBe(slider.getAttribute("aria-valuemax"));
      expect(map.compareDocumentPosition(slider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      const statusRow = within(card).getByRole("button", { name: "Edit check-in" }).parentElement!;
      expect(mapped.parentElement).toBe(statusRow.parentElement);
      expect(statusRow.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("draws no map in the sheet of a worker whose location was off before tracking began and still is", async () => {
    const { user, rows } = await openDashboard();
    await user.click(screen.getByRole("button", { name: /^All check-ins/ }));
    for (const [name, position] of [
      ["Gamander Lopez", "Can Filling Production Operator - Shift A"],
      ["Disha Patil", "Training - 2"],
      ["Maria Franci", "Picker Packer - Weekdays Afternoon Shift"],
    ] as const) {
      await user.click(within(rows().find((row) => row.getAttribute("data-worker") === name)!).getByRole("button", { name: position }));
      const sheet = screen.getByRole("dialog", { name });
      expect(within(within(sheet).getByRole("region", { name: "Risk factor" })).getByText("Location disabled")).toBeDefined();
      expect(sheet.querySelector("[data-map]")).toBeNull();
      expect(within(sheet).getByRole("region", { name: "Check-in status" }).hasAttribute("data-padded")).toBe(false);
    }
  });

  it("opens the sheet's timeline on the last report of each worker it's moved to", async () => {
    const { user, rows } = await openDashboard();
    await user.click(screen.getByRole("button", { name: /^All check-ins/ }));
    const ends = [];
    for (const [name, position] of [
      ["Sikander Mazumdar", "Cutting Machine Operator"],
      ["Jeff Gwartzmann", "Packer"],
      ["Tashonda Williams", "Cutting Machine Operator"],
    ] as const) {
      await user.click(within(rows().find((row) => row.getAttribute("data-worker") === name)!).getByRole("button", { name: position }));
      const slider = within(screen.getByRole("dialog", { name })).getByRole("slider", { name: LOCATION_HISTORY.timeline });
      expect(slider.getAttribute("aria-valuenow")).toBe(slider.getAttribute("aria-valuemax"));
      ends.push(slider.getAttribute("aria-valuemax"));
    }
    expect(new Set(ends).size).toBe(3);
  });

  it("heads the table's last column Actions", async () => {
    await openDashboard();
    expect(screen.getAllByRole("columnheader").at(-1)!.textContent).toBe("Actions");
  });

  it("shows Not Tracking, greyed out, for workers who are upcoming, checked out or absent, their location history in the side sheet alone", async () => {
    const { user, rows } = await openDashboard();
    await user.click(screen.getByRole("button", { name: /^All check-ins/ }));
    const row = (name: string) => rows().find((row) => row.getAttribute("data-worker") === name)!;
    for (const name of ["Sikander Mazumdar", "Jeff Gwartzmann", "Cristofer Dorwart"]) {
      expect(within(row(name)).queryByRole("button", { name: NOT_TRACKING })).toBeNull();
      expect(within(row(name)).getByRole("button", { name: /km|On Site/ }).hasAttribute("disabled")).toBe(false);
    }
    for (const [name, position, history] of [
      ["Tashonda Williams", "Cutting Machine Operator", true],
      ["Marilyn Calzoni", "Warehouse Associate - Night Shift", true],
      ["Giana Baptista", "Packer - Evening Shift", true],
      ["Brianna Santos", "Server - Late Shift", false],
    ] as const) {
      const link = within(row(name)).getByRole("button", { name: NOT_TRACKING });
      expect(link.hasAttribute("disabled")).toBe(true);
      expect(link.hasAttribute("aria-expanded")).toBe(false);
      await user.click(within(row(name)).getByRole("button", { name: position }));
      const status = within(screen.getByRole("dialog", { name })).getByRole("region", { name: "Check-in status" });
      const slider = within(status).queryByRole("slider", { name: LOCATION_HISTORY.timeline });
      expect(!!slider).toBe(history);
      if (slider) expect(slider.getAttribute("aria-valuenow")).toBe(slider.getAttribute("aria-valuemax"));
    }
    expect(screen.queryByRole("dialog", { name: /^View location/ })).toBeNull();
  });

  it("keeps a worker's side sheet in place for another worker's row, only its contents replaced", async () => {
    const { user, rows } = await openDashboard();
    await user.click(within(rows()[0]).getByRole("button", { name: "Packaging Worker - Overnight Shift" }));
    const sheet = screen.getByRole("dialog", { name: "Brittany Pilz" });
    const disha = rows().find((row) => row.getAttribute("data-worker") === "Disha Patil")!;
    await user.click(within(disha).getByRole("button", { name: "Training - 2" }));
    expect(screen.getByRole("dialog", { name: "Disha Patil" })).toBe(sheet);
    expect(within(sheet).getByRole("img", { name: /^Disha Patil's risk factor: / })).toBeDefined();
  });

  it("counts a worker's unread notes on Notes & history, marks them while it first shows them, not when it shows them again", async () => {
    const { user, rows } = await openDashboard();
    const brittany = () => user.click(within(rows()[0]).getByRole("button", { name: "Packaging Worker - Overnight Shift" }));
    const unread = () => screen.getByRole("dialog").querySelectorAll("[data-unread]").length;
    const tab = () => within(screen.getByRole("dialog")).getByRole("tab", { name: "Notes & history" });
    await brittany();
    expect(tab().textContent).toBe("Notes & history2");
    expect(within(rows()[0]).queryByText("2 Unread")).not.toBeNull();
    await user.click(tab());
    expect(unread()).toBe(2);
    expect(tab().textContent).toBe("Notes & history");
    expect(within(rows()[0]).queryByText("2 Unread")).toBeNull();
    const disha = rows().find((row) => row.getAttribute("data-worker") === "Disha Patil")!;
    await user.click(within(disha).getByRole("button", { name: "Training - 2" }));
    expect(unread()).toBe(0);
    await brittany();
    expect(unread()).toBe(0);
  });

  it("adds a note from a worker's side sheet in a bottom sheet modal over that sheet alone, kept up when its scrim's pressed", async () => {
    const { user, rows } = await openDashboard();
    const disha = () => rows().find((row) => row.getAttribute("data-worker") === "Disha Patil")!;
    await user.click(within(disha()).getByRole("button", { name: "Training - 2" }));
    const sheet = screen.getByRole("dialog", { name: "Disha Patil" });
    await user.click(within(sheet).getByRole("tab", { name: "Notes & history" }));
    await user.click(within(sheet).getByRole("button", { name: "Add note..." }));
    const note = () => screen.getByRole("dialog", { name: "Add a note" });
    expect(sheet.contains(note())).toBe(true);
    expect(note().getAttribute("aria-modal")).toBe("true");
    const scrim = note().parentElement!;
    expect(scrim.getAttribute("data-scrim")).toBe("light");
    expect(scrim.parentElement!.closest("section")).toBeNull();
    expect(within(sheet).getByRole("tab", { name: "Shift tracker" }).closest("[inert]")).not.toBeNull();
    expect(disha().closest("[inert]")).toBeNull();
    expect(document.activeElement).toBe(within(note()).getByRole("textbox", { name: "Note" }));

    await user.pointer({ keys: "[MouseLeft]", target: scrim });
    expect(note()).toBeDefined();
    [...document.querySelectorAll("[data-escape-layer]")].at(-1)!.dispatchEvent(new Event("escape-layer"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add a note" })).toBeNull());
    expect(screen.getByRole("dialog", { name: "Disha Patil" })).toBe(sheet);

    await user.click(within(sheet).getByRole("button", { name: "Add note..." }));
    await user.type(within(note()).getByRole("textbox", { name: "Note" }), "Called the site.");
    await user.click(within(note()).getByRole("button", { name: "Add note" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add a note" })).toBeNull());
    expect(within(sheet).getByText("Called the site.")).toBeDefined();
  });

  it("closes a worker's side sheet for a press on another row's control that opens no side sheet", async () => {
    const { user, rows } = await openDashboard();
    const brittany = () => user.click(within(rows()[0]).getByRole("button", { name: "Packaging Worker - Overnight Shift" }));
    const disha = () => rows().find((row) => row.getAttribute("data-worker") === "Disha Patil")!;
    await brittany();
    await user.click(within(disha()).getByRole("checkbox", { name: "Disha Patil" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Brittany Pilz" })).toBeNull());
    await brittany();
    await user.click(within(rows()[1]).getByRole("button", { name: "Check-in..." }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Brittany Pilz" })).toBeNull());
  });

  it("closes a worker's side sheet for a press in the app, not one on the page round it", async () => {
    const { user, rows } = await openDashboard();
    await user.click(within(rows()[0]).getByRole("button", { name: "Packaging Worker - Overnight Shift" }));
    const page = document.body.appendChild(document.createElement("p"));
    // The sheet leaves once its exit has played.
    const press = async (target: Element) => {
      fireEvent.pointerDown(target);
      await act(async () => {});
    };
    await press(page);
    expect(screen.queryByRole("dialog", { name: "Brittany Pilz" })).not.toBeNull();
    await press(screen.getByRole("heading", { level: 1, name: "Check-Ins" }));
    expect(screen.queryByRole("dialog", { name: "Brittany Pilz" })).toBeNull();
    page.remove();
  });

  it("switches between missing and all check-ins from their tiles", async () => {
    const { user, rows } = await openDashboard();
    const missing = screen.getByRole("button", { name: /^Missing\d/ });
    const all = screen.getByRole("button", { name: /^All check-ins/ });
    expect(missing.getAttribute("aria-pressed")).toBe("true");
    await user.click(all);
    expect(all.getAttribute("aria-pressed")).toBe("true");
    expect(missing.getAttribute("aria-pressed")).toBe("false");
    // The United States' 8 and Canada's 7.
    expect(rows()).toHaveLength(15);
  });

  it("counts both countries in one row of tiles, the Country segments first among the filters picking whose", async () => {
    const { user, rows } = await openDashboard();
    const tiles = within(screen.getByRole("group", { name: "Check-in counts" })).getAllByRole("button");
    expect(tiles.map((tile) => tile.textContent?.match(/^\D+/)?.[0])).toEqual([
      "Missing",
      "New workers",
      "New teams",
      "Absences",
      "Late check-ins",
      "All check-ins",
    ]);
    const country = screen.getByRole("group", { name: "Country" });
    const segment = (name: string) => within(country).getByRole("button", { name });
    expect(["All", "USA", "Canada"].map((name) => segment(name).getAttribute("aria-pressed"))).toEqual(["true", "false", "false"]);
    expect(country.parentElement!.firstElementChild).toBe(country);
    expect(within(country.parentElement!).getByRole("button", { name: "Companies" })).toBeDefined();
    const workers = () => rows().map((row) => row.getAttribute("data-worker"));
    const missing = () => tiles[0].querySelector("[data-typography=heading]")?.textContent;
    expect([missing(), rows().length]).toEqual(["6", 6]);
    await user.click(segment("USA"));
    expect([missing(), rows().length]).toEqual(["5", 5]);
    expect(workers()).not.toContain("Maria Franci");
    await user.click(segment("Canada"));
    expect([missing(), workers()]).toEqual(["1", ["Maria Franci"]]);
  });

  it("checks a missing worker in from their row, which leaves the missing list", async () => {
    const { user, rows } = await openDashboard();
    const gamander = rows()[1];
    await user.click(within(gamander).getByRole("button", { name: "Check-in..." }));
    const overlay = screen.getByRole("dialog", { name: "Check in: Gamander Lopez" });
    await user.click(within(overlay).getByRole("checkbox", { name: /Do not track this action/ }));
    await user.click(within(overlay).getByRole("button", { name: "Check in" }));
    expect(screen.queryByRole("dialog", { name: /Check in/ })).toBeNull();
    expect(rows().map((row) => row.getAttribute("data-worker"))).not.toContain("Gamander Lopez");
  });

  it("marks a worker absent from their row", async () => {
    const { user, rows } = await openDashboard();
    await user.click(within(rows()[1]).getByRole("button", { name: "Mark absent..." }));
    const overlay = screen.getByRole("dialog", { name: "Mark absent: Gamander Lopez" });
    expect(within(overlay).getByText("Danger zone")).toBeDefined();
    await user.click(within(overlay).getByRole("button", { name: "Mark absent" }));
    await user.click(screen.getAllByRole("button", { name: /^Absences/ })[0]);
    expect(rows().map((row) => row.getAttribute("data-worker"))).toContain("Gamander Lopez");
  });

  it("shows a row's notes, its unread ones counted on the line under them, and no message sent", async () => {
    const { rows } = await openDashboard();
    const brittany = rows().find((row) => row.getAttribute("data-worker") === "Brittany Pilz")!;
    const part = (element: Element) => element.closest("[role=cell] > *");
    const notes = within(brittany).getByRole("button", { name: /^\d+ notes?$/ });
    const unread = [...within(brittany).getAllByText(/^\d+ Unread$/)].find((chip) => part(chip)?.previousElementSibling === part(notes));
    expect(unread).toBeDefined();
    expect(brittany.textContent).not.toContain("Message Sent");
    expect(brittany.textContent).not.toContain("15m ago");
  });

  it("sends a message, which the row counts among its notes and the side sheet shows", async () => {
    const { user, rows } = await openDashboard();
    const disha = () => rows().find((row) => row.getAttribute("data-worker") === "Disha Patil")!;
    const notes = () => Number(/(\d+) notes?/.exec(disha().textContent ?? "")?.[1] ?? 0);
    const before = notes();
    await user.click(within(disha()).getByRole("button", { name: "Send message" }));
    const overlay = screen.getByRole("dialog", { name: "Send message: Disha Patil" });
    await user.click(within(overlay).getByRole("button", { name: "Are you on site?" }));
    await user.click(within(overlay).getAllByRole("button", { name: "Send message" }).at(-1)!);
    expect(notes()).toBe(before + 1);
    expect(disha().textContent).not.toContain("Message Sent");
    await user.click(within(disha()).getByRole("button", { name: "Training - 2" }));
    const sheet = screen.getByRole("dialog", { name: "Disha Patil" });
    await user.click(within(sheet).getByRole("tab", { name: "Notes & history" }));
    expect(within(sheet).getByText(/are you on site\?/)).toBeDefined();
  });

  it("keeps Send message pressable with no message, sending nothing and turning the message Alert", async () => {
    const { user, rows } = await openDashboard();
    const disha = () => rows().find((row) => row.getAttribute("data-worker") === "Disha Patil")!;
    const notes = () => Number(/(\d+) notes?/.exec(disha().textContent ?? "")?.[1] ?? 0);
    const before = notes();
    await user.click(within(disha()).getByRole("button", { name: "Send message" }));
    const overlay = screen.getByRole("dialog", { name: "Send message: Disha Patil" });
    const send = within(overlay).getAllByRole("button", { name: "Send message" }).at(-1)!;
    expect(send).toHaveProperty("disabled", false);
    await user.click(send);
    expect(screen.getByRole("dialog", { name: "Send message: Disha Patil" })).toBe(overlay);
    expect(notes()).toBe(before);
    const state = (name: string) => within(overlay).getByRole("textbox", { name }).closest("[data-field]")!.getAttribute("data-state");
    expect(state("Message")).toBe("alert");
    await user.click(within(overlay).getByRole("button", { name: "Are you on site?" }));
    expect(state("Message")).not.toBe("alert");
  });

  it("writes a message in a modal over the whole app, which takes the focus", async () => {
    const { user, rows } = await openDashboard();
    const disha = rows().find((row) => row.getAttribute("data-worker") === "Disha Patil")!;
    await user.click(within(disha).getByRole("button", { name: "Send message" }));
    const modal = screen.getByRole("dialog", { name: "Send message: Disha Patil" });
    expect(modal.getAttribute("aria-modal")).toBe("true");
    expect(disha.contains(modal)).toBe(false);
    expect(modal.contains(document.activeElement)).toBe(true);
  });

  it("keeps the focus inside the message modal", async () => {
    const { user, rows } = await openDashboard();
    await user.click(within(rows()[0]).getByRole("button", { name: "Send message" }));
    const modal = screen.getByRole("dialog", { name: /^Send message/ });
    for (let i = 0; i < 20; i++) {
      await user.tab();
      expect(modal.contains(document.activeElement)).toBe(true);
    }
  });

  it("closes the message modal, sending nothing, on a press outside it", async () => {
    const { user, rows } = await openDashboard();
    const disha = () => rows().find((row) => row.getAttribute("data-worker") === "Disha Patil")!;
    await user.click(within(disha()).getByRole("button", { name: "Send message" }));
    const modal = screen.getByRole("dialog", { name: "Send message: Disha Patil" });
    const notes = disha().textContent?.match(/\d+ notes?/)?.[0];
    await user.click(within(modal).getByRole("button", { name: "Are you on site?" }));
    await user.click(modal.parentElement!);
    expect(screen.queryByRole("dialog", { name: /^Send message/ })).toBeNull();
    expect(disha().textContent?.match(/\d+ notes?/)?.[0]).toBe(notes);
  });

  it("tells a worker who hasn't checked in from one who checked in and left the job site, both among the missing", async () => {
    const { user, rows } = await openDashboard();
    const row = (name: string) => rows().find((r) => r.getAttribute("data-worker") === name)!;
    const pill = (name: string) => within(row(name)).getAllByRole("cell")[3].firstElementChild!.textContent;
    expect(pill("Gamander Lopez")).toBe("Missing Check-In");
    const tone = (name: string) => within(row(name)).getAllByRole("cell")[3].querySelector("[data-tone]")!.getAttribute("data-tone");
    expect(tone("Gamander Lopez")).toBe("warning");
    for (const name of ["Sikander Mazumdar", "Brittany Pilz"]) {
      expect(pill(name)).toBe("Left Job Site");
      expect(within(row(name)).getAllByRole("cell")[3].textContent).toMatch(/\d{1,2}:\d{2} [AP]M–In Progress EST$/);
      expect(within(row(name)).queryByRole("button", { name: "Edit check-in..." })).not.toBeNull();
      expect(within(row(name)).queryByRole("button", { name: "Mark absent..." })).toBeNull();
    }
    await user.click(screen.getByRole("button", { name: "Status" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Missing Check-In",
      "Left Job Site",
      "Upcoming",
      "Late Check-In",
      "Checked In",
      "Checked Out",
      "Absent",
    ]);
  });

  it("shows a late check-in in Checked In's colours, its lateness still a chip of its own", async () => {
    const { user, rows } = await openDashboard();
    await user.click(screen.getByRole("button", { name: /^All check-ins/ }));
    const row = (name: string) => rows().find((r) => r.getAttribute("data-worker") === name)!;
    const pill = (name: string) => within(row(name)).getAllByRole("cell")[3].querySelector("[data-tone]")!;
    expect([pill("Cristofer Dorwart").textContent, pill("Cristofer Dorwart").getAttribute("data-tone")]).toEqual(["Late Check-In", "active"]);
    expect(pill("Angel Saris").getAttribute("data-tone")).toBe("active");
    expect(within(row("Cristofer Dorwart")).getByText(/^\+\d+m$/).closest("[data-tone]")!.getAttribute("data-tone")).toBe("warning");
  });

  it("narrows the list by status, team and risk factor", async () => {
    const { user, rows } = await openDashboard();
    await user.click(screen.getByRole("button", { name: /^All check-ins/ }));
    await user.click(screen.getByRole("button", { name: "Status" }));
    await user.click(screen.getByRole("option", { name: /Checked Out/ }));
    expect(rows().map((row) => row.getAttribute("data-worker"))).toEqual(["Tashonda Williams"]);
  });

  it("checks the customer's missing worker in on the customer's page too", async () => {
    const { user, rows, customer } = await openDashboard();
    await user.click(within(screen.getByRole("group", { name: "Country" })).getByRole("button", { name: "Canada" }));
    const maria = rows()[0];
    expect(maria.getAttribute("data-worker")).toBe("Maria Franci");
    await user.click(within(maria).getByRole("button", { name: "Check-in..." }));
    await user.click(within(screen.getByRole("dialog", { name: "Check in: Maria Franci" })).getByRole("button", { name: "Check in" }));
    await user.click(customer);
    const row = document.querySelector("[data-worker='Maria Franci']")!;
    expect(row.textContent).toMatch(/Checked In|Late Check-in/);
  });

  it("narrows the list to what's searched for in the Worker column's header", async () => {
    const { user, rows } = await openDashboard();
    const worker = screen.getByRole("columnheader", { name: "Worker" });
    await user.type(within(worker).getByRole("searchbox", { name: "Find a check-in..." }), "pilz");
    expect(rows()).toHaveLength(1);
  });

  it("goes back to the customer's page from its item", async () => {
    const { user, customer } = await openDashboard();
    await user.click(customer);
    expect(screen.getByRole("heading", { name: "Hello, Jesse!" })).toBeDefined();
  });

  it("keeps the sidebar open only when the dashboard has its full width beside it", async () => {
    expect((await openDashboard(1920)).isOpen()).toBe(true);
    cleanup();
    expect((await openDashboard(1440)).isOpen()).toBe(false);
  });

  it("keeps the window's size while the whole table fits it", async () => {
    await openDashboard(1315);
    expect(layout()).toEqual({ width: 1315, height: 900, scale: 1 });
  });

  it("scales down evenly once the table no longer fits, laid out where it last did", async () => {
    const { user, customer } = await openDashboard(1000);
    const { width, height, scale } = layout();
    expect(width).toBe(1315);
    expect(scale).toBeCloseTo(1000 / 1315);
    expect(height * scale).toBeCloseTo(900);
    // The customer's page still fits this window.
    await user.click(customer);
    expect(layout()).toEqual({ width: 1000, height: 900, scale: 1 });
  });
});

describe("the customer's profile cards", () => {
  it("leave the no-show risk to the operations team", async () => {
    setup(1440);
    fireEvent.focus(screen.getAllByRole("button", { name: "Maria Franci" })[0]);
    expect(await screen.findByText("Total Shifts Completed")).toBeDefined();
    expect(screen.queryByRole("img", { name: /no-show risk/ })).toBeNull();
  });
});

describe("a window too narrow for the customer's page", () => {
  it("scales the page down evenly, laid out where it last fit", () => {
    setup(457);
    expect(layout()).toEqual({ width: 914, height: 1800, scale: 0.5 });
  });
});

/** The app's layout box and the scale it's drawn at. */
function layout() {
  const app = document.querySelector<HTMLElement>("[data-check-ins-app]")!;
  const scale = app.style.transform ? parseFloat(app.style.transform.replace("scale(", "")) : 1;
  return { width: parseFloat(app.style.width), height: parseFloat(app.style.height), scale };
}
