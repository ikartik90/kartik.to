// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { CalchemyPlayground } from "../calchemy-playground";

afterEach(cleanup);

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

function cellLabel(date: Temporal.PlainDate): string {
  return `${MONTHS[date.month - 1]} ${date.day}, ${date.year}`;
}

function rowLabel(date: Temporal.PlainDate): string {
  return `${MONTHS[date.month - 1].slice(0, 3)} ${date.day}`;
}

describe("CalchemyPlayground", () => {
  it("opens on a window whose second row is the current quarter", async () => {
    await renderPlayground();

    // jsdom has no scroll position, so this is the window the grid opens with.
    const months = screen
      .getAllByRole("grid")
      .map((grid) => grid.getAttribute("aria-label"));
    expect(months).toHaveLength(24);

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

    // The window opens one row above today's quarter.
    expect(months.slice(3, 6)).toEqual(quarter);
  });

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

    await waitFor(() => expect(selectedLabels()).toHaveLength(0));
  });

  it("hands the grid back to the phrase after a day is picked by hand", async () => {
    const { input, user } = await renderPlayground();

    await user.type(input, "december");
    await waitFor(() => expect(selectedLabels()).toHaveLength(31));

    await user.click(selectedCells()[0]);
    await waitFor(() => expect(selectedLabels()).toHaveLength(30));

    // "december!" still parses as December.
    await user.type(input, "!");
    await waitFor(() => expect(selectedLabels()).toHaveLength(31));
  });

  // An absolute date: the playground reads the real clock.
  it("offers the parser's rewrite, and hands the grid back when it is taken", async () => {
    const { input, user } = await renderPlayground();

    await user.type(input, "2020 03 15");
    const offer = await screen.findByRole("button", {
      name: /^Search for .* instead$/,
    });
    expect(offer.textContent).toContain("2020-03-15");

    // The 15th: always on screen, and never a padding cell.
    await user.click(
      screen.getByRole("gridcell", {
        name: cellLabel(Temporal.Now.plainDateISO().with({ day: 15 })),
      }),
    );
    await waitFor(() => expect(selectedLabels()).toHaveLength(1));

    await user.click(offer);

    expect((input as HTMLInputElement).value).toBe("2020-03-15");
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /^Search for .* instead$/ }),
      ).toBeNull(),
    );
    expect(selectedLabels()).toHaveLength(0);
  });
});


describe("named date dictionary", () => {
  // The 15th: a real day of the opening month, never a padding cell.
  const base = Temporal.Now.plainDateISO().with({ day: 15 });

  async function light(
    user: ReturnType<typeof userEvent.setup>,
    ...days: Temporal.PlainDate[]
  ) {
    for (const day of days) {
      await user.click(screen.getByRole("gridcell", { name: cellLabel(day) }));
    }
  }

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

  /** Re-read every time: the form's morph unmounts the query row. */
  function queryField(): HTMLElement {
    return screen.getByRole("searchbox", {
      name: "Natural language date query",
    });
  }

  it("offers nothing to name until the grid has days on it", async () => {
    const { user } = await renderPlayground();

    expect(screen.queryByRole("button", { name: "New named date" })).toBeNull();

    await light(user, base);
    expect(screen.getByRole("button", { name: "New named date" })).toBeTruthy();
  });

  it("arms itself off a typed phrase too, not only a hand-made pick", async () => {
    const { input, user } = await renderPlayground();

    await user.type(input, "december");
    await waitFor(() => expect(selectedLabels()).toHaveLength(31));

    expect(screen.getByRole("button", { name: "New named date" })).toBeTruthy();
  });

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

  it("cancels the form on Escape", async () => {
    const { user } = await renderPlayground();
    await openForm(user);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("textbox", { name: "Date name" })).toBeNull();
    expect(
      screen.getByRole("searchbox", { name: "Natural language date query" }),
    ).toBeTruthy();
  });

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

  it("holds its own days when it does not repeat", async () => {
    const { user } = await renderPlayground();
    await openForm(user);
    await user.click(screen.getByRole("switch", { name: "Repeats every year" }));
    await define(user, "Eclipse");

    await user.type(queryField(), "eclipse next year");
    await waitFor(() => expect(selectedLabels()).toEqual([cellLabel(base)]));
  });

  it("withdraws the repeat switch from a set that outruns a year", async () => {
    const { user } = await renderPlayground();
    const far = base.add({ months: 15 });
    await openForm(user, base, far);

    const repeats = screen.getByRole("switch", { name: "Repeats every year" });
    expect(repeats.getAttribute("aria-checked")).toBe("false");
    expect((repeats as HTMLButtonElement).disabled).toBe(true);

    await define(user, "Season");

    await user.type(queryField(), "season next year");
    await waitFor(() =>
      expect(selectedLabels()).toEqual([cellLabel(base), cellLabel(far)]),
    );
  });

  it("restores the repeat switch when the set comes back inside a year", async () => {
    const { user } = await renderPlayground();
    const far = base.add({ months: 15 });
    await openForm(user, base, far);

    expect(
      (screen.getByRole("switch", { name: "Repeats every year" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await light(user, far);

    const repeats = screen.getByRole("switch", { name: "Repeats every year" });
    expect((repeats as HTMLButtonElement).disabled).toBe(false);
    expect(repeats.getAttribute("aria-checked")).toBe("true");
  });

  it("opens with a single alias row and appends one per press", async () => {
    const { user } = await renderPlayground();
    await openForm(user);

    expect(aliasFields()).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Add an alias" }));
    expect(aliasFields()).toHaveLength(2);
    expect(document.activeElement).toBe(aliasFields()[1]);
  });

  it("teaches the parser the alias, not just the name", async () => {
    const { user } = await renderPlayground();
    await openForm(user);
    await user.type(aliasFields()[0], "Yule");
    await define(user, "Yuletide");

    await user.type(queryField(), "yule");
    await waitFor(() => expect(selectedLabels()).toEqual([cellLabel(base)]));
  });

  it("drops a blank alias row rather than teaching an empty word", async () => {
    const { user } = await renderPlayground();
    await openForm(user);
    await define(user, "Yuletide");

    await user.type(queryField(), "yuletide");
    await waitFor(() => expect(selectedLabels()).toEqual([cellLabel(base)]));
  });

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

  it("names the add chip on hover", async () => {
    const { user } = await renderPlayground();
    await light(user, base);

    await user.hover(screen.getByRole("button", { name: "New named date" }));

    expect(
      screen.getByText("New named date").closest("[data-visible]"),
    ).toBeTruthy();
  });
});
