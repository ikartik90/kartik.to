// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { ShiftFormShell } from "../shift-form-shell";

afterEach(cleanup);

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

describe("ShiftFormShell — cropped", () => {
  it("drops the action bar so the card ends at the tear", () => {
    render(<ShiftFormShell cropped>form</ShiftFormShell>);
    expect(screen.queryByText("Cancel")).toBeNull();
    expect(screen.queryByText("Post Shift")).toBeNull();
  });

  it("keeps the header and the body it crops", () => {
    render(<ShiftFormShell cropped>form</ShiftFormShell>);
    expect(screen.getByText("Post a Shift")).toBeTruthy();
    expect(screen.getByText("form")).toBeTruthy();
  });

  it("has no footer slot to fill, so a fill is ignored", () => {
    render(
      <ShiftFormShell cropped footerFill={<span>wireframe</span>}>
        form
      </ShiftFormShell>,
    );
    expect(screen.queryByTestId("footer-fill")).toBeNull();
  });
});
