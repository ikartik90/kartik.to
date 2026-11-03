import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Field, SegmentedControl, TextInput } from "../ui";

afterEach(cleanup);

function Days({ disabled }: { disabled?: boolean }) {
  const [day, setDay] = useState("today");
  return (
    <SegmentedControl value={day} onChange={setDay} size="small" aria-label="Day" disabled={disabled}>
      <SegmentedControl.Segment value="yesterday">Yesterday</SegmentedControl.Segment>
      <SegmentedControl.Segment value="today">Today</SegmentedControl.Segment>
    </SegmentedControl>
  );
}

const pressed = () =>
  within(screen.getByRole("group", { name: "Day" }))
    .getAllByRole("button")
    .map((segment) => segment.getAttribute("aria-pressed"));

describe("SegmentedControl", () => {
  it("presses the segment holding its value, and moves its value to the one pressed", async () => {
    const user = userEvent.setup();
    render(<Days />);
    expect(pressed()).toEqual(["false", "true"]);
    await user.click(screen.getByRole("button", { name: "Yesterday" }));
    expect(pressed()).toEqual(["true", "false"]);
  });

  it("holds its own value when not given one, from its default", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SegmentedControl defaultValue="today" onChange={onChange} aria-label="Day">
        <SegmentedControl.Segment value="yesterday">Yesterday</SegmentedControl.Segment>
        <SegmentedControl.Segment value="today">Today</SegmentedControl.Segment>
      </SegmentedControl>,
    );
    expect(pressed()).toEqual(["false", "true"]);
    await user.click(screen.getByRole("button", { name: "Yesterday" }));
    expect(pressed()).toEqual(["true", "false"]);
    expect(onChange).toHaveBeenCalledWith("yesterday");
  });

  it("keeps a small segment as wide unpressed as pressed, under a hidden copy of its words at the pressed weight", async () => {
    const user = userEvent.setup();
    render(<Days />);
    const faces = () =>
      within(screen.getByRole("group", { name: "Day" }))
        .getAllByRole("button")
        .map((segment) => {
          const copy = segment.querySelector("[aria-hidden=true]");
          const shown = [...segment.children].find((child) => child !== copy);
          return [segment.textContent?.length, shown?.getAttribute("data-typography"), copy?.getAttribute("data-typography"), copy?.textContent];
        });
    expect(screen.getByRole("button", { name: "Yesterday" })).toBeTruthy();
    expect(faces()).toEqual([
      [18, "metadata", "metadataStrong", "Yesterday"],
      [10, "metadataStrong", "metadataStrong", "Today"],
    ]);
    await user.click(screen.getByRole("button", { name: "Yesterday" }));
    expect(faces().map(([, shown]) => shown)).toEqual(["metadataStrong", "metadata"]);
  });

  it("names its size, layout and disabled state on its group", () => {
    render(
      <SegmentedControl value="a" onChange={() => {}} size="small" layout="fill" disabled aria-label="Letters">
        <SegmentedControl.Segment value="a">A</SegmentedControl.Segment>
      </SegmentedControl>,
    );
    const root = screen.getByRole("group", { name: "Letters" });
    expect(root.dataset.size).toBe("small");
    expect(root.hasAttribute("data-fill")).toBe(true);
    expect(root.hasAttribute("data-disabled")).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "A" }).disabled).toBe(true);
  });

  it("is as tall as a field's box at either size, so it lines up with the fields in its row", () => {
    render(
      <>
        <TextInput aria-label="Large field" />
        <TextInput size="small" aria-label="Small field" />
        <SegmentedControl defaultValue="a" aria-label="Letters">
          <SegmentedControl.Segment value="a">A</SegmentedControl.Segment>
        </SegmentedControl>
      </>,
    );
    const height = (element: Element, prefix = "") =>
      element.className.split(" ").find((name) => name.startsWith(`${prefix}h_`));
    const box = screen.getByRole("textbox", { name: "Large field" }).parentElement!;
    const group = screen.getByRole("group", { name: "Letters" });
    expect(height(group)).toBe(height(box));
    expect(height(group, "[&[data-size=small]]:")).toBe(height(box, "[&[data-size=small]]:"));
    expect(height(box, "[&[data-size=small]]:")).toBeDefined();
  });

  it("is named by its label, over the segments, and hints under them", () => {
    render(
      <Field>
        <Field.Label>Break Type</Field.Label>
        <SegmentedControl value="paid" onChange={() => {}}>
          <SegmentedControl.Segment value="paid">Paid</SegmentedControl.Segment>
          <SegmentedControl.Segment value="unpaid">Unpaid</SegmentedControl.Segment>
        </SegmentedControl>
        <Field.HintText>Hint text</Field.HintText>
      </Field>,
    );
    const group = screen.getByRole("group", { name: "Break Type" });
    const root = group.parentElement!;
    expect([...root.children].map((child) => child.textContent)).toEqual(["Break Type", "PaidUnpaid", "Hint text"]);
    expect(within(group).getAllByRole("button")).toHaveLength(2);
  });
});
