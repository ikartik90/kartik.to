import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FC, SVGProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_TEAM } from "../activations";
import { CheckInsApp } from "../check-ins-app";
import { EXPAND_MAP, FEATURE_FLAGS, SNACKS } from "../copy";
import { CHOICES } from "../presets";
import { shiftStart } from "../data";
import { glyph, iconButtonStyle } from "../ui";
import { ROSTER } from "../worker-pool";
import AbsentIcon from "../assets/absent.svg";
import ConfirmedIcon from "../assets/confirmed.svg";
import InProgressIcon from "../assets/in-progress.svg";

const NOW = new Date(2026, 9, 17, 16, 0);

beforeEach(() => vi.useFakeTimers({ toFake: ["Date"], now: NOW }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// The canvas a logo's crop is drawn on, which jsdom lacks: what it's given to draw, and the picture it makes.
const CROPPED = "data:image/png;base64,Y3JvcHBlZA==";
function stubCanvas() {
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as unknown as ImageBitmapRenderingContext);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(CROPPED);
  return drawImage;
}

// Saves the picture just uploaded as it's cropped, in the overlay titled `title`.
// The newest snackbar's words; earlier ones stack behind it.
const newest = () => screen.getAllByRole("status").at(-1)!.textContent;

async function saveCrop(user: User, title: string) {
  await user.click(within(screen.getByRole("dialog", { name: title })).getByRole("button", { name: "Save logo" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: title })).toBeNull());
}

function openActivations() {
  const user = userEvent.setup();
  render(<CheckInsApp anchor={shiftStart(new Date())} width={1440} height={900} initialPage="activations" />);
  const table = () => screen.getByRole("table", { name: "Companies" });
  const rows = () => within(table()).getAllByRole("row").slice(1);
  // The owner's cell, after the company's.
  const names = () => rows().map((row) => within(row).getAllByRole("cell")[1].textContent);
  const row = (name: string) => rows().find((r) => r.textContent?.includes(name))!;
  return { user, table, rows, names, row };
}

type User = ReturnType<typeof userEvent.setup>;

// Confirms a dialog that asks why first: pressed without the note, it stays, the note's field Alert.
async function confirmWithNote(user: User, title: string, action: string) {
  const dialog = screen.getByRole("dialog", { name: title });
  const confirm = within(dialog).getByRole("button", { name: action });
  expect(confirm).toHaveProperty("disabled", false);
  await user.click(confirm);
  expect(screen.getByRole("dialog", { name: title })).toBe(dialog);
  expect(within(dialog).getByRole("textbox").closest("[data-field]")!.getAttribute("data-state")).toBe("alert");
  await user.type(within(dialog).getByRole("textbox"), "Their sites are outside the cities we serve.");
  await user.click(confirm);
  await waitFor(() => expect(screen.queryByRole("dialog", { name: title })).toBeNull());
}

