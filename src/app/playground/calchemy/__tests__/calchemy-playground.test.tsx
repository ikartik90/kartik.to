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

  // 0.3.0 of the parser says not just that a phrase failed but what it was
  // reaching for. The row itself is shared with the article's demo and tested
  // there; what belongs here is the wiring only the playground has — taking the
  // offer is a retype, so it drops the hand-made selection exactly as typing
  // does. ("2020 03 15" rather than a relative phrase: the playground reads the
  // real clock, and a rewrite that only exists in some months is a test that
  // fails in others.)
  it("offers the parser's rewrite, and hands the grid back when it is taken", async () => {
    const { input, user } = await renderPlayground();

    await user.type(input, "2020 03 15");
    const offer = await screen.findByRole("button", {
      name: /^Search for .* instead$/,
    });
    expect(offer.textContent).toContain("2020-03-15");

    // A day chosen by hand, standing against a phrase that says nothing. The
    // 15th of this month, because it is certain to be on screen — the window
    // opens with the current quarter in its second row — and certain to be a
    // real day of it rather than one of the grid's padding cells.
    await user.click(
      screen.getByRole("gridcell", {
        name: cellLabel(Temporal.Now.plainDateISO().with({ day: 15 })),
      }),
    );
    await waitFor(() => expect(selectedLabels()).toHaveLength(1));

    await user.click(offer);

    expect((input as HTMLInputElement).value).toBe("2020-03-15");
    // The rewrite reads, so the offer is withdrawn...
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /^Search for .* instead$/ }),
      ).toBeNull(),
    );
    // ...and the hand-made day is gone with it. March 2020 is years outside the
    // window on screen, so the phrase's own answer is nothing drawn at all.
    expect(selectedLabels()).toHaveLength(0);
  });
});


