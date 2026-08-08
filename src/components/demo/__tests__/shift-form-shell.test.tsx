// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { ShiftFormShell } from "../shift-form-shell";

afterEach(cleanup);

// The footer's wireframe block (Figma 902:2466) is the slot a demo fills when
// it needs the dialog to hold its height — it draws the section's side rails
// and nothing else, so an empty one costs no space.
describe("ShiftFormShell — footer fill", () => {
  it("omits the slot entirely when no fill is given", () => {
    render(<ShiftFormShell>form</ShiftFormShell>);
    expect(screen.queryByTestId("footer-fill")).toBeNull();
  });

  it("renders the fill inside the footer, above the action bar", () => {
    render(
      <ShiftFormShell footerFill={<span>wireframe</span>}>form</ShiftFormShell>,
    );
    const fill = screen.getByTestId("footer-fill");
    expect(fill.textContent).toBe("wireframe");
    expect(fill.nextElementSibling?.textContent).toContain("Cancel");
  });
});