describe("the Companies page", () => {
  it("heads its columns company, owner, contact information, added on, then status", () => {
    const { table, rows } = openActivations();
    expect(
      within(table())
        .getAllByRole("columnheader")
        .map((head) => head.getAttribute("aria-label") ?? head.textContent),
    ).toEqual(["Company", "Owner", "Contact information", "Added on", "Status"]);
    expect(within(table()).getAllByRole("columnheader")[0].querySelector("input")?.placeholder).toBe("Find a company...");
    expect(within(rows()[0]).getAllByRole("cell")[0].textContent).toContain("GoodLeaf Farms");
  });

  it("heads the page with Add new company alone, presets being the sidebar's", () => {
    openActivations();
    expect(screen.queryByRole("button", { name: "Manage Template Presets" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add new company..." })).toBeDefined();
  });

  it("lists Figma's prospects, the newest first, then CCLS, the company app's own", () => {
    const { names } = openActivations();
    expect(screen.getByRole("heading", { level: 1, name: "Companies" })).toBeDefined();
    expect(names()).toHaveLength(10);
    expect(names()[0]).toContain("Anika Septimus");
    expect(names()[0]).toContain("Operations Manager");
    expect(names().at(-2)).toContain("Brittany Pilz");
    expect(names().at(-1)).toContain("Jesse Pereira");
  });

  it("shows each company's status alone, over its notes, everything else being its settings'", () => {
    const { row } = openActivations();
    const status = (name: string) => within(row(name)).getAllByRole("cell").at(-1)!;
    for (const [name, text, notes] of [
      ["Gustavo Donin", "Pending review", "1 note"],
      ["Craig Curtis", "Onboarding", "4 notes"],
      ["Jocelyn Levin", "Rejected", "4 notes"],
      ["Nolan Gouse", "Active", "4 notes"],
    ]) {
      const pills = status(name).querySelectorAll("[data-shape=pill]");
      expect(pills).toHaveLength(1);
      expect(pills[0].textContent).toBe(text);
      expect(within(status(name)).getByText(notes)).toBeDefined();
      // Its company's name, which opens its settings, is all it has to press.
      expect(within(row(name)).getAllByRole("button")).toEqual([within(row(name)).getAllByRole("cell")[0].querySelector("button")]);
    }
  });

  it("asks why before rejecting a prospect, and keeps them pending on Cancel", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Maren Dorwart")).getByRole("button", { name: "Warehouse Republic" }));
    await user.click(within(screen.getByRole("dialog", { name: "Company settings" })).getByRole("button", { name: "Reject" }));
    const dialog = screen.getByRole("dialog", { name: "Rejecting company sign-up" });
    expect(within(dialog).getByText("Rejecting company sign-up")).toBeDefined();
    expect(dialog.textContent).toContain(
      "You can undo this later from Company settings. Are you sure you want to reject this sign-up?",
    );
    expect(within(dialog).getByRole("textbox", { name: "Add a note describing why you are rejecting the sign-up" })).toBeDefined();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Rejecting company sign-up" })).toBeNull());
    expect(within(row("Maren Dorwart")).getByText("Pending review")).toBeDefined();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("finds a prospect, and narrows them by country, size and source", async () => {
    const { user, table, names } = openActivations();
    await user.type(within(table()).getByRole("searchbox", { name: "Find a company..." }), "saralee");
    expect(names()).toEqual([expect.stringContaining("Gustavo Donin")]);
    await user.clear(within(table()).getByRole("searchbox", { name: "Find a company..." }));

    await user.click(within(screen.getByRole("group", { name: "Country" })).getByRole("button", { name: "Canada" }));
    expect(names()).toHaveLength(7);
    await user.click(screen.getByRole("button", { name: "Company size" }));
    await user.click(screen.getByRole("option", { name: "250+" }));
    expect(names()).toEqual([
      expect.stringContaining("Anika Septimus"),
      expect.stringContaining("Paityn Aminoff"),
      expect.stringContaining("Craig Curtis"),
      expect.stringContaining("Nolan Gouse"),
      expect.stringContaining("Brittany Pilz"),
      expect.stringContaining("Jesse Pereira"),
    ]);
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Source" }));
    await user.click(screen.getByRole("option", { name: "Organic" }));
    expect(names()).toHaveLength(3);
  });

  it("narrows them by any of the statuses picked, in a company's order of them", async () => {
    const { user, names } = openActivations();
    await user.click(screen.getByRole("button", { name: "Status" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Pending review",
      "Onboarding",
      "Active",
      "Rejected",
      "Deactivated",
    ]);
    await user.click(screen.getByRole("option", { name: "Active" }));
    expect(names()).toEqual([
      expect.stringContaining("Nolan Gouse"),
      expect.stringContaining("Brittany Pilz"),
      expect.stringContaining("Jesse Pereira"),
    ]);
    await user.click(screen.getByRole("option", { name: "Onboarding" }));
    expect(names()).toHaveLength(5);
  });

  it("shows each company's logo before its name, the placeholder until it has one", () => {
    const { row } = openActivations();
    const logo = (name: string) => within(row(name)).getAllByRole("cell")[0].querySelector("[data-avatar]");
    for (const name of ["Nolan Gouse", "Brittany Pilz", "Jesse Pereira", "Craig Curtis"]) {
      expect(logo(name)?.querySelector("img")).not.toBeNull();
    }
    for (const name of ["Anika Septimus", "Gustavo Donin", "Maren Dorwart", "Jocelyn Levin", "Skylar Kenter", "Paityn Aminoff"]) {
      expect(logo(name)).not.toBeNull();
      expect(logo(name)!.querySelector("img")).toBeNull();
    }
  });

  it("sorts by a column's header", async () => {
    const { user, table, names } = openActivations();
    await user.click(within(table()).getByRole("button", { name: "Sort by Owner" }));
    expect(names()[1]).toContain("Brittany Pilz");
    expect(within(table()).getAllByRole("columnheader")[1].getAttribute("aria-sort")).toBe("ascending");
    await user.click(within(table()).getByRole("button", { name: "Sort by Owner" }));
    expect(names()[0]).toContain("Skylar Kenter");
  });

  it("adds a prospect from New company, pending at the top", async () => {
    const { user, names, row } = openActivations();
    await user.click(screen.getByRole("button", { name: "Add new company..." }));
    const dialog = screen.getByRole("dialog", { name: "New company" });
    const add = within(dialog).getByRole("button", { name: "Add company" });
    expect(add).toHaveProperty("disabled", false);
    await user.click(add);
    expect(screen.getByRole("dialog", { name: "New company" })).toBe(dialog);
    const state = (label: string) => within(dialog).getByLabelText(label).closest("[data-field]")!.getAttribute("data-state");
    expect(["Full Name", "Email Address", "Designation", "Company Name"].map(state)).toEqual(["alert", "alert", "alert", "alert"]);
    expect(state("Contact Number")).not.toBe("alert");

    fireEvent.change(within(dialog).getByLabelText("Full Name"), { target: { value: "Jason Spooner" } });
    await user.type(within(dialog).getByLabelText("Contact Number"), "4165550142");
    expect(within(dialog).getByLabelText("Contact Number")).toHaveProperty("value", "(416) 555-0142");
    fireEvent.change(within(dialog).getByLabelText("Email Address"), {
      target: { value: "jason.spooner@shipfusion.com" },
    });
    fireEvent.change(within(dialog).getByLabelText("Designation"), { target: { value: "Operations Manager" } });
    await user.click(within(within(dialog).getByRole("group", { name: "Company Location" })).getByRole("button", { name: "Canada" }));
    fireEvent.change(within(dialog).getByLabelText("Company Name"), { target: { value: "ShipFusion" } });
    await user.click(within(within(dialog).getByRole("group", { name: "No. of Employees" })).getByRole("button", { name: "25–100" }));
    await user.click(add);

    expect(screen.queryByRole("dialog", { name: "New company" })).toBeNull();
    expect(newest()).toBe(SNACKS.prospectAdded);
    expect(names()[0]).toContain("Jason Spooner");
    expect(row("Jason Spooner").textContent).toContain("Canada • 25–100 employees");
    expect(row("Jason Spooner").textContent).toContain("+1 (416) 555-0142");
    expect(within(row("Jason Spooner")).getByText("Pending review")).toBeDefined();
  });

  it("turns an email or contact number Alert once it's filled in and isn't one, before anything's pressed", async () => {
    const { user } = openActivations();
    await user.click(screen.getByRole("button", { name: "Add new company..." }));
    const dialog = screen.getByRole("dialog", { name: "New company" });
    const state = (label: string) => within(dialog).getByLabelText(label).closest("[data-field]")!.getAttribute("data-state");
    expect(state("Email Address")).not.toBe("alert");
    fireEvent.change(within(dialog).getByLabelText("Email Address"), { target: { value: "jason.spooner@" } });
    expect(state("Email Address")).toBe("alert");
    fireEvent.change(within(dialog).getByLabelText("Email Address"), { target: { value: "jason.spooner@shipfusion.com" } });
    expect(state("Email Address")).not.toBe("alert");
    await user.type(within(dialog).getByLabelText("Contact Number"), "41655");
    expect(state("Contact Number")).toBe("alert");
    expect(state("Full Name")).not.toBe("alert");
  });

  it("asks for the company and its owner alone, templates left to its teams", async () => {
    const { user, row } = openActivations();
    await user.click(screen.getByRole("button", { name: "Add new company..." }));
    const added = screen.getByRole("dialog", { name: "New company" });
    expect(within(added).getAllByRole("heading").map((h) => h.textContent)).toEqual(["Owner information"]);
    // The company's fields first, with no heading, then its owner's under theirs.
    const order = ["Company Location", "Company Name", "No. of Employees", "Owner information", "Full Name", "Contact Number", "Email Address", "Designation"];
    const placed = order.map((text) => within(added).getByText(text));
    expect(placed.every((el, i) => i === 0 || placed[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(within(added).queryByRole("searchbox")).toBeNull();
    await user.click(within(added).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "New company" })).toBeNull());

    // Its own settings hold no templates; a team's Manage templates does.
    await user.click(within(row("Paityn Aminoff")).getByRole("button", { name: "SleepCountry" }));
    const settings = screen.getByRole("dialog", { name: "Company settings" });
    await user.click(within(settings).getByRole("button", { name: "Edit prospect information" }));
    const edited = screen.getByRole("dialog", { name: "Edit company" });
    expect(within(edited).queryByRole("searchbox")).toBeNull();
    await user.click(within(edited).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit company" })).toBeNull());
    expect(within(settings).queryByText(/^Manage templates/)).toBeNull();
  });
});

// A side sheet's way in never ends, so it stays coming in.
const holdWayIn = () => {
  Element.prototype.getAnimations = function (this: Element) {
    return this.matches("[role=dialog]") ? [{ finished: new Promise<never>(() => {}) } as unknown as Animation] : [];
  };
};

describe("a company's settings", () => {
  const sheet = () => screen.getByRole("dialog", { name: "Company settings" });
  const notes = () => screen.getByRole("dialog", { name: "Notes & history" });
  // Each entry's status, note and byline, newest first.
  const entries = () => within(notes()).getAllByRole("listitem").map((item) => item.textContent);
  const gone = () => waitFor(() => expect(screen.queryByRole("dialog", { name: "Company settings" })).toBeNull());
  // The Activation card's state, a pill in place of its title.
  const status = () => {
    const activation = within(sheet()).getByRole("heading", { level: 2, name: "Activation" }).closest("section")!;
    const pills = activation.querySelectorAll<HTMLElement>("[data-shape=pill]");
    expect(pills).toHaveLength(1);
    return { text: pills[0].textContent, tone: pills[0].dataset.tone, icon: pills[0].querySelector("svg")?.innerHTML };
  };
  const icon = (Icon: FC<SVGProps<SVGSVGElement>>) => {
    const box = document.createElement("div");
    box.innerHTML = renderToStaticMarkup(<Icon />);
    return box.firstElementChild!.innerHTML;
  };

  it("shows the company and its first team loading as it comes in", async () => {
    holdWayIn();
    try {
      const { user, row } = openActivations();
      await user.click(within(row("Jesse Pereira")).getByRole("button", { name: APP_TEAM.company }));
      const loading = sheet().querySelector("[aria-busy=true]")!;
      expect([...loading.querySelectorAll("h3")].map((title) => title.textContent)).toEqual([APP_TEAM.company, APP_TEAM.team]);
    } finally {
      Reflect.deleteProperty(Element.prototype, "getAnimations");
    }
  });

  it("opens from an onboarded company's name, as Figma lays it out", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Brittany Pilz")).getByRole("button", { name: "North West Company" }));
    const settings = sheet();
    expect(settings.getAttribute("aria-modal")).toBe("true");
    expect(within(settings).getAllByText("Company settings")).toHaveLength(1);
    expect(within(settings).getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Admin settings",
      "Team settings",
      "Activation",
    ]);
    expect(within(settings).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "North West Company",
      "North West Company Ottawa",
    ]);
    expect(status()).toEqual({ text: "Active", tone: "success", icon: icon(ConfirmedIcon) });
    expect(within(settings).getByText("Canada • 250+ employees")).toBeDefined();
    expect(within(settings).queryByText(/Created on/)).toBeNull();
    expect(within(settings).getByText("Ottawa • (GMT-5) Eastern Standard Time (EST)")).toBeDefined();
    expect(within(settings).queryByRole("switch", { name: "Enable beta access" })).toBeNull();
    // Onboarded, its templates are each team's, in place of the team's saved addresses.
    const admin = within(settings).getByRole("heading", { level: 2, name: "Admin settings" }).closest("section")!;
    expect(within(admin).getAllByText(/^Manage /).map((record) => record.textContent)).toEqual(["Manage feature flags"]);
    expect(within(settings).getByText("2 flags enabled")).toBeDefined();
    const teams = within(settings).getByRole("heading", { level: 2, name: "Team settings" }).closest("section")!;
    expect(within(teams).getAllByText(/^(Manage|Mandatory|Saved) /).map((record) => record.textContent)).toEqual([
      "Manage team members",
      "Manage templates",
      "Manage worker pool",
      "Mandatory requirements",
    ]);
    expect(within(teams).getByText("2 templates")).toBeDefined();
    expect(within(teams).getByText("0 workers")).toBeDefined();
    expect(within(settings).queryByText(/preset/)).toBeNull();
    const activation = within(settings).getByRole("heading", { level: 2, name: "Activation" }).closest("section")!;
    expect(within(activation).queryByText("Onboarded")).toBeNull();
    expect(within(activation).getByText("Active since 10/15/2026 3:48 PM")).toBeDefined();
    expect(within(activation).queryByText("Brittany Pilz • britpilz@northwest.ca")).toBeNull();
    expect(within(activation).getByText("4 notes")).toBeDefined();
    expect(within(activation).getByRole("group", { name: "Danger zone" }).textContent).toContain("Deactivate company");
    expect(within(settings).getAllByRole("switch")).toHaveLength(1);
    expect(within(settings).getByRole("switch", { name: "Enable check-in codes" }).getAttribute("aria-checked")).toBe("false");
    expect(
      within(settings)
        .getAllByRole("group", { name: "Danger zone" })
        .map((zone) => within(zone).getByRole("button").textContent),
    ).toEqual(["Deactivate team", "Deactivate company"]);
    expect(
      within(settings)
        .getAllByRole("button")
        .map((button) => button.textContent || button.getAttribute("aria-label")),
    ).toEqual([
      "Close",
      "Edit company...",
      "Manage feature flags2 flags enabled",
      "Add team...",
      "Edit team...",
      "Manage team members3 members",
      "Manage templates2 templates",
      "Manage worker pool0 workers",
      "Mandatory requirementsNo requirement set",
      "Deactivate team",
      "Notes & history4 notes",
      "Deactivate company",
    ]);
    expect(within(settings).getByText("You will receive a code by email for workers to use when checking in and out.")).toBeDefined();
    expect(
      within(settings).getByText(
        "Once you deactivate this team, no one can post shifts under the team or open the shifts already posted.",
      ),
    ).toBeDefined();
  });

  it("shows an approved company its activation, then its teams to set up, and undoes its approval", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Paityn Aminoff")).getByRole("button", { name: "SleepCountry" }));
    const settings = sheet();
    expect(within(settings).getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Admin settings",
      "Activation",
      "Team settings",
    ]);
    expect(within(settings).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "SleepCountry",
    ]);
    expect(status()).toEqual({ text: "Onboarding", tone: "active", icon: icon(ConfirmedIcon) });
    expect(within(settings).queryByText(/paitynaminoff@geminimats\.ca/)).toBeNull();
    // Onboarding, its Admin settings hold its feature flags alone.
    const admin = within(settings).getByRole("heading", { level: 2, name: "Admin settings" }).closest("section")!;
    expect(within(admin).getAllByText(/^Manage /).map((record) => record.textContent)).toEqual(["Manage feature flags"]);
    expect(within(settings).queryByRole("switch")).toBeNull();
    expect(
      within(settings)
        .getAllByRole("button")
        .map((button) => button.textContent || button.getAttribute("aria-label")),
    ).toEqual([
      "Close",
      "Edit company...",
      "Manage feature flagsNo flag enabled",
      "Contact info",
      "Send invitation",
      "Copy invitation link",
      "Edit prospect information",
      "Notes & history2 notes",
      "Undo approval",
      "Add team...",
    ]);
    expect(within(settings).queryByRole("group", { name: "Danger zone" })).toBeNull();
    const zones = within(settings).getAllByRole("group", { name: "Caution zone" });
    expect(zones).toHaveLength(1);
    expect(within(zones[0]).getByRole("button").textContent).toBe("Undo approval");
    expect(
      within(zones[0]).getByText("You can undo this approval to move this company back to pending for sales to approve or reject again."),
    ).toBeDefined();
    expect(zones[0].closest("section")?.querySelector("h2")?.textContent).toBe("Activation");
    const activation = zones[0].closest("section")!;
    const notes = within(activation).getByText("Notes & history");
    expect(notes.compareDocumentPosition(zones[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(activation).getByText("2 notes")).toBeDefined();

    const copyLink = within(settings).getByRole("button", { name: "Copy invitation link" });
    expect(copyLink.className.endsWith(` ${iconButtonStyle}`)).toBe(true);
    expect(copyLink.getAttribute("aria-label")).toBe("Copy invitation link");

    await user.click(within(settings).getByRole("button", { name: "Send invitation" }));
    expect(newest()).toBe(SNACKS.invitationSent);
    expect(within(settings).queryByRole("button", { name: "Send invitation" })).toBeNull();
    await user.click(within(settings).getByRole("button", { name: "Resend invitation" }));
    expect(newest()).toBe(SNACKS.invitationSent);
    await user.click(within(settings).getByRole("button", { name: "Copy invitation link" }));
    expect(newest()).toBe(SNACKS.linkCopied);

    await user.click(within(zones[0]).getByRole("button", { name: "Undo approval" }));
    expect(newest()).toBe(SNACKS.reverted);
    expect(status().text).toBe("Pending review");
    expect(within(row("Paityn Aminoff")).getByText("Pending review")).toBeDefined();
  });

  it("offers to resend the invitation to an owner who's already been sent it", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Craig Curtis")).getByRole("button", { name: "Dempster's" }));
    expect(within(sheet()).getByRole("button", { name: "Resend invitation" })).toBeDefined();
  });

  it("edits a pending or approved prospect's details over its settings, which keep them", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Gustavo Donin")).getByRole("button", { name: "SaraLee" }));
    const edit = within(sheet()).getByRole("button", { name: "Edit prospect information" });
    expect(edit.className.endsWith(` ${iconButtonStyle}`)).toBe(true);
    await user.click(edit);
    const dialog = screen.getByRole("dialog", { name: "Edit company" });
    expect(within(dialog).getByLabelText("Full Name")).toHaveProperty("value", "Gustavo Donin");
    expect(within(dialog).getByLabelText("Contact Number")).toHaveProperty("value", "(813) 752-5611");
    // Over the sheet, which waits under it.
    expect(sheet().compareDocumentPosition(dialog) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sheet().closest("[inert]")).not.toBeNull();
    fireEvent.change(within(dialog).getByLabelText("Company Name"), { target: { value: "SaraLee Inc." } });
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit company" })).toBeNull());
    expect(within(sheet()).getByRole("heading", { level: 3, name: "SaraLee Inc." })).toBeDefined();
    expect(sheet().closest("[inert]")).toBeNull();

    await user.click(within(sheet()).getByRole("button", { name: "Approve" }));
    await user.click(within(sheet()).getByRole("button", { name: "Edit prospect information" }));
    expect(screen.getByRole("dialog", { name: "Edit company" })).toBeDefined();
  });

  it("deactivates a company once a note says why, the dialog over its settings, and reactivates it as it was", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Brittany Pilz")).getByRole("button", { name: "North West Company" }));
    const zone = () =>
      within(within(sheet()).getByRole("heading", { level: 2, name: "Activation" }).closest("section")!).getByRole("group", {
        name: "Danger zone",
      });
    await user.click(within(zone()).getByRole("button", { name: "Deactivate company" }));
    const dialog = screen.getByRole("dialog", { name: "Deactivating company" });
    expect(dialog.textContent).toContain(
      "No one will be able to post shifts under any of this company's teams or open the shifts already posted. You can undo this later to bring the company and its teams back as they were. Are you sure you want to deactivate this company?",
    );
    expect(within(dialog).getByRole("textbox", { name: "Add a note describing why you are deactivating the company" })).toBeDefined();
    expect(sheet().closest("[inert]")).not.toBeNull();
    // Escape, which the prototype's overlay passes to the last layer open, closes the dialog alone.
    [...document.querySelectorAll("[data-escape-layer]")].at(-1)!.dispatchEvent(new Event("escape-layer"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Deactivating company" })).toBeNull());
    expect(sheet()).toBeDefined();

    await user.click(within(zone()).getByRole("button", { name: "Deactivate company" }));
    await confirmWithNote(user, "Deactivating company", "Deactivate company");
    expect(newest()).toBe(SNACKS.companyDeactivated);
    expect(status().text).toBe("Deactivated");
    expect(within(sheet()).getByText("Deactivated since 10/17/2026 4:00 PM")).toBeDefined();
    const caution = within(sheet()).getByRole("group", { name: "Caution zone" });
    expect(within(caution).getByText("This company has been deactivated and will be archived on 04/17/2027")).toBeDefined();
    expect(
      within(caution).getByText("You can undo this deactivation to bring the company and its teams back as they were, with their settings."),
    ).toBeDefined();
    expect(within(sheet()).getByText("5 notes")).toBeDefined();
    expect(
      within(sheet())
        .getAllByRole("button")
        .map((button) => button.textContent || button.getAttribute("aria-label")),
    ).toEqual(["Close", "Edit company...", "Manage feature flags2 flags enabled", "Notes & history5 notes", "Undo deactivation"]);
    // Its row shows it deactivated, with nothing to do there.
    expect(within(row("Brittany Pilz")).getByText("Deactivated")).toBeDefined();
    expect(within(row("Brittany Pilz")).queryByRole("button", { name: /Approve|Reject|More actions|Revert/ })).toBeNull();

    await user.click(within(caution).getByRole("button", { name: "Undo deactivation" }));
    expect(newest()).toBe(SNACKS.companyReactivated);
    expect(status().text).toBe("Active");
    expect(within(sheet()).getByRole("button", { name: "Add team..." })).toBeDefined();
    expect(within(row("Brittany Pilz")).getByText("Active")).toBeDefined();
  });

  it("lists the company app's teams in CCLS's settings", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Jesse Pereira")).getByRole("button", { name: "CCLS" }));
    const teams = within(sheet()).getByRole("heading", { level: 2, name: "Team settings" }).closest("section")!;
    expect(within(teams).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "CCLS First Gulf",
      "CCLS White Hart",
      "CCLS Derwent",
      "CCLS Thornton",
    ]);
  });

  it("keeps a deactivated company's teams, deactivated, and brings back each as it was", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Nolan Gouse")).getByRole("button", { name: "Dircks Logistics" }));
    const teams = () => within(sheet()).getByRole("heading", { level: 2, name: "Team settings" }).closest("section")!;
    const card = (name: string) =>
      within(teams()).getByRole("heading", { level: 3, name }).closest<HTMLElement>("[data-card]")!;
    // Calgary goes first, on its own.
    await user.click(within(card("Dircks Logistics Calgary")).getByRole("button", { name: "Deactivate team" }));
    await confirmWithNote(user, "Deactivating team", "Deactivate team");

    await user.click(within(sheet()).getByRole("button", { name: "Deactivate company" }));
    await confirmWithNote(user, "Deactivating company", "Deactivate company");
    expect(status().text).toBe("Deactivated");
    for (const name of ["Dircks Logistics Mississauga", "Dircks Logistics Calgary"]) {
      expect(card(name).hasAttribute("data-subdued")).toBe(true);
      expect(within(card(name)).queryAllByRole("button")).toHaveLength(0);
      expect(within(card(name)).queryByRole("switch")).toBeNull();
    }
    expect(within(teams()).queryByRole("button", { name: "Add team..." })).toBeNull();
    expect(within(sheet()).getAllByRole("group", { name: "Caution zone" })).toHaveLength(1);
    expect(within(sheet()).getByText("6 notes")).toBeDefined();

    await user.click(within(sheet()).getByRole("button", { name: "Undo deactivation" }));
    expect(newest()).toBe(SNACKS.companyReactivated);
    expect(status().text).toBe("Active");
    const mississauga = card("Dircks Logistics Mississauga");
    expect(mississauga.hasAttribute("data-subdued")).toBe(false);
    expect(within(mississauga).getByRole("switch", { name: "Enable check-in codes" }).getAttribute("aria-checked")).toBe("true");
    expect(within(mississauga).getByText("9 members")).toBeDefined();
    // Calgary stays as it was before: deactivated, its own undo back.
    expect(card("Dircks Logistics Calgary").hasAttribute("data-subdued")).toBe(true);
    expect(within(card("Dircks Logistics Calgary")).getAllByRole("button").map((b) => b.textContent)).toEqual(["Undo deactivation"]);
    expect(within(teams()).getByRole("button", { name: "Add team..." })).toBeDefined();
  });

  it("deactivates a team once a note says why, and brings it back with its settings", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Brittany Pilz")).getByRole("button", { name: "North West Company" }));
    const teams = () => within(sheet()).getByRole("heading", { level: 2, name: "Team settings" }).closest("section")!;
    const card = () => within(teams()).getByRole("heading", { level: 3, name: "North West Company Ottawa" }).closest("[data-card]")!;
    await user.click(within(sheet()).getByRole("switch", { name: "Enable check-in codes" }));

    await user.click(within(card() as HTMLElement).getByRole("button", { name: "Deactivate team" }));
    const dialog = screen.getByRole("dialog", { name: "Deactivating team" });
    expect(dialog.textContent).toContain(
      "No one will be able to post shifts under this team or open the shifts already posted. You can undo this later, but the team's future shifts will stay deleted. Are you sure you want to deactivate this team?",
    );
    expect(within(dialog).getByRole("textbox", { name: "Add a note describing why you are deactivating the team" })).toBeDefined();
    await confirmWithNote(user, "Deactivating team", "Deactivate team");
    expect(newest()).toBe(SNACKS.teamDeactivated);

    // Subdued, its Caution zone alone under its name.
    const deactivated = within(card() as HTMLElement);
    expect(card().hasAttribute("data-subdued")).toBe(true);
    expect(deactivated.getByText("Ottawa • (GMT-5) Eastern Standard Time (EST)")).toBeDefined();
    expect(deactivated.queryByRole("switch")).toBeNull();
    expect(deactivated.queryByText(/^(Manage|Mandatory)/)).toBeNull();
    expect(deactivated.getAllByRole("button").map((button) => button.textContent)).toEqual(["Undo deactivation"]);
    expect(
      within(deactivated.getByRole("group", { name: "Caution zone" })).getByText(
        "This team has been deactivated and will be archived on 04/17/2027",
      ),
    ).toBeDefined();
    expect(
      within(deactivated.getByRole("group", { name: "Caution zone" })).getByText(
        "You can undo this deactivation to bring the team back with its team members, check-in codes and other settings. The team's future shifts stay deleted.",
      ),
    ).toBeDefined();
    expect(within(sheet()).queryByRole("group", { name: "Danger zone" })?.textContent).toContain("Deactivate company");
    expect(within(sheet()).getByText("5 notes")).toBeDefined();

    await user.click(deactivated.getByRole("button", { name: "Undo deactivation" }));
    expect(newest()).toBe(SNACKS.teamRestored);
    expect(card().hasAttribute("data-subdued")).toBe(false);
    expect(within(sheet()).getByRole("switch", { name: "Enable check-in codes" }).getAttribute("aria-checked")).toBe("true");
    expect(within(card() as HTMLElement).getByText("3 members")).toBeDefined();
    expect(within(card() as HTMLElement).getByRole("button", { name: "Edit team..." })).toBeDefined();
    await user.click(within(sheet()).getByRole("button", { name: /^Notes & history/ }));
    expect(entries().slice(0, 2)).toEqual([
      "Active" + "North West Company Ottawa" + "ByMichael M.• Oct 17, 2026, 4:00 PM",
      "Deactivated" + "North West Company Ottawa" + "Their sites are outside the cities we serve." + "ByMichael M.• Oct 17, 2026, 4:00 PM",
    ]);
  });

  it("edits the company in its own form over its settings, saving it to the Admin settings card", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Nolan Gouse")).getByRole("button", { name: "Dircks Logistics" }));
    const admin = () => within(sheet()).getByRole("heading", { level: 2, name: "Admin settings" }).closest("section")!;
    await user.click(within(admin()).getByRole("button", { name: "Edit company..." }));
    const form = screen.getByRole("dialog", { name: "Edit company workspace" });
    expect(form.getAttribute("aria-modal")).toBe("true");
    expect(within(form).getByText("Edit company workspace")).toBeDefined();
    expect(within(form).getByLabelText("Company Name")).toHaveProperty("value", "Dircks Logistics");
    expect(within(form).getByRole("button", { name: "Cancel" })).toBeDefined();

    // Emptied, its name turns Alert and the form stays.
    const name = within(form).getByLabelText("Company Name");
    fireEvent.change(name, { target: { value: "" } });
    await user.click(within(form).getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("dialog", { name: "Edit company workspace" })).toBe(form);
    expect(name.closest("[data-field]")!.getAttribute("data-state")).toBe("alert");

    fireEvent.change(name, { target: { value: "Dircks Moving & Logistics" } });
    stubCanvas();
    await user.upload(within(form).getByLabelText("Update company logo"), new File(["logo"], "zeus.png", { type: "image/png" }));
    const crop = screen.getByRole("dialog", { name: "Company logo" });
    expect(within(crop).getByRole("img", { name: "Logo position" }).querySelector("img")?.getAttribute("src")).toMatch(/^blob:/);
    await saveCrop(user, "Company logo");
    const logo = form.querySelector("[data-avatar] img")?.getAttribute("src");
    expect(logo).toBe(CROPPED);
    await user.click(within(form).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit company workspace" })).toBeNull());
    expect(newest()).toBe(SNACKS.prospectUpdated);
    const card = within(admin()).getByRole("heading", { level: 3, name: "Dircks Moving & Logistics" }).closest<HTMLElement>("[data-card]")!;
    expect(card.querySelector("[data-avatar] img")?.getAttribute("src")).toBe(logo);
    // Its teams, with no logo of their own, show the company's.
    const teams = within(sheet()).getByRole("heading", { level: 2, name: "Team settings" }).closest("section")!;
    expect([...teams.querySelectorAll("[data-card] [data-avatar] img")].map((img) => img.getAttribute("src"))).toEqual([logo, logo]);

    // Escape closes the form alone.
    await user.click(within(admin()).getByRole("button", { name: "Edit company..." }));
    [...document.querySelectorAll("[data-escape-layer]")].at(-1)!.dispatchEvent(new Event("escape-layer"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit company workspace" })).toBeNull());
    expect(within(admin()).getByRole("heading", { level: 3, name: "Dircks Moving & Logistics" })).toBeDefined();
  });

  it("uploads GoodLeaf's logo without asking for a file, cropped to a thumbnail in an overlay beside it", async () => {
    const drawImage = stubCanvas();
    const picking = vi.spyOn(HTMLInputElement.prototype, "click");
    const { user, row } = openActivations();
    await user.click(within(row("Anika Septimus")).getByRole("button", { name: "GoodLeaf Farms" }));
    const admin = () => within(sheet()).getByRole("heading", { level: 2, name: "Admin settings" }).closest("section")!;
    const company = () => within(admin()).getByRole("heading", { level: 3, name: "GoodLeaf Farms" }).closest<HTMLElement>("[data-card]")!;
    expect(company().querySelector("[data-avatar] img")).toBeNull();
    await user.click(within(admin()).getByRole("button", { name: "Edit company..." }));
    const form = screen.getByRole("dialog", { name: "Edit company workspace" });
    await user.click(within(form).getByRole("button", { name: "Update company logo" }));
    expect(picking).not.toHaveBeenCalled();

    const crop = screen.getByRole("dialog", { name: "Company logo" });
    expect(within(crop).getByText("Company logo")).toBeDefined();
    expect(within(crop).getByRole("button", { name: "Cancel" })).toBeDefined();
    const picture = within(crop).getByRole("img", { name: "Logo position" });
    const img = picture.querySelector("img")!;
    expect(img.getAttribute("src")).toContain("goodleaf-farms");
    Object.defineProperties(img, { naturalWidth: { value: 768 }, naturalHeight: { value: 512 } });
    fireEvent.load(img);
    // Loaded, it just covers the crop, its shorter side the crop's, centred.
    const placed = () => {
      const { width, height, left, top } = img.parentElement!.style;
      return [width, height, left, top];
    };
    await waitFor(() => expect(placed()).toEqual(["150%", "100%", "-25%", "0%"]));

    // From 1, where the picture just covers the crop, to 3, keyed by tenths.
    const zoom = within(crop).getByRole("slider", { name: "Zoom" });
    const value = () => zoom.getAttribute("aria-valuenow");
    expect([zoom.getAttribute("aria-valuemin"), value(), zoom.getAttribute("aria-valuemax")]).toEqual(["1", "1", "3"]);
    fireEvent.keyDown(zoom, { key: "ArrowLeft" });
    expect(value()).toBe("1");
    for (let i = 0; i < 25; i++) fireEvent.keyDown(zoom, { key: "ArrowRight" });
    expect(value()).toBe("3");
    for (let i = 0; i < 10; i++) fireEvent.keyDown(zoom, { key: "ArrowLeft" });
    expect(value()).toBe("2");
    // Dragged, it follows the pointer between tenths.
    const track = zoom.parentElement!;
    vi.spyOn(track, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ x: 0, y: 0, width: 200, height: 4 }));
    fireEvent.pointerDown(track, { pointerId: 2, clientX: 103 });
    expect(Number(value())).toBeCloseTo(2.03);
    fireEvent.pointerMove(track, { pointerId: 2, clientX: 100 });
    fireEvent.pointerUp(track, { pointerId: 2 });
    expect(value()).toBe("2");

    // Dragged a quarter of the crop left and a bit up, it shows more of the picture's right and foot.
    vi.spyOn(picture, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ x: 0, y: 0, width: 200, height: 200 }));
    fireEvent.pointerDown(picture, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(picture, { pointerId: 1, clientX: 50, clientY: 68.75 });
    fireEvent.pointerUp(picture, { pointerId: 1 });
    await saveCrop(user, "Company logo");
    expect(drawImage).toHaveBeenCalledWith(img, 320, 168, 256, 256, 0, 0, 288, 288);
    expect(form.querySelector("[data-avatar] img")?.getAttribute("src")).toBe(CROPPED);

    // Cancelled, the logo stays as it was cropped; Escape closes the crop alone.
    await user.click(within(form).getByRole("button", { name: "Update company logo" }));
    await user.click(within(screen.getByRole("dialog", { name: "Company logo" })).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Company logo" })).toBeNull());
    await user.click(within(form).getByRole("button", { name: "Update company logo" }));
    [...document.querySelectorAll("[data-escape-layer]")].at(-1)!.dispatchEvent(new Event("escape-layer"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Company logo" })).toBeNull());
    expect(screen.getByRole("dialog", { name: "Edit company workspace" })).toBe(form);
    expect(form.querySelector("[data-avatar] img")?.getAttribute("src")).toBe(CROPPED);

    await user.click(within(form).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit company workspace" })).toBeNull());
    expect(company().querySelector("[data-avatar] img")?.getAttribute("src")).toBe(CROPPED);
  });

  it("edits a team in its own form over the company's settings, saving it to the team's card", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Nolan Gouse")).getByRole("button", { name: "Dircks Logistics" }));
    const teams = () => within(sheet()).getByRole("heading", { level: 2, name: "Team settings" }).closest("section")!;
    const card = (name: string) => within(teams()).getByRole("heading", { level: 3, name }).closest<HTMLElement>("[data-card]")!;
    const company = within(sheet()).getByRole("heading", { level: 3, name: "Dircks Logistics" }).closest<HTMLElement>("[data-card]")!;
    const companyLogo = company.querySelector("[data-avatar] img")!.getAttribute("src");
    expect(card("Dircks Logistics Calgary").querySelector("[data-avatar] img")?.getAttribute("src")).toBe(companyLogo);
    await user.click(within(card("Dircks Logistics Calgary")).getByRole("button", { name: "Edit team..." }));
    const form = screen.getByRole("dialog", { name: "Edit team" });
    expect(form.querySelector("[data-avatar] img")?.getAttribute("src")).toBe(companyLogo);
    expect(form.getAttribute("aria-modal")).toBe("true");
    expect(within(form).getByText("Edit team")).toBeDefined();
    expect(within(form).getByLabelText("Team Name")).toHaveProperty("value", "Dircks Logistics Calgary");
    expect(within(form).getByRole("combobox", { name: /^Team Addr\u200Cess$/ })).toHaveProperty("value", "4000 4 Street SE, Calgary, AB");
    expect(within(form).getByLabelText("Default Timezone").textContent).toBe("(GMT-7) Mountain Standard Time (MST)");
    expect(within(form).getByRole("button", { name: "Cancel" })).toBeDefined();

    // Emptied, its name turns Alert and the form stays.
    const name = within(form).getByLabelText("Team Name");
    fireEvent.change(name, { target: { value: "" } });
    await user.click(within(form).getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("dialog", { name: "Edit team" })).toBe(form);
    expect(name.closest("[data-field]")!.getAttribute("data-state")).toBe("alert");

    fireEvent.change(name, { target: { value: "Dircks Logistics Airdrie" } });
    stubCanvas();
    await user.upload(within(form).getByLabelText("Update team logo"), new File(["logo"], "zeus.png", { type: "image/png" }));
    expect(screen.getByRole("dialog", { name: "Team logo" })).toBeDefined();
    await saveCrop(user, "Team logo");
    const logo = form.querySelector("[data-avatar] img")?.getAttribute("src");
    expect(logo).toBe(CROPPED);
    await user.click(within(form).getByLabelText("Default Timezone"));
    await user.click(screen.getByRole("option", { name: "(GMT-6) Central Standard Time (CST)" }));
    await user.click(within(form).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit team" })).toBeNull());
    expect(newest()).toBe(SNACKS.teamUpdated);
    const airdrie = card("Dircks Logistics Airdrie");
    expect(within(airdrie).getByText("Calgary • (GMT-6) Central Standard Time (CST)")).toBeDefined();
    expect(within(airdrie).getByText("5 members")).toBeDefined();
    expect(airdrie.querySelector("[data-avatar] img")?.getAttribute("src")).toBe(logo);
    expect(card("Dircks Logistics Mississauga").querySelector("[data-avatar] img")?.getAttribute("src")).toBe(companyLogo);

    // Escape, which the prototype's overlay passes to the last layer open, closes the form alone.
    await user.click(within(airdrie).getByRole("button", { name: "Edit team..." }));
    expect(sheet().closest("[inert]")).not.toBeNull();
    [...document.querySelectorAll("[data-escape-layer]")].at(-1)!.dispatchEvent(new Event("escape-layer"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit team" })).toBeNull());
    expect(card("Dircks Logistics Airdrie")).toBeDefined();
  });

  it("fills a team's Default Timezone from the address picked, which can still be changed", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Brittany Pilz")).getByRole("button", { name: "North West Company" }));
    await user.click(within(sheet()).getByRole("button", { name: "Add team..." }));
    const form = screen.getByRole("dialog", { name: "New team" });
    const zone = within(form).getByLabelText("Default Timezone");
    expect(zone.textContent).toBe("");
    await user.type(within(form).getByRole("combobox", { name: /^Team Addr‌ess$/ }), "250 First");
    await user.click(await screen.findByRole("option", { name: "250 First Gulf Boulevard, Brampton, ON" }));
    expect(zone.textContent).toBe("(GMT-5) Eastern Standard Time (EST)");
    await user.click(zone);
    await user.click(screen.getByRole("option", { name: "(GMT-4) Atlantic Standard Time (AST)" }));
    expect(zone.textContent).toBe("(GMT-4) Atlantic Standard Time (AST)");
  });

  it("adds a team from New team once it has a name, an address and a timezone", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Brittany Pilz")).getByRole("button", { name: "North West Company" }));
    await user.click(within(sheet()).getByRole("button", { name: "Add team..." }));
    const form = screen.getByRole("dialog", { name: "New team" });
    expect(within(form).getByText("New team")).toBeDefined();
    // It starts with the company's logo, to update.
    const company = within(sheet()).getByRole("heading", { level: 3, name: "North West Company" }).closest<HTMLElement>("[data-card]")!;
    expect(form.querySelector("[data-avatar] img")?.getAttribute("src")).toBe(company.querySelector("[data-avatar] img")!.getAttribute("src"));
    expect(within(form).getByRole("button", { name: "Update team logo" })).toBeDefined();
    const add = within(form).getByRole("button", { name: "Add team" });
    await user.click(add);
    expect(screen.getByRole("dialog", { name: "New team" })).toBe(form);
    const state = (label: string | RegExp) => within(form).getByLabelText(label).closest("[data-field]")!.getAttribute("data-state");
    expect(["Team Name", /^Team Addr\u200Cess$/, "Default Timezone"].map(state)).toEqual(["alert", "alert", "alert"]);

    fireEvent.change(within(form).getByLabelText("Team Name"), { target: { value: "North West Company Brampton" } });
    await user.type(within(form).getByRole("combobox", { name: /^Team Addr\u200Cess$/ }), "250 First");
    await user.click(await screen.findByRole("option", { name: "250 First Gulf Boulevard, Brampton, ON" }));
    await user.click(within(form).getByLabelText("Default Timezone"));
    await user.click(screen.getByRole("option", { name: "(GMT-5) Eastern Standard Time (EST)" }));
    await user.click(add);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "New team" })).toBeNull());
    expect(newest()).toBe(SNACKS.teamAdded);
    const teams = within(sheet()).getByRole("heading", { level: 2, name: "Team settings" }).closest("section")!;
    expect(within(teams).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "North West Company Ottawa",
      "North West Company Brampton",
    ]);
    const brampton = within(teams).getByRole("heading", { level: 3, name: "North West Company Brampton" }).closest<HTMLElement>("[data-card]")!;
    expect(within(brampton).getByText("Brampton • (GMT-5) Eastern Standard Time (EST)")).toBeDefined();
    expect(within(brampton).getByText("1 member")).toBeDefined();
  });

  it("sets a team's mandatory requirements from its sheet over its settings, as Skills & requirements lays them out, on Save changes alone", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Brittany Pilz")).getByRole("button", { name: "North West Company" }));
    const record = () => within(sheet()).getByRole("button", { name: /^Mandatory requirements/ });
    const requirements = () => screen.getByRole("dialog", { name: "Mandatory requirements" });
    const closed = () => expect(screen.queryByRole("dialog", { name: "Mandatory requirements" })).toBeNull();
    const table = () => within(requirements()).getByRole("table", { name: "Mandatory requirements" });
    const tick = (name: string) => user.click(within(table()).getByRole("checkbox", { name }));
    const ticked = () =>
      within(table())
        .getAllByRole("checkbox")
        .filter((box) => box.getAttribute("aria-checked") === "true")
        .map((box) => box.getAttribute("aria-label"));
    expect(record().textContent).toBe("Mandatory requirementsNo requirement set");

    await user.click(record());
    expect(sheet().contains(requirements())).toBe(true);
    expect(within(requirements()).getByText("North West Company Ottawa • No requirement set")).toBeDefined();
    // Its skills left out.
    const kinds = within(requirements()).getByRole("group", { name: "Type" });
    // A small segment's words, past their hidden bold copy.
    expect(within(kinds).getAllByRole("button").map((segment) => segment.firstElementChild?.textContent)).toEqual([
      "All",
      "Equipment",
      "Physical",
      "Certificates",
      "Conditions",
    ]);
    expect(within(table()).getAllByRole("row").slice(1)).toHaveLength(CHOICES.filter(({ kind }) => kind !== "skill").length);
    expect(within(table()).queryByText("Skill")).toBeNull();
    await tick("Closed Toe Shoes");
    await user.click(within(requirements()).getByRole("button", { name: "Cancel" }));
    await waitFor(closed);
    expect(record().textContent).toBe("Mandatory requirementsNo requirement set");

    await user.click(record());
    expect(ticked()).toEqual([]);
    await tick("Closed Toe Shoes");
    await tick("Standing");
    await user.click(within(requirements()).getByRole("button", { name: "Save changes" }));
    await waitFor(closed);
    expect(newest()).toBe(SNACKS.requirementsUpdated);
    expect(record().textContent).toBe("Mandatory requirements2 requirements set");
    await user.click(record());
    expect(within(requirements()).getByText("North West Company Ottawa • 2 requirements set")).toBeDefined();
    expect(ticked()).toEqual(["Closed Toe Shoes", "Standing"]);
  });

  it("opens a team's members from Manage team members, over its settings", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Brittany Pilz")).getByRole("button", { name: "North West Company" }));
    await user.click(within(sheet()).getByRole("button", { name: /^Manage team members/ }));
    const members = () => screen.getByRole("dialog", { name: "Manage team members" });
    expect(sheet().contains(members())).toBe(true);
    expect(within(members()).getByText("Manage team members")).toBeDefined();
    expect(within(members()).getByText("North West Company Ottawa • 3 members")).toBeDefined();
    expect(within(members()).getByRole("searchbox", { name: "Find a user..." })).toBeDefined();
    expect(within(members()).getByRole("button", { name: "Add members..." })).toBeDefined();

    const rows = () => within(within(members()).getByRole("table", { name: "Team members" })).getAllByRole("row");
    const role = (i: number) => within(rows()[i]).getAllByRole("button")[0];
    expect(rows()).toHaveLength(4);
    expect(within(rows()[0]).getByText("Brittany Pilz")).toBeDefined();
    expect(within(rows()[0]).getByText("britpilz@northwest.ca")).toBeDefined();
    expect(rows()[0].querySelector("[data-avatar] img")).not.toBeNull();
    expect(within(rows()[1]).getByText("AG")).toBeDefined();
    expect([0, 1, 2].map((i) => role(i).textContent)).toEqual(["Owner", "Team Admin", "Viewer"]);
    expect(role(0)).toHaveProperty("disabled", true);
    expect(role(1)).toHaveProperty("disabled", false);
    // Invited, its email alone, then its pill and its menu.
    expect(within(rows()[3]).getByText("phil.lubin@northwest.ca")).toBeDefined();
    expect(within(rows()[3]).getByText("Invited")).toBeDefined();
    expect(within(rows()[3]).getByRole("button", { name: "More actions" })).toBeDefined();

    await user.click(role(2));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Team Admin", "Editor", "Viewer"]);
    await user.click(screen.getByRole("option", { name: "Editor" }));
    expect(newest()).toBe(SNACKS.roleChanged("Editor"));
    expect(role(2).textContent).toBe("Editor");

    await user.type(within(members()).getByRole("searchbox", { name: "Find a user..." }), "kad");
    expect(rows()).toHaveLength(1);
    expect(within(rows()[0]).getByText("Kadin Baptista")).toBeDefined();

    // Escape, which the prototype's overlay passes to the last layer open, closes the members alone.
    [...document.querySelectorAll("[data-escape-layer]")].at(-1)!.dispatchEvent(new Event("escape-layer"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Manage team members" })).toBeNull());
    expect(sheet()).toBeDefined();
    await user.click(within(sheet()).getByRole("button", { name: /^Manage team members/ }));
    expect(within(members()).getByRole("button", { name: /Editor/ })).toBeDefined();
    await user.click(within(members()).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Manage team members" })).toBeNull());
  });

  it("keeps the members sheet for another team's Manage team members, and closes it for any other press", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Nolan Gouse")).getByRole("button", { name: "Dircks Logistics" }));
    const records = () => within(sheet()).getAllByRole("button", { name: /^Manage team members/ });
    await user.click(records()[0]);
    const members = screen.getByRole("dialog", { name: "Manage team members" });
    await user.type(within(members).getByRole("searchbox", { name: "Find a user..." }), "nolan");
    await user.click(records()[1]);
    expect(screen.getByRole("dialog", { name: "Manage team members" })).toBe(members);
    expect(within(members).getByText("Dircks Logistics Calgary • 5 members")).toBeDefined();
    expect(within(members).getByRole("searchbox", { name: "Find a user..." })).toHaveProperty("value", "");
    await user.click(within(sheet()).getByText("Company settings"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Manage team members" })).toBeNull());
    expect(sheet()).toBeDefined();
  });

  it("invites members from Add members, a bottom sheet modal over the members sheet alone", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Brittany Pilz")).getByRole("button", { name: "North West Company" }));
    await user.click(within(sheet()).getByRole("button", { name: /^Manage team members/ }));
    const members = () => screen.getByRole("dialog", { name: "Manage team members" });
    await user.click(within(members()).getByRole("button", { name: "Add members..." }));
    const adding = () => screen.getByRole("dialog", { name: "Add members" });
    expect(members().contains(adding())).toBe(true);
    expect(adding().getAttribute("aria-modal")).toBe("true");
    // Its scrim, and the wall, stop at the members sheet: the company's settings round it stay live.
    const scrim = adding().parentElement!;
    expect(scrim.getAttribute("data-scrim")).toBe("light");
    expect(members().contains(scrim)).toBe(true);
    expect(members().querySelector("[role=table]")!.closest("[inert]")).not.toBeNull();
    expect(adding().closest("[inert]")).toBeNull();
    expect(within(sheet()).getAllByRole("button", { name: /^Manage team members/ })[0].closest("[inert]")).toBeNull();

    const emails = () => within(adding()).getAllByRole("textbox", { name: "Email Address" });
    const roles = () => within(adding()).getAllByRole("button", { name: /^Role/ });
    const tone = (i: number) => emails()[i].closest("[data-field]")!.getAttribute("data-state");
    expect(emails()).toHaveLength(3);
    expect(document.activeElement).toBe(emails()[0]);
    expect(roles().map((role) => role.textContent)).toEqual(["Editor", "Editor", "Editor"]);

    // Sent empty, it stays, its first email Alert; then an email on the team already is.
    const send = within(adding()).getByRole("button", { name: "Send invite" });
    await user.click(send);
    expect(adding()).toBeDefined();
    expect([0, 1, 2].map(tone)).toEqual(["alert", null, null]);
    await user.type(emails()[1], "kadin.b@northwest.ca");
    expect([0, 1, 2].map(tone)).toEqual([null, "alert", null]);
    await user.clear(emails()[1]);
    await user.type(emails()[1], "o.ward@northwest.ca");
    expect(tone(1)).toBe("active");
    await user.type(emails()[0], "m.chen@northwest.ca");
    await user.click(roles()[0]);
    await user.click(screen.getByRole("option", { name: "Team Admin" }));
    expect(roles()[0].textContent).toBe("Team Admin");
    await user.click(within(adding()).getByRole("button", { name: "Add another member" }));
    expect(emails()).toHaveLength(4);
    expect(document.activeElement).toBe(emails()[3]);

    await user.click(send);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add members" })).toBeNull());
    expect(newest()).toBe(SNACKS.membersInvited(2));
    const rows = within(within(members()).getByRole("table", { name: "Team members" })).getAllByRole("row");
    expect(rows).toHaveLength(6);
    expect(rows.slice(4).map((r) => [r.firstElementChild!.textContent, within(r).queryByText("Invited")?.textContent])).toEqual([
      ["m.chen@northwest.ca", "Invited"],
      ["o.ward@northwest.ca", "Invited"],
    ]);
    expect(within(members()).getByText("North West Company Ottawa • 3 members")).toBeDefined();
  });

  it("keeps Add members up when its scrim's pressed, closing it alone from Escape or Cancel, back on Add members", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Brittany Pilz")).getByRole("button", { name: "North West Company" }));
    await user.click(within(sheet()).getByRole("button", { name: /^Manage team members/ }));
    const members = () => screen.getByRole("dialog", { name: "Manage team members" });
    const add = within(members()).getByRole("button", { name: "Add members..." });
    const adding = () => screen.getByRole("dialog", { name: "Add members" });
    const email = () => within(adding()).getAllByRole("textbox", { name: "Email Address" })[0];
    await user.click(add);
    await user.type(email(), "m.chen@northwest.ca");
    await user.pointer({ keys: "[MouseLeft]", target: adding().parentElement! });
    expect(adding()).toBeDefined();

    [...document.querySelectorAll("[data-escape-layer]")].at(-1)!.dispatchEvent(new Event("escape-layer"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add members" })).toBeNull());
    expect(members()).toBeDefined();
    expect(members().querySelector("[inert]")).toBeNull();
    expect(document.activeElement).toBe(add);
    expect(within(within(members()).getByRole("table", { name: "Team members" })).getAllByRole("row")).toHaveLength(4);

    await user.click(add);
    expect(email()).toHaveProperty("value", "");
    await user.click(within(adding()).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add members" })).toBeNull());
    expect(members()).toBeDefined();
  });

  it("keeps a snackbar live when a modal opens over the app while it shows, to dismiss", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Brittany Pilz")).getByRole("button", { name: "North West Company" }));
    await user.click(within(sheet()).getByRole("button", { name: /^Manage team members/ }));
    const members = screen.getByRole("dialog", { name: "Manage team members" });
    const rows = within(within(members).getByRole("table", { name: "Team members" })).getAllByRole("row");
    await user.click(within(rows[2]).getAllByRole("button")[0]);
    await user.click(screen.getByRole("option", { name: "Editor" }));
    await user.click(within(sheet()).getByRole("button", { name: "Add team..." }));
    expect(screen.getByRole("dialog", { name: "New team" })).toBeDefined();
    expect(sheet().closest("[inert]")).not.toBeNull();
    const snack = screen.getByRole("status");
    expect(snack.textContent).toBe(SNACKS.roleChanged("Editor"));
    expect(snack.closest("[inert]")).toBeNull();
    await user.click(within(snack).getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(screen.getByRole("dialog", { name: "New team" })).toBeDefined();
  });

  it("opens a team's templates from Manage templates, each to delete, and its presets, each to duplicate into it", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Brittany Pilz")).getByRole("button", { name: "North West Company" }));
    await user.click(within(sheet()).getByRole("button", { name: /^Manage templates/ }));
    const templates = () => screen.getByRole("dialog", { name: "Manage templates" });
    expect(sheet().contains(templates())).toBe(true);
    expect(templates().getAttribute("data-size")).toBe("small");
    expect(within(templates()).getByText("North West Company Ottawa • 2 templates")).toBeDefined();
    const tabs = () => within(templates()).getAllByRole("tab");
    expect(tabs().map((tab) => tab.textContent)).toEqual(["Team's templates", "Template presets"]);
    expect(tabs()[0].getAttribute("aria-selected")).toBe("true");

    const table = () => within(templates()).getByRole("table");
    const rows = () => within(within(table()).getAllByRole("rowgroup").at(-1)!).getAllByRole("row");
    const headers = () => within(table()).getAllByRole("columnheader").map((header) => header.getAttribute("aria-label") ?? header.textContent);
    expect(headers()).toEqual(["", "Template title", "Tags", "Actions"]);
    const cells = () => rows().map((r) => within(r).getAllByRole("cell").map((cell) => cell.textContent));
    const titles = () => cells().map(([, title]) => title);
    const button = (i: number) => within(within(rows()[i]).getAllByRole("cell").at(-1)!).getByRole("button");
    const tags = (i: number) =>
      [...(within(rows()[i]).queryByRole("group", { name: "Tags" })?.children ?? [])].map((chip) => chip.firstChild!.textContent);
    expect(table().compareDocumentPosition(tabs()[1]) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(titles()).toEqual(["Receptionist", "Security Guard"]);
    expect([0, 1].map(tags)).toEqual([["Front Desk"], ["Security", "Licensed"]]);
    // Each to tick by its box, a press on a record itself doing nothing.
    expect(within(templates()).getAllByRole("checkbox").map((box) => box.getAttribute("aria-label"))).toEqual(["Select all", "Receptionist", "Security Guard"]);
    await user.click(within(rows()[0]).getByText("Receptionist"));
    expect(rows()[0].hasAttribute("data-picked")).toBe(false);
    expect(templates().querySelector("[data-action-bar]")).toBeNull();
    expect([0, 1].map((i) => button(i).getAttribute("aria-label"))).toEqual(["Delete", "Delete"]);

    // Each preset duplicates on its own; a name the team has already gets a number, from 2.
    await user.click(tabs()[1]);
    expect(tabs()[1].getAttribute("aria-selected")).toBe("true");
    expect(headers()).toEqual(["", "Template title", "Tags", "Actions"]);
    expect(titles().slice(0, 2)).toEqual(["Warehouse Associate", "Forklift Operator"]);
    expect([0, 1].map(tags)).toEqual([
      ["Warehouse", "Assembly Line"],
      ["Manufacturing", "Warehouse", "+1"],
    ]);
    const picker = titles().indexOf("Picker/Packer");
    expect(button(picker).getAttribute("aria-label")).toBe("Duplicate");
    await user.click(button(picker));
    expect(newest()).toBe(SNACKS.preset.duplicated);
    await user.click(button(picker));
    await user.click(button(titles().indexOf("Receptionist")));
    expect(within(templates()).getByText("North West Company Ottawa • 5 templates")).toBeDefined();
    expect(within(sheet()).getByRole("button", { name: "Manage templates5 templates" })).toBeDefined();

    await user.click(tabs()[0]);
    expect(titles()).toEqual(["Receptionist", "Security Guard", "Picker/Packer", "Picker/Packer 2", "Receptionist 2"]);
    expect(tags(3)).toEqual(["Warehouse", "Packing", "+1"]);
    await user.click(button(1));
    expect(newest()).toBe(SNACKS.template.deleted);
    expect(titles()).toEqual(["Receptionist", "Picker/Packer", "Picker/Packer 2", "Receptionist 2"]);
    expect(within(templates()).getByText("North West Company Ottawa • 4 templates")).toBeDefined();

    // Those ticked, from the action bar, said once for all of them.
    const bar = () => templates().querySelector<HTMLElement>("[data-action-bar]")!;
    await user.click(within(templates()).getByRole("checkbox", { name: "Picker/Packer 2" }));
    await user.click(within(templates()).getByRole("checkbox", { name: "Receptionist 2" }));
    await user.click(within(bar()).getByRole("button", { name: "Delete" }));
    expect(newest()).toBe(SNACKS.templatesDeleted(2));
    expect(SNACKS.templatesDeleted(2)).toBe("2 templates deleted");
    expect(SNACKS.templatesDeleted(1)).toBe(SNACKS.template.deleted);
    expect(titles()).toEqual(["Receptionist", "Picker/Packer"]);
    await user.click(tabs()[1]);
    await user.click(within(templates()).getByRole("checkbox", { name: "Warehouse Associate" }));
    await user.click(within(templates()).getByRole("checkbox", { name: "Forklift Operator" }));
    await user.click(within(bar()).getByRole("button", { name: "Duplicate" }));
    expect(newest()).toBe(SNACKS.presetsDuplicated(2));
    expect(SNACKS.presetsDuplicated(2)).toBe("2 template presets duplicated");
    expect(SNACKS.presetsDuplicated(1)).toBe(SNACKS.preset.duplicated);
    expect(within(templates()).getByText("North West Company Ottawa • 4 templates")).toBeDefined();
  });

  it("shows a team's emptied templates' empty state, its Browse template presets opening that tab", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Brittany Pilz")).getByRole("button", { name: "North West Company" }));
    await user.click(within(sheet()).getByRole("button", { name: /^Manage templates/ }));
    const templates = screen.getByRole("dialog", { name: "Manage templates" });
    for (let left = 2; left > 0; left--) await user.click(within(templates).getAllByRole("button", { name: "Delete" })[0]);
    expect(within(templates).queryByRole("table")).toBeNull();
    const empty = "Templates you add to this team will appear here";
    expect(within(templates).getByText(empty).parentElement!.textContent).toBe(`${empty}Browse template presets`);
    await user.click(within(templates).getByRole("button", { name: "Browse template presets" }));
    expect(within(templates).getByRole("tab", { name: "Template presets" }).getAttribute("aria-selected")).toBe("true");
    expect(within(templates).getByRole("table")).toBeDefined();
  });

  it("keeps the open side sheet for a team's Manage templates, its members' swapped for its templates", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Brittany Pilz")).getByRole("button", { name: "North West Company" }));
    await user.click(within(sheet()).getByRole("button", { name: /^Manage team members/ }));
    const open = screen.getByRole("dialog", { name: "Manage team members" });
    await user.click(within(sheet()).getByRole("button", { name: /^Manage templates/ }));
    expect(screen.getByRole("dialog", { name: "Manage templates" })).toBe(open);
    expect(within(open).queryByRole("table", { name: "Team members" })).toBeNull();
    await user.click(within(sheet()).getByRole("button", { name: /^Manage team members/ }));
    expect(screen.getByRole("dialog", { name: "Manage team members" })).toBe(open);
  });

  it("shows an approved company's contact from Contact info on a hover, each detail with its copy button", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Craig Curtis")).getByRole("button", { name: "Dempster's" }));
    const contact = within(sheet()).getByRole("button", { name: "Contact info" });
    const card = () => within(contact.parentElement!);
    expect(contact.getAttribute("aria-expanded")).toBe("false");
    expect(within(sheet()).queryByText(/craig@clickllc\.com/)).toBeNull();

    await user.hover(contact);
    await waitFor(() => expect(contact.getAttribute("aria-expanded")).toBe("true"));
    expect(card().getByText("Craig Curtis")).toBeDefined();
    expect(card().getByText("Head of Business Operations").className).toContain(glyph.subdued);
    // Each copy button sits on its value's line, under the label.
    const line = (label: string) => within(card().getByText(label).nextElementSibling as HTMLElement);
    expect(line("Phone number").getByText("+1 (504) 896-6913")).toBeDefined();
    expect(line("Phone number").getByRole("button", { name: "Copy phone number" })).toBeDefined();
    expect(line("Email address").getByText("craig@dempsters.ca")).toBeDefined();
    expect(line("Email address").getByRole("button", { name: "Copy email address" })).toBeDefined();
    const copies = card().getAllByRole("button", { name: /^Copy / });
    expect(copies.map((button) => button.getAttribute("aria-label"))).toEqual(["Copy phone number", "Copy email address"]);
    expect(copies.every((button) => button.className.endsWith(` ${iconButtonStyle}`))).toBe(true);

    await user.click(copies[0]);
    expect(await navigator.clipboard.readText()).toBe("+1 (504) 896-6913");
    expect(newest()).toBe(SNACKS.phoneCopied);
    await user.click(copies[1]);
    expect(await navigator.clipboard.readText()).toBe("craig@dempsters.ca");
    expect(newest()).toBe(SNACKS.emailCopied);
    expect(contact.getAttribute("aria-expanded")).toBe("true");

    await user.unhover(contact.parentElement!);
    await waitFor(() => expect(contact.getAttribute("aria-expanded")).toBe("false"));
  });

  it("shows only the contact's email address when they gave no phone number", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Paityn Aminoff")).getByRole("button", { name: "SleepCountry" }));
    const contact = within(sheet()).getByRole("button", { name: "Contact info" });
    await user.hover(contact);
    await waitFor(() => expect(contact.getAttribute("aria-expanded")).toBe("true"));
    const card = within(contact.parentElement!);
    expect(card.getByText("Paityn Aminoff")).toBeDefined();
    expect(card.getByText("HR Staffing Specialist")).toBeDefined();
    expect(card.queryByText("Phone number")).toBeNull();
    expect(within(card.getByText("Email address").nextElementSibling as HTMLElement).getByText("paitynaminoff@sleepcountry.ca")).toBeDefined();
    expect(card.getAllByRole("button", { name: /^Copy / }).map((button) => button.getAttribute("aria-label"))).toEqual([
      "Copy email address",
    ]);
  });

  it("opens Contact info from the keyboard, and keeps it open while its copy buttons take the focus", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Craig Curtis")).getByRole("button", { name: "Dempster's" }));
    const contact = within(sheet()).getByRole("button", { name: "Contact info" });
    contact.focus();
    await waitFor(() => expect(contact.getAttribute("aria-expanded")).toBe("true"));
    await user.tab();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Copy phone number");
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(contact.getAttribute("aria-expanded")).toBe("true");
  });

  it("counts the company's notes as they change", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Craig Curtis")).getByRole("button", { name: "Dempster's" }));
    expect(within(sheet()).getByText("4 notes")).toBeDefined();
    await user.click(within(sheet()).getByRole("button", { name: "Close" }));
    await gone();

    // Rejecting asks for a note, which its settings and its row count.
    await user.click(within(row("Gustavo Donin")).getByRole("button", { name: "SaraLee" }));
    expect(within(sheet()).getByText("1 note")).toBeDefined();
    await user.click(within(sheet()).getByRole("button", { name: "Reject" }));
    await confirmWithNote(user, "Rejecting company sign-up", "Reject sign-up");
    expect(within(sheet()).getByText("2 notes")).toBeDefined();
    expect(within(row("Gustavo Donin")).getByText("2 notes")).toBeDefined();
    await user.click(within(sheet()).getByRole("button", { name: /^Notes & history/ }));
    expect(entries()).toEqual([
      "Rejected" + "Their sites are outside the cities we serve." + "ByMichael M.• Oct 17, 2026, 4:00 PM",
      "Pending review" + "ByGustavo Donin• Oct 16, 2026, 3:15 PM",
    ]);
  });

  it("opens a company's notes and history from its record, newest first, each counted, to add a note from its header", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Craig Curtis")).getByRole("button", { name: "Dempster's" }));
    await user.click(within(sheet()).getByRole("button", { name: /^Notes & history/ }));
    expect(sheet().contains(notes())).toBe(true);
    expect(within(notes()).getByText("Notes & history", { selector: "[data-typography]" })).toBeDefined();
    expect(within(notes()).getByText("Dempster's • 4 notes")).toBeDefined();
    expect(entries()).toEqual([
      "Sent Craig the invitation, no sign-up yet. Will follow up if he hasn't signed up by end of week." + "ByMichael M.• Oct 16, 2026, 10:40 AM",
      "Onboarding" + "ByPriya S.• Oct 15, 2026, 1:06 PM",
      "Called Craig. He needs 6 production line associates for the holiday peak, so approving." + "ByPriya S.• Oct 15, 2026, 1:05 PM",
      "Pending review" + "ByCraig Curtis• Oct 15, 2026, 11:21 AM",
    ]);
    // Each a line apart.
    expect(within(notes()).getByRole("list").querySelectorAll(":scope > hr")).toHaveLength(3);

    // Add note waits beside its close button, the sheet holding no field until it's pressed.
    expect(within(notes()).queryByRole("textbox")).toBeNull();
    expect(within(notes()).getAllByRole("button").slice(0, 2).map((button) => button.textContent || button.getAttribute("aria-label"))).toEqual([
      "Add note...",
      "Close",
    ]);
    await user.click(within(notes()).getByRole("button", { name: "Add note..." }));
    const overlay = () => screen.getByRole("dialog", { name: "Add a note" });
    expect(notes().contains(overlay())).toBe(true);
    // A bottom sheet modal over the notes sheet alone, as Add members is over its members, kept up when its scrim's pressed.
    expect(overlay().getAttribute("aria-modal")).toBe("true");
    expect(overlay().parentElement!.getAttribute("data-scrim")).toBe("light");
    expect(notes().querySelector("[role=list]")!.closest("[inert]")).not.toBeNull();
    expect(within(sheet()).getAllByRole("button", { name: /^Notes & history/ })[0].closest("[inert]")).toBeNull();
    expect(document.activeElement).toBe(within(overlay()).getByRole("textbox", { name: "Note" }));
    await user.pointer({ keys: "[MouseLeft]", target: overlay().parentElement! });
    expect(overlay()).toBeDefined();
    await user.type(within(overlay()).getByRole("textbox", { name: "Note" }), "Craig wants the invitation sent to his warehouse lead too.");
    await user.click(within(overlay()).getByRole("button", { name: "Add note" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add a note" })).toBeNull());
    expect(newest()).toBe(SNACKS.noteAdded);
    expect(entries()).toHaveLength(5);
    expect(entries()[0]).toBe("Craig wants the invitation sent to his warehouse lead too." + "ByMichael M.• Oct 17, 2026, 4:00 PM");
    expect(within(notes()).getByText("Dempster's • 5 notes")).toBeDefined();
    expect(within(row("Craig Curtis")).getByText("5 notes")).toBeDefined();

    // Manage feature flags swaps into the same sheet; its close button then closes it, the company's settings staying.
    await user.click(within(sheet()).getByRole("button", { name: /^Manage feature flags/ }));
    expect(screen.queryByRole("dialog", { name: "Notes & history" })).toBeNull();
    await user.click(within(sheet()).getByRole("button", { name: /^Notes & history/ }));
    await user.click(within(notes()).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Notes & history" })).toBeNull());
    expect(within(sheet()).getByText("5 notes")).toBeDefined();
  });

  it("opens from a press anywhere on its row", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Craig Curtis")).getByText("Head of Business Operations"));
    expect(within(sheet()).getByRole("heading", { level: 3, name: "Dempster's" })).toBeDefined();
    expect(row("Craig Curtis").hasAttribute("data-sheet")).toBe(true);
    await user.click(within(sheet()).getByRole("button", { name: "Close" }));
    await gone();

    await user.click(within(row("Craig Curtis")).getByText("Onboarding"));
    expect(within(sheet()).getByRole("heading", { level: 3, name: "Dempster's" })).toBeDefined();
  });

  it("opens for an onboarded company too", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Nolan Gouse")).getByRole("button", { name: "Dircks Logistics" }));
    expect(within(sheet()).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Dircks Logistics",
      "Dircks Logistics Mississauga",
      "Dircks Logistics Calgary",
    ]);
    expect(status().text).toBe("Active");
    expect(within(sheet()).getByText("Active since 10/16/2026 9:32 AM")).toBeDefined();
    expect(within(sheet()).getByText("3 flags enabled")).toBeDefined();
  });

  it("opens for a pending company, to approve or reject it there", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Gustavo Donin")).getByText("Employment Coordinator"));
    expect(row("Gustavo Donin").hasAttribute("data-sheet")).toBe(true);
    const settings = sheet();
    expect(within(settings).getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Admin settings",
      "Activation",
    ]);
    expect(within(settings).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "SaraLee",
    ]);
    expect(status()).toEqual({ text: "Pending review", tone: "warning", icon: icon(InProgressIcon) });
    expect(within(settings).queryByText(/gusdonin@bandaidos\.com/)).toBeNull();
    expect(within(settings).getByText("1 note")).toBeDefined();
    expect(within(settings).queryAllByRole("group")).toHaveLength(0);
    expect(
      within(settings)
        .getAllByRole("button")
        .map((button) => button.textContent || button.getAttribute("aria-label")),
    ).toEqual([
      "Close",
      "Edit company...",
      "Manage feature flagsNo flag enabled",
      "Contact info",
      "Approve",
      "Reject",
      "Edit prospect information",
      "Notes & history1 note",
    ]);
    const contact = within(settings).getByRole("button", { name: "Contact info" });
    await user.hover(contact);
    await waitFor(() => expect(contact.getAttribute("aria-expanded")).toBe("true"));
    const card = within(contact.parentElement!);
    expect(card.getByText("Gustavo Donin")).toBeDefined();
    expect(card.getByText("Employment Coordinator")).toBeDefined();
    expect(within(card.getByText("Phone number").nextElementSibling as HTMLElement).getByText("+1 (813) 752-5611")).toBeDefined();
    expect(within(card.getByText("Email address").nextElementSibling as HTMLElement).getByText("gusdonin@saralee.com")).toBeDefined();
    await user.unhover(contact.parentElement!);
    await waitFor(() => expect(contact.getAttribute("aria-expanded")).toBe("false"));

    await user.click(within(settings).getByRole("button", { name: "Approve" }));
    expect(newest()).toBe(SNACKS.approved);
    expect(status().text).toBe("Onboarding");
    await user.click(within(sheet()).getByRole("button", { name: "Close" }));
    await gone();

    await user.click(within(row("Maren Dorwart")).getByRole("button", { name: "Warehouse Republic" }));
    await user.click(within(sheet()).getByRole("button", { name: "Reject" }));
    await confirmWithNote(user, "Rejecting company sign-up", "Reject sign-up");
    expect(newest()).toBe(SNACKS.rejected);
    expect(within(sheet()).getByRole("group", { name: "Caution zone" })).toBeDefined();
  });

  it("shows a rejected company as rejected, with a Caution zone to undo it back to pending", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Jocelyn Levin")).getByRole("button", { name: "Villaggio" }));
    const settings = sheet();
    expect(within(settings).getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Admin settings",
      "Activation",
    ]);
    expect(within(settings).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Villaggio",
    ]);
    expect(status()).toEqual({ text: "Rejected", tone: "alert", icon: icon(AbsentIcon) });
    // Rejected, it has no feature flags to manage.
    const admin = within(settings).getByRole("heading", { level: 2, name: "Admin settings" }).closest("section")!;
    expect(within(admin).queryAllByText(/^Manage /)).toHaveLength(0);
    expect(within(settings).queryByText(/flag|preset|template/)).toBeNull();
    const activation = within(settings).getByRole("heading", { level: 2, name: "Activation" }).closest("section")!;
    // When it was rejected, in place of its contact.
    expect(within(activation).getByText("Rejected on 10/16/2026 10:24 AM")).toBeDefined();
    expect(within(activation).queryByText(/Jocelyn Levin|jolevin@bayonetcoffee\.com/)).toBeNull();
    expect(within(activation).getByText("4 notes")).toBeDefined();
    expect(within(settings).queryByRole("group", { name: "Danger zone" })).toBeNull();
    const caution = within(activation).getByRole("group", { name: "Caution zone" });
    expect(
      within(caution).getByText(
        "You can undo this rejection to move this company back to pending for sales to approve or reject again.",
      ),
    ).toBeDefined();
    // Headed by when it's archived, six months after it was rejected.
    expect(within(caution).getByText("This company has been rejected and will be archived on 04/16/2027")).toBeDefined();
    expect(within(caution).queryByText("Undo rejection", { selector: "[data-typography]:not(button)" })).toBeNull();
    expect(
      within(settings)
        .getAllByRole("button")
        .map((button) => button.textContent || button.getAttribute("aria-label")),
    ).toEqual(["Close", "Edit company...", "Notes & history4 notes", "Undo rejection"]);

    await user.click(within(caution).getByRole("button", { name: "Undo rejection" }));
    expect(newest()).toBe(SNACKS.reverted);
    expect(status().text).toBe("Pending review");
    expect(within(row("Jocelyn Levin")).getByText("Pending review")).toBeDefined();
  });

  it("sets up an approved company's teams before sign-up, all but their members, each to delete", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Paityn Aminoff")).getByRole("button", { name: "SleepCountry" }));
    const teams = () => within(sheet()).getByRole("heading", { level: 2, name: "Team settings" }).closest("section")!;
    const head = () => teams().querySelector("h2")!.parentElement!;
    const empty = "Teams you add to this company will appear here";
    // With none yet, its empty state holds Add team, not its heading.
    expect(within(head()).queryByRole("button")).toBeNull();
    expect(within(teams()).getByText(empty).parentElement!.textContent).toBe(`${empty}Add team...`);

    await user.click(within(teams()).getByRole("button", { name: "Add team..." }));
    const form = screen.getByRole("dialog", { name: "New team" });
    expect(form.querySelector("[data-avatar] img")).toBeNull();
    expect(within(form).getByRole("button", { name: "Add team logo" })).toBeDefined();
    fireEvent.change(within(form).getByLabelText("Team Name"), { target: { value: "SleepCountry Brampton" } });
    await user.type(within(form).getByRole("combobox", { name: /^Team Addr‌ess$/ }), "250 First");
    await user.click(await screen.findByRole("option", { name: "250 First Gulf Boulevard, Brampton, ON" }));
    await user.click(within(form).getByRole("button", { name: "Add team" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "New team" })).toBeNull());
    expect(newest()).toBe(SNACKS.teamAdded);
    expect(within(teams()).queryByText(empty)).toBeNull();
    expect(within(head()).getByRole("button", { name: "Add team..." })).toBeDefined();

    // Its members wait for the owner to sign up, and it's deleted, not deactivated.
    const card = within(teams()).getByRole("heading", { level: 3, name: "SleepCountry Brampton" }).closest<HTMLElement>("[data-card]")!;
    expect(within(card).getAllByRole("button").map((button) => button.textContent || button.getAttribute("aria-label"))).toEqual([
      "Edit team...",
      "Manage templates0 templates",
      "Manage worker pool0 workers",
      "Mandatory requirementsNo requirement set",
      "Delete team",
    ]);
    const zone = within(card).getByRole("group", { name: "Danger zone" });
    expect(within(zone).getByText("Once you delete this team, you can't restore its templates, worker pool, check-in codes or other settings.")).toBeDefined();

    await user.click(within(zone).getByRole("button", { name: "Delete team" }));
    const dialog = screen.getByRole("dialog", { name: "Deleting team" });
    expect(
      within(dialog).getByText(
        "The team's templates, worker pool, check-in codes and other settings will be deleted. You can't undo this. Are you sure you want to delete this team?",
      ),
    ).toBeDefined();
    expect(within(dialog).queryByRole("textbox")).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Delete team" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Deleting team" })).toBeNull());
    expect(newest()).toBe(SNACKS.teamDeleted);
    expect(within(teams()).queryAllByRole("heading", { level: 3 })).toHaveLength(0);
    expect(within(teams()).getByText(empty)).toBeDefined();
    expect(within(head()).queryByRole("button")).toBeNull();
  });

  it("shows the team sales set up for an approved company, its logo, templates and workers in place", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Craig Curtis")).getByRole("button", { name: "Dempster's" }));
    const company = within(sheet()).getByRole("heading", { level: 3, name: "Dempster's" }).closest<HTMLElement>("[data-card]")!;
    expect(company.querySelector("[data-avatar] img")).not.toBeNull();
    const card = within(sheet()).getByRole("heading", { level: 3, name: "Dempster's Hamilton" }).closest<HTMLElement>("[data-card]")!;
    expect(within(card).getByText("Hamilton • (GMT-5) Eastern Standard Time (EST)")).toBeDefined();
    expect(within(card).getByRole("button", { name: /^Manage templates/ }).textContent).toBe("Manage templates3 templates");
    expect(within(card).getByRole("button", { name: /^Manage worker pool/ }).textContent).toMatch(/^Manage worker pool\d+ workers$/);
  });

  it("shows a prospect approved there with no teams yet", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Gustavo Donin")).getByRole("button", { name: "SaraLee" }));
    await user.click(within(sheet()).getByRole("button", { name: "Approve" }));
    expect(within(sheet()).getByText("USA • 250+ employees")).toBeDefined();
    expect(within(sheet()).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "SaraLee",
    ]);
    expect(status().text).toBe("Onboarding");
    expect(within(row("Gustavo Donin")).getByText("Onboarding")).toBeDefined();
  });

  it("closes from its close button, its scrim and Escape", async () => {
    const { user, row } = openActivations();
    const open = () => user.click(within(row("Paityn Aminoff")).getByRole("button", { name: "SleepCountry" }));

    await open();
    await user.click(within(sheet()).getByRole("button", { name: "Close" }));
    await gone();
    expect(row("Paityn Aminoff").hasAttribute("data-sheet")).toBe(false);

    await open();
    fireEvent.pointerDown(document.querySelector("[data-scrim=light]")!);
    await gone();

    await open();
    sheet().dispatchEvent(new Event("escape-layer"));
    await gone();
  });

  it("keeps a switch's setting once it's closed, and says so", async () => {
    const { user, row } = openActivations();
    const open = () => user.click(within(row("Brittany Pilz")).getByRole("button", { name: "North West Company" }));
    await open();
    await user.click(within(sheet()).getByRole("switch", { name: "Enable check-in codes" }));
    expect(newest()).toBe(SNACKS.checkInCodes(true));
    await user.click(within(sheet()).getByRole("button", { name: "Close" }));
    await gone();

    await open();
    expect(within(sheet()).getByRole("switch", { name: "Enable check-in codes" }).getAttribute("aria-checked")).toBe("true");
  });
});

