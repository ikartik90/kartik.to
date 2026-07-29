import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { Calendar } from "../calendar";
import { Field } from "../field";
import { Button } from "@/components/ui/button";
import { parseCalendarDate } from "@/utils/calendar-date";

const TODAY = Temporal.PlainDate.from("2026-12-11");

// Date navigation now needs an explicit parser on the Calendar (a bare
// Field.Search just emits raw strings). The tree wires DD/MM/YYYY by default;
// pass `null` for the parser-less (dumb) case, or a different parser to vary it.
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
        <Button variant="icon">‹</Button>
        <Calendar.Period>
          <Calendar.Month />
          <Calendar.Week>
            <Calendar.Day />
          </Calendar.Week>
          <Calendar.Grid>
            <Calendar.Date />
          </Calendar.Grid>
        </Calendar.Period>
        <Button variant="icon">›</Button>
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

afterEach(cleanup);

describe("field wiring", () => {
  it("throws when used outside <Field>", () => {
    // Silence React's error-boundary logging for the expected throw.
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
});

describe("weekday / weekend attributes", () => {
  it("marks weekend header columns", () => {
    renderCalendar();
    const headers = screen.getAllByRole("columnheader");
    expect(headers[0].hasAttribute("data-weekend")).toBe(true); // sun
    expect(headers[6].hasAttribute("data-weekend")).toBe(true); // sat
    expect(headers[1].hasAttribute("data-weekend")).toBe(false); // mon
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
    // Nov 29 backfills the Sunday-started grid → outside the current month.
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

// A range is the same single Period template cloned per month, so these assert
// the parts read THEIR month rather than the root's view, and that one chevron
// press moves the whole range (Figma 715:912).
describe("multi-month ranges", () => {
  const tabstops = () =>
    screen
      .getAllByRole("gridcell")
      .filter((c) => c.getAttribute("tabindex") === "0");

  it("clones the one Period template into a grid per month", () => {
    renderCalendar({ months: 3 });
    expect(screen.getAllByRole("grid")).toHaveLength(3);
    expect(screen.getAllByRole("gridcell")).toHaveLength(126); // 3 × 42
    expect(screen.getAllByRole("columnheader")).toHaveLength(21); // 3 × 7
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
    // Dec–Feb ▸ Sep–Nov: no month carries over between pages.
    expect(screen.getByText("September 2026")).toBeTruthy();
    expect(screen.getByText("November 2026")).toBeTruthy();
    expect(screen.queryByText("December 2026")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Next 3 months" }));
    expect(screen.getByText("December 2026")).toBeTruthy();
    expect(screen.getByText("February 2027")).toBeTruthy();
  });

  it("keeps ONE roving tabstop across the range, not one per grid", () => {
    renderCalendar({ months: 3, value: Temporal.PlainDate.from("2027-01-05") });
    const stops = tabstops();
    expect(stops).toHaveLength(1);
    expect(stops[0].getAttribute("aria-label")).toBe("January 5, 2027");
  });

  it("does not duplicate the tabstop onto a spill-day twin", () => {
    // Dec 31 renders twice in a Dec–Jan range: as December's own last day, and
    // as a spill cell leading January's grid. Only the owning month may hold
    // the tabstop, or the roving-tabindex contract breaks.
    renderCalendar({ months: 2, value: Temporal.PlainDate.from("2026-12-31") });
    expect(
      screen.getAllByRole("gridcell", { name: "December 31, 2026" }),
    ).toHaveLength(2);
    const stops = tabstops();
    expect(stops).toHaveLength(1);
    expect(stops[0].hasAttribute("data-outside")).toBe(false);
  });

  // A spill day is a decorative duplicate of a cell another month already owns,
  // so it carries no state at all — only the owning month may claim it. Without
  // this, every boundary date paints its chip twice across the range.
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
    // February is the third visible month — selecting in it must not shuffle
    // the range out from under the pointer.
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
            <Button variant="icon">‹</Button>
            <Calendar.Period>
              <Calendar.Month />
              <Calendar.Week>
                <Calendar.Day />
              </Calendar.Week>
              <Calendar.Grid>
                <Calendar.Date />
              </Calendar.Grid>
            </Calendar.Period>
            <Button variant="icon">›</Button>
          </Calendar.PeriodList>
        </Calendar>
      </Field>,
    );
    type("05/01/2027");
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });

    expect(onValueChange).toHaveBeenCalledWith("05/01/2027");
    expect(onKeyDown).toHaveBeenCalledOnce();
    // …and the built-in navigation still ran alongside them.
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
    // The attribute is pure state; the recipe decides that a disabled cell
    // takes no chip, exactly as it does for :hover.
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
  // A fully bespoke parser (not a format pattern) proves the hook is generic —
  // any string → date function works, and it lives on the Calendar, not the box.
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
            <Button variant="icon">‹</Button>
            <Calendar.Period>
              <Calendar.Month />
              <Calendar.Week>
                <Calendar.Day />
              </Calendar.Week>
              <Calendar.Grid>
                <Calendar.Date />
              </Calendar.Grid>
            </Calendar.Period>
            <Button variant="icon">›</Button>
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
