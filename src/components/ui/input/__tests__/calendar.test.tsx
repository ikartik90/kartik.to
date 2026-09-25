import { act, render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { Calendar } from "../calendar";
import { Field } from "../field";
import { Tooltip } from "@/components/ui/tooltip";
import { parseCalendarDate } from "@/utils/calendar-date";

const TODAY = Temporal.PlainDate.from("2026-12-11");

function calendarTree(
  props: Partial<React.ComponentProps<typeof Calendar>> = {},
  queryParser:
    | ((q: string) => Temporal.PlainDate | null)
    | null = parseCalendarDate("DD/MM/YYYY"),
) {
  return (
    <Calendar today={TODAY} queryParser={queryParser ?? undefined} {...props}>
      <Field.Search placeholder="Type a date…" />
      <Calendar.PeriodList>
        <Calendar.Prev>‹</Calendar.Prev>
        <Calendar.Period>
          <Calendar.Month />
          <Calendar.Week>
            <Calendar.Day />
          </Calendar.Week>
          <Calendar.Grid>
            <Calendar.Date />
          </Calendar.Grid>
        </Calendar.Period>
        <Calendar.Next>›</Calendar.Next>
      </Calendar.PeriodList>
    </Calendar>
  );
}

function renderCalendar(
  props: Partial<React.ComponentProps<typeof Calendar>> = {},
  queryParser?: ((q: string) => Temporal.PlainDate | null) | null,
) {
  return render(<Field>{calendarTree(props, queryParser)}</Field>);
}

/** Live page only: the outgoing copy is aria-hidden, so role queries skip it. */
function monthsOnScreen(): (string | null)[] {
  return screen.getAllByRole("grid").map((g) => g.getAttribute("aria-label"));
}

afterEach(cleanup);

describe("field wiring", () => {
  it("throws when used outside <Field>", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(calendarTree())).toThrow(/must be used within <Field>/);
    spy.mockRestore();
  });

  it("labels the calendar group via Field.Label / Field.Hint", () => {
    render(
      <Field>
        <Field.Label>Trip date</Field.Label>
        {calendarTree()}
        <Field.Hint>Pick a day</Field.Hint>
      </Field>,
    );
    const group = screen.getByRole("group");
    const labelId = group.getAttribute("aria-labelledby");
    const hintId = group.getAttribute("aria-describedby");
    expect(document.getElementById(labelId!)?.textContent).toBe("Trip date");
    expect(document.getElementById(hintId!)?.textContent).toBe("Pick a day");
  });

  it("omits the associations when no label/hint is present", () => {
    renderCalendar();
    const group = screen.getByRole("group");
    expect(group.getAttribute("aria-labelledby")).toBeNull();
    expect(group.getAttribute("aria-describedby")).toBeNull();
  });
});

describe("Calendar composition", () => {
  it("clones one Calendar.Day into the 7 weekday headers", () => {
    renderCalendar();
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(7);
    expect(headers.map((h) => h.getAttribute("data-weekday"))).toEqual([
      "sun", "mon", "tue", "wed", "thu", "fri", "sat",
    ]);
  });

  it("clones one Calendar.Date into a full 42-cell month", () => {
    renderCalendar();
    expect(screen.getAllByRole("gridcell")).toHaveLength(42);
  });

  it("stops the search claiming an intrinsic width of its own", () => {
    renderCalendar();
    expect(screen.getByRole("searchbox").getAttribute("size")).toBe("1");
  });

  it("lets a consumer state their own", () => {
    render(
      <Field>
        <Calendar today={TODAY}>
          <Field.Search size={12} />
        </Calendar>
      </Field>,
    );
    expect(screen.getByRole("searchbox").getAttribute("size")).toBe("12");
  });
});

describe("weekday / weekend attributes", () => {
  it("marks weekend header columns", () => {
    renderCalendar();
    const headers = screen.getAllByRole("columnheader");
    expect(headers[0].hasAttribute("data-weekend")).toBe(true);
    expect(headers[6].hasAttribute("data-weekend")).toBe(true);
    expect(headers[1].hasAttribute("data-weekend")).toBe(false);
  });

  it("tags every day cell with its weekday, weekends flagged", () => {
    renderCalendar();
    const sat = screen.getByRole("gridcell", { name: "December 5, 2026" });
    expect(sat.getAttribute("data-weekday")).toBe("sat");
    expect(sat.hasAttribute("data-weekend")).toBe(true);

    const wed = screen.getByRole("gridcell", { name: "December 9, 2026" });
    expect(wed.getAttribute("data-weekday")).toBe("wed");
    expect(wed.hasAttribute("data-weekend")).toBe(false);
  });
});

