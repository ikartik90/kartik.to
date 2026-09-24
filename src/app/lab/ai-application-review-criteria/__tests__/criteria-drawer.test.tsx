// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CRITERIA } from "../harness-data";
import { Landing } from "../landing";

// jsdom implements neither. The stubs mirror the platform: `close()` fires the
// `close` event, and `showModal()` throws on an already-open dialog.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    if (this.open) throw new DOMException("Already open", "InvalidStateError");
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    if (!this.open) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const TITLE = "AI-assisted application review criteria";
const STARTING = CRITERIA.filter((c) => c.id !== "new-logo");

function drawer() {
  return document.querySelector("dialog") as HTMLDialogElement;
}

async function openDrawer(user = userEvent.setup()) {
  render(<Landing />);
  await user.click(screen.getByRole("button", { name: "Edit" }));
  return user;
}

describe("criteria drawer", () => {
  it("is closed until Edit is pressed", () => {
    render(<Landing />);
    expect(drawer().open).toBe(false);
  });

  it("opens from Edit, named for what it edits", async () => {
    await openDrawer();
    expect(drawer().open).toBe(true);
    expect(screen.getByRole("dialog", { name: TITLE })).toBe(drawer());
  });

  it("puts each running criterion up for editing, title and prompt", async () => {
    await openDrawer();
    const dialog = within(drawer());
    const titles = dialog.getAllByLabelText(
      "Short title",
    ) as HTMLInputElement[];
    const prompts = dialog.getAllByLabelText("Prompt") as HTMLTextAreaElement[];

    expect(titles.map((input) => input.value)).toEqual(
      STARTING.map((c) => c.title),
    );
    expect(prompts.map((input) => input.value)).toEqual(
      STARTING.map((c) => c.prompt),
    );
  });

  it.each([
    [
      "the close tab",
      () =>
        fireEvent.click(
          within(drawer()).getByRole("button", { name: "Close" }),
        ),
    ],
    [
      "Cancel",
      () =>
        fireEvent.click(
          within(drawer()).getByRole("button", { name: "Cancel" }),
        ),
    ],
    ["Escape", () => fireEvent.keyDown(drawer(), { key: "Escape" })],
  ])("closes from %s", async (_, close) => {
    await openDrawer();
    close();
    expect(drawer().open).toBe(false);
  });

  it("closes when the page beside it is clicked, but not when the drawer is", async () => {
    await openDrawer();
    fireEvent.click(within(drawer()).getAllByLabelText("Prompt")[0]);
    expect(drawer().open).toBe(true);

    // A click on the backdrop lands on the <dialog> itself.
    fireEvent.pointerDown(drawer());
    fireEvent.click(drawer());
    expect(drawer().open).toBe(false);
  });

  it("stays open when a press that began inside it is released over the page", async () => {
    await openDrawer();
    // Dragging a selection out of a prompt: the click the browser reports goes
    // to the nearest common ancestor, which is the <dialog>.
    fireEvent.pointerDown(within(drawer()).getAllByLabelText("Prompt")[0]);
    fireEvent.click(drawer());
    expect(drawer().open).toBe(true);
  });

  it("throws away what was typed when it is cancelled", async () => {
    const user = await openDrawer();
    const [first] = within(drawer()).getAllByLabelText(
      "Short title",
    ) as HTMLInputElement[];
    await user.clear(first);
    await user.type(first, "Something else");
    await user.click(within(drawer()).getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const [reopened] = within(drawer()).getAllByLabelText(
      "Short title",
    ) as HTMLInputElement[];
    expect(reopened.value).toBe(STARTING[0].title);
  });

  it("does not offer Save", async () => {
    await openDrawer();
    const dialog = within(drawer());
    expect(
      (dialog.getByRole("button", { name: "Save" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});

const NEW_LOGO = CRITERIA.find((c) => c.id === "new-logo")!;

function titles() {
  return within(drawer()).getAllByLabelText(
    "Short title",
  ) as HTMLInputElement[];
}

function prompts() {
  return within(drawer()).getAllByLabelText("Prompt") as HTMLTextAreaElement[];
}

function menu() {
  return within(drawer()).queryByRole("menu", { name: "Add criteria" });
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    within(drawer()).getByRole("button", { name: "Add criteria" }),
  );
}

/**
 * Opens the drawer and adds the custom criterion, with the clock stopped from
 * the moment it is added. Everything after runs on `fireEvent`: Testing
 * Library's async wrapper waits on a `setTimeout(0)` it only advances for
 * Jest's fake timers, so `userEvent` never returns under Vitest's.
 */
async function addCustom() {
  const user = await openDrawer();
  await openMenu(user);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  fireEvent.click(
    within(drawer()).getByRole("menuitem", { name: "Add custom" }),
  );
}

function click(element: HTMLElement) {
  fireEvent.click(element);
}

async function finishTyping() {
  await act(async () => {
    vi.runAllTimers();
  });
}

describe("add criteria menu", () => {
  it("opens from Add criteria with the three ways to add one", async () => {
    const user = await openDrawer();
    const trigger = within(drawer()).getByRole("button", {
      name: "Add criteria",
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await openMenu(user);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(
      within(menu()!)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Add from 8 suggestions", "Add previously used", "Add custom"]);
  });

  it("closes on Escape without closing the drawer", async () => {
    const user = await openDrawer();
    await openMenu(user);
    fireEvent.keyDown(within(menu()!).getAllByRole("menuitem")[0], {
      key: "Escape",
    });
    expect(menu()).toBeNull();
    expect(drawer().open).toBe(true);
  });

  it("closes on a press anywhere else", async () => {
    const user = await openDrawer();
    await openMenu(user);
    fireEvent.pointerDown(
      within(drawer()).getByRole("heading", { name: TITLE }),
    );
    expect(menu()).toBeNull();
  });

  it("moves between its items with the arrow keys", async () => {
    const user = await openDrawer();
    await openMenu(user);
    const items = within(menu()!).getAllByRole("menuitem");
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(document.activeElement).toBe(items[2]);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(items[0]);
  });
});

describe("adding a custom criterion", () => {
  it("adds it at the top of the resume criteria, and closes the menu", async () => {
    await addCustom();
    expect(menu()).toBeNull();
    expect(titles()).toHaveLength(4);
    expect(
      titles()
        .slice(1)
        .map((input) => input.value),
    ).toEqual(STARTING.map((c) => c.title));
  });

  it("types its title in, then its prompt", async () => {
    await addCustom();
    expect(document.activeElement).toBe(titles()[0]);

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    const partway = titles()[0].value;
    expect(partway.length).toBeGreaterThan(0);
    expect(
      NEW_LOGO.title.startsWith(partway) && partway !== NEW_LOGO.title,
    ).toBe(true);
    expect(prompts()[0].value).toBe("");

    await finishTyping();
    expect(titles()[0].value).toBe(NEW_LOGO.title);
    expect(prompts()[0].value).toBe(NEW_LOGO.prompt);
    expect(document.activeElement).toBe(prompts()[0]);
  });

  it("says the criteria have changed since they were tested, and offers a retest", async () => {
    await addCustom();
    const dialog = within(drawer());
    expect(dialog.getByText("Criteria changed since last test")).toBeTruthy();
    expect(
      dialog.getByRole("button", { name: "Retest criteria" }),
    ).toBeTruthy();
    expect(dialog.queryByText("Up to date")).toBeNull();
    expect(
      dialog.queryByRole("button", { name: "View benchmark results" }),
    ).toBeNull();
  });

  it("stops typing the moment the recruiter types over it", async () => {
    await addCustom();
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.change(titles()[0], { target: { value: "Mine" } });
    await finishTyping();
    expect(titles()[0].value).toBe("Mine");
    expect(prompts()[0].value).toBe("");
  });

  it("fills it in at once when motion is reduced", async () => {
    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      ...matchMedia(query),
      matches: query.includes("reduce"),
    })) as typeof window.matchMedia;
    try {
      await addCustom();
      expect(titles()[0].value).toBe(NEW_LOGO.title);
      expect(prompts()[0].value).toBe(NEW_LOGO.prompt);
    } finally {
      window.matchMedia = matchMedia;
    }
  });

  it("can only be added once", async () => {
    await addCustom();
    await finishTyping();
    click(within(drawer()).getByRole("button", { name: "Add criteria" }));
    const custom = within(menu()!).getByRole("menuitem", {
      name: "Add custom",
    });
    expect(custom.getAttribute("aria-disabled")).toBe("true");
    click(custom);
    expect(titles()).toHaveLength(4);
  });

  it("is gone again once the drawer is cancelled", async () => {
    await addCustom();
    await finishTyping();
    click(within(drawer()).getByRole("button", { name: "Cancel" }));
    click(screen.getByRole("button", { name: "Edit" }));
    expect(titles()).toHaveLength(3);
    expect(within(drawer()).getByText("Up to date")).toBeTruthy();
  });
});

describe("retest criteria menu", () => {
  function retestMenu() {
    return within(drawer()).queryByRole("menu", { name: "Retest criteria" });
  }

  async function openRetest() {
    await addCustom();
    await finishTyping();
    click(within(drawer()).getByRole("button", { name: "Retest criteria" }));
  }

  it("opens from Retest criteria with the ways to retest, and the last results after a rule", async () => {
    await openRetest();
    const trigger = within(drawer()).getByRole("button", {
      name: "Retest criteria",
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(
      within(retestMenu()!)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Retest with 12 suggested candidates",
      "Retest with previous candidate set",
      "Change candidates...",
      "View last benchmark results",
    ]);
    const [separator] = within(retestMenu()!).getAllByRole("separator");
    const items = within(retestMenu()!).getAllByRole("menuitem");
    expect(separator.previousElementSibling).toBe(items[2]);
  });

  it("closes on Escape without closing the drawer, and keeps the draft", async () => {
    await openRetest();
    fireEvent.keyDown(within(retestMenu()!).getAllByRole("menuitem")[0], {
      key: "Escape",
    });
    expect(retestMenu()).toBeNull();
    expect(drawer().open).toBe(true);
    expect(titles()[0].value).toBe(NEW_LOGO.title);
  });

  it("is one menu at a time with Add criteria", async () => {
    await openRetest();
    fireEvent.pointerDown(
      within(drawer()).getByRole("button", { name: "Add criteria" }),
    );
    click(within(drawer()).getByRole("button", { name: "Add criteria" }));
    expect(retestMenu()).toBeNull();
    expect(menu()).not.toBeNull();
  });
});
