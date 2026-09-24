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
import { Intro } from "../intro";

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

afterEach(cleanup);

// What the title page says (Figma 147:8677).
const WELCOME = {
  title: "Benchmarking AI review criteria",
  text: [
    "Concept prototype",
    "A proposal for taking the guesswork out of AI-assisted screening",
  ],
};

// What each page after it says (Figma 134:7340, 139:7493 and 143:7778), in
// order.
const PAGES = [
  {
    title: "AI criteria can silently exclude strong candidates",
    text: [
      "UX gap",
      "Criteria prompts capture a recruiter’s best intentions, but depend on the AI’s interpretation of the language.",
      "A criterion that reads well can still eliminate candidates you would likely hire.",
      "Today, the only way to spot a bad prompt is to run it past your entire pipeline, at a credit per evaluation.",
      "Even so, fixing the prompt is guesswork, as active applicants don’t have an outcome to compare against yet.",
    ],
  },
  {
    title: "Test your criteria against talent with known outcomes",
    text: [
      "Recommendation",
      "Before applying your criteria on active candidates, test them on a small set of past hires and archived profiles.",
      "A criterion that excludes one of your hires will likely exclude strong active candidates too.",
      "A criterion that passes a profile you archived will likely let weak ones through.",
      "Tests flag mismatches and the criteria that caused them, with suggested rewrites to take out the guesswork.",
    ],
  },
  {
    title: "Add a criterion and put it to the test",
    text: [
      "Try it yourself",
      "You will add a criterion to an Account Executive job, test it against 12 profiles with known outcomes, and apply suggested rewrites to fix what the test finds.",
      "Concept prototype. Fictional candidate profiles and resumes generated with AI.",
    ],
  },
];

function intro() {
  return document.querySelector("dialog") as HTMLDialogElement;
}

function page(title: string) {
  return screen
    .getByRole("heading", { level: 2, name: title })
    .closest("section")!;
}

// Out of reach of the keyboard and assistive tech: inert, or inside something
// that is.
function hidden(element: Element) {
  return element.closest("[inert]") !== null;
}

async function arrive() {
  const user = userEvent.setup();
  render(<Intro />);
  await act(async () => {});
  return user;
}

async function start() {
  const user = await arrive();
  await user.click(screen.getByRole("button", { name: "Get started" }));
  return user;
}

describe("intro", () => {
  it("opens on arrival, on its title page", async () => {
    await arrive();
    expect(intro().open).toBe(true);
    expect(screen.getByRole("dialog", { name: WELCOME.title })).toBe(intro());
    const welcome = page(WELCOME.title);
    for (const line of WELCOME.text)
      expect(within(welcome).getByText(line)).toBeTruthy();
    expect(hidden(welcome)).toBe(false);
    for (const { title } of PAGES) expect(hidden(page(title))).toBe(true);
  });

  it("puts Get started in focus as it opens", async () => {
    await arrive();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Get started" }),
    );
  });

  it("goes on to the first page from Get started, and puts Next in focus", async () => {
    await start();
    expect(screen.getByRole("dialog", { name: PAGES[0].title })).toBe(intro());
    expect(hidden(page(WELCOME.title))).toBe(true);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Next" }),
    );
  });

  it.each(PAGES.map((p, i) => [i + 1, p] as const))(
    "says what page %i says",
    async (_, { title, text }) => {
      await arrive();
      const section = within(page(title));
      for (const line of text) expect(section.getByText(line)).toBeTruthy();
    },
  );

  it("hides every page but the one on screen from the keyboard and assistive tech", async () => {
    await start();
    const [first, ...rest] = PAGES.map((p) => page(p.title));
    expect(hidden(first)).toBe(false);
    for (const other of rest) expect(hidden(other)).toBe(true);
  });

  it("moves on with Next and back with Back", async () => {
    const user = await start();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("dialog", { name: PAGES[1].title })).toBe(intro());
    expect(hidden(page(PAGES[0].title))).toBe(true);
    expect(hidden(page(PAGES[1].title))).toBe(false);

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("dialog", { name: PAGES[2].title })).toBe(intro());

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("dialog", { name: PAGES[1].title })).toBe(intro());
  });

  it("has no way back from the first page, and starts the walkthrough from the last", async () => {
    const user = await start();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("dialog", { name: PAGES[2].title })).toBe(intro());
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Start walkthrough" }),
    ).toBeTruthy();
  });

  it("keeps the focus in the footer as its buttons come and go", async () => {
    const user = await start();
    const next = screen.getByRole("button", { name: "Next" });
    await user.click(next);
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Next" }),
    );

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Start walkthrough" }),
    );
  });

  it("goes straight to a page from its dot, and marks the page on screen", async () => {
    const user = await start();
    const dots = within(screen.getByRole("group", { name: "Pages" }));
    expect(
      dots.getByRole("button", { name: "Page 1" }).getAttribute("aria-current"),
    ).toBe("step");

    await user.click(dots.getByRole("button", { name: "Page 3" }));
    expect(screen.getByRole("dialog", { name: PAGES[2].title })).toBe(intro());
    expect(
      dots.getByRole("button", { name: "Page 3" }).getAttribute("aria-current"),
    ).toBe("step");
    expect(
      dots.getByRole("button", { name: "Page 1" }).hasAttribute("aria-current"),
    ).toBe(false);
  });

  it("closes from Start walkthrough, on the last page", async () => {
    const user = await start();
    await user.click(screen.getByRole("button", { name: "Page 3" }));
    await user.click(screen.getByRole("button", { name: "Start walkthrough" }));
    expect(intro().open).toBe(false);
  });

  it("has no close button on the title page, and one from the first page on", async () => {
    const user = await arrive();
    expect(hidden(screen.getByRole("button", { name: "Close" }))).toBe(true);

    await user.click(screen.getByRole("button", { name: "Get started" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    const close = screen.getByRole("button", { name: "Close" });
    expect(hidden(close)).toBe(false);
    await user.click(close);
    expect(intro().open).toBe(false);
  });

  it("closes on Escape", async () => {
    await arrive();
    fireEvent.keyDown(screen.getByRole("button", { name: "Get started" }), {
      key: "Escape",
    });
    expect(intro().open).toBe(false);
  });

  it("keeps its pictures out of reach: what they show is not there to use", async () => {
    const user = await start();
    // The title page's, and one for each page after it.
    const covers = intro().querySelectorAll("[data-cover]");
    expect(covers).toHaveLength(PAGES.length + 1);
    for (const cover of covers) {
      expect(cover.getAttribute("aria-hidden")).toBe("true");
      expect(cover.hasAttribute("inert")).toBe(true);
    }
    // The last page's picture draws the rewrite's own buttons.
    await user.click(screen.getByRole("button", { name: "Page 3" }));
    expect(
      screen.queryByRole("button", { name: "Apply suggested rewrite" }),
    ).toBeNull();
  });
});