describe("a company's feature flags", () => {
  const sheet = () => screen.getByRole("dialog", { name: "Company settings" });
  const flags = () => screen.getByRole("dialog", { name: "Manage feature flags" });
  const record = () => within(sheet()).getByRole("button", { name: /^Manage feature flags/ });
  const flag = (name: string) => within(flags()).getByRole("switch", { name });
  const LABELS = ["Beta dashboard", "Worksite geofencing", "Check-in codes"];
  const checked = () => LABELS.map((label) => flag(label).getAttribute("aria-checked"));

  it("lists every feature with its switch, each turning on or off at once", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Craig Curtis")).getByRole("button", { name: "Dempster's" }));
    expect(record().textContent).toBe("Manage feature flags1 flag enabled");
    await user.click(record());
    expect(within(flags()).getByText("Dempster's • 1 flag enabled")).toBeDefined();
    expect(within(flags()).getAllByText(/^(Beta dashboard|Worksite geofencing|Check-in codes)$/).map((label) => label.textContent)).toEqual(
      LABELS,
    );
    for (const { description } of Object.values(FEATURE_FLAGS)) expect(within(flags()).getByText(description)).toBeDefined();
    expect(checked()).toEqual(["true", "false", "false"]);

    await user.click(flag("Worksite geofencing"));
    expect(newest()).toBe(SNACKS.featureFlag("Worksite geofencing", true));
    expect(checked()).toEqual(["true", "true", "false"]);
    expect(within(flags()).getByText("Dempster's • 2 flags enabled")).toBeDefined();
    expect(record().textContent).toBe("Manage feature flags2 flags enabled");

    await user.click(flag("Beta dashboard"));
    expect(newest()).toBe(SNACKS.featureFlag("Beta dashboard", false));
    expect(checked()).toEqual(["false", "true", "false"]);
  });

  it("takes its teams' check-in code switches away while check-in codes are off, each team keeping its own", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Nolan Gouse")).getByRole("button", { name: "Dircks Logistics" }));
    const codes = () => within(sheet()).queryAllByRole("switch", { name: "Enable check-in codes" }).map((s) => s.getAttribute("aria-checked"));
    expect(codes()).toEqual(["true", "true"]);
    await user.click(record());

    await user.click(flag("Check-in codes"));
    expect(newest()).toBe(SNACKS.featureFlag("Check-in codes", false));
    expect(codes()).toEqual([]);
    expect(within(sheet()).getAllByRole("button", { name: /^Manage team members/ })).toHaveLength(2);

    await user.click(flag("Check-in codes"));
    expect(codes()).toEqual(["true", "true"]);
  });
});

