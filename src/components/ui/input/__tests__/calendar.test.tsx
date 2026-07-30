import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { Calendar } from "../calendar";
import { Field } from "../field";
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

// Each nav DECLARES its role, so neither its position among siblings nor its
// depth in the tree decides what it does — which is what lets a consumer wrap
// the chevrons in their own chrome.
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
    // Next FIRST in the DOM: under the old positional wiring this button would
    // have paged BACKWARDS, because it was the first Button it found.
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
    // The consumer's handler REPLACES the paging, it doesn't run alongside it.
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

// ---------------------------------------------------------------------------
// Multiple selection — the second selection mode, plus the two gestures that
// only exist there: a pointer sweep and its keyboard mirror (Shift+Arrow).
// ---------------------------------------------------------------------------

/** A `selectionMode="multiple"` tree, no search row. `months` is passthrough. */
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

/** The OWNED cell for a date (a spill copy carries the same accessible name). */
function cell(name: string): HTMLButtonElement {
  const matches = screen.getAllByRole("gridcell", { name });
  const owned = matches.find((c) => !c.hasAttribute("data-outside"));
  return (owned ?? matches[0]) as HTMLButtonElement;
}

const iso = (dates: Temporal.PlainDate[]) => dates.map((d) => d.toString());

/** Every OWNED cell currently marked selected, in chronological (DOM) order. */
const selected = () =>
  screen
    .getAllByRole("gridcell")
    .filter((c) => c.getAttribute("aria-selected") === "true")
    .map((c) => c.getAttribute("data-date"));

// jsdom lays nothing out — every getBoundingClientRect is zeroes — so a marquee
// has nothing to intersect. Give the cells a synthetic grid: 24px cells on a
// 28px pitch, each month column offset by 250px, mirroring the real 7-column
// layout closely enough for overlap maths to mean something.
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

/** The centre point of a date's own cell, in the synthetic layout above. */
function centre(name: string): { x: number; y: number } {
  const box = cell(name).getBoundingClientRect();
  return { x: box.left + CELL / 2, y: box.top + CELL / 2 };
}

/**
 * Press on `from`, drag the band to `to`, release. Both are date names; the
 * band is the rectangle between their cell centres.
 */
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
  // The band is a RECTANGLE, not a trail: what matters is the area between the
  // press point and the pointer, so a row-spanning drag takes the whole block
  // rather than the cells a cursor happened to touch.
  it("toggles every cell the band overlaps, both ends included", () => {
    renderMulti();
    layoutGrids();
    marquee("December 7, 2026", "December 9, 2026");
    expect(selected()).toEqual(["2026-12-07", "2026-12-08", "2026-12-09"]);
  });

  it("takes a BLOCK when the band spans rows, not just the cursor's path", () => {
    renderMulti();
    layoutGrids();
    // Dec 7 (Mon) → Dec 15 (Tue): two columns wide, two rows tall.
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
    // Creep 1px into the neighbouring cell's box — a sliver, but an overlap.
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
    // Shrink back: Dec 9 leaves the band and must return to unselected.
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
    // 7 and 8 were on, so the band turns them off; 9 was off, so it turns on.
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

  // A band between two distant cells necessarily covers everything BETWEEN
  // them — that is the whole point of a rectangle over a path. So this drags a
  // thin band along the top row, which crosses the gap between two month
  // columns without swallowing the rows beneath.
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
    // Under the drag threshold — still a click, so the band never applies.
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
    // Press and release shared a cell only in the browser's eyes; the click
    // still fires and must be swallowed.
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
    // January's first row opens with Dec 27–31 as spill days, so this band
    // passes straight over them — but their OWNED cells sit further down in
    // December's own grid, outside the band, so they must stay untouched.
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
  /** The period list — the grid's grandparent (grid ▸ period ▸ list). */
  const list = () => screen.getAllByRole("grid")[0].parentElement!.parentElement!;

  /** Press on the LIST itself (a gutter, a label, a short month's tail). */
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
    // Above and left of the whole grid — no day cell under the press point.
    marqueeFromList({ x: -20, y: -20 }, "December 1, 2026");
    expect(selected()).toContain("2026-12-01");
  });

  it("takes every cell between the empty-space origin and the pointer", () => {
    renderMulti();
    layoutGrids();
    marqueeFromList({ x: -20, y: -20 }, "December 2, 2026");
    // Dec 1 and 2 sit in the band's first row; Dec 3 is past its right edge.
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
    // jsdom gives the list a zero-origin rect, so list-relative == client here.
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
    expect(cell("December 6, 2026").getAttribute("tabindex")).toBe("0"); // Sunday
    fireEvent.keyDown(cell("December 6, 2026"), { key: "End" });
    expect(cell("December 12, 2026").getAttribute("tabindex")).toBe("0"); // Saturday
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

// `sweep={false}` keeps the toggle model but withdraws the two GESTURES that
// commit more than one date per action, so a multiple-selection calendar can
// still be strictly one-at-a-time.
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
    // The caret still MOVES — only the range-extend is withdrawn.
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
    renderMulti(); // uncontrolled: `values: []` would pin it empty
    const start = cell("December 11, 2026"); // today holds the tabstop
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
    renderMulti(); // uncontrolled: `values: []` would pin it empty
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
    // Without it the range would start at the selection (Aug–Oct).
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
