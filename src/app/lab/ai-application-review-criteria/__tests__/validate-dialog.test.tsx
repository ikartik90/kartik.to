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
import { BENCHMARKING_MS } from "../benchmark-dialog";
import { VALIDATING_MS } from "../validate-dialog";
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

function drawer() {
  return screen.getByRole("dialog", {
    name: "AI-assisted application review criteria",
  });
}

function validate() {
  return within(drawer()).getByRole("button", {
    name: "Validate",
  }) as HTMLButtonElement;
}

function save() {
  return within(drawer()).getByRole("button", {
    name: /^Save/,
  }) as HTMLButtonElement;
}

const NEW_LOGO = CRITERIA.find((c) => c.id === "new-logo")!;

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

/** Edit, with the clock stopped from then on (`userEvent` never returns under fake timers). */
async function edit() {
  const user = userEvent.setup();
  render(<Landing />);
  await user.click(screen.getByRole("button", { name: "Edit" }));
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
}

async function addCustomCriterion() {
  fireEvent.click(
    within(drawer()).getByRole("button", { name: "Add criteria" }),
  );
  fireEvent.click(
    within(drawer()).getByRole("menuitem", { name: "Add custom" }),
  );
  await act(async () => {
    vi.runAllTimers();
  });
}

async function retest() {
  fireEvent.click(
    within(drawer()).getByRole("button", { name: "Retest criteria" }),
  );
  fireEvent.click(
    within(drawer()).getByRole("menuitem", {
      name: "Retest with previous candidate set",
    }),
  );
  await advance(BENCHMARKING_MS);
  return screen.getByRole("dialog", { name: "Benchmark results" });
}

describe("the Validate and Save buttons", () => {
  it("are not offered when the form opens: the criteria running were validated, saved and evaluated with the last run", async () => {
    await edit();
    expect(validate().disabled).toBe(true);
    expect(save().disabled).toBe(true);
    expect(save().textContent).toBe("Save");
  });

  it("offer Validate once changed criteria are retested, and not before", async () => {
    await edit();
    await addCustomCriterion();
    expect(validate().disabled).toBe(true);
    await retest();
    expect(validate().disabled).toBe(false);
    expect(save().disabled).toBe(true);
  });

  it("take Validate away while a candidate put back has not been benchmarked", async () => {
    await edit();
    await addCustomCriterion();
    const results = await retest();
    fireEvent.click(
      within(results).getByRole("tab", { name: /Suggested candidates/ }),
    );
    const tomas = () =>
      within(results).getByRole("row", { name: /Tomas Reyes/ });
    fireEvent.click(within(tomas()).getByRole("button", { name: "Remove" }));
    expect(validate().disabled).toBe(false);
    fireEvent.click(within(tomas()).getByRole("button", { name: "Add" }));
    expect(validate().disabled).toBe(true);
  });

  it("keep Validate offered with suggested rewrites waiting on an answer", async () => {
    await edit();
    await addCustomCriterion();
    const results = await retest();
    fireEvent.click(
      within(results).getByRole("button", {
        name: "Review suggested rewrites",
      }),
    );
    await act(async () => {});
    expect(
      within(drawer()).getByRole("group", { name: "Suggested rewrite" }),
    ).toBeTruthy();
    expect(validate().disabled).toBe(false);
  });
});

function validating() {
  return screen.getByRole("dialog", { name: "Validating job criteria" });
}

/** Changed criteria, retested, and then validated. */
async function startValidating() {
  await edit();
  await addCustomCriterion();
  const results = await retest();
  fireEvent.keyDown(results, { key: "Escape" });
  fireEvent.click(validate());
  return validating();
}

async function validateAndClose() {
  const dialog = await startValidating();
  await advance(VALIDATING_MS);
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  return dialog;
}

