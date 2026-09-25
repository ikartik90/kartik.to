// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Intro } from "../intro";
import { Landing } from "../landing";
import { Walkthrough } from "../walkthrough";
import { AUTHOR, SOCIAL_PROFILES } from "@/data/site";

// jsdom lacks these; the dialog stubs mirror the platform. jsdom can't show a
// popover, so a tip is shown and hidden by the stubs alone.
const showPopover = vi.fn();
const hidePopover = vi.fn();
beforeEach(() => {
  showPopover.mockClear();
  hidePopover.mockClear();
  HTMLElement.prototype.showPopover = showPopover;
  HTMLElement.prototype.hidePopover = hidePopover;
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

const STEPS = [
  {
    title: "Edit the AI review criteria",
    body: "Open the application criteria form to add a custom review criterion.",
  },
  {
    title: "Add a custom criterion",
    body: "Select Add criteria > Add custom. The custom prompt will be auto-filled for you.",
  },
  {
    title: "Test your criteria",
    body: "Test your criteria on 12 benchmark profiles of your choice with known outcomes. Each test costs 12 credits.",
  },
  {
    title: "Criterion excludes a past hire",
    body: "The test flags a mismatch as the New Logo Acquisition criterion excludes Dana, a past hire, even though her resume reports 42 new accounts won. Select Review suggested rewrites to see reworded alternatives.",
  },
  {
    title: "Apply the suggested rewrite",
    body: "It refines the criterion to accept a resume that reports new-logo wins in numbers. Applying a rewrite is free.",
  },
  {
    title: "Test the criteria again",
    body: "Retest to confirm the rewrite resolves the mismatches.",
  },
  {
    title: "All results match",
    body: "With the rewrite applied, all 12 results match their known outcomes. These criteria are now ready to evaluate active candidates.",
  },
];
const [FIRST, SECOND, THIRD, FOURTH, FIFTH, SIXTH, SEVENTH] = STEPS;

function intro() {
  return screen
    .getByRole("button", { name: "Get started", hidden: true })
    .closest("dialog") as HTMLDialogElement;
}

function drawer() {
  return screen
    .getByRole("heading", {
      name: "AI-assisted application review criteria",
      hidden: true,
    })
    .closest("dialog") as HTMLDialogElement;
}

// Found by its title: Testing Library names nothing jsdom hides.
function tip({ title }: (typeof STEPS)[number]) {
  return (
    screen
      .queryByText(title)
      ?.closest<HTMLElement>('[role="dialog"][popover]') ?? null
  );
}

async function shown(step: (typeof STEPS)[number]) {
  await waitFor(() => {
    expect(tip(step)).not.toBeNull();
    expect(showPopover.mock.contexts).toContain(tip(step));
  });
  return tip(step)!;
}

function edit() {
  return screen.getByRole("button", { name: "Edit" });
}

function addCriteria() {
  return within(drawer()).getByRole("button", { name: "Add criteria" });
}

// The header's, not the one the stale results offer.
function retestCriteria() {
  return within(drawer()).getAllByRole("button", {
    name: "Retest criteria",
  })[0];
}

function results() {
  return screen.getByRole("dialog", { name: "Benchmark results" });
}

function reviewRewrites() {
  return screen.getByRole("button", { name: "Review suggested rewrites" });
}

function applyRewrite() {
  return screen.getByRole("button", { name: "Apply suggested rewrite" });
}

async function retestMenu(item: string) {
  fireEvent.click(retestCriteria());
  fireEvent.click(within(drawer()).getByRole("menuitem", { name: item }));
  await act(async () => {});
}

// Two frames on: past the frame a tip waits before it shows.
function frames() {
  return act(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
}

function description(control: HTMLElement) {
  return (control.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)!.textContent)
    .join(" ");
}

async function arrive() {
  const user = userEvent.setup();
  render(
    <Walkthrough>
      <Landing />
      <Intro />
    </Walkthrough>,
  );
  await act(async () => {});
  return user;
}

async function startWalkthrough() {
  const user = await arrive();
  const dialog = within(intro());
  await user.click(dialog.getByRole("button", { name: "Get started" }));
  await user.click(dialog.getByRole("button", { name: "Page 3" }));
  await user.click(dialog.getByRole("button", { name: "Start walkthrough" }));
  await shown(FIRST);
  return user;
}

async function secondStep() {
  const user = await startWalkthrough();
  await user.click(edit());
  await shown(SECOND);
  return user;
}

async function addCustom() {
  const user = await secondStep();
  await user.click(addCriteria());
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  fireEvent.click(
    within(drawer()).getByRole("menuitem", { name: "Add custom" }),
  );
}

async function thirdStep() {
  await addCustom();
  await act(async () => {
    vi.runAllTimers();
  });
  vi.useRealTimers();
  return shown(THIRD);
}

async function fourthStep() {
  await thirdStep();
  await retestMenu("Retest with previous candidate set");
  return shown(FOURTH);
}

async function fifthStep() {
  await fourthStep();
  fireEvent.click(reviewRewrites());
  return shown(FIFTH);
}

async function sixthStep() {
  await fifthStep();
  fireEvent.click(applyRewrite());
  return shown(SIXTH);
}

async function seventhStep() {
  await sixthStep();
  await retestMenu("Retest with previous candidate set");
  return shown(SEVENTH);
}

function button(shownTip: HTMLElement, name: string) {
  return within(shownTip).queryByRole("button", { name, hidden: true });
}

function count(shownTip: HTMLElement, at: number) {
  return within(shownTip).queryByText(`${at} of ${STEPS.length}`);
}

function precedes(before: Element, after: Element) {
  return Boolean(
    before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

describe("walkthrough", () => {
  it("has no tip while the intro is open", async () => {
    await arrive();
    expect(tip(FIRST)).toBeNull();
  });

  it("starts no walkthrough when the intro is put away any other way", async () => {
    const user = await arrive();
    const dialog = within(intro());
    await user.click(dialog.getByRole("button", { name: "Get started" }));
    await user.click(dialog.getByRole("button", { name: "Close" }));
    await act(async () => {});
    expect(intro().open).toBe(false);
    expect(tip(FIRST)).toBeNull();
  });

  it.each(STEPS.map((step, i) => [i + 1, step] as const))(
    "says what step %i is",
    async (at, step) => {
      if (at === 1) await startWalkthrough();
      else if (at === 2) await secondStep();
      else if (at === 3) await thirdStep();
      else if (at === 4) await fourthStep();
      else if (at === 5) await fifthStep();
      else if (at === 6) await sixthStep();
      else await seventhStep();
      const shownTip = tip(step)!;
      const label = shownTip.getAttribute("aria-labelledby")!;
      expect(document.getElementById(label)!.textContent).toBe(step.title);
      expect(within(shownTip).getByText(step.body)).toBeTruthy();
      expect(within(shownTip).queryByText(/Step \d/)).toBeNull();
    },
  );

  it("ends from a tip's Skip", async () => {
    const user = await startWalkthrough();
    await user.click(button(tip(FIRST)!, "Skip")!);
    expect(tip(FIRST)).toBeNull();
    expect(edit().hasAttribute("aria-describedby")).toBe(false);
  });

  it("offers Skip, and no Close", async () => {
    await startWalkthrough();
    const first = tip(FIRST)!;
    expect(button(first, "Close")).toBeNull();
    expect(button(first, "Skip")).not.toBeNull();
    expect(button(first, "Finish")).toBeNull();
  });

  it("offers Finish in Skip's place on the last step", async () => {
    const last = await seventhStep();
    expect(button(last, "Close")).toBeNull();
    expect(button(last, "Skip")).toBeNull();
    expect(button(last, "Finish")).not.toBeNull();
  });

  it.each([
    [1, startWalkthrough, FIRST],
    [4, fourthStep, FOURTH],
    [7, seventhStep, SEVENTH],
  ] as const)(
    "counts step %i of them all, over its title",
    async (at, reach, step) => {
      await reach();
      const shownTip = tip(step)!;
      const counted = count(shownTip, at)!;
      expect(counted).not.toBeNull();
      expect(precedes(counted, within(shownTip).getByText(step.title))).toBe(
        true,
      );
      expect(counted.closest("hgroup")).toBe(
        within(shownTip).getByText(step.title).closest("hgroup"),
      );
    },
  );

  describe("step 1", () => {
    it("starts from Start walkthrough, at Edit", async () => {
      await startWalkthrough();
      expect(intro().open).toBe(false);
      expect(document.activeElement).toBe(edit());
      expect(description(edit())).toContain(FIRST.title);
      expect(description(edit())).toContain(`1 of ${STEPS.length}`);
    });

    it("is done once Edit is pressed, and step 2 follows in the drawer", async () => {
      const user = await startWalkthrough();
      await user.click(edit());
      expect(tip(FIRST)).toBeNull();
      expect(edit().hasAttribute("aria-describedby")).toBe(false);
      expect(drawer().open).toBe(true);
      expect(drawer().contains(await shown(SECOND))).toBe(true);
    });
  });

  describe("step 2", () => {
    it("points at Add criteria", async () => {
      await secondStep();
      expect(document.activeElement).toBe(addCriteria());
      expect(description(addCriteria())).toContain(SECOND.title);
    });

    it("steps aside while the menu is open, and comes back if it closes with nothing chosen", async () => {
      const user = await secondStep();
      const second = tip(SECOND)!;
      await user.click(addCriteria());
      expect(hidePopover.mock.contexts).toContain(second);

      showPopover.mockClear();
      await user.click(addCriteria());
      await waitFor(() => expect(showPopover.mock.contexts).toEqual([second]));
    });

    it("is done once Add custom is chosen", async () => {
      await addCustom();
      expect(tip(SECOND)).toBeNull();
      expect(addCriteria().hasAttribute("aria-describedby")).toBe(false);
    });

    it("goes back to step 1 if the drawer is closed first", async () => {
      const user = await secondStep();
      await user.click(
        within(drawer()).getAllByRole("button", { name: "Close" })[0],
      );
      expect(drawer().open).toBe(false);
      expect(tip(SECOND)).toBeNull();
      await shown(FIRST);
      expect(description(edit())).toContain(FIRST.title);
    });
  });

  describe("step 3", () => {
    it("waits for the prompt to be typed out", async () => {
      await addCustom();
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      await frames();
      const third = tip(THIRD);
      expect(third && showPopover.mock.contexts.includes(third)).toBeFalsy();
    });

    it("then points at Retest criteria, leaving the caret in the prompt", async () => {
      await thirdStep();
      expect(description(retestCriteria())).toContain(THIRD.title);
      expect(document.activeElement?.tagName).toBe("TEXTAREA");
    });

    it("steps aside while the results are open over it, and comes back when they close", async () => {
      const third = await thirdStep();
      await retestMenu("View last benchmark results");
      expect(hidePopover.mock.contexts).toContain(third);

      showPopover.mockClear();
      fireEvent.keyDown(results(), { key: "Escape" });
      await waitFor(() => expect(showPopover.mock.contexts).toEqual([third]));
    });

    it("is done once the criteria are retested", async () => {
      await thirdStep();
      await retestMenu("Retest with previous candidate set");
      expect(tip(THIRD)).toBeNull();
    });
  });

  describe("step 4", () => {
    it("shows in the results once they are in, with Review suggested rewrites in focus", async () => {
      const fourth = await fourthStep();
      expect(results().contains(fourth)).toBe(true);
      expect(document.activeElement).toBe(reviewRewrites());
      expect(description(reviewRewrites())).toContain(FOURTH.title);
    });

    it("steps aside while the results are closed, and is back when they reopen", async () => {
      const fourth = await fourthStep();
      fireEvent.keyDown(results(), { key: "Escape" });
      await act(async () => {});
      expect(hidePopover.mock.contexts).toContain(fourth);

      showPopover.mockClear();
      fireEvent.click(
        within(drawer()).getByRole("button", {
          name: "View benchmark results",
        }),
      );
      await shown(FOURTH);
    });

    it("is done once Review suggested rewrites is pressed", async () => {
      await fourthStep();
      fireEvent.click(reviewRewrites());
      await act(async () => {});
      expect(tip(FOURTH)).toBeNull();
    });
  });

  describe("step 5", () => {
    it("points at Apply suggested rewrite, back in the drawer", async () => {
      const fifth = await fifthStep();
      expect([...document.querySelectorAll("dialog[open]")]).toEqual([
        drawer(),
      ]);
      expect(drawer().contains(fifth)).toBe(true);
      expect(document.activeElement).toBe(applyRewrite());
      expect(description(applyRewrite())).toContain(FIFTH.title);
    });

    it("is done once the rewrite is applied", async () => {
      await fifthStep();
      fireEvent.click(applyRewrite());
      await act(async () => {});
      expect(tip(FIFTH)).toBeNull();
    });
  });

  describe("step 6", () => {
    it("points at Retest criteria again, leaving the caret in the rewritten prompt", async () => {
      await sixthStep();
      expect(description(retestCriteria())).toContain(SIXTH.title);
      expect(document.activeElement?.tagName).toBe("TEXTAREA");
    });

    it("is done once the criteria are retested again", async () => {
      await sixthStep();
      await retestMenu("Retest with previous candidate set");
      expect(tip(SIXTH)).toBeNull();
    });
  });

  describe("step 7", () => {
    it("shows in the results once they all match, with its Finish in focus", async () => {
      const seventh = await seventhStep();
      expect(results().contains(seventh)).toBe(true);
      expect(document.activeElement).toBe(button(seventh, "Finish"));
    });

    it("closes the results from Finish, which ends the walkthrough", async () => {
      const seventh = await seventhStep();
      fireEvent.click(button(seventh, "Finish")!);
      await act(async () => {});
      expect([...document.querySelectorAll("dialog[open]")]).toEqual([
        drawer(),
      ]);
      expect(tip(SEVENTH)).toBeNull();
    });

    it("moves on however the results are closed", async () => {
      await seventhStep();
      fireEvent.keyDown(results(), { key: "Escape" });
      await act(async () => {});
      expect(tip(SEVENTH)).toBeNull();
    });
  });

  describe("the thanks at the end", () => {
    const THANKS = "Thanks for trying the prototype";

    // Found by text: Testing Library names nothing jsdom hides.
    function thanks() {
      return (
        screen.queryByText(THANKS)?.closest<HTMLElement>("[popover]") ?? null
      );
    }

    function link(card: HTMLElement, name: string) {
      return within(card).getByRole("link", { name, hidden: true });
    }

    async function finish() {
      const seventh = await seventhStep();
      fireEvent.click(button(seventh, "Finish")!);
      await act(async () => {});
      return thanks()!;
    }

    it("is not there before the walkthrough is finished", async () => {
      await seventhStep();
      expect(thanks()).toBeNull();
    });

    it("is shown once Finish is pressed, and says who is thanking", async () => {
      const card = await finish();
      expect(card).not.toBeNull();
      expect(showPopover.mock.contexts).toContain(card);
      expect(within(card).getByText("Kartik Iyer")).toBeTruthy();
      expect(within(card).getByText("Product designer, Toronto")).toBeTruthy();
      expect(
        within(card).getByText(
          "Given the chance, I’d love to present this in person and walk you through the decisions behind it.",
        ),
      ).toBeTruthy();
      expect(card.querySelector("img")?.getAttribute("src")).toBe(
        AUTHOR.avatar,
      );
    });

    it.each([
      ["Book a time", "https://calendly.com/ikartik90/30min"],
      ["LinkedIn", SOCIAL_PROFILES.linkedin],
      ["X", SOCIAL_PROFILES.twitter],
    ])("links %s, in a new tab", async (name, href) => {
      const to = link(await finish(), name);
      expect(to.getAttribute("href")).toBe(href);
      expect(to.getAttribute("target")).toBe("_blank");
      expect(to.getAttribute("rel")).toContain("noopener");
    });

    it("is shown too when the last step is done by closing the results", async () => {
      await seventhStep();
      fireEvent.keyDown(results(), { key: "Escape" });
      await act(async () => {});
      expect(thanks()).not.toBeNull();
    });

    it("is not shown when the walkthrough is skipped", async () => {
      const user = await startWalkthrough();
      await user.click(button(tip(FIRST)!, "Skip")!);
      expect(thanks()).toBeNull();
    });

    it("goes from its Close", async () => {
      const card = await finish();
      fireEvent.click(button(card, "Close")!);
      expect(thanks()).toBeNull();
    });

    it("sits in the drawer while it is open, and on the page once it closes", async () => {
      await finish();
      expect(drawer().contains(thanks())).toBe(true);

      fireEvent.keyDown(drawer(), { key: "Escape" });
      await act(async () => {});
      expect(drawer().open).toBe(false);
      expect(thanks()).not.toBeNull();
      expect(drawer().contains(thanks())).toBe(false);
    });
  });
});
