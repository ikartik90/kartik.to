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

  it("omits aria-describedby when there is no hint", () => {
    render(<TextInput label="Label" />);
    expect(
      screen.getByRole("textbox").getAttribute("aria-describedby"),
    ).toBeNull();
  });

  it("renders the leading icon as decorative (aria-hidden)", () => {
    render(
      <TextInput label="Label" iconBefore={<CalendarIcon data-testid="cal" />} />,
    );
    // The adornment wrapper hides the purely decorative icon from AT.
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