describe("validating the criteria (Figma 119:5974)", () => {
  it("shows a progress bar first, with no Close", async () => {
    const dialog = await startValidating();
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(
      within(dialog).getByRole("progressbar", {
        name: "Validating job criteria",
      }),
    ).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: "Close" })).toBeNull();
    expect(within(dialog).queryByText("All criteria are valid")).toBeNull();
  });

  it("then says every criterion is valid, and offers Close", async () => {
    const dialog = await startValidating();
    await advance(VALIDATING_MS - 1);
    expect(within(dialog).getByRole("progressbar")).toBeTruthy();
    await advance(1);
    expect(within(dialog).queryByRole("progressbar")).toBeNull();
    expect(within(dialog).getByText("All criteria are valid")).toBeTruthy();
    expect(document.activeElement).toBe(
      within(dialog).getByRole("button", { name: "Close" }),
    );
  });

  it("once closed, takes Validate away and offers to save and evaluate, with focus on it", async () => {
    const dialog = await validateAndClose();
    expect(dialog.hasAttribute("open")).toBe(false);
    expect(validate().disabled).toBe(true);
    const saveAndEvaluate = within(drawer()).getByRole("button", {
      name: "Save and evaluate all active candidates",
    }) as HTMLButtonElement;
    expect(saveAndEvaluate.disabled).toBe(false);
    expect(document.activeElement).toBe(saveAndEvaluate);
  });

  it("changes nothing when closed before it has finished", async () => {
    const dialog = await startValidating();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(dialog.hasAttribute("open")).toBe(false);
    expect(validate().disabled).toBe(false);
    expect(save().disabled).toBe(true);
    expect(document.activeElement).toBe(validate());
    fireEvent.click(validate());
    expect(within(validating()).getByRole("progressbar")).toBeTruthy();
  });

  it("stops counting once the criteria change again: Save goes, and Validate waits on a retest", async () => {
    await validateAndClose();
    fireEvent.change(within(drawer()).getAllByLabelText("Prompt")[1], {
      target: { value: "Has run a full sales cycle." },
    });
    expect(save().textContent).toBe("Save");
    expect(save().disabled).toBe(true);
    expect(validate().disabled).toBe(true);
  });
});

describe("saving and evaluating all active candidates", () => {
  /** The criteria the AI features page lists, by title, each with its prompt. */
  function running() {
    return within(
      screen.getByRole("list", { name: "AI-assisted application review" }),
    )
      .getAllByRole("listitem")
      .map((item) => ({
        title: item.querySelector("h4")?.textContent,
        prompt: item.querySelector("p")?.textContent,
      }));
  }

  const RUNNING_BEFORE = CRITERIA.filter((c) => c.id !== NEW_LOGO.id).map(
    ({ title, prompt }) => ({ title, prompt }),
  );

  async function saveAndEvaluate() {
    await validateAndClose();
    fireEvent.click(
      within(drawer()).getByRole("button", {
        name: "Save and evaluate all active candidates",
      }),
    );
  }

  it("closes the drawer, and the page lists the criteria saved: the new one at the top, its prompt shown as the others are", async () => {
    await saveAndEvaluate();
    expect(document.querySelector("dialog")!.hasAttribute("open")).toBe(false);
    expect(running()).toEqual([
      { title: NEW_LOGO.title, prompt: NEW_LOGO.prompt },
      ...RUNNING_BEFORE,
    ]);
  });

  it("opens the drawer next time on what was saved, with nothing to validate or save", async () => {
    await saveAndEvaluate();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(
      (
        within(drawer()).getAllByLabelText("Short title") as HTMLInputElement[]
      ).map((field) => field.value),
    ).toEqual([NEW_LOGO.title, ...RUNNING_BEFORE.map((c) => c.title)]);
    expect(within(drawer()).getByText("Up to date")).toBeTruthy();
    expect(validate().disabled).toBe(true);
    expect(save().disabled).toBe(true);
    expect(save().textContent).toBe("Save");
  });

  it("keeps the last results of the criteria saved, not of those they replaced", async () => {
    await saveAndEvaluate();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(
      within(drawer()).getByRole("button", { name: "View benchmark results" }),
    );
    expect(
      within(
        screen.getByRole("dialog", { name: "Benchmark results" }),
      ).getByText(
        "3/12 results mismatch with their known outcomes on 1 criterion",
      ),
    ).toBeTruthy();
  });

  it("leaves the page as it was when the drawer is closed without saving", async () => {
    await validateAndClose();
    fireEvent.click(within(drawer()).getByRole("button", { name: "Cancel" }));
    expect(running()).toEqual(RUNNING_BEFORE);
  });
});