// ---------------------------------------------------------------------------
// The named dates, which are now defined FROM the grid: the days a definition
// stands for are whatever is lit when the add chip is pressed, so there is no
// date field in the form at all and no way to open it with nothing selected.
// ---------------------------------------------------------------------------
describe("named date dictionary", () => {
  // The 15th of the month the window opens on — a real day of it rather than
  // one of the grid's padding cells, which carry the label of the day they
  // stand in for. Every date in this block is measured off it.
  const base = Temporal.Now.plainDateISO().with({ day: 15 });

  /** Light days on the grid, which is where a definition's days come from. */
  async function light(
    user: ReturnType<typeof userEvent.setup>,
    ...days: Temporal.PlainDate[]
  ) {
    for (const day of days) {
      await user.click(screen.getByRole("gridcell", { name: cellLabel(day) }));
    }
  }

  /** Light `days` (today's 15th by default) and open the form on them. */
  async function openForm(
    user: ReturnType<typeof userEvent.setup>,
    ...days: Temporal.PlainDate[]
  ) {
    await light(user, ...(days.length > 0 ? days : [base]));
    await user.click(screen.getByRole("button", { name: "New named date" }));
    return screen.getByRole("group", { name: "New named date" });
  }

  function aliasFields(): HTMLElement[] {
    return screen.queryAllByRole("textbox", { name: /^Alias/ });
  }

  /** Fill in a name and commit the form. */
  async function define(
    user: ReturnType<typeof userEvent.setup>,
    name: string,
  ) {
    await user.type(screen.getByRole("textbox", { name: "Date name" }), name);
    await user.click(screen.getByRole("button", { name: "Define named date" }));
  }

  function dictionary(): string {
    return screen.getByRole("group", { name: "Named dates" }).textContent ?? "";
  }

  /** The query row, re-read every time: the morph UNMOUNTS it, so a reference
   *  taken before a form was opened points at a node that is no longer on the
   *  page — and typing into one of those reaches nothing. */
  function queryField(): HTMLElement {
    return screen.getByRole("searchbox", {
      name: "Natural language date query",
    });
  }

  // The chip is an offer to name WHAT IS LIT, so with nothing lit there is
  // nothing to offer — and no form that could ask for the days instead.
  it("offers nothing to name until the grid has days on it", async () => {
    const { user } = await renderPlayground();

    expect(screen.queryByRole("button", { name: "New named date" })).toBeNull();

    await light(user, base);
    expect(screen.getByRole("button", { name: "New named date" })).toBeTruthy();
  });

  // A phrase's own answer counts. "Mondays and fridays next month" is exactly
  // the kind of set worth a name, and it was never picked by hand.
  it("arms itself off a typed phrase too, not only a hand-made pick", async () => {
    const { input, user } = await renderPlayground();

    await user.type(input, "december");
    await waitFor(() => expect(selectedLabels()).toHaveLength(31));

    expect(screen.getByRole("button", { name: "New named date" })).toBeTruthy();
  });

  // The whole gesture: the panel becomes the form and gives the query row back
  // when the form is done with it. The days stay lit throughout — they are the
  // subject, not something the form took away.
  it("morphs the query panel into the form, and back out of it", async () => {
    const { user } = await renderPlayground();
    await openForm(user);

    expect(
      screen.queryByRole("searchbox", { name: "Natural language date query" }),
    ).toBeNull();
    expect(screen.getByRole("textbox", { name: "Date name" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.getByRole("searchbox", { name: "Natural language date query" }),
    ).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Date name" })).toBeNull();
    expect(selectedLabels()).toEqual([cellLabel(base)]);
  });

  // Escape is the same retreat as Cancel, and it stops there — the rail behind
  // the panel is not the thing being dismissed.
  it("cancels the form on Escape", async () => {
    const { user } = await renderPlayground();
    await openForm(user);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("textbox", { name: "Date name" })).toBeNull();
    expect(
      screen.getByRole("searchbox", { name: "Natural language date query" }),
    ).toBeTruthy();
  });

  // What the form is FOR: every day that was lit becomes what the name means,
  // not just the first of them.
  it("teaches the parser every day that was lit, not only the first", async () => {
    const { user } = await renderPlayground();
    const second = base.add({ months: 1 });
    await openForm(user, base, second);
    await define(user, "Fixtures");

    await user.type(queryField(), "fixtures");
    await waitFor(() =>
      expect(selectedLabels()).toEqual([cellLabel(base), cellLabel(second)]),
    );
  });

  // A repeating set slides WHOLE, anchored on its first day's year — so a set
  // that straddles a new year keeps its shape a year on rather than collapsing
  // into one of them.
  it("slides the whole set to the year it is asked about", async () => {
    const { user } = await renderPlayground();
    const second = base.add({ months: 1 });
    await openForm(user, base, second);
    await define(user, "Fixtures");

    await user.type(queryField(), "fixtures next year");
    await waitFor(() =>
      expect(selectedLabels()).toEqual([
        cellLabel(base.add({ years: 1 })),
        cellLabel(second.add({ years: 1 })),
      ]),
    );
  });

  // And the other rule. Turned off, the entry is pinned to the days it was
  // defined on and answers with them whatever year is asked.
  it("holds its own days when it does not repeat", async () => {
    const { user } = await renderPlayground();
    await openForm(user);
    await user.click(screen.getByRole("switch", { name: "Repeats every year" }));
    await define(user, "Eclipse");

    await user.type(queryField(), "eclipse next year");
    await waitFor(() => expect(selectedLabels()).toEqual([cellLabel(base)]));
  });

  // The rule the switch can only be offered under: a set that outruns a year
  // has no year to slide by — the second lap would land on the first. So the
  // switch is withdrawn rather than left to mean something it cannot.
  it("withdraws the repeat switch from a set that outruns a year", async () => {
    const { user } = await renderPlayground();
    const far = base.add({ months: 15 });
    await openForm(user, base, far);

    const repeats = screen.getByRole("switch", { name: "Repeats every year" });
    expect(repeats.getAttribute("aria-checked")).toBe("false");
    expect((repeats as HTMLButtonElement).disabled).toBe(true);

    await define(user, "Season");

    // Pinned, then: the days it was defined on, whatever year is asked for.
    await user.type(queryField(), "season next year");
    await waitFor(() =>
      expect(selectedLabels()).toEqual([cellLabel(base), cellLabel(far)]),
    );
  });

  // ...and it comes back when the selection is brought back inside a year,
  // because the answer to "may this repeat" is a fact about what is lit.
  it("restores the repeat switch when the set comes back inside a year", async () => {
    const { user } = await renderPlayground();
    const far = base.add({ months: 15 });
    await openForm(user, base, far);

    expect(
      (screen.getByRole("switch", { name: "Repeats every year" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    // Taking the far day back off the grid, with the form still open.
    await light(user, far);

    const repeats = screen.getByRole("switch", { name: "Repeats every year" });
    expect((repeats as HTMLButtonElement).disabled).toBe(false);
    expect(repeats.getAttribute("aria-checked")).toBe("true");
  });

  // The add chip in the row is what a SECOND alias comes from; the first has a
  // row waiting for it, because the chip has to sit at the end of one.
  it("opens with a single alias row and appends one per press", async () => {
    const { user } = await renderPlayground();
    await openForm(user);

    expect(aliasFields()).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Add an alias" }));
    expect(aliasFields()).toHaveLength(2);
    expect(document.activeElement).toBe(aliasFields()[1]);
  });

  // What the aliases are FOR: the engine is rebuilt with the entry's
  // vocabulary, so a word the dictionary has never heard becomes a date.
  it("teaches the parser the alias, not just the name", async () => {
    const { user } = await renderPlayground();
    await openForm(user);
    await user.type(aliasFields()[0], "Yule");
    await define(user, "Yuletide");

    await user.type(queryField(), "yule");
    await waitFor(() => expect(selectedLabels()).toEqual([cellLabel(base)]));
  });

  // A row added and left blank is one the reader thought better of, not an
  // empty word to teach the parser.
  it("drops a blank alias row rather than teaching an empty word", async () => {
    const { user } = await renderPlayground();
    await openForm(user);
    await define(user, "Yuletide");

    await user.type(queryField(), "yuletide");
    await waitFor(() => expect(selectedLabels()).toEqual([cellLabel(base)]));
  });

  // The DAY is what the row is asked about, so it is the row's label and the
  // name is its value. Which rule the entry follows is readable off that label
  // without opening it — a repeating date is a month and a day, a pinned one
  // carries the year that makes it days in history — and a set says how many
  // more days it holds.
  it("labels a row with its days, and names the year only when pinned", async () => {
    const { user } = await renderPlayground();
    const day = rowLabel(base);

    await openForm(user);
    await define(user, "Yuletide");

    await openForm(user, base.add({ months: 1 }));
    await user.click(screen.getByRole("switch", { name: "Repeats every year" }));
    await define(user, "Eclipse");

    await user.click(screen.getByRole("button", { name: "Parser Settings" }));
    expect(dictionary()).toMatch(new RegExp(`${day}(?!,)\\s*Yuletide`));
    expect(dictionary()).toMatch(
      new RegExp(`${rowLabel(base)}, ${base.year} \\+1\\s*Eclipse`),
    );
  });

  // The rail's pencil opens the SAME form on the entry it belongs to — filled
  // in, and with the entry's own days lit, because the days are what the form
  // is standing over.
  it("opens the form on the entry the pencil belongs to, days and all", async () => {
    const { user } = await renderPlayground();
    const second = base.add({ months: 1 });
    await openForm(user, base, second);
    await user.type(aliasFields()[0], "Yule");
    await define(user, "Yuletide");

    await user.click(screen.getByRole("button", { name: "Parser Settings" }));
    await user.click(screen.getByRole("button", { name: "Edit Yuletide" }));

    expect(screen.getByRole("group", { name: "Edit named date" })).toBeTruthy();
    expect(
      (screen.getByRole("textbox", { name: "Date name" }) as HTMLInputElement)
        .value,
    ).toBe("Yuletide");
    expect(
      (screen.getByRole("textbox", { name: "Alias 1" }) as HTMLInputElement)
        .value,
    ).toBe("Yule");
    expect(selectedLabels()).toEqual([cellLabel(base), cellLabel(second)]);
  });

  // And saving REPLACES the entry — including in the vocabulary, so the old
  // name stops meaning anything and the new one starts.
  it("replaces the entry it was opened on rather than adding another", async () => {
    const { user } = await renderPlayground();
    await openForm(user);
    await define(user, "Yuletide");

    await user.click(screen.getByRole("button", { name: "Parser Settings" }));
    await user.click(screen.getByRole("button", { name: "Edit Yuletide" }));
    await user.clear(screen.getByRole("textbox", { name: "Date name" }));
    await user.type(
      screen.getByRole("textbox", { name: "Date name" }),
      "Christmas",
    );
    await user.click(screen.getByRole("button", { name: "Save named date" }));

    expect(dictionary()).toContain("Christmas");
    expect(dictionary()).not.toContain("Yuletide");

    await user.type(queryField(), "christmas");
    await waitFor(() => expect(selectedLabels()).toEqual([cellLabel(base)]));

    await user.clear(queryField());
    await user.type(queryField(), "yuletide");
    await waitFor(() => expect(selectedLabels()).toEqual([]));
  });

  // The chip carries no words of its own, so the hover label is where its name
  // is written out.
  it("names the add chip on hover", async () => {
    const { user } = await renderPlayground();
    await light(user, base);

    await user.hover(screen.getByRole("button", { name: "New named date" }));

    expect(
      screen.getByText("New named date").closest("[data-visible]"),
    ).toBeTruthy();
  });
});
