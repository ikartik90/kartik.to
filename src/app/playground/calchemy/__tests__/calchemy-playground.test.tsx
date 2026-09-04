// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { CalchemyPlayground } from "../calchemy-playground";

afterEach(cleanup);

/** The playground with its engine loaded — everything waits on that. */
async function renderPlayground() {
  render(<CalchemyPlayground />);
  const input = await screen.findByRole("searchbox", {
    name: "Natural language date query",
  });

  return { input, user: userEvent.setup() };
}

function selectedCells(): HTMLElement[] {
  return screen.queryAllByRole("gridcell", { selected: true });
}

function selectedLabels(): string[] {
  return selectedCells().map((cell) => cell.getAttribute("aria-label") ?? "");
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** A day written the way the grid labels its cells. */
function cellLabel(date: Temporal.PlainDate): string {
  return `${MONTHS[date.month - 1]} ${date.day}, ${date.year}`;
}

/** And the way the dictionary's rows label themselves — the month abbreviated,
 *  because the panel's label column is 80px and a written-out month is not. */
function rowLabel(date: Temporal.PlainDate): string {
  return `${MONTHS[date.month - 1].slice(0, 3)} ${date.day}`;
}

describe("CalchemyPlayground", () => {
  it("opens on a window whose second row is the current quarter", async () => {
    await renderPlayground();

    // The grids come out in DOM order, which IS reading order across a
    // three-column grid. Only the rows near the viewport are ever built — the
    // scroll runs a century either way — and which ones those are is read off
    // the scroll position, which has no meaning in jsdom. So this is the window
    // it opens with.
    const months = screen
      .getAllByRole("grid")
      .map((grid) => grid.getAttribute("aria-label"));
    expect(months).toHaveLength(24);

    // The quarter today falls in, named the way the grid names its months.
    const today = new Date();
    const quarterStart = new Date(
      today.getFullYear(),
      Math.floor(today.getMonth() / 3) * 3,
      1,
    );
    const quarter = [0, 1, 2].map((offset) => {
      const month = new Date(
        quarterStart.getFullYear(),
        quarterStart.getMonth() + offset,
        1,
      );
      return month.toLocaleString("en-US", { month: "long", year: "numeric" });
    });

    // The window opens one row ABOVE the quarter, which is what puts the
    // quarter second on screen. Where it lands is a scroll position, verified
    // in the browser.
    expect(months.slice(3, 6)).toEqual(quarter);
  });

  // The site's own two gutter controls. The playground is a full-height
  // scroller with no intro row to hang them off, so it carries them itself —
  // the same pair, the same buttons, as the shader playground next door.
  it("carries the site's menu and theme controls", async () => {
    await renderPlayground();

    expect(screen.getByRole("button", { name: "Menu" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /^(Light|Dark) theme$/ }),
    ).toBeTruthy();
  });

  it("offers no chevrons — scrolling is how the months move", async () => {
    await renderPlayground();

    expect(
      screen.queryAllByRole("button", { name: /Previous|Next/ }),
    ).toHaveLength(0);
  });

  it("selects the days a typed phrase means", async () => {
    const { input, user } = await renderPlayground();

    await user.type(input, "december");

    // Every day of December, and nothing outside it.
    await waitFor(() => expect(selectedLabels()).toHaveLength(31));
    expect(
      selectedLabels().every((label) => label.startsWith("December")),
    ).toBe(true);
  });

  it("selects nothing for a phrase it cannot parse", async () => {
    const { input, user } = await renderPlayground();

    await user.type(input, "december");
    await waitFor(() => expect(selectedLabels()).toHaveLength(31));

    await user.clear(input);
    await user.type(input, "qwerty");

    // Not an error state: the box is being typed INTO, so an unparseable
    // phrase just means nothing yet.
    await waitFor(() => expect(selectedLabels()).toHaveLength(0));
  });

  it("hands the grid back to the phrase after a day is picked by hand", async () => {
    const { input, user } = await renderPlayground();

    await user.type(input, "december");
    await waitFor(() => expect(selectedLabels()).toHaveLength(31));

    // A click toggles that one day out of the phrase's answer...
    await user.click(selectedCells()[0]);
    await waitFor(() => expect(selectedLabels()).toHaveLength(30));

    // ...and the next keystroke takes the grid back to what the phrase says,
    // rather than leaving the hand-made selection standing against a phrase
    // that disagrees with it. ("december!" still parses as December, which is
    // what makes this the phrase's answer returning and not a parse failure
    // clearing the grid.)
    await user.type(input, "!");
    await waitFor(() => expect(selectedLabels()).toHaveLength(31));
  });
});

describe("named date dictionary", () => {
  /** Open the rail and the New Named Date popover on it. */
  async function openForm(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Parser Settings" }));
    await user.click(screen.getByRole("button", { name: "Add a named date" }));
    return screen.getByRole("dialog", { name: "New Named Date" });
  }

  function aliasFields(): HTMLElement[] {
    return screen.queryAllByRole("textbox", { name: /^Alias/ });
  }

  // A name usually has none, and a form that opens with an empty box for one
  // asks a question most entries answer with silence. The section's add button
  // is what a first alias comes from — the same bargain the dictionary section
  // itself makes with its own header.
  it("opens with no alias field at all", async () => {
    const { user } = await renderPlayground();
    await openForm(user);
    expect(aliasFields()).toHaveLength(0);
  });

  it("adds one alias field per press, and focuses it", async () => {
    const { user } = await renderPlayground();
    await openForm(user);

    await user.click(screen.getByRole("button", { name: "Add an alias" }));
    expect(aliasFields()).toHaveLength(1);
    expect(document.activeElement).toBe(aliasFields()[0]);

    await user.click(screen.getByRole("button", { name: "Add an alias" }));
    expect(aliasFields()).toHaveLength(2);
    expect(document.activeElement).toBe(aliasFields()[1]);
  });

  // What the aliases are FOR: the engine is rebuilt with the entry's vocabulary,
  // so a word the dictionary has never heard becomes a date the grid can draw.
  it("teaches the parser the alias, not just the name", async () => {
    const { input, user } = await renderPlayground();
    await openForm(user);

    await user.type(
      screen.getByRole("textbox", { name: "Date name" }),
      "Yuletide",
    );
    await user.click(screen.getByRole("button", { name: "Add an alias" }));
    await user.type(aliasFields()[0], "Yule");
    await user.click(screen.getByRole("button", { name: "Add named date" }));

    // The entry falls on the day the form opened on — today — so that is the
    // one cell the alias should light up.
    const today = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    await user.type(input, "yule");
    await waitFor(() => expect(selectedLabels()).toEqual([today]));
  });

  // The whole point of a NAMED date: the name is asked for by year, so a
  // repeating entry has to answer for a year nobody picked in the form. The
  // form opens on today, so "next year" is today's month and day one year on —
  // which is inside the window the grid opens with, whatever today is.
  it("answers for a year the form never picked when it repeats", async () => {
    const { input, user } = await renderPlayground();
    await openForm(user);

    await user.type(
      screen.getByRole("textbox", { name: "Date name" }),
      "Yuletide",
    );
    await user.click(screen.getByRole("button", { name: "Add named date" }));

    const today = Temporal.Now.plainDateISO();
    const nextYear = today.add({ years: 1 });

    await user.type(input, "yuletide next year");
    await waitFor(() =>
      expect(selectedLabels()).toEqual([cellLabel(nextYear)]),
    );
  });

  // And the other shape. Turned off, the entry is pinned to the year the
  // picker was left on, so the same phrase resolves to that one day rather
  // than sliding a year forward with the question.
  it("holds its own year when it does not repeat", async () => {
    const { input, user } = await renderPlayground();
    await openForm(user);

    await user.type(
      screen.getByRole("textbox", { name: "Date name" }),
      "Eclipse",
    );
    await user.click(
      screen.getByRole("switch", { name: "Repeats every year" }),
    );
    await user.click(screen.getByRole("button", { name: "Add named date" }));

    const today = Temporal.Now.plainDateISO();

    await user.type(input, "eclipse next year");
    await waitFor(() => expect(selectedLabels()).toEqual([cellLabel(today)]));
  });

  // The DAY is what the row is asked about — the dictionary is read to find out
  // when something falls — so it is the row's label and the name is its value.
  // Which of the two rules an entry follows is readable off that label without
  // opening it: a repeating date is a month and a day, a pinned one carries the
  // year that makes it a single day in history.
  it("labels a row with its day, and names the year only when pinned", async () => {
    const { user } = await renderPlayground();
    const today = Temporal.Now.plainDateISO();
    const day = rowLabel(today);

    await openForm(user);
    await user.type(
      screen.getByRole("textbox", { name: "Date name" }),
      "Yuletide",
    );
    await user.click(screen.getByRole("button", { name: "Add named date" }));

    await user.click(screen.getByRole("button", { name: "Add a named date" }));
    await user.type(
      screen.getByRole("textbox", { name: "Date name" }),
      "Eclipse",
    );
    await user.click(screen.getByRole("switch", { name: "Repeats every year" }));
    await user.click(screen.getByRole("button", { name: "Add named date" }));

    const entries =
      screen.getByRole("group", { name: "Named dates" }).textContent ?? "";
    expect(entries).toMatch(new RegExp(`${day}(?!,)\\s*Yuletide`));
    expect(entries).toMatch(new RegExp(`${day}, ${today.year}\\s*Eclipse`));
  });

  /** Define one entry, all defaults but the name. */
  async function define(
    user: ReturnType<typeof userEvent.setup>,
    name: string,
  ) {
    await user.type(screen.getByRole("textbox", { name: "Date name" }), name);
    await user.click(screen.getByRole("button", { name: "Add named date" }));
  }

  // The row's own button opens the same popover on the entry it belongs to,
  // filled in — an edit is the form it was defined with, not a fresh one.
  it("opens the popover already holding the entry it was pressed on", async () => {
    const { user } = await renderPlayground();
    await openForm(user);
    await user.click(screen.getByRole("button", { name: "Add an alias" }));
    await user.type(screen.getByRole("textbox", { name: "Alias 1" }), "Yule");
    await define(user, "Yuletide");

    await user.click(screen.getByRole("button", { name: "Edit Yuletide" }));

    expect(screen.getByRole("dialog", { name: "Edit Named Date" })).toBeTruthy();
    expect(
      (screen.getByRole("textbox", { name: "Date name" }) as HTMLInputElement)
        .value,
    ).toBe("Yuletide");
    expect(
      (screen.getByRole("textbox", { name: "Alias 1" }) as HTMLInputElement)
        .value,
    ).toBe("Yule");
  });

  // And saving it REPLACES the entry — including in the vocabulary, so the old
  // name stops meaning anything and the new one starts.
  it("replaces the entry it was opened on rather than adding another", async () => {
    const { input, user } = await renderPlayground();
    await openForm(user);
    await define(user, "Yuletide");

    await user.click(screen.getByRole("button", { name: "Edit Yuletide" }));
    await user.clear(screen.getByRole("textbox", { name: "Date name" }));
    await user.type(
      screen.getByRole("textbox", { name: "Date name" }),
      "Christmas",
    );
    await user.click(screen.getByRole("button", { name: "Save named date" }));

    const entries =
      screen.getByRole("group", { name: "Named dates" }).textContent ?? "";
    expect(entries).toContain("Christmas");
    expect(entries).not.toContain("Yuletide");

    const today = Temporal.Now.plainDateISO();
    await user.type(input, "christmas");
    await waitFor(() => expect(selectedLabels()).toEqual([cellLabel(today)]));

    await user.clear(input);
    await user.type(input, "yuletide");
    await waitFor(() => expect(selectedLabels()).toEqual([]));
  });
});
