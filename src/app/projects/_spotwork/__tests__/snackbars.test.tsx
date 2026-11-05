import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckInsApp, type Page } from "../check-ins-app";
import { SNACKS } from "../copy";
import { shiftStart } from "../data";
import { addDays, isoOf, longDate, weekOf } from "../shifts";
import { dayTitle } from "../timesheet";

// A Wednesday afternoon: the customer's shift began half an hour ago.
const NOW = new Date(2026, 9, 14, 16, 0);
const YESTERDAY = addDays("2026-10-14", -1);

beforeEach(() => vi.useFakeTimers({ toFake: ["Date"], now: NOW }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function open(initialPage?: Page, admin = false) {
  const user = userEvent.setup();
  render(
    <CheckInsApp anchor={shiftStart(new Date())} width={1920} height={900} initialPage={initialPage} admin={admin} />,
  );
  return user;
}

const said = () => screen.queryAllByRole("status").map((snackbar) => snackbar.textContent);

describe("the messages", () => {
  it("leave the worker unnamed, and give counts in numerals and hours as the app shows them", () => {
    expect([SNACKS.checkedIn, SNACKS.checkInUpdated, SNACKS.markedAbsent]).toEqual([
      "Worker checked in",
      "Worker's check-in updated",
      "Worker marked absent",
    ]);
    expect(SNACKS.rescheduled(4, 2)).toBe("4 shifts posted. 2 shifts cancelled.");
    expect(SNACKS.rescheduled(1, 0)).toBe("1 shift posted");
    expect(SNACKS.rescheduled(0, 2)).toBe("2 shifts cancelled");
    expect(SNACKS.rescheduled(10, 2, 80)).toBe("10 shifts posted. 2 shifts cancelled. 80 offers sent.");
    expect(SNACKS.rescheduled(1, 0, 1)).toBe("1 shift posted. 1 offer sent.");
    expect(SNACKS.offersSent(2, 1)).toBe("2 offers sent. 1 offer waitlisted.");
    expect(SNACKS.offersSent(0, 3)).toBe("3 offers waitlisted");
    expect(SNACKS.offersWithdrawn(2)).toBe("2 offers withdrawn");
    expect(SNACKS.confirmed("16.50")).toBe("16.50 hours confirmed");
    expect(SNACKS.offAppAdded).toBe("Off-app timecard added");
  });
});

describe("the Check-ins page's snackbars", () => {
  it("say which code was copied", async () => {
    const user = open();
    const shift = screen.getAllByRole("group", { name: "Weekdays Afternoon Shift" })[0];
    await user.click(within(shift).getByRole("button", { name: "Check-in: 3725" }));
    expect(said()).toEqual([SNACKS.checkInCode("3725")]);
    await user.click(within(shift).getByRole("button", { name: "Check-out: 6835" }));
    expect(said()).toEqual([SNACKS.checkInCode("3725"), SNACKS.checkOutCode("6835")]);
  });

  it("say a worker was checked in, then their check-in changed, then they were marked absent", async () => {
    const user = open();
    const maria = () => document.querySelector<HTMLElement>("[data-worker='Maria Franci']")!;
    await user.click(within(maria()).getByRole("button", { name: "Check in..." }));
    await user.click(within(screen.getByRole("dialog", { name: "Check in: Maria Franci" })).getByRole("button", { name: "Check in" }));
    expect(said()).toEqual([SNACKS.checkedIn]);
    await user.click(within(maria()).getByRole("button", { name: "Edit check-in" }));
    await user.click(within(screen.getByRole("dialog", { name: /Maria Franci/ })).getByRole("button", { name: "Save changes" }));
    expect(said()).toEqual([SNACKS.checkedIn, SNACKS.checkInUpdated]);
    await user.click(within(maria()).getByRole("button", { name: "Edit check-in" }));
    const overlay = screen.getByRole("dialog", { name: /Maria Franci/ });
    await user.click(within(overlay).getByRole("button", { name: "Mark absent" }));
    await user.click(within(overlay).getAllByRole("button", { name: "Mark absent" }).at(-1)!);
    expect(said()).toEqual([SNACKS.checkedIn, SNACKS.checkInUpdated, SNACKS.markedAbsent]);
  });

  it("stack the same message twice", async () => {
    const user = open();
    const shift = screen.getAllByRole("group", { name: "Weekdays Afternoon Shift" })[0];
    const copy = within(shift).getByRole("button", { name: "Check-in: 3725" });
    await user.click(copy);
    await user.click(copy);
    expect(said()).toEqual([SNACKS.checkInCode("3725"), SNACKS.checkInCode("3725")]);
  });
});

describe("the Shifts page's snackbar", () => {
  async function editSchedule() {
    const user = open("shifts");
    await user.click(within(screen.getByRole("row", { name: /General Labour/ })).getAllByRole("button", { name: /^Weekdays AM/ })[0]);
    await user.click(within(screen.getByRole("dialog", { name: "General Labour" })).getByRole("button", { name: "Edit schedule..." }));
    return { user, dialog: screen.getByRole("dialog", { name: "Edit schedule" }) };
  }

  it("counts the shifts an edited schedule posts and cancels, and the offers its new day sends the six hired and two who applied", async () => {
    const { user, dialog } = await editSchedule();
    const week = weekOf(isoOf(new Date()));
    await user.click(within(dialog).getByRole("button", { name: longDate(week[6]) }));
    await user.click(within(dialog).getByRole("button", { name: longDate(addDays(week[0], 8)) }));
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
    expect(said()).toEqual([SNACKS.rescheduled(1, 1, 8)]);
  });

  it("says SpotFill was turned off when that's all that changed", async () => {
    const { user, dialog } = await editSchedule();
    await user.click(within(dialog).getByRole("switch"));
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
    expect(said()).toEqual([SNACKS.spotFill(false)]);
  });
});

describe("Manage Templates' and Manage Template Presets' snackbars", () => {
  it("say a template was saved as a draft, updated, duplicated and deleted", async () => {
    const user = open("templates");
    const card = (name: string) =>
      within(screen.getByRole("list", { name: "Templates" }))
        .getAllByRole("listitem")
        .find((c) => within(c).getByRole("heading").textContent === name)!;

    await user.click(screen.getByRole("button", { name: "New template..." }));
    let sheet = screen.getByRole("dialog", { name: "Create a template" });
    await user.type(within(sheet).getByLabelText("Template Title"), "Shipping Clerk");
    await user.click(within(sheet).getByRole("button", { name: "Save as draft" }));
    expect(said()).toEqual([SNACKS.template.drafted]);

    await user.click(within(card("Forklift Operator")).getByRole("button", { name: "Edit" }));
    await user.click(within(screen.getByRole("dialog", { name: "Edit template" })).getByRole("button", { name: "Save changes" }));
    expect(said()).toEqual([SNACKS.template.drafted, SNACKS.template.updated]);

    await user.click(within(card("Forklift Operator")).getByRole("button", { name: "Duplicate" }));
    sheet = screen.getByRole("dialog", { name: "Create a template" });
    fireEvent.change(within(sheet).getByLabelText("Template Title"), { target: { value: "Forklift Lead" } });
    while (!within(sheet).queryByRole("button", { name: "Create template" }))
      await user.click(within(sheet).getByRole("button", { name: "Next" }));
    await user.click(within(sheet).getByRole("button", { name: "Create template" }));
    expect(said().at(-1)).toBe(SNACKS.template.duplicated);

    await user.click(within(card("Forklift Lead")).getByRole("button", { name: "Delete" }));
    expect(said().at(-1)).toBe(SNACKS.template.deleted);
  });

  it("say a template created from New shift was saved", async () => {
    const user = open("shifts");
    await user.click(within(screen.getByRole("main")).getByRole("button", { name: "New shift..." }));
    const shift = within(screen.getByRole("dialog", { name: "New shift" }));
    await user.click(shift.getByRole("button", { name: longDate(isoOf(new Date())) }));
    await user.click(shift.getByRole("button", { name: "Next" }));
    await user.click(shift.getByRole("button", { name: "Add new template..." }));
    const sheet = screen.getByRole("dialog", { name: "Create a template" });
    await user.type(within(sheet).getByLabelText("Template Title"), "Shipping Clerk");
    await user.click(within(sheet).getByRole("button", { name: "Save as draft" }));
    expect(said()).toEqual([SNACKS.template.drafted]);
  });

  it("call a preset a template preset", async () => {
    const user = open("presets");
    await user.click(screen.getByRole("button", { name: "New template preset..." }));
    const sheet = screen.getByRole("dialog", { name: "Create a template preset" });
    await user.type(within(sheet).getByLabelText("Template Title"), "Shipping Clerk");
    await user.click(within(sheet).getByRole("button", { name: "Save as draft" }));
    expect(said()).toEqual([SNACKS.preset.drafted]);
  });
});

describe("the Timesheet's snackbars", () => {
  const row = (name: string) => within(screen.getByRole("table", { name: "Timesheet" })).getByRole("row", { name: new RegExp(name) });

  it("give the hours a worker's week confirmed, and unconfirmed", async () => {
    const user = open("timesheets");
    const confirm = within(row("Rayna Rhiel Madsen")).getByRole("button", { name: /^Confirm [\d.]+ h$/ });
    const [, hours] = confirm.textContent!.match(/([\d.]+) h/)!;
    await user.click(confirm);
    expect(said()).toEqual([`${hours} hours confirmed`]);
    await user.click(within(row("Rayna Rhiel Madsen")).getByRole("button", { name: "Undo confirmation" }));
    expect(said()).toEqual([`${hours} hours confirmed`, `${hours} hours unconfirmed`]);
  });

  it("give the hours a timecard confirmed, and unconfirmed", async () => {
    const user = open("timesheets");
    const day = () => row("Maria Franci").querySelector<HTMLElement>(`[data-date='${YESTERDAY}']`)!;
    await user.click(within(day()).getByRole("button", { name: /^Checked In\/Out/ }));
    await user.click(within(screen.getByRole("dialog", { name: dayTitle(YESTERDAY) })).getByRole("button", { name: "Confirm hours" }));
    const confirmed = within(day()).getByRole("button", { name: /^Confirmed/ });
    const [, hours] = confirmed.textContent!.match(/([\d.]+) h/)!;
    expect(said()).toEqual([`${hours} hours confirmed`]);
    await user.click(confirmed);
    await user.click(within(screen.getByRole("dialog", { name: dayTitle(YESTERDAY) })).getByRole("button", { name: "Unconfirm hours" }));
    expect(said()).toEqual([`${hours} hours confirmed`, `${hours} hours unconfirmed`]);
  });

  it("say an off-app timecard was added, updated and deleted", async () => {
    const user = open("timesheets", true);
    await user.click(screen.getByRole("button", { name: "Add off-app shift..." }));
    const dialog = screen.getByRole("dialog", { name: "Off-app shift timecard" });
    await user.click(within(dialog).getByRole("combobox", { name: "Template" }));
    await user.click(within(dialog.parentElement!).getByRole("option", { name: "Forklift Operator" }));
    await user.type(within(dialog).getByRole("combobox", { name: "Find a worker" }), "555-0196");
    await user.click(within(dialog.parentElement!).getByRole("option", { name: /Tashonda Williams/ }));
    await user.click(within(dialog).getByRole("button", { name: "Shift Date" }));
    await user.click(within(dialog.parentElement!).getByRole("button", { name: longDate(YESTERDAY) }));
    await user.click(within(dialog).getByRole("button", { name: "Add shift" }));
    expect(said()).toEqual([SNACKS.offAppAdded]);

    const card = () => within(screen.getByRole("region", { name: "Off-app shifts" })).getByRole("group", { name: /Tashonda Williams/ });
    await user.click(within(card()).getByRole("button", { name: /^Edit/ }));
    await user.click(within(screen.getByRole("dialog", { name: "Off-app shift timecard" })).getByRole("button", { name: "Save changes" }));
    expect(said()).toEqual([SNACKS.offAppAdded, SNACKS.offAppUpdated]);
    await user.click(within(card()).getByRole("button", { name: "Delete timecard" }));
    expect(said()).toEqual([SNACKS.offAppAdded, SNACKS.offAppUpdated, SNACKS.offAppDeleted]);
  });
});

describe("the Check-ins dashboard's snackbars", () => {
  async function openDashboard() {
    const user = open("dashboard");
    const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
    const disha = () => rows().find((row) => row.getAttribute("data-worker") === "Disha Patil")!;
    return { user, rows, disha };
  }

  it("say a worker was checked in", async () => {
    const { user, rows } = await openDashboard();
    await user.click(within(rows()[1]).getByRole("button", { name: "Check-in..." }));
    await user.click(within(screen.getByRole("dialog", { name: "Check in: Gamander Lopez" })).getByRole("button", { name: "Check in" }));
    expect(said()).toEqual([SNACKS.checkedIn]);
  });

  it("say a message was sent", async () => {
    const { user, disha } = await openDashboard();
    await user.click(within(disha()).getByRole("button", { name: "Send message" }));
    const overlay = screen.getByRole("dialog", { name: "Send message: Disha Patil" });
    await user.click(within(overlay).getByRole("button", { name: "Are you on site?" }));
    await user.click(within(overlay).getAllByRole("button", { name: "Send message" }).at(-1)!);
    expect(said()).toEqual([SNACKS.messageSent]);
  });

  it("say a risk was acknowledged, then not, and a note added", async () => {
    const { user, disha } = await openDashboard();
    await user.click(within(disha()).getByRole("button", { name: "Training - 2" }));
    const sheet = screen.getByRole("dialog", { name: "Disha Patil" });
    const acknowledge = within(sheet).getByRole("checkbox", { name: "Acknowledge Risk" });
    await user.click(acknowledge);
    expect(said()).toEqual([SNACKS.riskAcknowledged]);
    await user.click(acknowledge);
    expect(said()).toEqual([SNACKS.riskAcknowledged, SNACKS.riskUnacknowledged]);
    await user.click(within(sheet).getByRole("tab", { name: "Notes & history" }));
    await user.click(within(sheet).getByRole("button", { name: "Add note..." }));
    const note = screen.getByRole("dialog", { name: "Add a note" });
    await user.type(within(note).getByRole("textbox"), "Called the site.");
    await user.click(within(note).getByRole("button", { name: "Add note" }));
    expect(said()).toEqual([SNACKS.riskAcknowledged, SNACKS.riskUnacknowledged, SNACKS.noteAdded]);
  });
});

describe("the Activations dashboard's snackbars", () => {
  const row = (name: string) => screen.getByRole("row", { name: new RegExp(name) });

  it("say a prospect was approved, invited, reverted and rejected, each stacked over the last", async () => {
    const user = open("activations");
    await user.click(within(row("Gustavo Donin")).getByRole("button", { name: "SaraLee" }));
    const sheet = screen.getByRole("dialog", { name: "Company settings" });
    await user.click(within(sheet).getByRole("button", { name: "Approve" }));
    expect(said()).toEqual([SNACKS.approved]);
    await user.click(within(sheet).getByRole("button", { name: "Send invitation" }));
    expect(said()).toEqual([SNACKS.approved, SNACKS.invitationSent]);
    expect(screen.getAllByRole("status").map((snackbar) => snackbar.hasAttribute("data-behind"))).toEqual([true, false]);
    await user.click(within(sheet).getByRole("button", { name: "Copy invitation link" }));
    expect(said().at(-1)).toBe(SNACKS.linkCopied);
    await user.click(within(sheet).getByRole("button", { name: "Undo approval" }));
    expect(said().at(-1)).toBe(SNACKS.reverted);
    await user.click(within(sheet).getByRole("button", { name: "Reject" }));
    const reject = screen.getByRole("dialog", { name: "Rejecting company sign-up" });
    await user.type(within(reject).getByRole("textbox"), "Their sites are outside the cities we serve.");
    await user.click(within(reject).getByRole("button", { name: "Reject sign-up" }));
    expect(said()).toEqual([SNACKS.approved, SNACKS.invitationSent, SNACKS.linkCopied, SNACKS.reverted, SNACKS.rejected]);
  });

  it("say a prospect was updated", async () => {
    const user = open("activations");
    await user.click(within(row("Gustavo Donin")).getByRole("button", { name: "SaraLee" }));
    await user.click(within(screen.getByRole("dialog", { name: "Company settings" })).getByRole("button", { name: "Edit prospect information" }));
    const dialog = screen.getByRole("dialog", { name: "Edit company" });
    fireEvent.change(within(dialog).getByLabelText("Company Name"), { target: { value: "SaraLee Inc." } });
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
    expect(said()).toEqual([SNACKS.prospectUpdated]);
  });
});
