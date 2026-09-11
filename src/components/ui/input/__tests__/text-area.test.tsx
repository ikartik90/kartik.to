import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { TextArea } from "../text-area";

afterEach(() => cleanup());

describe("TextArea", () => {
  // The whole reason this exists beside TextInput: prose WRAPS, and a
  // single-line input hides everything past its right edge.
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

  // Same assertion TextInput makes, and for the same reason: a size that scales
  // the label but not the frame is the exact mismatch the recipe's size variant
  // exists to prevent.
  it("forwards size to every field slot", () => {
    render(<TextArea label="Label" hint="Hint text" size="sm" />);
    const control = screen.getByRole("textbox");
    expect(control.className).toContain("field__control--size_sm");
    expect(control.parentElement?.className).toContain("field__frame--size_sm");
    expect(screen.getByText("Label").className).toContain(
      "field__label--size_sm",
    );
  });

  // `data-control` is what the frame's mousedown looks for when forwarding a
  // click on its dead padding. Without it a click near the frame's edge focuses
  // nothing and the field feels broken.
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
