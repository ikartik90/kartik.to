import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckInsApp } from "../check-ins-app";
import { PEOPLE, daysFrom, minutesNow, shiftStart } from "../data";
import { addDays, longDate } from "../shifts";
import { dayTitle, type Edits, type OffAppShift } from "../timesheet";
import { TimesheetPage } from "../timesheet-page";
import { hatchStyle } from "../ui";

// A Wednesday afternoon: the customer's shift began half an hour ago, the AM shift is done.
const NOW = new Date(2026, 9, 14, 16, 0);
const TODAY = "2026-10-14";
const YESTERDAY = addDays(TODAY, -1);

beforeEach(() => vi.useFakeTimers({ toFake: ["Date"], now: NOW }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function openApp(initialPage?: "timesheets") {
  const user = userEvent.setup();
  render(<CheckInsApp anchor={shiftStart(new Date())} width={1440} height={900} initialPage={initialPage} />);
  const table = () => screen.getByRole("table", { name: "Timesheet" });
  const row = (name: string) => within(table()).getByRole("row", { name: new RegExp(name) });
  const workers = () => within(table()).getAllByRole("rowheader").map((cell) => cell.textContent);
  return { user, table, row, workers };
}

const dayCell = (row: HTMLElement, date: string) => row.querySelector<HTMLElement>(`[data-date='${date}']`)!;

// The tones of the chips and pills in `root`.
const tones = (root: HTMLElement) =>
  [...root.querySelectorAll("span[data-tone]:not([data-badge])")].map((chip) => chip.getAttribute("data-tone"));

describe("the Timesheet", () => {
  it("opens on this week from Wednesday, and on last week, still to confirm, from Sunday to Tuesday", () => {
    openApp("timesheets");
    expect(screen.getByRole("button", { name: "Week of Oct 11–17" })).toBeDefined();
    cleanup();
    vi.setSystemTime(new Date(2026, 9, 26, 16, 0));
    openApp("timesheets");
    expect(screen.getByRole("button", { name: "Week of Oct 18–24" })).toBeDefined();
  });

  it("opens from the sidebar, a row for each of the Check-ins page's workers", async () => {
    const { user, workers } = openApp();
    await user.click(within(screen.getByRole("navigation", { name: "Main" })).getByRole("button", { name: "Timesheets" }));
    expect(screen.getByRole("heading", { name: "Timesheet" })).toBeDefined();
    expect(workers()).toHaveLength(10);
    expect(workers()[0]).toContain("Maria Franci");
  });

  it("puts each worker's Spotscore on the line under their name", () => {
    const { row } = openApp("timesheets");
    const cell = within(row("Maria Franci")).getByRole("rowheader");
    const { tier, score } = PEOPLE.maria.profile;
    const pill = cell.querySelector<HTMLElement>("[data-tier]")!;
    expect(pill.dataset.tier).toBe(tier);
    expect(pill.textContent).toBe(`${tier}${score}`);
    expect(pill.closest("[data-lead]")).toBeNull();
    expect(within(cell.querySelector<HTMLElement>("[data-lead]")!).getByRole("button", { name: "Maria Franci" })).toBeDefined();
  });

  it("leaves off-app shifts to Spotwork admins", () => {
    openApp("timesheets");
    expect(screen.queryByRole("button", { name: "Add off-app shift..." })).toBeNull();
  });

  it("shows each day's hours, and today's shift as the Check-ins page has it", () => {
    const { row } = openApp("timesheets");
    expect(within(dayCell(row("Aspen Curtis"), YESTERDAY)).getByText("Absent")).toBeDefined();
    expect(within(dayCell(row("Aspen Curtis"), TODAY)).getByText("In Progress")).toBeDefined();
    expect(within(dayCell(row("Maria Franci"), TODAY)).getByText("Absent")).toBeDefined();
    expect(within(dayCell(row("Maria Franci"), addDays(TODAY, 1))).getByText("Upcoming")).toBeDefined();
    expect(within(dayCell(row("Maria Franci"), YESTERDAY)).getByRole("button", { name: /^Checked In\/Out 8\.55 h/ })).toBeDefined();
  });

  it("makes each shift one button, holding its plain chip and its times, as the Shifts table does", () => {
    const { row } = openApp("timesheets");
    const shift = within(dayCell(row("Maria Franci"), YESTERDAY)).getByRole("button", { name: /^Checked In\/Out 8\.55 h/ });
    expect(shift.querySelector("[data-times]")).toBeTruthy();
    expect(shift.querySelector("[data-tone]")?.tagName).toBe("SPAN");
  });

  it("heads its days with their months, as the Shifts table does", async () => {
    const { user, table } = openApp("timesheets");
    const head = () => within(table()).getAllByRole("rowgroup")[0].textContent;
    expect(head()).toContain("October 2026");
    await user.click(screen.getByRole("button", { name: "Previous week" }));
    await user.click(screen.getByRole("button", { name: "Previous week" }));
    expect(head()).toContain("September 2026");
    expect(head()).toContain("October 2026");
  });

  it("heads its last column Actions", () => {
    const { table } = openApp("timesheets");
    expect(within(table()).getAllByRole("columnheader").at(-1)!.textContent).toBe("Actions");
  });

  it("foots each day with its hours across the workers shown, nothing under the days to come", async () => {
    const { user, table } = openApp("timesheets");
    const foot = () => within(table()).getAllByRole("rowgroup").at(-1)!;
    const total = (date: string) => dayCell(foot(), date).textContent;
    expect(within(foot()).getAllByRole("cell")[0].textContent).toBe("Total hours");
    expect(total(addDays(TODAY, 1))).toBe("");
    const everyone = parseFloat(total(YESTERDAY)!);
    await user.type(within(table()).getByRole("searchbox", { name: "Find a worker..." }), "maria");
    expect(total(YESTERDAY)).toBe("8.55 h");
    expect(total(TODAY)).toBe("0.00 h");
    expect(everyone).toBeGreaterThan(8.55);
  });

  it("foots the Actions column with the hours confirmed across the workers shown", async () => {
    const { user, table, row } = openApp("timesheets");
    const confirmed = () => {
      const text = within(within(table()).getAllByRole("rowgroup").at(-1)!).getAllByRole("cell").at(-1)!.textContent!;
      expect(text).toMatch(/^\d+\.\d{2} h confirmed$/);
      return parseFloat(text);
    };
    const before = confirmed();
    const confirm = within(row("Rayna Rhiel Madsen")).getByRole("button", { name: /^Confirm [\d.]+ h$/ });
    const hours = parseFloat(confirm.textContent!.replace("Confirm ", ""));
    await user.click(confirm);
    expect(confirmed()).toBeCloseTo(before + hours, 1);
    await user.click(within(row("Rayna Rhiel Madsen")).getByRole("button", { name: "Undo confirmation" }));
    expect(confirmed()).toBe(before);
  });

  it("hatches no day, not even one with a shift under way", () => {
    const { row } = openApp("timesheets");
    expect(dayCell(row("Aspen Curtis"), TODAY).className).not.toContain(hatchStyle);
    expect(dayCell(row("Maria Franci"), YESTERDAY).className).not.toContain(hatchStyle);
  });

  it("confirms a row's hours, and undoes it", async () => {
    const { user, row } = openApp("timesheets");
    await user.click(within(row("Rayna Rhiel Madsen")).getByRole("button", { name: /^Confirm [\d.]+ h$/ }));
    expect(within(row("Rayna Rhiel Madsen")).getByText("Confirmed")).toBeDefined();
    expect(within(dayCell(row("Rayna Rhiel Madsen"), YESTERDAY)).getByRole("button", { name: /^Confirmed/ })).toBeDefined();
    await user.click(within(row("Rayna Rhiel Madsen")).getByRole("button", { name: "Undo confirmation" }));
    expect(within(row("Rayna Rhiel Madsen")).getByRole("button", { name: /^Confirm [\d.]+ h$/ })).toBeDefined();
  });

  it("finds a worker, and narrows the rows by status", async () => {
    const { user, table, workers } = openApp("timesheets");
    await user.type(within(table()).getByRole("searchbox", { name: "Find a worker..." }), "rayna");
    expect(workers()).toEqual([expect.stringContaining("Rayna Rhiel Madsen")]);
    await user.clear(within(table()).getByRole("searchbox", { name: "Find a worker..." }));
    await user.click(screen.getByRole("button", { name: "Status" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Upcoming", "In Progress", "Absent", "Checked In/Out", "Worker Submitted", "Confirmed",
    ]); // prettier-ignore
    await user.click(screen.getByRole("option", { name: "Confirmed" }));
    expect(workers()).toEqual([expect.stringContaining("Disha Patil"), expect.stringContaining("Sikander Mazumdar")]);
  });

  it("follows a check-in made on the Check-ins page", async () => {
    const { user, row } = openApp();
    await user.click(screen.getByRole("button", { name: "Check in..." }));
    await user.click(within(screen.getByRole("dialog", { name: "Check in: Maria Franci" })).getByRole("button", { name: "Check in" }));
    await user.click(within(screen.getByRole("navigation", { name: "Main" })).getByRole("button", { name: "Timesheets" }));
    expect(within(dayCell(row("Maria Franci"), TODAY)).getByText("In Progress")).toBeDefined();
  });
});

describe("a timecard", () => {
  async function openYesterday(user: ReturnType<typeof userEvent.setup>, row: (name: string) => HTMLElement) {
    await user.click(within(dayCell(row("Maria Franci"), YESTERDAY)).getByRole("button", { name: /^Checked In\/Out/ }));
    return screen.getByRole("dialog", { name: dayTitle(YESTERDAY) });
  }

  it("shows the worker's Spotscore under their name", async () => {
    const { user, row } = openApp("timesheets");
    const dialog = await openYesterday(user, row);
    const { tier, score } = PEOPLE.maria.profile;
    const spotscore = dialog.querySelector("[data-tier]")!;
    expect(spotscore.textContent).toBe(`${tier}${score}`);
    expect(within(dialog).getByText("Maria Franci").compareDocumentPosition(spotscore) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("bills the hours picked, once they're confirmed", async () => {
    const { user, row } = openApp("timesheets");
    const dialog = await openYesterday(user, row);
    expect(within(dialog).getByText("Maria Franci")).toBeDefined();
    const checked = within(dialog).getByRole("radio", { name: /Checked In\/Out/ });
    expect(checked.getAttribute("aria-checked")).toBe("true");
    await user.click(within(dialog).getByRole("radio", { name: /Posted Hours/ }));
    expect(checked.getAttribute("aria-checked")).toBe("false");
    await user.click(within(dialog).getByRole("button", { name: "Confirm hours" }));
    expect(screen.queryByRole("dialog", { name: dayTitle(YESTERDAY) })).toBeNull();
    expect(within(dayCell(row("Maria Franci"), YESTERDAY)).getByRole("button", { name: "Confirmed 8.50 h" })).toBeDefined();
  });

  it("holds confirmed hours until Unconfirm hours opens them to changes again, still open", async () => {
    const { user, row } = openApp("timesheets");
    let dialog = await openYesterday(user, row);
    const marked = () => within(dialog).getAllByRole("radio").map((card) => card.hasAttribute("data-confirmed"));
    const card = (name: RegExp) => within(dialog).getByRole("radio", { name });
    const add = () => within(dialog).getByRole("button", { name: "Add adjusted hours..." });
    expect(marked().some(Boolean)).toBe(false);
    await user.click(card(/Posted Hours/));
    await user.click(within(dialog).getByRole("button", { name: "Confirm hours" }));
    await user.click(within(dayCell(row("Maria Franci"), YESTERDAY)).getByRole("button", { name: "Confirmed 8.50 h" }));
    dialog = screen.getByRole("dialog", { name: dayTitle(YESTERDAY) });
    expect(within(dialog).queryByRole("button", { name: "Confirm hours" })).toBeNull();
    expect(marked().length).toBeGreaterThan(1);
    expect(marked().every(Boolean)).toBe(true);
    expect((add() as HTMLButtonElement).disabled).toBe(true);
    await user.click(card(/Checked In\/Out/));
    expect(card(/Posted Hours/).getAttribute("aria-checked")).toBe("true");
    const unconfirm = within(dialog).getByRole("button", { name: "Unconfirm hours" });
    expect([unconfirm.getAttribute("data-emphasis"), unconfirm.getAttribute("data-tone")]).toEqual(["secondary", "destructive"]);
    await user.click(unconfirm);
    expect(screen.getByRole("dialog", { name: dayTitle(YESTERDAY) })).toBe(dialog);
    expect(within(dayCell(row("Maria Franci"), YESTERDAY)).queryByRole("button", { name: /^Confirmed/ })).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Confirm hours" })).toBeDefined();
    expect(marked().some(Boolean)).toBe(false);
    expect((add() as HTMLButtonElement).disabled).toBe(false);
    await user.click(card(/Checked In\/Out/));
    expect(card(/Checked In\/Out/).getAttribute("aria-checked")).toBe("true");
  });

  it("shows the card picked first, the rest in their order, as cards are picked, adjusted and marked absent", async () => {
    const { user, row } = openApp("timesheets");
    const dialog = await openYesterday(user, row);
    const LABELS = ["Adjusted Hours", "Worker Submitted", "Absent", "Checked In/Out", "Posted Hours"];
    // By each card's chips.
    const order = () => within(dialog).getAllByRole("radio").map((card) => LABELS.find((label) => card.firstElementChild!.textContent!.includes(label)));
    expect(order()).toEqual(["Checked In/Out", "Posted Hours"]);
    await user.click(within(dialog).getByRole("radio", { name: /Posted Hours/ }));
    expect(order()).toEqual(["Posted Hours", "Checked In/Out"]);
    await user.click(within(dialog).getByRole("button", { name: "Add adjusted hours..." }));
    await user.click(within(dialog).getByRole("button", { name: "Adjust hours" }));
    expect(order()).toEqual(["Adjusted Hours", "Checked In/Out", "Posted Hours"]);
    await user.click(within(dialog).getByRole("radio", { name: /Posted Hours/ }));
    expect(order()).toEqual(["Posted Hours", "Adjusted Hours", "Checked In/Out"]);
    await user.click(within(dialog).getByRole("button", { name: "Add adjusted hours..." }));
    await user.click(within(dialog).getByRole("button", { name: "Mark absent" }));
    await user.click(within(within(dialog).getByRole("group", { name: "Absent" })).getByRole("button", { name: "Mark absent" }));
    expect(order()).toEqual(["Absent", "Adjusted Hours", "Checked In/Out", "Posted Hours"]);
    await user.click(within(dialog).getByRole("radio", { name: /Checked In\/Out/ }));
    expect(order()).toEqual(["Checked In/Out", "Adjusted Hours", "Absent", "Posted Hours"]);
  });

  it("takes adjusted hours, with a note", async () => {
    const { user, row } = openApp("timesheets");
    const dialog = await openYesterday(user, row);
    await user.click(within(dialog).getByRole("button", { name: "Add adjusted hours..." }));
    await user.click(within(within(dialog).getByRole("group", { name: "Unpaid Break" })).getByRole("button", { name: "More" }));
    await user.type(within(dialog).getByRole("textbox", { name: "Note" }), "Left early.");
    await user.click(within(dialog).getByRole("button", { name: "Adjust hours" }));
    const adjusted = within(dialog).getByRole("radio", { name: /Adjusted Hours/ });
    expect(adjusted.getAttribute("aria-checked")).toBe("true");
    expect(adjusted.textContent).toContain("Left early.");
    await user.click(within(dialog).getByRole("button", { name: "Confirm hours" }));
    expect(within(dayCell(row("Maria Franci"), YESTERDAY)).getByRole("button", { name: /^Confirmed/ })).toBeDefined();
  });

  it("marks a worker absent from a form of its own, with a note", async () => {
    const { user, row } = openApp("timesheets");
    const dialog = await openYesterday(user, row);
    await user.click(within(dialog).getByRole("button", { name: "Add adjusted hours..." }));
    await user.click(within(dialog).getByRole("button", { name: "Mark absent" }));
    expect(within(dialog).queryByRole("group", { name: "Adjusted Hours" })).toBeNull();
    const form = within(dialog).getByRole("group", { name: "Absent" });
    expect(within(dialog).queryByRole("radio", { name: /^Absent/ })).toBeNull();
    expect(within(form).getByRole("checkbox", { name: "Add note to worker's profile" })).toBeDefined();
    expect(form.textContent).not.toContain("Check-in Time");
    await user.type(within(form).getByRole("textbox", { name: "Note" }), "No-show.");
    await user.click(within(form).getByRole("button", { name: "Mark absent" }));
    const absent = within(dialog).getByRole("radio", { name: /^Absent/ });
    expect(absent.getAttribute("aria-checked")).toBe("true");
    expect(absent.textContent).toContain("Adjusted Start Time-Adjusted End Time-Unpaid Break-Billable Duration0.00 h");
    expect(absent.textContent).toContain("No-show.");
    await user.click(within(dialog).getByRole("button", { name: "Confirm hours" }));
    expect(within(dayCell(row("Maria Franci"), YESTERDAY)).getByRole("button", { name: "Absent" })).toBeDefined();
  });

  it("goes back from the absent form to adjusting, and cancels either", async () => {
    const { user, row } = openApp("timesheets");
    const dialog = await openYesterday(user, row);
    await user.click(within(dialog).getByRole("button", { name: "Add adjusted hours..." }));
    await user.click(within(dialog).getByRole("button", { name: "Mark absent" }));
    await user.click(within(dialog).getByRole("button", { name: "Add adjusted hours" }));
    expect(within(dialog).queryByRole("group", { name: "Absent" })).toBeNull();
    expect(within(dialog).getByRole("group", { name: "Adjusted Hours" })).toBeDefined();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(within(dialog).queryByRole("group", { name: "Adjusted Hours" })).toBeNull();
    expect(within(dialog).queryByRole("radio", { name: /^Absent/ })).toBeNull();
  });

  it("keeps an absence to pick again once other hours are picked", async () => {
    const { user, row } = openApp("timesheets");
    await user.click(within(dayCell(row("Maria Franci"), TODAY)).getByRole("button", { name: "Absent" }));
    const dialog = screen.getByRole("dialog", { name: dayTitle(TODAY) });
    const absent = within(dialog).getByRole("radio", { name: /^Absent/ });
    expect(absent.getAttribute("aria-checked")).toBe("true");
    await user.click(within(dialog).getByRole("radio", { name: /Posted Hours/ }));
    expect(absent.getAttribute("aria-checked")).toBe("false");
    await user.click(absent);
    expect(absent.getAttribute("aria-checked")).toBe("true");
  });

  it("shows confirmed hours' pills in their tones, and the cards not picked with theirs disabled", async () => {
    const { user, row } = openApp("timesheets");
    await openYesterday(user, row);
    await user.click(screen.getByRole("button", { name: "Confirm hours" }));
    await user.click(within(dayCell(row("Maria Franci"), YESTERDAY)).getByRole("button", { name: /^Confirmed/ }));
    const [picked, ...rest] = within(screen.getByRole("dialog", { name: dayTitle(YESTERDAY) })).getAllByRole("radio");
    expect(tones(picked)).toEqual(["active", "success"]);
    expect(rest.length).toBeGreaterThan(0);
    for (const card of rest) expect(tones(card)).toEqual(["disabled"]);
  });

  it("closes without changing anything", async () => {
    const { user, row } = openApp("timesheets");
    const dialog = await openYesterday(user, row);
    await user.click(within(dialog).getByRole("radio", { name: /Posted Hours/ }));
    // The footer's, under the header's ×.
    await user.click(within(dialog).getAllByRole("button", { name: "Close" }).at(-1)!);
    expect(within(dayCell(row("Maria Franci"), YESTERDAY)).getByRole("button", { name: /^Checked In\/Out/ })).toBeDefined();
  });

  it("closes a week's days and its Actions, and only them, at 5 PM on the Tuesday after it, white till then even empty or to come, and its footer never", async () => {
    // Each body row's days, then its Actions; the footer's last.
    const rows = (table: HTMLElement) =>
      [...table.querySelectorAll<HTMLElement>("[role=row]")]
        .filter((row) => row.querySelector(":scope > [role=cell][data-date]"))
        .map((row) => [...row.querySelectorAll<HTMLElement>(":scope > [data-date], :scope > [role=cell]:last-child")]);
    const week = (table: HTMLElement) => rows(table).slice(0, -1).flat();
    const foot = (table: HTMLElement) => rows(table).at(-1)!;
    const flagged = (cells: HTMLElement[], flag: string) => cells.filter((cell) => cell.hasAttribute(flag)).length;
    vi.setSystemTime(new Date(2026, 9, 13, 16, 59));
    const before = openApp("timesheets");
    expect(screen.getByRole("button", { name: "Week of Oct 4–10" })).toBeDefined();
    expect(flagged(week(before.table()), "data-closed")).toBe(0);
    const days = week(before.table()).filter((cell) => cell.hasAttribute("data-date"));
    for (const flag of ["data-empty", "data-ahead"]) expect(flagged(days, flag)).toBe(0);
    cleanup();

    vi.setSystemTime(new Date(2026, 9, 13, 17, 0));
    const after = openApp("timesheets");
    expect(flagged(week(after.table()), "data-closed")).toBe(week(after.table()).length);
    expect(flagged(week(after.table()), "data-empty")).toBe(0);
    expect(foot(after.table()).length).toBe(8);
    expect(flagged(foot(after.table()), "data-closed")).toBe(0);
    await after.user.click(screen.getByRole("button", { name: "Next week" }));
    expect(flagged(week(after.table()), "data-closed")).toBe(0);
  });

  it("selects the day cell whose timecards are open, and only it, until they close", async () => {
    const { user, row } = openApp("timesheets");
    const selected = () => [...document.querySelectorAll("[data-selected]")];
    expect(selected()).toEqual([]);
    const dialog = await openYesterday(user, row);
    expect(selected()).toEqual([dayCell(row("Maria Franci"), YESTERDAY)]);
    await user.click(within(dialog).getAllByRole("button", { name: "Close" }).at(-1)!);
    expect(selected()).toEqual([]);
  });

  async function openSubmitted(user: ReturnType<typeof userEvent.setup>, row: (name: string) => HTMLElement) {
    await user.click(within(dayCell(row("Rayna Rhiel Madsen"), YESTERDAY)).getByRole("button", { name: /^Worker Submitted/ }));
    const dialog = screen.getByRole("dialog", { name: dayTitle(YESTERDAY) });
    return { dialog, ask: within(dialog).getByRole("dialog", { name: "Approve worker submitted hours?" }) };
  }

  it("asks to approve the hours a worker sent in, their check-in picked till then", async () => {
    const { user, row } = openApp("timesheets");
    const { dialog, ask } = await openSubmitted(user, row);
    expect(ask.textContent).toContain("Couldn't find the floor manager in time to get the check-in code.");
    expect(within(dialog).getByRole("radio", { name: /Checked In\/Out/ }).getAttribute("aria-checked")).toBe("true");
    expect(within(dialog).queryByRole("radio", { name: /Worker Submitted/ })).toBeNull();
    await user.click(within(ask).getByRole("button", { name: "Approve hours" }));
    expect(within(dialog).queryByRole("dialog", { name: "Approve worker submitted hours?" })).toBeNull();
    expect(within(dialog).getByRole("radio", { name: /Worker Submitted/ }).getAttribute("aria-checked")).toBe("true");
    await user.click(within(dialog).getByRole("button", { name: "Confirm hours" }));
    expect(within(dayCell(row("Rayna Rhiel Madsen"), YESTERDAY)).getByRole("button", { name: "Confirmed 8.50 h" })).toBeDefined();
  });

  it("keeps the hours a worker sent in once they're rejected, under the check-in and not picked", async () => {
    const { user, row } = openApp("timesheets");
    const { dialog, ask } = await openSubmitted(user, row);
    await user.click(within(ask).getByRole("button", { name: "Reject hours" }));
    expect(within(dialog).queryByRole("dialog", { name: "Approve worker submitted hours?" })).toBeNull();
    const radios = [/^Checked In\/Out/, /^Worker Submitted/, /^Posted/].map((name) => within(dialog).getByRole("radio", { name }));
    expect(within(dialog).getAllByRole("radio")).toEqual(radios);
    expect(radios.map((radio) => radio.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
  });

  it("shows the hours a worker sent in, and their note, in the absent form", async () => {
    const { user, row } = openApp("timesheets");
    const { dialog, ask } = await openSubmitted(user, row);
    await user.click(within(ask).getByRole("button", { name: "Adjust hours..." }));
    await user.click(within(dialog).getByRole("button", { name: "Mark absent" }));
    const form = within(dialog).getByRole("group", { name: "Absent" });
    expect(form.textContent).toContain("Worker Submitted HoursShift Start Time");
    await user.click(within(form).getByRole("button", { name: "1 note" }));
    expect(form.textContent).toContain("Couldn't find the floor manager in time to get the check-in code.");
  });

  it("adjusts the hours a worker sent in, from theirs", async () => {
    const { user, row } = openApp("timesheets");
    const { dialog, ask } = await openSubmitted(user, row);
    await user.click(within(ask).getByRole("button", { name: "Adjust hours..." }));
    expect(within(dialog).getByText("Worker Submitted Hours")).toBeDefined();
    await user.click(within(dialog).getByRole("button", { name: "Adjust hours" }));
    expect(within(dialog).getByRole("radio", { name: /Adjusted Hours/ }).getAttribute("aria-checked")).toBe("true");
    expect(within(dialog).getByRole("radio", { name: /Worker Submitted/ })).toBeDefined();
    expect(within(dialog).queryByRole("dialog", { name: "Approve worker submitted hours?" })).toBeNull();
  });
});

function AdminTimesheet() {
  const [edits, setEdits] = useState<Edits>({});
  const [offApp, setOffApp] = useState<OffAppShift[]>([]);
  const anchor = shiftStart(new Date());
  return (
    <TimesheetPage
      admin
      today={TODAY}
      days={daysFrom(anchor, minutesNow(anchor))}
      edits={edits}
      onEdits={setEdits}
      offApp={offApp}
      onOffApp={setOffApp}
      layer={document.body}
      height={900}
    />
  );
}

describe("a closed week", () => {
  // Last week's hours closed at 5 PM yesterday.
  async function openLastWeek() {
    const app = openApp("timesheets");
    await app.user.click(screen.getByRole("button", { name: "Previous week" }));
    return app;
  }

  it("undoes nothing, and shows its chips and pills disabled", async () => {
    const { table } = await openLastWeek();
    expect(within(table()).queryAllByRole("button", { name: "Undo confirmation" })).toEqual([]);
    expect(tones(table()).length).toBeGreaterThan(0);
    expect(new Set(tones(table()))).toEqual(new Set(["disabled"]));
  });

  it("opens its timecards with nothing to change, the confirmed card's pills in their tones and the rest disabled", async () => {
    const { user, row } = await openLastWeek();
    await user.click(within(row("Maria Franci")).getAllByRole("button", { name: /^Confirmed/ })[0]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: /adjusted hours/ })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: /confirm hours/i })).toBeNull();
    // The header's × alone.
    expect(within(dialog).getAllByRole("button", { name: "Close" })).toHaveLength(1);
    const [picked, ...rest] = within(dialog).getAllByRole("radio");
    expect(picked.getAttribute("aria-checked")).toBe("true");
    expect(tones(picked)).toContain("success");
    expect(tones(picked)).not.toContain("disabled");
    expect(rest.length).toBeGreaterThan(0);
    for (const card of rest) expect(tones(card)).toEqual(["disabled"]);
  });
});

describe("an off-app shift", () => {
  it("is added by hand, and deleted", async () => {
    const user = userEvent.setup();
    render(<AdminTimesheet />);
    expect(screen.queryByRole("region", { name: "Off-app shifts" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Add off-app shift..." }));
    const dialog = screen.getByRole("dialog", { name: "Off-app shift timecard" });
    const add = within(dialog).getByRole("button", { name: "Add shift" });
    expect(add).toHaveProperty("disabled", false);
    const look = (label: string) =>
      within(dialog).getByText(label, { selector: "label" }).closest("[data-state]")?.getAttribute("data-state");
    expect(look("Template")).not.toBe("alert");

    // Pressed too soon, it adds nothing and marks what's missing.
    await user.click(add);
    expect(screen.queryByRole("region", { name: "Off-app shifts" })).toBeNull();
    expect(["Template", "Find a worker", "Shift Date"].map(look)).toEqual(["alert", "alert", "alert"]);

    await user.click(within(dialog).getByRole("combobox", { name: "Template" }));
    await user.click(within(dialog.parentElement!).getByRole("option", { name: "Forklift Operator" }));
    expect(look("Template")).not.toBe("alert");
    await user.type(within(dialog).getByRole("combobox", { name: "Find a worker" }), "555-0196");
    await user.click(within(dialog.parentElement!).getByRole("option", { name: /Tashonda Williams/ }));
    await user.click(within(dialog).getByRole("button", { name: "Shift Date" }));
    // The month hangs from the dialog's scrim.
    await user.click(within(dialog.parentElement!).getByRole("button", { name: longDate(YESTERDAY) }));
    await user.click(add);

    const section = screen.getByRole("region", { name: "Off-app shifts" });
    const card = within(section).getByRole("group", { name: /Tashonda Williams/ });
    expect(card.textContent).toContain("Forklift Operator");
    expect(card.textContent).toContain(dayTitle(YESTERDAY));
    expect(card.textContent).toContain("Confirmed");
    await user.click(within(card).getByRole("button", { name: "Delete timecard" }));
    expect(screen.queryByRole("region", { name: "Off-app shifts" })).toBeNull();
  });
});
