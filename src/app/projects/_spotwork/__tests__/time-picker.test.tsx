import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TimePicker } from "../time-picker";
import { Field } from "../ui";
import { keyed } from "./story-harness";

const PM3 = 15 * 60;
const DAY = 24 * 60;

afterEach(cleanup);

function setup() {
  const onChange = vi.fn();
  const onInvalid = vi.fn();
  const user = userEvent.setup();
  render(
    <Field>
      <Field.Label>Check-in Time</Field.Label>
      <TimePicker value={PM3} around={PM3} onChange={onChange} onInvalid={onInvalid} />
      <Field.HintText>On time</Field.HintText>
    </Field>,
  );
  const field = screen.getByRole<HTMLInputElement>("combobox", { name: "Check-in Time" });
  const typeIn = async (text: string) => {
    await user.clear(field);
    if (text) await user.type(field, text, { skipClick: true });
  };
  return { user, field, typeIn, onChange, onInvalid };
}

describe("TimePicker", () => {
  it("is named by its label, its hint under it", async () => {
    const { user, field } = setup();
    expect(screen.getByText("On time")).toBeTruthy();
    await user.click(field);
    expect(screen.getByRole("listbox", { name: "Check-in Time" })).toBeTruthy();
  });

  it("gives its hint its tone, or the hint's own", () => {
    render(
      <Field tone="alert">
        <Field.Label>Start</Field.Label>
        <TimePicker value={PM3} around={PM3} onChange={() => {}} />
        <Field.HintText>Too early</Field.HintText>
      </Field>,
    );
    expect(screen.getByText("Too early").getAttribute("data-tone")).toBe("alert");
    cleanup();
    render(
      <Field>
        <Field.Label>Start</Field.Label>
        <TimePicker value={PM3} around={PM3} onChange={() => {}} />
        <Field.HintText tone="warning">7 minutes late</Field.HintText>
      </Field>,
    );
    expect(screen.getByText("7 minutes late").getAttribute("data-tone")).toBe("warning");
  });

  it("sets a typed time on Enter", async () => {
    const { user, field, typeIn, onChange } = setup();
    await typeIn("3:07");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith(PM3 + 7);
    expect(field.getAttribute("aria-invalid")).not.toBe("true");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows an alert in place of its hint, and sets nothing, when what's typed on Enter isn't a time", async () => {
    const { user, field, typeIn, onChange, onInvalid } = setup();
    await typeIn("3:75");
    await user.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
    expect(field.value).toBe("3:75");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText("On time")).toBeNull();
    expect(onInvalid).toHaveBeenLastCalledWith(true);
  });

  it("shows the alert when the field is left with something that isn't a time", async () => {
    const { user, field, typeIn } = setup();
    await typeIn("abc");
    await user.tab();
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("waits for Enter or leaving the field before flagging what's typed", async () => {
    const { field, typeIn } = setup();
    await typeIn("3:");
    expect(field.getAttribute("aria-invalid")).not.toBe("true");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears the alert as soon as what's typed is a time", async () => {
    const { user, field, typeIn, onInvalid } = setup();
    await typeIn("3:75");
    await user.keyboard("{Enter}");
    await typeIn("3:07");
    expect(field.getAttribute("aria-invalid")).not.toBe("true");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onInvalid).toHaveBeenLastCalledWith(false);
  });

  it("puts the time back when the field is cleared and left", async () => {
    const { user, field, typeIn, onChange } = setup();
    await typeIn("");
    await user.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(field.value).toBe("3:00 PM");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("steps through its times with the arrow keys from the one it shows, and sets the one reached on Enter", async () => {
    const { user, field, onChange } = setup();
    await user.click(field);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(keyed(field)).toBe("3:30 PM");
    await user.keyboard("{ArrowUp}");
    expect(keyed(field)).toBe("3:15 PM");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(PM3 + 15);
    expect(field.getAttribute("aria-expanded")).toBe("false");
  });

  it("steps from a time between its rows to the ones either side of it", async () => {
    const user = userEvent.setup();
    const between = () => {
      render(
        <Field>
          <Field.Label>Start</Field.Label>
          <TimePicker value={PM3 + 7} onChange={() => {}} />
        </Field>,
      );
      return screen.getByRole<HTMLInputElement>("combobox", { name: "Start" });
    };
    let field = between();
    await user.click(field);
    await user.keyboard("{ArrowDown}");
    expect(keyed(field)).toBe("3:15 PM");
    cleanup();
    field = between();
    await user.click(field);
    await user.keyboard("{ArrowUp}");
    expect(keyed(field)).toBe("3:00 PM");
  });

  it("holds the time picked when not given one, from its default, resting around it", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Field>
        <Field.Label>Start</Field.Label>
        <TimePicker defaultValue={PM3} onChange={onChange} />
      </Field>,
    );
    const field = screen.getByRole<HTMLInputElement>("combobox", { name: "Start" });
    expect(field.value).toBe("3:00 PM");
    await user.click(field);
    expect(screen.getByRole("option", { selected: true }).textContent).toBe("3:00 PM");
    await user.click(screen.getByRole("option", { name: "3:30 PM" }));
    expect(field.value).toBe("3:30 PM");
    expect(onChange).toHaveBeenCalledWith(PM3 + 30);
  });

  describe("with the time it's measured from", () => {
    function since() {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(
        <Field>
          <Field.Label>Shift End</Field.Label>
          <TimePicker since={PM3} defaultValue={DAY} onChange={onChange} defaultOpen />
        </Field>,
      );
      const field = screen.getByRole<HTMLInputElement>("combobox", { name: "Shift End" });
      return { user, field, onChange };
    }

    it("runs a day on from it, each time with how long after it falls", () => {
      since();
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(96);
      expect(options[0].textContent).toBe("3:15 PM +0.25 hours");
      expect(options.at(-1)!.textContent).toBe("3:00 PM +24 hours");
      expect(screen.getByRole("option", { selected: true }).textContent).toBe("12:00 AM +9 hours");
    });

    it("marks where the next day starts, over midnight", () => {
      since();
      const midnight = screen.getByRole("option", { name: "12:00 AM +9 hours" });
      expect(midnight.previousElementSibling?.textContent).toBe("Next Day");
      expect(screen.getAllByText("Next Day")).toHaveLength(1);
    });

    it("sets a time past midnight on the next day, picked or typed", async () => {
      const { user, field, onChange } = since();
      await user.click(screen.getByRole("option", { name: "1:00 AM +10 hours" }));
      expect(onChange).toHaveBeenLastCalledWith(DAY + 60);
      await user.clear(field);
      await user.type(field, "2:00 AM{Enter}");
      expect(onChange).toHaveBeenLastCalledWith(DAY + 120);
    });

    it("picks out a time it's given on another day as the one a day on from it", () => {
      render(<TimePicker since={PM3} value={60} aria-label="Shift End" defaultOpen />);
      expect(screen.getByRole("option", { selected: true }).textContent).toBe("1:00 AM +10 hours");
    });
  });

  it("names its parts for the code view", () => {
    expect(TimePicker.displayName).toBe("TimePicker");
    expect(Field.Label.displayName).toBe("Field.Label");
    expect(Field.HintText.displayName).toBe("Field.HintText");
  });
});
