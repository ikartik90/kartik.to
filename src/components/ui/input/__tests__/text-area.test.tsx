import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { TextArea } from "../text-area";

afterEach(() => cleanup());

describe("TextArea", () => {
  it("renders a textarea in the control slot", () => {
    render(<TextArea label="Testimonial" />);
    expect(screen.getByLabelText("Testimonial").tagName).toBe("TEXTAREA");
  });

  it("associates the label with the control", () => {
    render(<TextArea label="Testimonial" />);
    expect(screen.getByLabelText("Testimonial")).toBe(
      screen.getByRole("textbox"),
    );
  });

  it("links the hint via aria-describedby when present", () => {
    render(<TextArea label="Label" hint="Hint text" />);
    const describedBy = screen
      .getByRole("textbox")
      .getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe("Hint text");
  });

  it("forwards size to every field slot", () => {
    render(<TextArea label="Label" hint="Hint text" size="sm" />);
    const control = screen.getByRole("textbox");
    expect(control.className).toContain("field__control--size_sm");
    expect(control.parentElement?.className).toContain("field__frame--size_sm");
    expect(screen.getByText("Label").className).toContain(
      "field__label--size_sm",
    );
  });

  it("carries data-control so the frame can forward focus", () => {
    render(<TextArea label="Label" />);
    const control = screen.getByRole("textbox");
    expect(control.hasAttribute("data-control")).toBe(true);

    fireEvent.mouseDown(control.parentElement!);
    expect(document.activeElement).toBe(control);
  });

  it("passes native textarea attributes through", () => {
    render(<TextArea label="Label" rows={5} maxLength={280} />);
    const control = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(control.rows).toBe(5);
    expect(control.maxLength).toBe(280);
  });
});
