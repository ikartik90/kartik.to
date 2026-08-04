import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { TextInput } from "../text-input";
import CalendarIcon from "@/assets/icons/calendar.svg";

afterEach(() => cleanup());

describe("TextInput", () => {
  it("associates the label with the input", () => {
    render(<TextInput label="Date of birth" />);
    // getByLabelText only resolves if htmlFor/id wire the label to the control.
    expect(screen.getByLabelText("Date of birth")).toBe(
      screen.getByRole("textbox"),
    );
  });

  it("links the hint via aria-describedby when present", () => {
    render(<TextInput label="Label" hint="Hint text" />);
    const input = screen.getByRole("textbox");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe("Hint text");
  });

  // The assembly used to hardcode the field's default size, so `sm` was
  // unreachable without dropping down to the compound parts. Assert the prop
  // reaches every slot — a size that scales the label but not the frame is the
  // exact mismatch the recipe's size variant exists to prevent.
  it("forwards size to every field slot", () => {
    render(<TextInput label="Label" hint="Hint text" size="sm" />);
    const control = screen.getByRole("textbox");
    expect(control.className).toContain("field__control--size_sm");
    expect(control.parentElement?.className).toContain("field__frame--size_sm");
    expect(screen.getByText("Label").className).toContain(
      "field__label--size_sm",
    );
    expect(screen.getByText("Hint text").className).toContain(
      "field__hint--size_sm",
    );
  });

  it("stays on the medium field when no size is given", () => {
    render(<TextInput label="Label" />);
    expect(screen.getByRole("textbox").className).toContain(
      "field__control--size_md",
    );
  });

  it("omits aria-describedby when there is no hint", () => {
    render(<TextInput label="Label" />);
    expect(
      screen.getByRole("textbox").getAttribute("aria-describedby"),
    ).toBeNull();
  });

  it("renders a caller-marked decorative leading icon (aria-hidden)", () => {
    render(
      <TextInput
        label="Label"
        iconBefore={<CalendarIcon aria-hidden data-testid="cal" />}
      />,
    );
    // Icons pass bare into the frame; the caller marks a purely decorative one
    // aria-hidden, and the frame just sizes/tints it.
    expect(screen.getByTestId("cal").closest("[aria-hidden]")).not.toBeNull();
  });

  it("forwards value changes through onChange", () => {
    const onChange = vi.fn();
    render(<TextInput label="Label" value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "11/12/2026" },
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("focuses the control when the frame's dead space is clicked", () => {
    render(<TextInput label="Label" iconBefore={<CalendarIcon />} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    const frame = input.parentElement as HTMLElement; // Field.Frame wraps the control
    expect(document.activeElement).not.toBe(input);

    // preventDefault (returns false) so focus lands cleanly without a blur flash.
    const notCancelled = fireEvent.mouseDown(frame);
    expect(notCancelled).toBe(false);
    expect(document.activeElement).toBe(input);
  });

  it("leaves focus handling to the browser when the control itself is clicked", () => {
    render(<TextInput label="Label" />);
    const input = screen.getByRole("textbox");
    // Clicking the control must not be intercepted — no preventDefault.
    expect(fireEvent.mouseDown(input)).toBe(true);
  });
});
