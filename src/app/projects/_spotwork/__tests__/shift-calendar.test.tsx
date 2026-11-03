import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DATE_PICKER } from "../copy";
import { Calendar, DatePicker } from "../shift-calendar";
import type { Iso } from "../shifts";
import { Field } from "../ui";

const PARTS = (
  <Calendar.PeriodList>
    <Calendar.Prev>
      <span>‹</span>
    </Calendar.Prev>
    <Calendar.Period>
      <Calendar.Month />
      <Calendar.Week>
        <Calendar.Day />
      </Calendar.Week>
      <Calendar.Grid>
        <Calendar.Date />
      </Calendar.Grid>
    </Calendar.Period>
    <Calendar.Next>
      <span>›</span>
    </Calendar.Next>
  </Calendar.PeriodList>
);

afterEach(cleanup);

function setup(props: { tone?: "warning" | "alert"; disabled?: boolean } = {}) {
  const user = userEvent.setup();
  const picked: Iso[] = [];
  function Harness() {
    const [value, setValue] = useState<Iso | null>("2023-11-12");
    return (
      <Field {...props}>
        <Field.Label>Shift Date</Field.Label>
        <DatePicker
          value={value}
          onChange={(date) => {
            picked.push(date);
            setValue(date);
          }}
          today="2023-11-10"
        />
        <Field.HintText>mm/dd/yyyy</Field.HintText>
      </Field>
    );
  }
  render(<Harness />);
  const field = () => screen.getByRole("button", { name: "Shift Date" });
  return { user, picked, field };
}