describe("today / selection state", () => {
  it("marks today with data-state", () => {
    renderCalendar();
    expect(
      screen
        .getByRole("gridcell", { name: "December 11, 2026" })
        .getAttribute("data-state"),
    ).toBe("today");
  });

  it("reflects the controlled value via aria-selected", () => {
    renderCalendar({ value: Temporal.PlainDate.from("2026-12-05") });
    expect(
      screen
        .getByRole("gridcell", { name: "December 5, 2026" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("flags spill-over days from adjacent months", () => {
    renderCalendar();
    expect(
      screen
        .getByRole("gridcell", { name: "November 29, 2026" })
        .hasAttribute("data-outside"),
    ).toBe(true);
  });
});

describe("selecting a date", () => {
  it("fires onValueChange with the clicked Temporal date", () => {
    const onValueChange = vi.fn();
    renderCalendar({ onValueChange });
    fireEvent.click(screen.getByRole("gridcell", { name: "December 5, 2026" }));
    expect(onValueChange).toHaveBeenCalledOnce();
    expect(onValueChange.mock.calls[0][0].toString()).toBe("2026-12-05");
  });

  it("does not fire for days outside min/max", () => {
    const onValueChange = vi.fn();
    renderCalendar({ onValueChange, min: Temporal.PlainDate.from("2026-12-10") });
    const early = screen.getByRole("gridcell", {
      name: "December 5, 2026",
    }) as HTMLButtonElement;
    expect(early.disabled).toBe(true);
    fireEvent.click(early);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("month navigation", () => {
  it("steps the heading via the Period chevrons", () => {
    renderCalendar();
    expect(screen.getByText("December 2026")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("November 2026")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("January 2027")).toBeTruthy();
  });

  it("keeps a single roving tabstop on the active date", () => {
    renderCalendar({ value: Temporal.PlainDate.from("2026-12-05") });
    const grid = screen.getByRole("grid");
    const tabbable = within(grid)
      .getAllByRole("gridcell")
      .filter((c) => c.getAttribute("tabindex") === "0");
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0].getAttribute("aria-label")).toBe("December 5, 2026");
  });
});

describe("page turn", () => {
  const list = () =>
    screen.getAllByRole("grid")[0].parentElement!.parentElement!;
  const outgoing = () => list().querySelector<HTMLElement>("[data-outgoing]");
  const nav = (name: string) => screen.getByRole("button", { name });

  it("holds the outgoing page beside the incoming one, then drops it", () => {
    vi.useFakeTimers();
    try {
      renderCalendar();
      fireEvent.click(nav("Next month"));
      expect(monthsOnScreen()).toEqual(["January 2027"]);
      expect(within(outgoing()!).getByText("December 2026")).toBeTruthy();
      // 200ms is PUSH_MS.
      act(() => vi.advanceTimersByTime(199));
      expect(outgoing()).toBeTruthy();
      act(() => vi.advanceTimersByTime(1));
      expect(outgoing()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("pushes from the side the range is travelling toward", () => {
    renderCalendar();
    fireEvent.click(nav("Next month"));
    expect(list().style.getPropertyValue("--calendar-push")).toBe("100%");
    fireEvent.click(nav("Previous month"));
    expect(list().style.getPropertyValue("--calendar-push")).toBe("-100%");
  });

  it("travels by the step, not by the width of the range", () => {
    renderCalendar({ months: 3, step: 1 });
    fireEvent.click(nav("Next month"));
    expect(list().style.getPropertyValue("--calendar-push")).toBe("100%");
    cleanup();

    renderCalendar({ months: 3 });
    fireEvent.click(nav("Next 3 months"));
    expect(list().style.getPropertyValue("--calendar-push")).toBe("300%");
  });

  it("keeps the outgoing page out of the a11y tree and the tab order", () => {
    renderCalendar();
    fireEvent.click(nav("Next month"));
    expect(outgoing()!.getAttribute("aria-hidden")).toBe("true");
    expect(outgoing()!.hasAttribute("inert")).toBe(true);
    expect(screen.getAllByRole("grid")).toHaveLength(1);
    expect(screen.getAllByRole("gridcell")).toHaveLength(42);
  });

  it("turns no page when the view stands still", () => {
    renderCalendar({ months: 3 });
    fireEvent.click(
      screen.getAllByRole("gridcell", { name: "February 10, 2027" })[0],
    );
    expect(outgoing()).toBeNull();
  });

  it("turns the page for a search that lands off the range", () => {
    renderCalendar();
    fireEvent.input(screen.getByRole("searchbox"), {
      target: { value: "05/06/2027" },
    });
    expect(monthsOnScreen()).toEqual(["June 2027"]);
    expect(within(outgoing()!).getByText("December 2026")).toBeTruthy();
    expect(list().style.getPropertyValue("--calendar-push")).toBe("100%");
  });
});

describe("paging step", () => {
  const range = (props: Partial<React.ComponentProps<typeof Calendar>>) =>
    render(
      <Field>
        <Calendar today={TODAY} months={3} {...props}>
          <Calendar.PeriodList>
            <Calendar.Prev>‹</Calendar.Prev>
            <Calendar.Period>
              <Calendar.Month />
              <Calendar.Week>
                <Calendar.Day />
              </Calendar.Week>
              <Calendar.Grid>
                <Calendar.Date />
              </Calendar.Grid>
            </Calendar.Period>
            <Calendar.Next>›</Calendar.Next>
          </Calendar.PeriodList>
        </Calendar>
      </Field>,
    );

  it("pages a whole range at a time by default", () => {
    range({});
    expect(screen.getByText("December 2026")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next 3 months" }));
    expect(monthsOnScreen()).toEqual(["March 2027", "April 2027", "May 2027"]);
  });

  it("walks one month at a time when step is 1", () => {
    range({ step: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(monthsOnScreen()).toEqual([
      "January 2027",
      "February 2027",
      "March 2027",
    ]);
  });

  it("steps back by the same one month", () => {
    range({ step: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(monthsOnScreen()).toEqual([
      "December 2026",
      "January 2027",
      "February 2027",
    ]);
  });

  it("names the chevrons after the step, not the range", () => {
    range({ step: 1 });
    expect(screen.getByRole("button", { name: "Next month" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next 3 months" })).toBeNull();
  });
});

describe("nav role declaration", () => {
  const period = (
    <Calendar.Period>
      <Calendar.Month />
      <Calendar.Week>
        <Calendar.Day />
      </Calendar.Week>
      <Calendar.Grid>
        <Calendar.Date />
      </Calendar.Grid>
    </Calendar.Period>
  );

  it("reads the role from the part, not the sibling order", () => {
    render(
      <Field>
        <Calendar today={TODAY}>
          <Calendar.PeriodList>
            <Calendar.Next>›</Calendar.Next>
            <Calendar.Prev>‹</Calendar.Prev>
            {period}
          </Calendar.PeriodList>
        </Calendar>
      </Field>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("January 2027")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("December 2026")).toBeTruthy();
  });

  it("works nested inside a consumer's own facade, outside the list", () => {
    render(
      <Field>
        <Calendar today={TODAY}>
          <div>
            <section>
              <Calendar.Prev>‹</Calendar.Prev>
            </section>
          </div>
          <Calendar.PeriodList>{period}</Calendar.PeriodList>
        </Calendar>
      </Field>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("November 2026")).toBeTruthy();
  });

  it("names itself for the size of the range", () => {
    render(
      <Field>
        <Calendar today={TODAY} months={3}>
          <Calendar.PeriodList>
            <Calendar.Prev>‹</Calendar.Prev>
            {period}
            <Calendar.Next>›</Calendar.Next>
          </Calendar.PeriodList>
        </Calendar>
      </Field>,
    );
    expect(
      screen.getByRole("button", { name: "Previous 3 months" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next 3 months" })).toBeTruthy();
  });

  it("lets a consumer override the handler and the label", () => {
    const onClick = vi.fn();
    render(
      <Field>
        <Calendar today={TODAY}>
          <Calendar.PeriodList>
            <Calendar.Prev onClick={onClick} aria-label="Back a month">
              ‹
            </Calendar.Prev>
            {period}
          </Calendar.PeriodList>
        </Calendar>
      </Field>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Back a month" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByText("December 2026")).toBeTruthy();
  });

  it("tags itself so the list can pin it to the right corner", () => {
    renderCalendar();
    const prev = screen
      .getByRole("button", { name: "Previous month" })
      .closest("[data-nav]");
    const next = screen
      .getByRole("button", { name: "Next month" })
      .closest("[data-nav]");
    expect(prev?.getAttribute("data-nav")).toBe("prev");
    expect(next?.getAttribute("data-nav")).toBe("next");
  });

  it("throws when used outside <Calendar>", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Calendar.Prev>‹</Calendar.Prev>)).toThrow(
      /must be used within <Calendar>/,
    );
    spy.mockRestore();
  });
});

describe("multi-month ranges", () => {
  const tabstops = () =>
    screen
      .getAllByRole("gridcell")
      .filter((c) => c.getAttribute("tabindex") === "0");

  it("clones the one Period template into a grid per month", () => {
    renderCalendar({ months: 3 });
    expect(screen.getAllByRole("grid")).toHaveLength(3);
    expect(screen.getAllByRole("gridcell")).toHaveLength(126);
    expect(screen.getAllByRole("columnheader")).toHaveLength(21);
  });

  it("labels each period with its own month, not the view's", () => {
    renderCalendar({ months: 3 });
    expect(screen.getByText("December 2026")).toBeTruthy();
    expect(screen.getByText("January 2027")).toBeTruthy();
    expect(screen.getByText("February 2027")).toBeTruthy();
  });

  it("pages a whole range at a time", () => {
    renderCalendar({ months: 3 });
    fireEvent.click(screen.getByRole("button", { name: "Previous 3 months" }));
    expect(monthsOnScreen()).toEqual([
      "September 2026",
      "October 2026",
      "November 2026",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Next 3 months" }));
    expect(monthsOnScreen()).toEqual([
      "December 2026",
      "January 2027",
      "February 2027",
    ]);
  });

  it("keeps ONE roving tabstop across the range, not one per grid", () => {
    renderCalendar({ months: 3, value: Temporal.PlainDate.from("2027-01-05") });
    const stops = tabstops();
    expect(stops).toHaveLength(1);
    expect(stops[0].getAttribute("aria-label")).toBe("January 5, 2027");
  });

  it("does not duplicate the tabstop onto a spill-day twin", () => {
    renderCalendar({ months: 2, value: Temporal.PlainDate.from("2026-12-31") });
    expect(
      screen.getAllByRole("gridcell", { name: "December 31, 2026" }),
    ).toHaveLength(2);
    const stops = tabstops();
    expect(stops).toHaveLength(1);
    expect(stops[0].hasAttribute("data-outside")).toBe(false);
  });

  it("marks only the owning month's copy as selected", () => {
    renderCalendar({ months: 2, value: Temporal.PlainDate.from("2026-12-31") });
    const selected = screen
      .getAllByRole("gridcell", { name: "December 31, 2026" })
      .filter((c) => c.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(1);
    expect(selected[0].hasAttribute("data-outside")).toBe(false);
  });

  it("marks only the owning month's copy as today", () => {
    renderCalendar({
      months: 2,
      today: Temporal.PlainDate.from("2026-12-31"),
      value: Temporal.PlainDate.from("2026-12-01"),
    });
    const todays = screen
      .getAllByRole("gridcell")
      .filter((c) => c.getAttribute("data-state") === "today");
    expect(todays).toHaveLength(1);
    expect(todays[0].hasAttribute("data-outside")).toBe(false);
  });

  it("marks only the owning month's copy as the query", () => {
    renderCalendar({ months: 2 });
    fireEvent.input(screen.getByRole("searchbox"), {
      target: { value: "31/12/2026" },
    });
    const marked = screen
      .getAllByRole("gridcell")
      .filter((c) => c.hasAttribute("data-query"));
    expect(marked).toHaveLength(1);
    expect(marked[0].hasAttribute("data-outside")).toBe(false);
  });

  it("does not page when the clicked date is already on screen", () => {
    renderCalendar({ months: 3 });
    fireEvent.click(
      screen.getAllByRole("gridcell", { name: "February 10, 2027" })[0],
    );
    expect(screen.getByText("December 2026")).toBeTruthy();
    expect(screen.getByText("February 2027")).toBeTruthy();
  });

  it("pages an off-range date into the first slot", () => {
    renderCalendar({ months: 3 });
    fireEvent.input(screen.getByRole("searchbox"), {
      target: { value: "05/06/2027" },
    });
    expect(screen.getByText("June 2027")).toBeTruthy();
    expect(screen.getByText("August 2027")).toBeTruthy();
    expect(screen.queryByText("May 2027")).toBeNull();
  });

  it("names the nav for a single month when the range is one", () => {
    renderCalendar();
    expect(screen.getByRole("button", { name: "Previous month" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next month" })).toBeTruthy();
  });
});

describe("Calendar.Month formatting", () => {
  function renderMonth(monthFormat?: "full" | "narrow") {
    return render(
      <Field>
        <Calendar today={TODAY}>
          <Calendar.PeriodList>
            <Calendar.Period>
              <Calendar.Month monthFormat={monthFormat} />
              <Calendar.Week>
                <Calendar.Day />
              </Calendar.Week>
              <Calendar.Grid>
                <Calendar.Date />
              </Calendar.Grid>
            </Calendar.Period>
          </Calendar.PeriodList>
        </Calendar>
      </Field>,
    );
  }

  it("writes the full month name by default", () => {
    renderMonth();
    expect(screen.getByText("December 2026")).toBeTruthy();
  });

  it("abbreviates to three letters when narrow", () => {
    renderMonth("narrow");
    expect(screen.getByText("Dec 2026")).toBeTruthy();
  });

  it("keeps the grid's accessible name unabbreviated", () => {
    renderMonth("narrow");
    expect(screen.getByRole("grid").getAttribute("aria-label")).toBe(
      "December 2026",
    );
  });
});

describe("search", () => {
  const type = (value: string) =>
    fireEvent.input(screen.getByRole("searchbox"), { target: { value } });

  it("navigates to a typed date without selecting it", () => {
    const onValueChange = vi.fn();
    renderCalendar({ onValueChange });
    expect(screen.getByText("December 2026")).toBeTruthy();

    type("05/01/2027");

    expect(screen.getByText("January 2027")).toBeTruthy();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("gridcell", { selected: true })).toBeNull();
  });

  it("selects the typed date on Enter", () => {
    const onValueChange = vi.fn();
    renderCalendar({ onValueChange });
    type("05/01/2027");
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });

    expect(onValueChange).toHaveBeenCalledOnce();
    expect(onValueChange.mock.calls[0][0].toString()).toBe("2027-01-05");
  });

  it("ignores input that is not yet a date", () => {
    const onValueChange = vi.fn();
    renderCalendar({ onValueChange });
    for (const partial of ["0", "05/", "05/01/20", "31/11/2026"]) {
      type(partial);
      fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    }
    expect(screen.getByText("December 2026")).toBeTruthy();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("honours min/max on Enter, like a clicked cell", () => {
    const onValueChange = vi.fn();
    renderCalendar({
      onValueChange,
      min: Temporal.PlainDate.from("2026-12-10"),
    });
    type("05/12/2026");
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("reads the typed date with the Calendar's parser", () => {
    const onValueChange = vi.fn();
    renderCalendar({ onValueChange }, parseCalendarDate("MM/DD/YYYY"));
    type("05/01/2027");
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    expect(onValueChange.mock.calls[0][0].toString()).toBe("2027-05-01");
  });

  it("does not navigate without a queryParser (a bare search is dumb)", () => {
    const onValueChange = vi.fn();
    renderCalendar({ onValueChange }, null);
    type("05/01/2027");
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    expect(screen.getByText("December 2026")).toBeTruthy();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("leaves a consumer's own Field.Search handlers intact", () => {
    const onValueChange = vi.fn();
    const onKeyDown = vi.fn();
    render(
      <Field>
        <Calendar today={TODAY} queryParser={parseCalendarDate("DD/MM/YYYY")}>
          <Field.Search
            onValueChange={onValueChange}
            onKeyDown={onKeyDown}
          />
          <Calendar.PeriodList>
            <Calendar.Prev>‹</Calendar.Prev>
            <Calendar.Period>
              <Calendar.Month />
              <Calendar.Week>
                <Calendar.Day />
              </Calendar.Week>
              <Calendar.Grid>
                <Calendar.Date />
              </Calendar.Grid>
            </Calendar.Period>
            <Calendar.Next>›</Calendar.Next>
          </Calendar.PeriodList>
        </Calendar>
      </Field>,
    );
    type("05/01/2027");
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });

    expect(onValueChange).toHaveBeenCalledWith("05/01/2027");
    expect(onKeyDown).toHaveBeenCalledOnce();
    expect(screen.getByText("January 2027")).toBeTruthy();
  });
});

describe("search preview", () => {
  const type = (value: string) =>
    fireEvent.input(screen.getByRole("searchbox"), { target: { value } });
  const queried = () =>
    screen
      .getAllByRole("gridcell")
      .filter((c) => c.hasAttribute("data-query"))
      .map((c) => c.getAttribute("aria-label"));

  it("marks the typed date so it can be previewed before committing", () => {
    renderCalendar();
    expect(queried()).toEqual([]);
    type("05/01/2027");
    expect(queried()).toEqual(["January 5, 2027"]);
  });

  it("clears the mark when the query stops resolving", () => {
    renderCalendar();
    type("05/01/2027");
    type("05/01/20");
    expect(queried()).toEqual([]);
    type("");
    expect(queried()).toEqual([]);
  });

  it("drops the mark when the query is paged out of view", () => {
    renderCalendar();
    type("05/01/2027");
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("February 2027")).toBeTruthy();
    expect(queried()).toEqual([]);
  });

  it("moves the roving tabstop onto the typed date", () => {
    renderCalendar({ value: Temporal.PlainDate.from("2026-12-05") });
    type("05/01/2027");
    const tabbable = screen
      .getAllByRole("gridcell")
      .filter((c) => c.getAttribute("tabindex") === "0");
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0].getAttribute("aria-label")).toBe("January 5, 2027");
  });

  it("still marks a date that min/max makes uncommittable", () => {
    renderCalendar({ min: Temporal.PlainDate.from("2026-12-10") });
    type("05/12/2026");
    const cell = screen.getByRole("gridcell", {
      name: "December 5, 2026",
    }) as HTMLButtonElement;
    expect(cell.hasAttribute("data-query")).toBe(true);
    expect(cell.disabled).toBe(true);
  });
});

describe("custom queryParser", () => {
  function renderWithParser(queryParser: (q: string) => Temporal.PlainDate | null) {
    const onValueChange = vi.fn();
    render(
      <Field>
        <Calendar
          today={TODAY}
          onValueChange={onValueChange}
          queryParser={queryParser}
        >
          <Field.Search />
          <Calendar.PeriodList>
            <Calendar.Prev>‹</Calendar.Prev>
            <Calendar.Period>
              <Calendar.Month />
              <Calendar.Week>
                <Calendar.Day />
              </Calendar.Week>
              <Calendar.Grid>
                <Calendar.Date />
              </Calendar.Grid>
            </Calendar.Period>
            <Calendar.Next>›</Calendar.Next>
          </Calendar.PeriodList>
        </Calendar>
      </Field>,
    );
    return { onValueChange };
  }

  const xmas = (q: string) =>
    q.trim().toLowerCase() === "xmas"
      ? Temporal.PlainDate.from("2027-12-25")
      : null;

  it("navigates via the consumer's parser, not the format", () => {
    renderWithParser(xmas);
    fireEvent.input(screen.getByRole("searchbox"), { target: { value: "xmas" } });
    expect(screen.getByText("December 2027")).toBeTruthy();
  });

  it("commits the consumer-parsed date on Enter", () => {
    const { onValueChange } = renderWithParser(xmas);
    fireEvent.input(screen.getByRole("searchbox"), { target: { value: "xmas" } });
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    expect(onValueChange.mock.calls[0][0].toString()).toBe("2027-12-25");
  });

  it("ignores queries the consumer's parser rejects", () => {
    const { onValueChange } = renderWithParser(xmas);
    fireEvent.input(screen.getByRole("searchbox"), { target: { value: "11/12/2026" } });
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    expect(screen.getByText("December 2026")).toBeTruthy();
    expect(onValueChange).not.toHaveBeenCalled();
  });
})

function multiTree(props: Partial<React.ComponentProps<typeof Calendar>> = {}) {
  return (
    <Field>
      <Calendar today={TODAY} selectionMode="multiple" {...props}>
        <Calendar.PeriodList>
          <Calendar.Prev>‹</Calendar.Prev>
          <Calendar.Period>
            <Calendar.Month />
            <Calendar.Week>
              <Calendar.Day />
            </Calendar.Week>
            <Calendar.Grid>
              <Calendar.Date />
            </Calendar.Grid>
          </Calendar.Period>
          <Calendar.Next>›</Calendar.Next>
        </Calendar.PeriodList>
      </Calendar>
    </Field>
  );
}

const renderMulti = (props: Partial<React.ComponentProps<typeof Calendar>> = {}) =>
  render(multiTree(props));

/** The owned cell for a date; a spill copy shares its accessible name. */
function cell(name: string): HTMLButtonElement {
  const matches = screen.getAllByRole("gridcell", { name });
  const owned = matches.find((c) => !c.hasAttribute("data-outside"));
  return (owned ?? matches[0]) as HTMLButtonElement;
}

const iso = (dates: Temporal.PlainDate[]) => dates.map((d) => d.toString());

const selected = () =>
  screen
    .getAllByRole("gridcell")
    .filter((c) => c.getAttribute("aria-selected") === "true")
    .map((c) => c.getAttribute("data-date"));

// jsdom lays nothing out, so the cells get a synthetic 7-column grid for the overlap maths.
const CELL = 24;
const PITCH = 28;
const MONTH_OFFSET = 250;

function layoutGrids() {
  screen.getAllByRole("grid").forEach((grid, monthIndex) => {
    [...grid.children].forEach((cell, i) => {
      const left = monthIndex * MONTH_OFFSET + (i % 7) * PITCH;
      const top = Math.floor(i / 7) * PITCH;
      (cell as HTMLElement).getBoundingClientRect = () =>
        ({
          left, top, right: left + CELL, bottom: top + CELL,
          width: CELL, height: CELL, x: left, y: top,
          toJSON: () => {},
        }) as DOMRect;
    });
  });
}

function centre(name: string): { x: number; y: number } {
  const box = cell(name).getBoundingClientRect();
  return { x: box.left + CELL / 2, y: box.top + CELL / 2 };
}

function marquee(from: string, to: string) {
  const a = centre(from);
  const b = centre(to);
  fireEvent.pointerDown(cell(from), {
    pointerType: "mouse", button: 0, clientX: a.x, clientY: a.y,
  });
  fireEvent.pointerMove(window, { clientX: b.x, clientY: b.y });
  fireEvent.pointerUp(window);
}

describe("multiple selection", () => {
  it("toggles a date on click and reports the whole selection", () => {
    const onValuesChange = vi.fn();
    renderMulti({ onValuesChange });

    fireEvent.click(cell("December 5, 2026"));
    expect(iso(onValuesChange.mock.calls[0][0])).toEqual(["2026-12-05"]);

    fireEvent.click(cell("December 9, 2026"));
    expect(iso(onValuesChange.mock.calls[1][0])).toEqual([
      "2026-12-05",
      "2026-12-09",
    ]);
  });

  it("clicking a selected date deselects it", () => {
    const onValuesChange = vi.fn();
    renderMulti({
      values: [Temporal.PlainDate.from("2026-12-05")],
      onValuesChange,
    });
    fireEvent.click(cell("December 5, 2026"));
    expect(iso(onValuesChange.mock.calls[0][0])).toEqual([]);
  });

  it("marks every selected date with aria-selected", () => {
    renderMulti({
      values: [
        Temporal.PlainDate.from("2026-12-05"),
        Temporal.PlainDate.from("2026-12-09"),
      ],
    });
    expect(cell("December 5, 2026").getAttribute("aria-selected")).toBe("true");
    expect(cell("December 9, 2026").getAttribute("aria-selected")).toBe("true");
    expect(cell("December 6, 2026").getAttribute("aria-selected")).toBe("false");
  });

  it("keeps the returned selection in chronological order", () => {
    const onValuesChange = vi.fn();
    renderMulti({
      values: [Temporal.PlainDate.from("2026-12-20")],
      onValuesChange,
    });
    fireEvent.click(cell("December 3, 2026"));
    expect(iso(onValuesChange.mock.calls[0][0])).toEqual([
      "2026-12-03",
      "2026-12-20",
    ]);
  });

  it("never fires the single-select callback", () => {
    const onValueChange = vi.fn();
    renderMulti({ onValueChange });
    fireEvent.click(cell("December 5, 2026"));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("leaves min/max-disabled dates untoggleable", () => {
    const onValuesChange = vi.fn();
    renderMulti({ onValuesChange, min: Temporal.PlainDate.from("2026-12-10") });
    fireEvent.click(cell("December 5, 2026"));
    expect(onValuesChange).not.toHaveBeenCalled();
  });

  it("holds its own selection when uncontrolled", () => {
    renderMulti({ defaultValues: [Temporal.PlainDate.from("2026-12-05")] });
    fireEvent.click(cell("December 9, 2026"));
    expect(cell("December 5, 2026").getAttribute("aria-selected")).toBe("true");
    expect(cell("December 9, 2026").getAttribute("aria-selected")).toBe("true");
  });
});

describe("single selection is unchanged by the new mode", () => {
  it("still replaces the selection rather than accumulating", () => {
    const onValueChange = vi.fn();
    renderCalendar({ onValueChange });
    fireEvent.click(screen.getByRole("gridcell", { name: "December 5, 2026" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "December 9, 2026" }));
    expect(onValueChange).toHaveBeenCalledTimes(2);
    expect(
      screen
        .getByRole("gridcell", { name: "December 5, 2026" })
        .getAttribute("aria-selected"),
    ).toBe("false");
  });

  it("ignores a marquee drag entirely", () => {
    const onValueChange = vi.fn();
    renderCalendar({ onValueChange });
    fireEvent.pointerDown(
      screen.getByRole("gridcell", { name: "December 5, 2026" }),
      { pointerType: "mouse", button: 0, clientX: 0, clientY: 0 },
    );
    fireEvent.pointerMove(window, { clientX: 200, clientY: 200 });
    fireEvent.pointerUp(window);
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("marquee drag", () => {
  it("toggles every cell the band overlaps, both ends included", () => {
    renderMulti();
    layoutGrids();
    marquee("December 7, 2026", "December 9, 2026");
    expect(selected()).toEqual(["2026-12-07", "2026-12-08", "2026-12-09"]);
  });

  it("takes a BLOCK when the band spans rows, not just the cursor's path", () => {
    renderMulti();
    layoutGrids();
    marquee("December 7, 2026", "December 15, 2026");
    expect(selected()).toEqual([
      "2026-12-07", "2026-12-08",
      "2026-12-14", "2026-12-15",
    ]); // prettier-ignore
  });

  it("counts a PARTIAL overlap — a band clipping a cell's corner takes it", () => {
    renderMulti();
    layoutGrids();
    const a = centre("December 7, 2026");
    fireEvent.pointerDown(cell("December 7, 2026"), {
      pointerType: "mouse", button: 0, clientX: a.x, clientY: a.y,
    });
    fireEvent.pointerMove(window, { clientX: a.x + PITCH - 1, clientY: a.y });
    fireEvent.pointerUp(window);
    expect(selected()).toEqual(["2026-12-07", "2026-12-08"]);
  });

  it("works in every direction — an up-left drag equals its down-right mirror", () => {
    renderMulti();
    layoutGrids();
    marquee("December 9, 2026", "December 7, 2026");
    expect(selected()).toEqual(["2026-12-07", "2026-12-08", "2026-12-09"]);
  });

  it("reverts a cell when the band retreats back off it", () => {
    renderMulti();
    layoutGrids();
    const a = centre("December 7, 2026");
    const far = centre("December 9, 2026");
    const near = centre("December 8, 2026");
    fireEvent.pointerDown(cell("December 7, 2026"), {
      pointerType: "mouse", button: 0, clientX: a.x, clientY: a.y,
    });
    fireEvent.pointerMove(window, { clientX: far.x, clientY: far.y });
    expect(selected()).toEqual(["2026-12-07", "2026-12-08", "2026-12-09"]);
    fireEvent.pointerMove(window, { clientX: near.x, clientY: near.y });
    expect(selected()).toEqual(["2026-12-07", "2026-12-08"]);
    fireEvent.pointerUp(window);
  });

  it("toggles AGAINST the selection the drag started from", () => {
    renderMulti({
      defaultValues: [
        Temporal.PlainDate.from("2026-12-07"),
        Temporal.PlainDate.from("2026-12-08"),
      ],
    });
    layoutGrids();
    marquee("December 7, 2026", "December 9, 2026");
    expect(selected()).toEqual(["2026-12-09"]);
  });

  it("reports the whole selection once per band change", () => {
    const onValuesChange = vi.fn();
    renderMulti({ onValuesChange });
    layoutGrids();
    marquee("December 7, 2026", "December 8, 2026");
    expect(iso(onValuesChange.mock.lastCall![0])).toEqual([
      "2026-12-07",
      "2026-12-08",
    ]);
  });

  it("spans the months of a multi-month range", () => {
    renderMulti({ months: 2 });
    layoutGrids();
    marquee("December 1, 2026", "January 2, 2027");
    expect(selected()).toEqual([
      "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05",
      "2027-01-01", "2027-01-02",
    ]); // prettier-ignore
  });

  it("leaves a press with no movement to the click handler", () => {
    renderMulti();
    layoutGrids();
    const a = centre("December 7, 2026");
    fireEvent.pointerDown(cell("December 7, 2026"), {
      pointerType: "mouse", button: 0, clientX: a.x, clientY: a.y,
    });
    fireEvent.pointerMove(window, { clientX: a.x + 1, clientY: a.y + 1 });
    fireEvent.pointerUp(window);
    expect(selected()).toEqual([]);
    fireEvent.click(cell("December 7, 2026"), { detail: 1 });
    expect(selected()).toEqual(["2026-12-07"]);
  });

  it("does not double-toggle via the trailing click after a real drag", () => {
    renderMulti();
    layoutGrids();
    marquee("December 7, 2026", "December 8, 2026");
    fireEvent.click(cell("December 7, 2026"), { detail: 1 });
    expect(selected()).toEqual(["2026-12-07", "2026-12-08"]);
  });

  it("ignores pointer movement after the button is released", () => {
    renderMulti();
    layoutGrids();
    marquee("December 7, 2026", "December 8, 2026");
    const far = centre("December 16, 2026");
    fireEvent.pointerMove(window, { clientX: far.x, clientY: far.y });
    expect(selected()).toEqual(["2026-12-07", "2026-12-08"]);
  });

  it("never takes a min/max-disabled date into the band", () => {
    renderMulti({ min: Temporal.PlainDate.from("2026-12-08") });
    layoutGrids();
    marquee("December 7, 2026", "December 9, 2026");
    expect(selected()).toEqual(["2026-12-08", "2026-12-09"]);
  });

  it("never takes a spill-over copy, so a boundary date can't toggle twice", () => {
    renderMulti({ months: 2 });
    layoutGrids();
    marquee("December 1, 2026", "January 2, 2027");
    const taken = selected();
    for (const day of ["27", "28", "29", "30", "31"]) {
      expect(taken).not.toContain(`2026-12-${day}`);
    }
  });

  it("does not drag on a touch pointer — tap-to-toggle only", () => {
    renderMulti();
    layoutGrids();
    const a = centre("December 7, 2026");
    const b = centre("December 9, 2026");
    fireEvent.pointerDown(cell("December 7, 2026"), {
      pointerType: "touch", clientX: a.x, clientY: a.y,
    });
    fireEvent.pointerMove(window, { clientX: b.x, clientY: b.y });
    fireEvent.pointerUp(window);
    expect(selected()).toEqual([]);
    fireEvent.click(cell("December 7, 2026"), { detail: 1 });
    expect(selected()).toEqual(["2026-12-07"]);
  });

  it("ignores a non-primary button", () => {
    renderMulti();
    layoutGrids();
    const a = centre("December 7, 2026");
    const b = centre("December 9, 2026");
    fireEvent.pointerDown(cell("December 7, 2026"), {
      pointerType: "mouse", button: 2, clientX: a.x, clientY: a.y,
    });
    fireEvent.pointerMove(window, { clientX: b.x, clientY: b.y });
    expect(selected()).toEqual([]);
  });
});

describe("dragging from outside a day cell", () => {
  const list = () => screen.getAllByRole("grid")[0].parentElement!.parentElement!;

  function marqueeFromList(at: { x: number; y: number }, to: string) {
    const b = centre(to);
    fireEvent.pointerDown(list(), {
      pointerType: "mouse",
      button: 0,
      clientX: at.x,
      clientY: at.y,
    });
    fireEvent.pointerMove(window, { clientX: b.x, clientY: b.y });
    fireEvent.pointerUp(window);
  }

  it("starts a band from empty space in the period list", () => {
    renderMulti();
    layoutGrids();
    marqueeFromList({ x: -20, y: -20 }, "December 1, 2026");
    expect(selected()).toContain("2026-12-01");
  });

  it("takes every cell between the empty-space origin and the pointer", () => {
    renderMulti();
    layoutGrids();
    marqueeFromList({ x: -20, y: -20 }, "December 2, 2026");
    expect(selected()).toEqual(["2026-12-01", "2026-12-02"]);
  });

  it("does not start a band when the press lands on a nav chevron", () => {
    renderMulti();
    layoutGrids();
    const chevron = screen.getByRole("button", { name: "Previous month" });
    const to = centre("December 9, 2026");
    fireEvent.pointerDown(chevron, {
      pointerType: "mouse",
      button: 0,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(window, { clientX: to.x, clientY: to.y });
    fireEvent.pointerUp(window);
    expect(selected()).toEqual([]);
  });
});

describe("the drag band", () => {
  const marqueeEl = () =>
    document.querySelector("[class*=marquee]") as HTMLElement | null;

  it("is absent until a drag actually starts", () => {
    renderMulti();
    layoutGrids();
    expect(marqueeEl()).toBeNull();
  });

  it("is drawn between the press point and the pointer while dragging", () => {
    renderMulti();
    layoutGrids();
    const a = centre("December 7, 2026");
    const b = centre("December 9, 2026");
    fireEvent.pointerDown(cell("December 7, 2026"), {
      pointerType: "mouse",
      button: 0,
      clientX: a.x,
      clientY: a.y,
    });
    fireEvent.pointerMove(window, { clientX: b.x, clientY: b.y });

    const box = marqueeEl();
    expect(box).not.toBeNull();
    // jsdom's zero-origin list rect makes list-relative equal client coordinates.
    expect(box!.style.left).toBe(`${Math.min(a.x, b.x)}px`);
    expect(box!.style.width).toBe(`${Math.abs(b.x - a.x)}px`);
    expect(box!.style.height).toBe(`${Math.abs(b.y - a.y)}px`);
    fireEvent.pointerUp(window);
  });

  it("normalises so an up-left drag draws the same box as its mirror", () => {
    renderMulti();
    layoutGrids();
    const a = centre("December 16, 2026");
    const b = centre("December 7, 2026");
    fireEvent.pointerDown(cell("December 16, 2026"), {
      pointerType: "mouse",
      button: 0,
      clientX: a.x,
      clientY: a.y,
    });
    fireEvent.pointerMove(window, { clientX: b.x, clientY: b.y });

    const box = marqueeEl();
    expect(box!.style.left).toBe(`${Math.min(a.x, b.x)}px`);
    expect(box!.style.top).toBe(`${Math.min(a.y, b.y)}px`);
    fireEvent.pointerUp(window);
  });

  it("disappears when the pointer is released", () => {
    renderMulti();
    layoutGrids();
    marquee("December 7, 2026", "December 9, 2026");
    expect(marqueeEl()).toBeNull();
  });

  it("stays hidden for a press that never clears the drag threshold", () => {
    renderMulti();
    layoutGrids();
    const a = centre("December 7, 2026");
    fireEvent.pointerDown(cell("December 7, 2026"), {
      pointerType: "mouse",
      button: 0,
      clientX: a.x,
      clientY: a.y,
    });
    fireEvent.pointerMove(window, { clientX: a.x + 1, clientY: a.y });
    expect(marqueeEl()).toBeNull();
    fireEvent.pointerUp(window);
  });
});

describe("the sweep hint", () => {
  const HINT = "Drag to select multiple";

  function renderHinted(props: Partial<React.ComponentProps<typeof Calendar>> = {}) {
    return render(
      <Field>
        <Calendar today={TODAY} selectionMode="multiple" {...props}>
          <Calendar.PeriodList>
            <Calendar.Tooltip>
              <Tooltip.Text>{HINT}</Tooltip.Text>
            </Calendar.Tooltip>
            <Calendar.Prev>‹</Calendar.Prev>
            <Calendar.Period>
              <Calendar.Month />
              <Calendar.Week>
                <Calendar.Day />
              </Calendar.Week>
              <Calendar.Grid>
                <Calendar.Date />
              </Calendar.Grid>
            </Calendar.Period>
            <Calendar.Next>›</Calendar.Next>
          </Calendar.PeriodList>
        </Calendar>
      </Field>,
    );
  }

  const list = () => screen.getAllByRole("grid")[0].parentElement!.parentElement!;
  const hint = () => screen.getByText(HINT).parentElement as HTMLElement;
  const showing = () => hint().hasAttribute("data-visible");

  const enter = () =>
    fireEvent.mouseEnter(list(), { clientX: 40, clientY: 40 });

  it("renders decoratively, and stays hidden until the pointer arrives", () => {
    renderHinted();
    expect(hint().getAttribute("aria-hidden")).toBe("true");
    expect(showing()).toBe(false);
  });

  it("appears while the pointer is over the draggable area", () => {
    renderHinted();
    enter();
    expect(showing()).toBe(true);
  });

  it("follows the cursor, like every other tooltip here", () => {
    renderHinted();
    fireEvent.mouseEnter(list(), { clientX: 100, clientY: 200 });
    // CURSOR_TOOLTIP_OFFSET is (15, 17).
    expect(hint().style.left).toBe("115px");
    expect(hint().style.top).toBe("217px");
  });

  it("withdraws itself after three seconds of pointing", () => {
    vi.useFakeTimers();
    try {
      renderHinted();
      enter();
      act(() => vi.advanceTimersByTime(2999));
      expect(showing()).toBe(true);
      act(() => vi.advanceTimersByTime(1));
      expect(showing()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("goes away when the pointer leaves", () => {
    renderHinted();
    enter();
    fireEvent.mouseLeave(list());
    expect(showing()).toBe(false);
  });

  it("retires on the first real drag, and never comes back", () => {
    renderHinted();
    layoutGrids();
    enter();
    expect(showing()).toBe(true);

    marquee("December 7, 2026", "December 9, 2026");
    expect(showing()).toBe(false);

    fireEvent.mouseLeave(list());
    enter();
    expect(showing()).toBe(false);
  });

  it("survives a press that never became a drag", () => {
    renderHinted();
    layoutGrids();
    enter();
    const a = centre("December 7, 2026");
    fireEvent.pointerDown(cell("December 7, 2026"), {
      pointerType: "mouse", button: 0, clientX: a.x, clientY: a.y,
    });
    fireEvent.pointerMove(window, { clientX: a.x + 1, clientY: a.y });
    fireEvent.pointerUp(window);
    expect(showing()).toBe(true);
  });

  it("stays down when there is no sweep to teach", () => {
    renderHinted({ sweep: false });
    enter();
    expect(showing()).toBe(false);
  });

  it("stays down in single-selection mode, which never had a sweep", () => {
    renderHinted({ selectionMode: "single" });
    enter();
    expect(showing()).toBe(false);
  });

  it("leaves a hintless calendar alone", () => {
    renderMulti();
    expect(() => fireEvent.mouseEnter(list())).not.toThrow();
    expect(document.querySelector("[class*=tooltip]")).toBeNull();
  });
});

describe("keyboard grid navigation", () => {
  it("moves the roving tabstop with the arrow keys", () => {
    renderMulti({ values: [Temporal.PlainDate.from("2026-12-09")] });
    const start = cell("December 9, 2026");
    expect(start.getAttribute("tabindex")).toBe("0");

    fireEvent.keyDown(start, { key: "ArrowRight" });
    expect(cell("December 10, 2026").getAttribute("tabindex")).toBe("0");
    expect(cell("December 9, 2026").getAttribute("tabindex")).toBe("-1");

    fireEvent.keyDown(cell("December 10, 2026"), { key: "ArrowDown" });
    expect(cell("December 17, 2026").getAttribute("tabindex")).toBe("0");

    fireEvent.keyDown(cell("December 17, 2026"), { key: "ArrowUp" });
    fireEvent.keyDown(cell("December 10, 2026"), { key: "ArrowLeft" });
    expect(cell("December 9, 2026").getAttribute("tabindex")).toBe("0");
  });

  it("moves focus to the cell it lands on", () => {
    renderMulti({ values: [Temporal.PlainDate.from("2026-12-09")] });
    fireEvent.keyDown(cell("December 9, 2026"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(cell("December 10, 2026"));
  });

  it("jumps to the ends of the week with Home / End", () => {
    renderMulti({ values: [Temporal.PlainDate.from("2026-12-09")] });
    fireEvent.keyDown(cell("December 9, 2026"), { key: "Home" });
    expect(cell("December 6, 2026").getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(cell("December 6, 2026"), { key: "End" });
    expect(cell("December 12, 2026").getAttribute("tabindex")).toBe("0");
  });

  it("pages the range with PageUp / PageDown", () => {
    renderMulti({ values: [Temporal.PlainDate.from("2026-12-09")] });
    fireEvent.keyDown(cell("December 9, 2026"), { key: "PageDown" });
    expect(screen.getByText("January 2027")).toBeTruthy();
    fireEvent.keyDown(cell("January 9, 2027"), { key: "PageUp" });
    expect(screen.getByText("December 2026")).toBeTruthy();
  });

  it("pages the view when an arrow walks off the visible range", () => {
    renderMulti({ values: [Temporal.PlainDate.from("2026-12-01")] });
    fireEvent.keyDown(cell("December 1, 2026"), { key: "ArrowUp" });
    expect(screen.getByText("November 2026")).toBeTruthy();
    expect(cell("November 24, 2026").getAttribute("tabindex")).toBe("0");
  });

  it("commits the focused cell on Enter, without a pointer gesture", () => {
    const onValuesChange = vi.fn();
    renderMulti({ values: [Temporal.PlainDate.from("2026-12-09")], onValuesChange });
    // A keyboard-activated button click carries detail 0.
    fireEvent.click(cell("December 9, 2026"), { detail: 0 });
    expect(iso(onValuesChange.mock.calls[0][0])).toEqual([]);
  });
});

describe("sweep={false} — multiple selection, one date per action", () => {
  it("still toggles on click, in and out", () => {
    const onValuesChange = vi.fn();
    renderMulti({ sweep: false, onValuesChange });

    fireEvent.click(cell("December 5, 2026"));
    expect(iso(onValuesChange.mock.calls[0][0])).toEqual(["2026-12-05"]);

    fireEvent.click(cell("December 9, 2026"));
    expect(iso(onValuesChange.mock.calls[1][0])).toEqual([
      "2026-12-05",
      "2026-12-09",
    ]);
  });

  it("does not open a marquee — a drag across the grid selects nothing", () => {
    renderMulti({ sweep: false });
    layoutGrids();

    marquee("December 7, 2026", "December 9, 2026");
    expect(selected()).toEqual([]);
  });

  it("withdraws Shift+Arrow too, so the keyboard cannot sweep either", () => {
    renderMulti({ sweep: false });
    fireEvent.keyDown(cell("December 11, 2026"), {
      key: "ArrowRight",
      shiftKey: true,
    });
    expect(selected()).toEqual([]);
    expect(cell("December 12, 2026").getAttribute("tabindex")).toBe("0");
  });

  it("leaves the sweep on by default", () => {
    renderMulti();
    layoutGrids();

    marquee("December 7, 2026", "December 9, 2026");
    expect(selected().length).toBeGreaterThan(1);
  });
});

describe("Shift+Arrow — the keyboard mirror of the sweep", () => {
  it("toggles each date it moves onto, anchor included", () => {
    renderMulti();
    const start = cell("December 11, 2026");
    fireEvent.keyDown(start, { key: "ArrowRight", shiftKey: true });
    expect(cell("December 11, 2026").getAttribute("aria-selected")).toBe("true");
    expect(cell("December 12, 2026").getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(cell("December 12, 2026"), {
      key: "ArrowRight",
      shiftKey: true,
    });
    expect(cell("December 13, 2026").getAttribute("aria-selected")).toBe("true");
  });

  it("flips dates back when the run reverses over itself", () => {
    renderMulti();
    fireEvent.keyDown(cell("December 11, 2026"), {
      key: "ArrowRight",
      shiftKey: true,
    });
    fireEvent.keyDown(cell("December 12, 2026"), {
      key: "ArrowLeft",
      shiftKey: true,
    });
    expect(cell("December 11, 2026").getAttribute("aria-selected")).toBe("false");
  });

  it("stays a plain move in single-selection mode", () => {
    const onValueChange = vi.fn();
    renderCalendar({ onValueChange });
    fireEvent.keyDown(
      screen.getByRole("gridcell", { name: "December 11, 2026" }),
      { key: "ArrowRight", shiftKey: true },
    );
    expect(onValueChange).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole("gridcell", { name: "December 12, 2026" })
        .getAttribute("tabindex"),
    ).toBe("0");
  });
});

describe("defaultView", () => {
  it("opens on the given month instead of the selection's", () => {
    renderMulti({
      months: 3,
      defaultView: Temporal.PlainDate.from("2026-07-01"),
      defaultValues: [Temporal.PlainDate.from("2026-08-11")],
    });
    expect(screen.getByText("July 2026")).toBeTruthy();
    expect(screen.getByText("September 2026")).toBeTruthy();
  });

  it("is only a STARTING view — the chevrons still move off it", () => {
    renderMulti({ defaultView: Temporal.PlainDate.from("2026-07-01") });
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("August 2026")).toBeTruthy();
  });

  it("falls back to the selection when absent", () => {
    renderMulti({ defaultValues: [Temporal.PlainDate.from("2026-08-11")] });
    expect(screen.getByText("August 2026")).toBeTruthy();
  });
});