describe("a team's worker pool", () => {
  const sheet = () => screen.getByRole("dialog", { name: "Company settings" });
  // The company app's team, First Gulf.
  const gulf = () => within(sheet()).getByRole("heading", { level: 3, name: "CCLS First Gulf" }).closest<HTMLElement>("[data-card]")!;
  const pool = () => screen.getByRole("dialog", { name: "Manage worker pool" });
  const tabs = () => within(pool()).getAllByRole("tab");
  const table = () => within(pool()).queryByRole("table");
  // The body's rows, none while there's only the head.
  const rows = () =>
    within(table()!)
      .getAllByRole("rowgroup")
      .slice(1)
      .flatMap((body) => within(body).getAllByRole("row"));
  const names = () => rows().map((r) => within(r).getAllByRole("cell")[1].textContent);
  const button = (i: number) => within(within(rows()[i]).getAllByRole("cell").at(-1)!).getByRole("button");
  const skillsOf = (name: string) => ROSTER.find((worker) => worker.name === name)!.skills;
  const count = () => within(pool()).queryByText(/^(\d+ workers?|No workers)$/)?.textContent;
  const headers = () => within(table()!).getAllByRole("columnheader").map((header) => header.getAttribute("aria-label") ?? header.textContent);
  const paints = (element: Element) => [
    ...new Set([...element.querySelectorAll(":scope > svg [fill]")].map((part) => part.getAttribute("fill")).filter((paint) => paint !== "none")),
  ];

  async function openPool() {
    const { user, row } = openActivations();
    await user.click(within(row("Jesse Pereira")).getByRole("button", { name: "CCLS" }));
    await user.click(within(gulf()).getByRole("button", { name: /^Manage worker pool/ }));
    return user;
  }

  it("opens a team's pool from Manage worker pool, between its templates and requirements, each worker to remove", async () => {
    const { user, row } = openActivations();
    await user.click(within(row("Jesse Pereira")).getByRole("button", { name: "CCLS" }));
    const records = within(gulf())
      .getAllByRole("button", { name: /^(Manage team members|Manage templates|Manage worker pool|Mandatory requirements)/ })
      .map((record) => /^(Manage team members|Manage templates|Manage worker pool|Mandatory requirements)/.exec(record.textContent!)![1]);
    expect(records).toEqual(["Manage team members", "Manage templates", "Manage worker pool", "Mandatory requirements"]);
    await user.click(within(gulf()).getByRole("button", { name: "Manage worker pool6 workers" }));
    expect(sheet().contains(pool())).toBe(true);
    expect(pool().getAttribute("data-size")).toBe("small");
    expect(within(pool()).getByText("CCLS First Gulf • 6 workers")).toBeDefined();
    expect(tabs().map((tab) => tab.textContent)).toEqual(["Team's worker pool", "Find workers"]);
    expect(tabs()[0].getAttribute("aria-selected")).toBe("true");

    expect(headers()).toEqual(["", "Worker", "Skills", "Actions"]);
    expect(names()).toEqual(["Tashonda Williams", "Rayna Rhiel Madsen", "Angel Saris", "Aspen Curtis", "Alejandro Vasquez", "Maria Franci"]);
    // Each worker's picture beside their name, and their skills where a template's tags would be.
    expect(rows().every((r) => within(r).getAllByRole("cell")[1].querySelector("img"))).toBe(true);
    const skills = within(rows().at(-1)!).getByRole("group", { name: "Skills" });
    expect([...skills.children].map((chip) => chip.firstChild!.textContent)).toEqual(["Packer", "Forklift", "+1"]);
    expect(rows().map((_, i) => button(i).getAttribute("aria-label"))).toEqual(Array(6).fill("Remove from pool"));
    expect(paints(button(0))).toEqual(["currentColor"]);

    await user.click(button(1));
    expect(newest()).toBe(SNACKS.workerRemoved);
    expect(names()).toEqual(["Tashonda Williams", "Angel Saris", "Aspen Curtis", "Alejandro Vasquez", "Maria Franci"]);
    expect(within(pool()).getByText("CCLS First Gulf • 5 workers")).toBeDefined();
    expect(within(sheet()).getByRole("button", { name: "Manage worker pool5 workers" })).toBeDefined();
  });

  it("sizes the Skills column apart from the skills listed, so it holds still as the list narrows", async () => {
    await openPool();
    const tracks = table()!.style.gridTemplateColumns.split(/\s+(?![^(]*\))/);
    expect(tracks[headers().indexOf("Skills")]).not.toMatch(/auto|content/);
  });

  it("finds the pool's workers by name from the Worker column's head, and removes those ticked from the sheet's action bar", async () => {
    const user = await openPool();
    const bar = () => pool().querySelector<HTMLElement>("[data-action-bar]");
    const find = () => within(within(pool()).getByRole("columnheader", { name: "Worker" })).getByRole("searchbox", { name: "Find a worker..." });
    expect(bar()).toBeNull();
    await user.type(find(), "as");
    expect(names()).toEqual(["Tashonda Williams", "Aspen Curtis", "Alejandro Vasquez"]);
    await user.click(within(table()!).getByRole("checkbox", { name: "Select all" }));
    expect(within(bar()!).getAllByRole("button").map((each) => each.textContent)).toEqual(["Cancel", "Remove from pool"]);
    await user.click(within(pool()).getByRole("checkbox", { name: "Aspen Curtis" }));
    expect(rows().map((r) => r.hasAttribute("data-picked"))).toEqual([true, false, true]);
    await user.click(within(bar()!).getByRole("button", { name: "Remove from pool" }));
    expect(newest()).toBe(SNACKS.workersRemoved(2));
    expect(SNACKS.workersRemoved(2)).toBe("2 workers removed from pool");
    expect(names()).toEqual(["Aspen Curtis"]);
    expect(within(pool()).getByText("CCLS First Gulf • 4 workers")).toBeDefined();
    await waitFor(() => expect(bar()).toBeNull());
    await user.clear(find());
    expect(names()).toEqual(["Rayna Rhiel Madsen", "Angel Saris", "Aspen Curtis", "Maria Franci"]);
  });

  it("filters the pool's workers by their own skills, the most matched first, counted in the template names' style", async () => {
    const user = await openPool();
    expect(count()).toBe("6 workers");
    expect(within(pool()).getByText("6 workers").getAttribute("data-typography")).toBe("body");
    const skills = () => within(pool()).getByRole("button", { name: /^Skills/ });
    const listbox = () => screen.getByRole("listbox", { name: "Skills" });
    const pick = async (...picked: string[]) => {
      await user.click(skills());
      for (const skill of picked) await user.click(within(listbox()).getByRole("option", { name: skill }));
      await user.click(skills());
    };
    await user.click(skills());
    expect(within(listbox()).getAllByRole("option").map((option) => option.textContent)).toEqual([...new Set(names().flatMap(skillsOf))].sort());
    await user.click(skills());
    await pick("Packer");
    expect(names()).toEqual(["Angel Saris", "Aspen Curtis", "Maria Franci"]);
    expect(count()).toBe("3 workers");
    await pick("Forklift");
    expect(names()).toEqual(["Angel Saris", "Maria Franci", "Aspen Curtis"]);

    // Narrowed by name too, and nothing left counted.
    const find = within(within(pool()).getByRole("columnheader", { name: "Worker" })).getByRole("searchbox", { name: "Find a worker..." });
    await user.type(find, "Tashonda");
    expect(names()).toEqual([]);
    expect(count()).toBe("No workers");
  });

  it("counts the workers found in the template names' style, narrowed from the Worker column's head, and adds those ticked", async () => {
    const user = await openPool();
    await user.click(tabs()[1]);
    await user.click(within(pool()).getByRole("button", { name: "Find by name or number" }));
    await user.type(within(pool()).getByRole("combobox", { name: "Find a Worker" }), "555-01");
    const shown = names().length;
    expect(count()).toBe(`${shown} workers`);
    expect(within(pool()).getByText(count()!).getAttribute("data-typography")).toBe("body");

    const find = within(within(pool()).getByRole("columnheader", { name: "Worker" })).getByRole("searchbox", { name: "Find a worker..." });
    await user.type(find, "disha");
    expect(names()).toEqual(["Disha Patil"]);
    expect(count()).toBe("1 worker");
    await user.click(within(pool()).getByRole("checkbox", { name: "Disha Patil" }));
    await user.clear(find);
    expect(count()).toBe(`${shown} workers`);
    await user.click(within(pool()).getByRole("checkbox", { name: "Priya Raghunathan" }));
    const bar = pool().querySelector<HTMLElement>("[data-action-bar]")!;
    expect(within(bar).getAllByRole("button").map((each) => each.textContent)).toEqual(["Cancel", "Add to pool"]);
    await user.click(within(bar).getByRole("button", { name: "Add to pool" }));
    expect(newest()).toBe(SNACKS.workersAdded(2));
    expect(SNACKS.workersAdded(2)).toBe("2 workers added to pool");
    expect(SNACKS.workersAdded(1)).toBe(SNACKS.workerAdded);
    expect(names()).not.toContain("Disha Patil");
    expect(within(pool()).getByText("CCLS First Gulf • 8 workers")).toBeDefined();
    await user.click(tabs()[0]);
    expect(names().slice(-2).sort()).toEqual(["Disha Patil", "Priya Raghunathan"]);
  });

  it("shows an emptied pool's empty state, its Find workers opening that tab", async () => {
    const user = await openPool();
    for (let left = 6; left > 0; left--) await user.click(button(0));
    expect(table()).toBeNull();
    const empty = "Workers you add to this team's worker pool will appear here";
    expect(within(pool()).getByText(empty).parentElement!.textContent).toBe(`${empty}Find workers`);
    await user.click(within(pool()).getByRole("button", { name: "Find workers" }));
    expect(tabs()[1].getAttribute("aria-selected")).toBe("true");
    expect(within(pool()).getByRole("combobox", { name: /^Find Workers by Addr/ })).toBeDefined();
  });

  it("finds workers by name or number as it's typed, those in the pool left out, each to add to it", async () => {
    const user = await openPool();
    await user.click(tabs()[1]);
    await user.click(within(pool()).getByRole("button", { name: "Find by name or number" }));
    expect(within(pool()).getByRole("button", { name: "Find by name or number" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(pool()).getByRole("button", { name: "Find by location" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(pool()).queryByRole("combobox", { name: /^Find Workers by Addr/ })).toBeNull();
    const find = within(pool()).getByRole("combobox", { name: "Find a Worker" });
    expect(find.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.getElementById(find.getAttribute("aria-describedby")!)!.textContent).toBe(
      "Look workers up by their name or phone number",
    );
    // Nothing until something's typed, and no skills to filter by.
    expect(table()).toBeNull();
    expect(count()).toBeUndefined();
    expect(within(pool()).queryByRole("button", { name: /^Skills/ })).toBeNull();

    await user.type(find, "Brittany");
    expect(names()).toEqual(["Brittany Pilz"]);
    expect(count()).toBe("1 worker");
    // Their name opens their profile card, as a check-in card's does.
    fireEvent.focus(within(rows()[0]).getByRole("button", { name: "Brittany Pilz" }));
    expect(await screen.findByText("+1 (647) 555-0121")).toBeDefined();
    expect(headers()).toEqual(["", "Worker", "Skills", "Actions"]);
    expect(button(0).getAttribute("aria-label")).toBe("Add to pool");
    // In the button's colour, as every icon button's icon is.
    expect(paints(button(0))).toEqual(["currentColor"]);
    // Anyone on the roster, not only those in the check-ins.
    await user.clear(find);
    await user.type(find, "416 555 0101");
    expect(names()).toEqual(["Priya Raghunathan"]);
    expect(within(rows()[0]).getAllByRole("cell")[1].querySelector("[data-avatar] img")).not.toBeNull();
    // Every number holds 555-01, so it finds everyone outside the pool.
    await user.clear(find);
    await user.type(find, "555-01");
    expect(names()).toHaveLength(ROSTER.length - 6);
    expect(count()).toBe(`${ROSTER.length - 6} workers`);
    await user.clear(find);
    await user.type(find, "Nobody");
    expect(table()).toBeNull();
    expect(count()).toBe("No workers");
    await user.clear(find);
    await user.type(find, "555-01");

    await user.click(button(names().indexOf("Disha Patil")));
    expect(newest()).toBe(SNACKS.workerAdded);
    expect(names()).not.toContain("Disha Patil");
    expect(within(pool()).getByText("CCLS First Gulf • 7 workers")).toBeDefined();
    await user.click(tabs()[0]);
    expect(names().at(-1)).toBe("Disha Patil");
  });

  it("finds 30 to 40 workers of many skills round the address once searched, counted, then those with any skill picked, each to add", async () => {
    const user = await openPool();
    await user.click(tabs()[1]);
    // By location first, and to start.
    const modes = within(pool()).getAllByRole("button", { name: /^Find by/ });
    expect(modes.map((mode) => [mode.textContent, mode.getAttribute("aria-pressed")])).toEqual([
      ["Find by location", "true"],
      ["Find by name or number", "false"],
    ]);
    expect(within(pool()).queryByRole("combobox", { name: "Find a Worker" })).toBeNull();
    // The team's own address to start, five kilometres round it, its slider from 5 to 30.
    const address = within(pool()).getByRole("combobox", { name: /^Find Workers by Addr/ });
    expect(address).toHaveProperty("value", "250 First Gulf Boulevard, Brampton, ON");
    const range = within(pool()).getByRole<HTMLInputElement>("textbox", { name: "Range" });
    const slider = within(pool()).getByRole("slider", { name: "Range" });
    expect(range).toHaveProperty("value", "5");
    expect(["aria-valuemin", "aria-valuenow", "aria-valuemax"].map((name) => slider.getAttribute(name))).toEqual(["5", "5", "30"]);
    // Skills filter what it finds, not the search.
    expect(within(pool()).queryByRole("combobox", { name: "Skills" })).toBeNull();
    expect(within(pool()).queryByRole("button", { name: /^Skills/ })).toBeNull();
    // A minimap beside the address and the range, which a press widens across them.
    const form = () => pool().querySelector<HTMLElement>("[data-location]")!;
    expect(form().hasAttribute("data-expanded")).toBe(false);
    expect(form().querySelector("[data-map]")!.getAttribute("data-size")).toBeNull();
    expect(form().querySelector("[data-pin][data-draggable]")).toBeNull();
    expect(table()).toBeNull();
    expect(count()).toBeUndefined();

    const search = within(pool()).getByRole("button", { name: "Search" });
    await user.click(search);
    const everyone = names();
    expect(everyone.length).toBeGreaterThanOrEqual(30);
    expect(everyone.length).toBeLessThanOrEqual(40);
    expect(count()).toBe(`${everyone.length} workers`);
    expect(new Set(everyone.flatMap(skillsOf)).size).toBeGreaterThanOrEqual(12);
    const inPool = ["Tashonda Williams", "Rayna Rhiel Madsen", "Angel Saris", "Aspen Curtis", "Alejandro Vasquez", "Maria Franci"];
    expect(everyone.filter((name) => inPool.includes(name))).toEqual([]);
    expect(button(0).getAttribute("aria-label")).toBe("Add to pool");

    // Its skills filter offers only the skills of those it found, and narrows them as each is picked, the most matched
    // first, counted again.
    const skills = () => within(pool()).getByRole("button", { name: /^Skills/ });
    const listbox = () => screen.getByRole("listbox", { name: "Skills" });
    const pick = async (...picked: string[]) => {
      await user.click(skills());
      for (const skill of picked) await user.click(within(listbox()).getByRole("option", { name: skill }));
      await user.click(skills());
    };
    await user.click(skills());
    expect(within(listbox()).getAllByRole("option").map((option) => option.textContent)).toEqual([...new Set(everyone.flatMap(skillsOf))].sort());
    await user.click(within(listbox()).getByRole("option", { name: "Packer" }));
    expect(names().every((name) => skillsOf(name).includes("Packer"))).toBe(true);
    expect(count()).toBe(`${names().length} workers`);
    await user.click(skills());
    await pick("Forklift", "Warehouse");
    const matched = (name: string, picked: string[]) => picked.filter((skill) => skillsOf(name).includes(skill)).length;
    const packers = names();
    const counts = packers.map((name) => matched(name, ["Packer", "Forklift", "Warehouse"]));
    expect(packers.length).toBeLessThan(everyone.length);
    expect(packers.every((name) => everyone.includes(name))).toBe(true);
    expect(counts.every((count) => count > 0)).toBe(true);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(count()).toBe(`${packers.length} workers`);

    // Added, a worker leaves the list, no one taking their place.
    await user.click(button(0));
    expect(newest()).toBe(SNACKS.workerAdded);
    expect(names()).toEqual(packers.slice(1));
    expect(count()).toBe(`${packers.length - 1} workers`);
    expect(within(pool()).getByText("CCLS First Gulf • 7 workers")).toBeDefined();

    await pick("Packer");
    const forklifts = names();
    expect(forklifts.length).toBeGreaterThan(0);
    expect(forklifts.every((name) => matched(name, ["Forklift", "Warehouse"]) > 0)).toBe(true);
    expect(forklifts).not.toContain(packers[0]);

    // The slider sets the range in fives, up to 30; a range typed takes the nearest of them.
    const now = () => slider.getAttribute("aria-valuenow");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect([range.value, now()]).toEqual(["10", "10"]);
    for (let i = 0; i < 5; i++) fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect([range.value, now()]).toEqual(["30", "30"]);
    await user.clear(range);
    await user.type(range, "12");
    expect([range.value, now()]).toEqual(["12", "10"]);
    // Searched again, the pool as it is now: someone else fills the place of the worker added.
    await user.click(search);
    expect(range.value).toBe("10");
    const searchedAgain = names();
    expect(searchedAgain).toEqual(expect.arrayContaining(forklifts));
    expect(count()).toBe(`${searchedAgain.length} workers`);

    // Widened, its pin drags, and where it's let go becomes the address; Search makes it mini again.
    await user.click(within(pool()).getByRole("button", { name: EXPAND_MAP }));
    expect(form().hasAttribute("data-expanded")).toBe(true);
    expect(form().querySelector("[data-map]")!.getAttribute("data-size")).toBe("wide");
    const pin = form().querySelector("[data-pin][data-draggable]")!;
    fireEvent.pointerDown(pin, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(pin, { pointerId: 1, clientX: 130, clientY: 90 });
    fireEvent.pointerUp(pin, { pointerId: 1 });
    await waitFor(() => expect((address as HTMLInputElement).value).toMatch(/^43\.\d{5}, -79\.\d{5}$/));
    await user.click(search);
    expect(form().hasAttribute("data-expanded")).toBe(false);
    expect(within(pool()).getByRole("button", { name: EXPAND_MAP })).toBeDefined();
    // Round the pin's new spot, others.
    const dragged = names();
    expect(dragged).not.toEqual(searchedAgain);

    // Without an address, it searches for nothing, and says so; a range left empty keeps the last.
    const tone = (field: HTMLElement) => field.closest("[data-field]")!.getAttribute("data-state");
    await user.clear(address);
    await user.clear(range);
    await user.click(search);
    expect(tone(address)).toBe("alert");
    expect(tone(range)).not.toBe("alert");
    expect(range.value).toBe("10");
    expect(names()).toEqual(dragged);
    // Back round the team's address, the same workers again.
    await user.type(address, "First Gulf");
    await user.click(await screen.findByRole("option", { name: "250 First Gulf Boulevard, Brampton, ON" }));
    await user.click(search);
    expect(names()).toEqual(searchedAgain);
  });
});