describe("DatePicker", () => {
  it("opened low in its page, scrolls only that page to show it, never the boxes round the page", async () => {
    const user = userEvent.setup();
    const scrolled = vi.fn();
    const pageScrolled = vi.fn();
    const props = {
      scrollIntoView: { configurable: true, value: scrolled },
      offsetTop: { configurable: true, get(this: HTMLElement) { return this.getAttribute("role") === "dialog" ? 300 : 0; } },
      offsetHeight: { configurable: true, get(this: HTMLElement) { return this.getAttribute("role") === "dialog" ? 100 : 0; } },
      clientHeight: { configurable: true, get(this: HTMLElement) { return this.dataset.testid === "page" ? 200 : 0; } },
    };
    Object.defineProperties(HTMLElement.prototype, props);
    try {
      render(
        <div style={{ overflowY: "auto" }}>
          <div data-testid="page" style={{ overflowY: "auto" }} ref={(node) => void (node && (node.scrollTo = pageScrolled))}>
            <Field>
              <Field.Label>Shift Date</Field.Label>
              <DatePicker defaultValue="2023-11-12" today="2023-11-10" />
            </Field>
          </div>
        </div>,
      );
      await user.click(screen.getByRole("button", { name: "Shift Date" }));
      expect(scrolled).not.toHaveBeenCalled();
      expect(pageScrolled).toHaveBeenCalledWith(expect.objectContaining({ top: 300 + 100 + 24 - 200 }));
    } finally {
      for (const name of Object.keys(props)) Reflect.deleteProperty(HTMLElement.prototype, name);
    }
  });

  it("shows its date between its label and its hint", () => {
    const { field } = setup();
    expect(field().textContent).toBe("11/12/2023");
    expect([...field().closest("[data-field]")!.children].map((part) => part.textContent)).toEqual([
      "Shift Date",
      "11/12/2023",
      "mm/dd/yyyy",
    ]);
  });

  it("opens a month, named by its label, and takes the day picked", async () => {
    const { user, field, picked } = setup();
    await user.click(field());
    const month = screen.getByRole("dialog", { name: "Shift Date" });
    await user.click(within(month).getByRole("button", { name: /15 November/ }));
    expect(picked).toEqual(["2023-11-15"]);
    expect(field().textContent).toBe("11/15/2023");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("gives its hint its tone, and can be disabled", async () => {
    const { user, field } = setup({ tone: "alert", disabled: true });
    expect(screen.getByText("mm/dd/yyyy").getAttribute("data-tone")).toBe("alert");
    await user.click(field());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("can open on its month and year", () => {
    render(
      <Field>
        <Field.Label>Shift Date</Field.Label>
        <DatePicker defaultValue="2023-11-30" today="2023-11-10" defaultOpen defaultView="month" />
      </Field>,
    );
    const month = screen.getByRole("dialog", { name: "Shift Date" });
    expect(within(month).getByRole("listbox", { name: "Year" })).toBeTruthy();
  });

  it("holds the day picked when not given a date, from its default", async () => {
    const user = userEvent.setup();
    const picked: Iso[] = [];
    render(
      <Field>
        <Field.Label>Shift Date</Field.Label>
        <DatePicker defaultValue="2023-11-12" today="2023-11-10" onChange={(date) => picked.push(date)} />
      </Field>,
    );
    const field = screen.getByRole("button", { name: "Shift Date" });
    expect(field.textContent).toBe("11/12/2023");
    await user.click(field);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /15 November/ }));
    expect(field.textContent).toBe("11/15/2023");
    expect(picked).toEqual(["2023-11-15"]);
  });

  it("names its parts for the code view", () => {
    expect(DatePicker.displayName).toBe("DatePicker");
    expect(Field.Label.displayName).toBe("Field.Label");
    expect(Field.HintText.displayName).toBe("Field.HintText");
  });
});

describe("Calendar", () => {
  it("shows its month view while held there", () => {
    render(<Calendar view="month" month="2023-11-01" picked={[]} today="2023-11-10" onMonth={() => {}}>{PARTS}</Calendar>);
    expect(screen.getByRole("listbox", { name: "Year" })).toBeTruthy();
    cleanup();
    render(<Calendar view="date" month="2023-11-01" picked={[]} today="2023-11-10" onMonth={() => {}}>{PARTS}</Calendar>);
    expect(screen.queryByRole("listbox", { name: "Year" })).toBeNull();
  });

  it("moves the focus through its month view's months or years with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Calendar view="month" month="2023-11-01" picked={[]} today="2023-11-10" onMonth={() => {}}>{PARTS}</Calendar>);
    within(screen.getByRole("listbox", { name: "Month" })).getByRole("option", { selected: true }).focus();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement?.textContent).toBe("December");
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(document.activeElement?.textContent).toBe("October");
  });

  it("holds its own month, day and view when not given them, from its defaults", async () => {
    const user = userEvent.setup();
    render(<Calendar defaultPicked={["2023-11-12"]} today="2023-11-10" from="2023-11-01">{PARTS}</Calendar>);
    const pressed = () =>
      screen
        .getAllByRole("button", { pressed: true })
        .map((day) => day.textContent);
    expect(pressed()).toEqual(["12"]);
    await user.click(screen.getByRole("button", { name: /15 November/ }));
    expect(pressed()).toEqual(["15"]);
    await user.click(screen.getByRole("button", { name: DATE_PICKER.nextMonth }));
    await user.click(screen.getByRole("button", { name: DATE_PICKER.open("December 2023") }));
    expect(screen.getByRole("listbox", { name: "Year" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: DATE_PICKER.close }));
    expect(screen.getByRole("button", { name: "Friday, 1 December, 2023" })).toBeTruthy();
    cleanup();
    render(<Calendar defaultView="month" defaultMonth="2023-11-01" today="2023-11-10">{PARTS}</Calendar>);
    expect(screen.getByRole("listbox", { name: "Year" })).toBeTruthy();
  });

  it("marks today", () => {
    render(<Calendar today="2023-11-03" from="2023-11-01">{PARTS}</Calendar>);
    expect(screen.getByRole("button", { name: /, 3 November/ }).getAttribute("aria-current")).toBe("date");
    expect(screen.getByRole("button", { name: /, 4 November/ }).getAttribute("aria-current")).toBeNull();
  });

  function picks(select: "day" | "week" | "range", initial: Iso[]) {
    const user = userEvent.setup();
    const changes: Iso[][] = [];
    render(
      <Calendar select={select} size="small" today="2023-11-03" from="2023-10-01" defaultPicked={initial} onPickedChange={(next) => changes.push(next)}>
        {PARTS}
      </Calendar>,
    );
    const day = (date: number) => screen.getByRole("button", { name: new RegExp(`^\\w+, ${date} November`) });
    const pressed = () => screen.getAllByRole("button", { pressed: true }).map((button) => button.textContent);
    return { user, changes, day, pressed };
  }

  it("picks the whole week of the day pressed as a week selector, a band behind it", async () => {
    const { user, changes, day, pressed } = picks("week", []);
    await user.click(day(15));
    expect(changes).toEqual([["2023-11-12", "2023-11-13", "2023-11-14", "2023-11-15", "2023-11-16", "2023-11-17", "2023-11-18"]]);
    expect(pressed()).toEqual(["12", "13", "14", "15", "16", "17", "18"]);
    expect(document.querySelectorAll("[data-band]")).toHaveLength(1);
  });

  it("picks a range with two presses, whichever end comes first, then starts again", async () => {
    const { user, changes, day, pressed } = picks("range", []);
    await user.click(day(20));
    expect(changes.at(-1)).toEqual(["2023-11-20"]);
    await user.click(day(12));
    expect(changes.at(-1)).toEqual(["2023-11-12", "2023-11-20"]);
    expect(pressed()).toEqual(["12", "20"]);
    expect(document.querySelectorAll("[data-band]")).toHaveLength(2);
    await user.click(day(25));
    expect(changes.at(-1)).toEqual(["2023-11-25"]);
  });

  it("fades a range's band where it runs on past the month", () => {
    render(
      <Calendar select="range" size="small" today="2023-11-03" defaultMonth="2023-11-01" defaultPicked={["2023-10-29", "2023-11-04"]}>
        {PARTS}
      </Calendar>,
    );
    expect([...document.querySelectorAll("[data-band]")].map((band) => band.getAttribute("data-band"))).toEqual(["in"]);
  });

  it("names its size for its look", () => {
    render(<Calendar size="small" today="2023-11-03">{PARTS}</Calendar>);
    expect(document.querySelector("[data-size=small]")).not.toBeNull();
  });
});
