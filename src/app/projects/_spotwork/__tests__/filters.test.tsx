import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DateSelector } from "../dashboard-menus";
import type { Day } from "../data";
import { FILTER_STORIES } from "../ds-filter";
import { Dropdown } from "../dropdown";
import { BulkSelect, RangeSelector, RangeType } from "../filters";
import { DatePicker } from "../shift-calendar";
import { Field, TextInput, Typography } from "../ui";
import { longDate } from "../shifts";
import { keyed } from "./story-harness";
import { renderStories } from "./story-harness";

afterEach(cleanup);

const OPTIONS = ["Day Shift", "Night Shift", "Weekend Shift"];

describe("the small Dropdown (Atoms/Filter/Dropdown)", () => {
  function setup(props: { disabled?: boolean; defaultOpen?: boolean } = {}) {
    const user = userEvent.setup();
    const picked: string[] = [];
    function Harness() {
      const [value, setValue] = useState("Selected Value");
      return (
        <Dropdown
          size="small"
          value={value}
          onChange={(next) => {
            picked.push(next);
            setValue(next);
          }}
          {...props}
        >
          {OPTIONS.map((option) => (
            <Dropdown.Item key={option}><Typography variant="bodyLarge">{option}</Typography></Dropdown.Item>
          ))}
        </Dropdown>
      );
    }
    render(<Harness />);
    return { user, picked };
  }

  it("shows its value, closed", () => {
    setup();
    const button = screen.getByRole("button", { name: "Selected Value" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("lists its items when pressed, and takes the one picked", async () => {
    const { user, picked } = setup();
    await user.click(screen.getByRole("button", { name: "Selected Value" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(OPTIONS);
    await user.click(screen.getByRole("option", { name: "Night Shift" }));
    expect(picked).toEqual(["Night Shift"]);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Night Shift" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("marks the item holding its value", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Selected Value" }));
    await user.click(screen.getByRole("option", { name: "Night Shift" }));
    await user.click(screen.getByRole("button", { name: "Night Shift" }));
    expect(screen.getByRole("option", { name: "Night Shift" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("option", { name: "Day Shift" }).getAttribute("aria-selected")).toBe("false");
  });

  it("closes on Escape", async () => {
    const { user } = setup({ defaultOpen: true });
    expect(screen.getByRole("listbox")).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("can't be opened while disabled", async () => {
    const { user } = setup({ disabled: true });
    const button = screen.getByRole<HTMLButtonElement>("button", { name: "Selected Value" });
    expect(button.disabled).toBe(true);
    await user.click(button);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("holds its own value when not given one, from its default", async () => {
    const user = userEvent.setup();
    render(
      <Dropdown size="small" defaultValue="Selected Value">
        {OPTIONS.map((option) => (
          <Dropdown.Item key={option}><Typography variant="bodyLarge">{option}</Typography></Dropdown.Item>
        ))}
      </Dropdown>,
    );
    await user.click(screen.getByRole("button", { name: "Selected Value" }));
    await user.click(screen.getByRole("option", { name: "Night Shift" }));
    expect(screen.getByRole("button", { name: "Night Shift" })).toBeTruthy();
  });
});

describe("the small Dropdown picking several (Atoms/Filter/Multi-select)", () => {
  function setup(props: { disabled?: boolean; defaultOpen?: boolean; initial?: string[] } = {}) {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = useState<string[]>(props.initial ?? []);
      return (
        <Dropdown
          size="small"
          multiple
          value={value}
          onChange={setValue}
          disabled={props.disabled}
          defaultOpen={props.defaultOpen}
        >
          <Typography variant="metadata">Status</Typography>
          <Dropdown.Item value="posted" tone="active">
            <Typography variant="bodyLarge">Posted Hours</Typography>
          </Dropdown.Item>
          <Dropdown.Item value="adjusted"><Typography variant="bodyLarge">Adjusted Hours</Typography></Dropdown.Item>
        </Dropdown>
      );
    }
    render(<Harness />);
    return { user, trigger: () => screen.getAllByRole("button")[0] };
  }

  it("opens with its options showing when held open", () => {
    setup({ defaultOpen: true });
    expect(screen.getByRole("button", { name: "Status" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.getByRole("listbox", { name: "Status" }).getAttribute("aria-multiselectable")).toBe("true");
  });

  it("ticks the options picked, and counts them on its button", async () => {
    const { user, trigger } = setup();
    await user.click(trigger());
    await user.click(screen.getByRole("option", { name: "Adjusted Hours" }));
    expect(screen.getByRole("option", { name: "Adjusted Hours" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("option", { name: "Posted Hours" }).getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(trigger().textContent).toBe("Status1");
    await user.click(screen.getByRole("option", { name: "Adjusted Hours" }));
    expect(trigger().textContent).toBe("Status");
  });

  it("tints an option's words in its tone", () => {
    setup({ defaultOpen: true });
    expect(screen.getByRole("option", { name: "Posted Hours" }).getAttribute("data-tone")).toBe("active");
    expect(screen.getByRole("option", { name: "Adjusted Hours" }).hasAttribute("data-tone")).toBe(false);
  });

  it("can't be opened while disabled", async () => {
    const { user } = setup({ disabled: true, initial: ["posted"] });
    const button = screen.getByRole<HTMLButtonElement>("button", { name: /Status/ });
    expect(button.disabled).toBe(true);
    await user.click(button);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("holds its own picks when not given them, from its default", async () => {
    const user = userEvent.setup();
    render(
      <Dropdown size="small" multiple defaultValue={["posted"]}>
        <Typography variant="metadata">Status</Typography>
        <Dropdown.Item value="posted"><Typography variant="bodyLarge">Posted Hours</Typography></Dropdown.Item>
        <Dropdown.Item value="adjusted"><Typography variant="bodyLarge">Adjusted Hours</Typography></Dropdown.Item>
      </Dropdown>,
    );
    const trigger = screen.getAllByRole("button")[0];
    expect(trigger.textContent).toBe("Status1");
    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: "Adjusted Hours" }));
    expect(trigger.textContent).toBe("Status2");
  });
});

describe("Molecules/Filter/Date Selector (DateSelector)", () => {
  it("steps with its arrows, and shows its date between them", async () => {
    const user = userEvent.setup();
    const steps: number[] = [];
    render(
      <DateSelector>
        <DateSelector.Previous aria-label="Previous week" onClick={() => steps.push(-1)} />
        <DateSelector.Date aria-label="Week of Nov 3">Nov 3</DateSelector.Date>
        <DateSelector.Next aria-label="Next week" onClick={() => steps.push(1)} />
      </DateSelector>,
    );
    await user.click(screen.getByRole("button", { name: "Previous week" }));
    await user.click(screen.getByRole("button", { name: "Next week" }));
    expect(steps).toEqual([-1, 1]);
    const date = screen.getByRole("button", { name: "Week of Nov 3" });
    expect(date.textContent).toBe("Nov 3");
    expect(date.hasAttribute("aria-expanded")).toBe(false);
  });

  function Days({ defaultOpen }: { defaultOpen?: boolean }) {
    const [day, setDay] = useState<Day>("today");
    return (
      <DateSelector defaultOpen={defaultOpen}>
        <DateSelector.Previous aria-label="Previous day" disabled={day === "yesterday"} onClick={() => setDay("yesterday")} />
        <DateSelector.Date>{day}</DateSelector.Date>
        <DateSelector.Next aria-label="Next day" onClick={() => setDay("tomorrow")} />
        <DateSelector.Calendar day={day} onChange={setDay} today="2023-11-03" />
      </DateSelector>
    );
  }

  it("opens its calendar from its date when it has one", async () => {
    const user = userEvent.setup();
    render(<Days />);
    const date = screen.getByRole("button", { name: "today" });
    expect(date.getAttribute("aria-expanded")).toBe("false");
    await user.click(date);
    expect(screen.getByRole("dialog", { name: "Date" })).toBeTruthy();
    expect(screen.getByText("November 2023")).toBeTruthy();
  });

  it("opens with its calendar showing when held open, and closes it on a day picked", async () => {
    const user = userEvent.setup();
    render(<Days defaultOpen />);
    await user.click(screen.getByRole("button", { name: longDate("2023-11-04") }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "tomorrow" })).toBeTruthy();
  });

  it("can't step past the first day", async () => {
    const user = userEvent.setup();
    render(<Days />);
    await user.click(screen.getByRole("button", { name: "Previous day" }));
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Previous day" }).disabled).toBe(true);
  });

  it("steps through the days it has by itself when it holds its own, from its default", async () => {
    const user = userEvent.setup();
    render(
      <DateSelector defaultDay="today">
        <DateSelector.Previous aria-label="Previous day" />
        <DateSelector.Date />
        <DateSelector.Next aria-label="Next day" />
        <DateSelector.Calendar today="2023-11-03" />
      </DateSelector>,
    );
    const date = () => screen.getByRole("button", { expanded: false });
    const step = (name: string) => screen.getByRole<HTMLButtonElement>("button", { name });
    expect(date().textContent).toBe("Today");
    await user.click(step("Previous day"));
    expect(date().textContent).toBe("Yesterday");
    expect(step("Previous day").disabled).toBe(true);
    await user.click(date());
    await user.click(screen.getByRole("button", { name: longDate("2023-11-04") }));
    expect(date().textContent).toBe("Tomorrow");
    expect(step("Next day").disabled).toBe(true);
    expect(step("Previous day").disabled).toBe(false);
  });
});

describe("the small Date Picker picking a range (Molecules/Filter/Date Picker)", () => {
  function setup(props: { disabled?: boolean } = {}) {
    const user = userEvent.setup();
    const changes: { start: string; end: string }[] = [];
    function Harness() {
      const [value, setValue] = useState({ start: "2023-11-12", end: "2023-12-06" });
      return (
        <DatePicker
          size="small"
          select="range"
          value={value}
          today="2023-11-10"
          onChange={(next) => {
            changes.push(next);
            setValue(next);
          }}
          {...props}
        >
          <DatePicker.Preset days={7}>Last 7 days</DatePicker.Preset>
          <DatePicker.Preset days={14}>Last 14 days</DatePicker.Preset>
        </DatePicker>
      );
    }
    render(<Harness />);
    return { user, changes };
  }

  it("shows its range as Figma writes dates", () => {
    setup();
    expect(screen.getByRole("button", { name: "11/12/2023 – 12/6/2023" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("offers its presets and a custom range when pressed", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "11/12/2023 – 12/6/2023" }));
    const panel = screen.getByRole("dialog", { name: "Date" });
    expect(within(panel).getAllByRole("option").map((option) => option.textContent)).toEqual(["Last 7 days", "Last 14 days", "Custom"]);
  });

  it("moves through its presets with the arrow keys from its box, and takes the one reached on Enter", async () => {
    const { user, changes } = setup();
    const box = screen.getByRole("button", { name: "11/12/2023 – 12/6/2023" });
    box.focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(keyed(box)).toBe("Last 14 days");
    await user.keyboard("{Enter}");
    expect(changes).toEqual([{ start: "2023-10-28", end: "2023-11-10" }]);
  });

  it("takes a preset's last days up to today, and closes", async () => {
    const { user, changes } = setup();
    await user.click(screen.getByRole("button", { name: "11/12/2023 – 12/6/2023" }));
    await user.click(screen.getByRole("option", { name: "Last 7 days" }));
    expect(changes).toEqual([{ start: "2023-11-04", end: "2023-11-10" }]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "11/4/2023 – 11/10/2023" })).toBeTruthy();
  });

  it("takes a custom range from its calendar, and closes once both ends are picked", async () => {
    const { user, changes } = setup();
    await user.click(screen.getByRole("button", { name: "11/12/2023 – 12/6/2023" }));
    await user.click(screen.getByRole("option", { name: "Custom" }));
    expect(screen.getByText("November 2023")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: longDate("2023-11-14") }));
    expect(changes).toEqual([]);
    await user.click(screen.getByRole("button", { name: longDate("2023-11-20") }));
    expect(changes).toEqual([{ start: "2023-11-14", end: "2023-11-20" }]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("can't be opened while disabled", async () => {
    const { user } = setup({ disabled: true });
    const button = screen.getByRole<HTMLButtonElement>("button", { name: "11/12/2023 – 12/6/2023" });
    expect(button.disabled).toBe(true);
    await user.click(button);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("holds its own range when not given one, from its default", async () => {
    const user = userEvent.setup();
    render(
      <DatePicker size="small" select="range" defaultValue={{ start: "2023-11-12", end: "2023-12-06" }} today="2023-11-10">
        <DatePicker.Preset days={7}>Last 7 days</DatePicker.Preset>
      </DatePicker>,
    );
    await user.click(screen.getByRole("button", { name: "11/12/2023 – 12/6/2023" }));
    await user.click(screen.getByRole("option", { name: "Last 7 days" }));
    expect(screen.getByRole("button", { name: "11/4/2023 – 11/10/2023" })).toBeTruthy();
  });
});

function RangeHarness({
  type,
  initial,
  changes,
  bars,
}: {
  type: "discrete" | "continuous";
  initial: [number, number];
  changes: [number, number][];
  bars?: number[];
}) {
  const [value, setValue] = useState(initial);
  return (
    <RangeType
      type={type}
      min={1}
      max={5}
      value={value}
      onChange={(next) => {
        changes.push(next);
        setValue(next);
      }}
    >
      {bars && (
        <RangeType.DataViz>
          {bars.map((height, i) => (
            <RangeType.Bar key={i} height={height} />
          ))}
        </RangeType.DataViz>
      )}
    </RangeType>
  );
}

describe("Molecules/Range Type", () => {
  it("shows a discrete range's steps and its two ends", () => {
    render(<RangeHarness type="discrete" initial={[2, 3]} changes={[]} />);
    expect(screen.getAllByRole("slider").map((slider) => slider.getAttribute("aria-valuenow"))).toEqual(["2", "3"]);
    for (const step of ["1", "2", "3", "4", "5"]) expect(screen.getByText(step)).toBeTruthy();
  });

  it("draws its data viz only when it holds one, the bars in its range lit", () => {
    const { container, unmount } = render(<RangeHarness type="discrete" initial={[2, 3]} changes={[]} />);
    expect(container.querySelector("[data-graph]")).toBeNull();
    unmount();
    const lit = render(<RangeHarness type="discrete" initial={[2, 3]} changes={[]} bars={[15, 35, 22, 5]} />);
    const bars = [...lit.container.querySelectorAll("[data-graph] > span")];
    expect(bars.map((bar) => bar.hasAttribute("data-in"))).toEqual([false, true, false, false]);
    expect(bars.map((bar) => (bar as HTMLElement).style.height)).toEqual(["15px", "35px", "22px", "5px"]);
  });

  it("lights the bars as its range moves", () => {
    const { container } = render(<RangeHarness type="discrete" initial={[2, 3]} changes={[]} bars={[15, 35, 22, 5]} />);
    fireEvent.keyDown(screen.getAllByRole("slider")[1], { key: "ArrowRight" });
    const bars = [...container.querySelectorAll("[data-graph] > span")];
    expect(bars.map((bar) => bar.hasAttribute("data-in"))).toEqual([false, true, true, false]);
  });

  it("moves a discrete end a step at a time with the arrow keys", () => {
    const changes: [number, number][] = [];
    render(<RangeHarness type="discrete" initial={[2, 3]} changes={changes} />);
    const [, upper] = screen.getAllByRole("slider");
    fireEvent.keyDown(upper, { key: "ArrowRight" });
    expect(changes).toEqual([[2, 4]]);
    fireEvent.keyDown(upper, { key: "ArrowLeft" });
    expect(changes.at(-1)).toEqual([2, 3]);
  });

  it("never lets its ends cross, or leave the track", () => {
    const changes: [number, number][] = [];
    render(<RangeHarness type="discrete" initial={[2, 3]} changes={changes} />);
    const [lower, upper] = screen.getAllByRole("slider");
    fireEvent.keyDown(lower, { key: "ArrowRight" });
    fireEvent.keyDown(lower, { key: "ArrowRight" });
    expect(lower.getAttribute("aria-valuenow")).toBe("3");
    fireEvent.keyDown(lower, { key: "ArrowLeft" });
    fireEvent.keyDown(lower, { key: "ArrowLeft" });
    fireEvent.keyDown(lower, { key: "ArrowLeft" });
    expect(lower.getAttribute("aria-valuenow")).toBe("1");
    fireEvent.keyDown(upper, { key: "ArrowRight" });
    fireEvent.keyDown(upper, { key: "ArrowRight" });
    fireEvent.keyDown(upper, { key: "ArrowRight" });
    expect(upper.getAttribute("aria-valuenow")).toBe("5");
  });

  it("moves a continuous end by a tenth, and shows both ends in its inputs", () => {
    const changes: [number, number][] = [];
    render(<RangeHarness type="continuous" initial={[1.9, 3.1]} changes={changes} />);
    const [lower] = screen.getAllByRole("slider");
    const inputs = screen.getAllByRole<HTMLInputElement>("textbox");
    expect(inputs.map((input) => input.value)).toEqual(["1.9", "3.1"]);
    fireEvent.keyDown(lower, { key: "ArrowRight" });
    expect(changes).toEqual([[2, 3.1]]);
    expect(inputs[0].value).toBe("2");
  });

  it("holds an input Active only while it's focused", () => {
    render(<RangeHarness type="continuous" initial={[1.9, 3.1]} changes={[]} />);
    const boxes = () => screen.getAllByRole("textbox").map((input) => input.parentElement!.getAttribute("data-state") === "active");
    expect(boxes()).toEqual([false, false]);
    fireEvent.focus(screen.getAllByRole("slider")[1]);
    expect(boxes()).toEqual([false, false]);
    fireEvent.focus(screen.getAllByRole("textbox")[1]);
    expect(boxes()).toEqual([false, true]);
    fireEvent.blur(screen.getAllByRole("textbox")[1]);
    expect(boxes()).toEqual([false, false]);
  });

  it("grows an end only while its input is focused or it's dragged, small at rest", () => {
    const { container } = render(<RangeHarness type="continuous" initial={[1.9, 3.1]} changes={[]} />);
    const grown = () => screen.getAllByRole("slider").map((slider) => slider.hasAttribute("data-active"));
    expect(grown()).toEqual([false, false]);
    fireEvent.focus(screen.getAllByRole("textbox")[1]);
    expect(grown()).toEqual([false, true]);
    fireEvent.blur(screen.getAllByRole("textbox")[1]);
    expect(grown()).toEqual([false, false]);
    const track = container.querySelector("[data-track]")!;
    fireEvent.pointerDown(track, { clientX: 0 });
    expect(grown()).toEqual([true, false]);
    fireEvent.pointerUp(track);
    expect(grown()).toEqual([false, false]);
  });

  it("keeps a press on the track from selecting the page's text as it's dragged", () => {
    const { container } = render(<RangeHarness type="continuous" initial={[1.9, 3.1]} changes={[]} />);
    expect(fireEvent.pointerDown(container.querySelector("[data-track]")!, { clientX: 0 })).toBe(false);
  });

  it("fills an end only while it's pressed or dragged, not while typed into", () => {
    const { container } = render(<RangeHarness type="continuous" initial={[1.9, 3.1]} changes={[]} />);
    const filled = () => screen.getAllByRole("slider").map((slider) => slider.hasAttribute("data-pressed"));
    const track = container.querySelector("[data-track]")!;
    fireEvent.pointerDown(track, { clientX: 0 });
    expect(filled()).toEqual([true, false]);
    fireEvent.pointerUp(track);
    expect(filled()).toEqual([false, false]);
    fireEvent.focus(screen.getAllByRole("textbox")[1]);
    expect(filled()).toEqual([false, false]);
  });

  it("follows the pointer between tenths when smooth, showing and keying it by tenths", () => {
    const changes: [number, number][] = [];
    const { container } = render(
      <RangeType type="continuous" single smooth min={1} max={3} defaultValue={[1, 1]} onChange={(next) => changes.push(next)} />,
    );
    const track = container.querySelector<HTMLElement>("[data-track]")!;
    vi.spyOn(track, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ x: 0, y: 0, width: 200, height: 4 }));
    fireEvent.pointerDown(track, { clientX: 37 });
    fireEvent.pointerUp(track);
    expect(changes.at(-1)![1]).toBeCloseTo(1.37);
    const end = screen.getByRole("slider");
    expect(end.textContent).toBe("1.4");
    fireEvent.keyDown(end, { key: "ArrowRight" });
    expect(changes.at(-1)).toEqual([1, 1.5]);
  });

  it("moves a continuous end to the value typed in its input", async () => {
    const user = userEvent.setup();
    const changes: [number, number][] = [];
    render(<RangeHarness type="continuous" initial={[1.9, 3.1]} changes={changes} />);
    const [lowerInput] = screen.getAllByRole<HTMLInputElement>("textbox");
    await user.clear(lowerInput);
    await user.type(lowerInput, "2.5");
    expect(changes.at(-1)).toEqual([2.5, 3.1]);
    expect(screen.getAllByRole("slider")[0].getAttribute("aria-valuenow")).toBe("2.5");
  });

  it("keeps an end where it is for a typed value past the other end, and shows it again on leaving", async () => {
    const user = userEvent.setup();
    const changes: [number, number][] = [];
    render(<RangeHarness type="continuous" initial={[1.9, 3.1]} changes={changes} />);
    const [lowerInput] = screen.getAllByRole<HTMLInputElement>("textbox");
    await user.clear(lowerInput);
    await user.type(lowerInput, "4");
    expect(changes).toEqual([]);
    expect(screen.getAllByRole("slider")[0].getAttribute("aria-valuenow")).toBe("1.9");
    await user.tab();
    expect(lowerInput.value).toBe("1.9");
  });

  it("steps through the stops it's given, evenly spaced along its track", () => {
    const { container } = render(<RangeType type="discrete" steps={[0, 50, 75, 100]} defaultValue={[50, 100]} />);
    for (const step of ["0", "50", "75", "100"]) expect(screen.getByText(step)).toBeTruthy();
    expect(container.querySelectorAll("[data-dot]")).toHaveLength(4);
    const [lower, upper] = screen.getAllByRole("slider");
    expect(lower.style.left).toContain("0.333");
    fireEvent.keyDown(upper, { key: "ArrowLeft" });
    fireEvent.keyDown(lower, { key: "ArrowLeft" });
    expect([lower, upper].map((slider) => slider.getAttribute("aria-valuenow"))).toEqual(["0", "75"]);
    fireEvent.keyDown(lower, { key: "ArrowLeft" });
    fireEvent.keyDown(upper, { key: "ArrowRight" });
    fireEvent.keyDown(upper, { key: "ArrowRight" });
    expect([lower, upper].map((slider) => slider.getAttribute("aria-valuenow"))).toEqual(["0", "100"]);
  });

  it("lights a bar between each pair of its stops while both are in its range", () => {
    const { container } = render(
      <RangeType type="discrete" steps={[0, 50, 75, 100]} defaultValue={[50, 100]}>
        <RangeType.DataViz>
          {[15, 35, 22].map((height, i) => (
            <RangeType.Bar key={i} height={height} />
          ))}
        </RangeType.DataViz>
      </RangeType>,
    );
    const bars = [...container.querySelectorAll("[data-graph] > span")];
    expect(bars.map((bar) => bar.hasAttribute("data-in"))).toEqual([false, true, true]);
  });

  it("holds its own range when not given one, from its default", () => {
    render(<RangeType type="discrete" min={1} max={5} defaultValue={[2, 3]} />);
    fireEvent.keyDown(screen.getAllByRole("slider")[1], { key: "ArrowRight" });
    expect(screen.getAllByRole("slider").map((slider) => slider.getAttribute("aria-valuenow"))).toEqual(["2", "4"]);
  });

  it("has one end when single, its range from the track's start, named by its field's label", () => {
    const changes: [number, number][] = [];
    function Harness() {
      const [value, setValue] = useState<[number, number]>([5, 10]);
      return (
        <Field>
          <Field.Label>Range</Field.Label>
          <RangeType
            type="discrete"
            single
            steps={[5, 10, 15, 20, 25, 30]}
            value={value}
            onChange={(next) => {
              changes.push(next);
              setValue(next);
            }}
          />
        </Field>
      );
    }
    const { container } = render(<Harness />);
    const slider = screen.getByRole("slider", { name: "Range" });
    expect(screen.getAllByRole("slider")).toHaveLength(1);
    expect(["aria-valuemin", "aria-valuenow", "aria-valuemax"].map((name) => slider.getAttribute(name))).toEqual(["5", "10", "30"]);
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(changes).toEqual([[5, 5]]);
    // A press anywhere on the track moves its one end.
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.pointerDown(container.querySelector("[data-track]")!, { pointerId: 1, clientX: 0 });
    expect(changes.at(-1)).toEqual([5, 5]);
  });
});

describe("Molecules/Range Selector", () => {
  function setup(props: { disabled?: boolean } = {}) {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = useState<[number, number]>([2, 3]);
      return (
        <RangeSelector min={1} max={5} value={value} onChange={setValue} {...props}>
          <Typography variant="metadata">Rating</Typography>
        </RangeSelector>
      );
    }
    render(<Harness />);
    const button = () => screen.getByRole<HTMLButtonElement>("button", { name: /Rating/ });
    return { user, button };
  }

  it("shows its label and the range applied", () => {
    const { button } = setup();
    expect(button().textContent).toBe("Rating2–3");
    expect(button().getAttribute("aria-expanded")).toBe("false");
  });

  it("opens its range, and counts what's picked there", async () => {
    const { user, button } = setup();
    await user.click(button());
    expect(screen.getByRole("dialog", { name: "Rating" })).toBeTruthy();
    const [, upper] = screen.getAllByRole("slider");
    fireEvent.keyDown(upper, { key: "ArrowRight" });
    expect(button().textContent).toBe("Rating2–4");
  });

  it("can't be opened while disabled", async () => {
    const { user, button } = setup({ disabled: true });
    expect(button().disabled).toBe(true);
    await user.click(button());
    expect(screen.queryByRole("slider")).toBeNull();
  });

  it("holds its own range when not given one, from its default or else the whole track", async () => {
    const user = userEvent.setup();
    render(
      <>
        <RangeSelector min={1} max={5} defaultValue={[2, 3]}>
          <Typography variant="metadata">Rating</Typography>
        </RangeSelector>
        <RangeSelector min={1} max={5}>
          <Typography variant="metadata">Score</Typography>
        </RangeSelector>
      </>,
    );
    expect(screen.getByRole("button", { name: /Score/ }).textContent).toBe("Score");
    const rating = screen.getByRole("button", { name: /Rating/ });
    await user.click(rating);
    fireEvent.keyDown(screen.getAllByRole("slider")[1], { key: "ArrowRight" });
    expect(rating.textContent).toBe("Rating2–4");
  });

  it("steps through the stops it's given, applied once its range is narrower than theirs", async () => {
    const user = userEvent.setup();
    render(
      <RangeSelector steps={[0, 50, 75, 100]}>
        <Typography variant="metadata">Fill %</Typography>
      </RangeSelector>,
    );
    const button = screen.getByRole("button", { name: /Fill %/ });
    expect(button.textContent).toBe("Fill %");
    await user.click(button);
    fireEvent.keyDown(screen.getAllByRole("slider")[0], { key: "ArrowRight" });
    expect(button.textContent).toBe("Fill %50–100");
  });
});

describe("the small Text Input (Atoms/Inline Input)", () => {
  it("takes what's typed, between its prefix and suffix", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = useState("1.9");
      return (
        <TextInput size="small" value={value} onChange={setValue}>
          <TextInput.Prefix>CAD</TextInput.Prefix>
          <TextInput.Suffix>USD</TextInput.Suffix>
        </TextInput>
      );
    }
    render(<Harness />);
    const input = screen.getByRole<HTMLInputElement>("textbox");
    await user.clear(input);
    await user.type(input, "2.4");
    expect(input.value).toBe("2.4");
    expect([...input.parentElement!.children].map((part) => part.textContent || part.tagName)).toEqual(["CAD", "INPUT", "USD"]);
  });

  it("keeps a suffix after its input whatever order its parts come in", () => {
    render(
      <TextInput size="small" value="1.9" onChange={() => {}}>
        <TextInput.Suffix>CAD</TextInput.Suffix>
      </TextInput>,
    );
    const input = screen.getByRole("textbox");
    expect(input.previousElementSibling).toBeNull();
    expect(input.nextElementSibling?.textContent).toBe("CAD");
  });

  it("can't be typed in while disabled", () => {
    render(<TextInput size="small" value="1.9" onChange={() => {}} disabled />);
    expect(screen.getByRole<HTMLInputElement>("textbox").disabled).toBe(true);
  });

  it("drops its tone while disabled", () => {
    render(<TextInput size="small" value="1.9" onChange={() => {}} tone="alert" disabled />);
    expect(screen.getByRole("textbox").parentElement!.hasAttribute("data-state")).toBe(false);
  });

  it("holds what's typed when not given a value, from its default", async () => {
    const user = userEvent.setup();
    render(<TextInput size="small" defaultValue="1.9" />);
    const input = screen.getByRole<HTMLInputElement>("textbox");
    expect(input.value).toBe("1.9");
    await user.clear(input);
    await user.type(input, "2.4");
    expect(input.value).toBe("2.4");
  });
});

describe("Atoms/Filter/Bulk Select", () => {
  function setup() {
    const user = userEvent.setup();
    const picked: string[] = [];
    function Harness() {
      const [checked, setChecked] = useState(false);
      return (
        <BulkSelect checked={checked} onCheck={setChecked} onPick={(option) => picked.push(option)}>
          <BulkSelect.Item value="offered">
<Typography variant="metadata">Offered</Typography>
</BulkSelect.Item>
          <BulkSelect.Item value="accepted">
<Typography variant="metadata">Accepted</Typography>
</BulkSelect.Item>
          <BulkSelect.Item value="waitlist">
<Typography variant="metadata">Waitlist</Typography>
</BulkSelect.Item>
        </BulkSelect>
      );
    }
    render(<Harness />);
    const menuButton = () => screen.getByRole("button", { expanded: false });
    return { user, picked, menuButton };
  }

  it("lists items of its own size: small by default, large when it's large", () => {
    const sizes = (size?: "large") => {
      render(
        <BulkSelect size={size} defaultOpen>
          <BulkSelect.Item>
            <Typography variant="body">Offered</Typography>
          </BulkSelect.Item>
        </BulkSelect>,
      );
      const item = screen.getByRole("menuitem").dataset.size;
      cleanup();
      return item;
    };
    expect(sizes()).toBe("small");
    expect(sizes("large")).toBeUndefined();
  });

  it("ticks and unticks its checkbox", async () => {
    const { user } = setup();
    const box = screen.getByRole("checkbox", { name: "Select all" });
    expect(box.getAttribute("aria-checked")).toBe("false");
    await user.click(box);
    expect(box.getAttribute("aria-checked")).toBe("true");
    await user.click(box);
    expect(box.getAttribute("aria-checked")).toBe("false");
  });

  it("moves through its menu with the arrow keys from its chevron, and picks the item reached on Enter", async () => {
    const { user, picked, menuButton } = setup();
    const chevron = menuButton();
    chevron.focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(keyed(chevron)).toBe("Accepted");
    await user.keyboard("{Enter}");
    expect(picked).toEqual(["accepted"]);
    expect(chevron.getAttribute("aria-expanded")).toBe("false");
  });

  it("lists its options from its chevron, and picks one", async () => {
    const { user, picked, menuButton } = setup();
    await user.click(menuButton());
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Offered", "Accepted", "Waitlist"]);
    await user.click(screen.getByRole("menuitem", { name: "Accepted" }));
    expect(picked).toEqual(["accepted"]);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes its menu on Escape", async () => {
    const { user, menuButton } = setup();
    await user.click(menuButton());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("lists options that share their words, as Figma's String values do", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <BulkSelect checked={false} onCheck={() => {}} defaultOpen>
        {["String value", "String value"].map((option, i) => (
          <BulkSelect.Item key={i} value={option}>
<Typography variant="metadata">{option}</Typography>
</BulkSelect.Item>
        ))}
      </BulkSelect>,
    );
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["String value", "String value"]);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("leaves its tick to whoever holds it when an option is picked", async () => {
    const user = userEvent.setup();
    const onCheck = vi.fn();
    const onPick = vi.fn();
    render(
      <BulkSelect checked={false} onCheck={onCheck} onPick={onPick} defaultOpen>
        <BulkSelect.Item value="offered">
          <Typography variant="metadata">Offered</Typography>
        </BulkSelect.Item>
      </BulkSelect>,
    );
    await user.click(screen.getByRole("menuitem", { name: "Offered" }));
    expect(onPick).toHaveBeenCalledWith("offered");
    expect(onCheck).not.toHaveBeenCalled();
  });

  it("holds a small checkbox, or a large one", () => {
    const { rerender } = render(
      <BulkSelect>
        <BulkSelect.Item value="offered">
          <Typography variant="metadata">Offered</Typography>
        </BulkSelect.Item>
      </BulkSelect>,
    );
    expect(screen.getByRole("checkbox").dataset.size).toBe("small");
    rerender(
      <BulkSelect size="large">
        <BulkSelect.Item value="offered">
          <Typography variant="metadata">Offered</Typography>
        </BulkSelect.Item>
      </BulkSelect>,
    );
    expect(screen.getByRole("checkbox").dataset.size).toBeUndefined();
  });

  it("has no chevron without options to pick", () => {
    render(<BulkSelect>{[]}</BulkSelect>);
    expect(screen.getByRole("checkbox", { name: "Select all" })).toBeDefined();
    expect(screen.queryByRole("button", { expanded: false })).toBeNull();
  });

  it("names its checkbox for what it picks", () => {
    render(
      <BulkSelect aria-label="Drishti Suresh">
        <BulkSelect.Item value="offered">
          <Typography variant="metadata">Offered</Typography>
        </BulkSelect.Item>
      </BulkSelect>,
    );
    expect(screen.getByRole("checkbox", { name: "Drishti Suresh" })).toBeDefined();
  });

  it("holds its own tick when not given one, from its default, and ticks for an option picked", async () => {
    const user = userEvent.setup();
    render(
      <BulkSelect defaultChecked>
        <BulkSelect.Item value="offered">
<Typography variant="metadata">Offered</Typography>
</BulkSelect.Item>
      </BulkSelect>,
    );
    const box = screen.getByRole("checkbox", { name: "Select all" });
    expect(box.getAttribute("aria-checked")).toBe("true");
    await user.click(box);
    expect(box.getAttribute("aria-checked")).toBe("false");
    await user.click(screen.getByRole("button", { expanded: false }));
    await user.click(screen.getByRole("menuitem", { name: "Offered" }));
    expect(box.getAttribute("aria-checked")).toBe("true");
  });
});

describe("the Filter page", () => {
  it("shows every one of Figma's Filter components, in its order", () => {
    renderStories(FILTER_STORIES);
    expect([...document.querySelectorAll("[data-ds-story]")].map((story) => story.getAttribute("aria-label"))).toEqual([
      "Range Type",
      "Range Selector",
      "Bulk Select",
      "Date Selector",
    ]);
  });
});
