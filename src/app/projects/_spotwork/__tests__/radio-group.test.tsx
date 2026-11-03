import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Field, RadioButton, RadioGroup } from "../ui";

afterEach(cleanup);

const group = (onValueChange?: (value: string) => void) => (
  <RadioGroup aria-label="Edit" defaultValue="one" onValueChange={onValueChange}>
    <Field orientation="horizontal">
      <RadioButton value="one" />
      <Field.Label>This shift only</Field.Label>
    </Field>
    <Field orientation="horizontal">
      <RadioButton value="all" />
      <Field.Label>All upcoming shifts</Field.Label>
    </Field>
  </RadioGroup>
);

describe("a radio group", () => {
  it("names its radios' group and picks the one it starts on", () => {
    render(group());
    expect(screen.getByRole("radiogroup", { name: "Edit" })).toBeTruthy();
    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("aria-checked"))).toEqual(["true", "false"]);
  });

  it("picks one radio at a time, telling its owner which", async () => {
    const onValueChange = vi.fn();
    render(group(onValueChange));
    await userEvent.click(screen.getByRole("radio", { name: "All upcoming shifts" }));
    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("aria-checked"))).toEqual(["false", "true"]);
    expect(onValueChange).toHaveBeenCalledWith("all");
  });

  it("names itself as the code view prints it", () => {
    expect((RadioGroup as { displayName?: string }).displayName).toBe("RadioGroup");
  });
});
