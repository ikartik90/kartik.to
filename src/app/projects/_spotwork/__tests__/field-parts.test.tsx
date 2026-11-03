import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TIME_PICKER } from "../copy";
import { PasswordInput } from "../form-parts";
import { TimePicker } from "../time-picker";
import { Field } from "../ui";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Field's own parts", () => {
  it("names its label and hint text as its own", () => {
    expect([Field.Label, Field.HintText].map((part) => part.displayName)).toEqual(["Field.Label", "Field.HintText"]);
  });

  it("refuses a label or hint text out of a field", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Field.Label>Start</Field.Label>)).toThrow(new Error("Field.Label must be used inside Field"));
    expect(() => render(<Field.HintText>On time</Field.HintText>)).toThrow(new Error("Field.HintText must be used inside Field"));
  });

  it("gives a password's conditions their own tones, never the field's tone or hint id", async () => {
    const user = userEvent.setup();
    render(
      <Field tone="warning">
        <Field.Label>Password</Field.Label>
        <PasswordInput>
          <PasswordInput.Conditions>
            <PasswordInput.Condition rule="length">At least 8 characters</PasswordInput.Condition>
          </PasswordInput.Conditions>
        </PasswordInput>
        <Field.HintText>Not one used before</Field.HintText>
      </Field>,
    );
    await user.type(screen.getByLabelText("Password"), "abcdefgh");
    const condition = screen.getByText("At least 8 characters");
    expect(condition.getAttribute("data-tone")).toBe("success");
    expect(condition.id).toBe("");
    expect(screen.getByText("Not one used before").id).toMatch(/-hint$/);
  });

  it("places a time picker's own alert as its field's hint text, when the field has none", async () => {
    const user = userEvent.setup();
    render(
      <Field>
        <Field.Label>Shift Start Time</Field.Label>
        <TimePicker value={15 * 60} around={15 * 60} onChange={() => {}} />
      </Field>,
    );
    const field = screen.getByRole("combobox", { name: "Shift Start Time" });
    await user.clear(field);
    await user.type(field, "3:75{Enter}", { skipClick: true });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(TIME_PICKER.invalid);
    expect(alert.closest("[data-hint]")!.parentElement!.hasAttribute("data-field")).toBe(true);
  });
});
