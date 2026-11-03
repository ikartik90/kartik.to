import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Calendar } from "../shift-calendar";

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

describe("the month and year view", () => {
  it("steps the month and year, and takes one picked", async () => {
    const user = userEvent.setup();
    const months: string[] = [];
    function Harness() {
      const [month, setMonth] = useState("2023-11-01");
      return (
        <Calendar
          view="month"
          month={month}
          picked={[]}
          today="2023-11-10"
          onMonth={(next) => {
            months.push(next);
            setMonth(next);
          }}>{PARTS}</Calendar>
      );
    }
    render(<Harness />);
    expect(screen.getByRole("heading").textContent).toBe("November 2023");
    await user.click(screen.getByRole("button", { name: "Next month" }));
    await user.click(screen.getByRole("button", { name: "Previous year" }));
    // Five months show around the current one.
    expect(screen.getAllByRole("option").slice(0, 5).map((option) => option.textContent)).toEqual([
      "October",
      "November",
      "December",
      "January",
      "February",
    ]);
    await user.click(screen.getByRole("option", { name: "October" }));
    expect(months).toEqual(["2023-12-01", "2022-12-01", "2022-10-01"]);
    expect(screen.getByRole("heading").textContent).toBe("October 2022");
  });

  it("opens from the days' title, and goes back to the days of the month picked", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [month, setMonth] = useState("2023-11-01");
      return <Calendar month={month} picked={[]} today="2023-11-10" onPick={() => {}} onMonth={setMonth}>{PARTS}</Calendar>;
    }
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /^November 2023/ }));
    expect(screen.getByRole("listbox", { name: "Month" })).toBeTruthy();
    await user.click(screen.getByRole("option", { name: "January" }));
    await user.click(screen.getByRole("option", { name: "2025" }));
    await user.click(screen.getByRole("button", { name: "Back to days" }));
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button", { name: /^January 2025/ })).toBeTruthy();
  });

  it("keeps the days' title as words where there's no month to pick", () => {
    render(<Calendar month="2023-11-01" picked={[]} today="2023-11-10">{PARTS}</Calendar>);
    expect(screen.queryByRole("button", { name: /November 2023/ })).toBeNull();
    expect(screen.getByText("November 2023")).toBeTruthy();
  });
});
