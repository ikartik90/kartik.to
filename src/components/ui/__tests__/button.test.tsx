// @vitest-environment jsdom
import { createRef } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Button } from "../button";
import { Tooltip } from "../tooltip";

describe("Button", () => {
  afterEach(() => cleanup());

  it("renders a text label", () => {
    render(<Button>Cancel</Button>);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
  });

  it("renders link variant", () => {
    render(<Button variant="link">browse to upload</Button>);
    expect(
      screen.getByRole("button", { name: "browse to upload" }),
    ).toBeDefined();
  });

  it("renders icon variant with aria-label", () => {
    render(
      <Button variant="icon" aria-label="Close dialog">
        ×
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Close dialog" })).toBeDefined();
  });

  it("renders a Button.Text label", () => {
    render(
      <Button>
        <svg />
        <Button.Text>Save changes</Button.Text>
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDefined();
  });

  it("blocks click when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Insert Image
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Insert Image" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("forwards ref", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Go</Button>);
    expect(ref.current?.tagName).toBe("BUTTON");
  });

  describe("Button.Tooltip", () => {
    function iconButton() {
      return (
        <Button aria-label="Delete">
          <svg />
          <Button.Tooltip>
            <Tooltip.Text>Delete</Tooltip.Text>
            <svg />
          </Button.Tooltip>
        </Button>
      );
    }

    it("renders the tooltip decoratively, hidden until hover", () => {
      render(iconButton());
      // Accessible name comes from the button, not the aria-hidden tooltip.
      expect(screen.getByRole("button", { name: "Delete" })).toBeDefined();
      const tip = screen.getByText("Delete").parentElement as HTMLElement;
      expect(tip.getAttribute("aria-hidden")).toBe("true");
      expect(tip.hasAttribute("data-visible")).toBe(false);
    });

    it("reveals the tooltip while the pointer is over the button", () => {
      render(iconButton());
      const btn = screen.getByRole("button", { name: "Delete" });
      const tip = screen.getByText("Delete").parentElement as HTMLElement;

      fireEvent.mouseEnter(btn, { clientX: 10, clientY: 10 });
      expect(tip.hasAttribute("data-visible")).toBe(true);

      fireEvent.mouseLeave(btn);
      expect(tip.hasAttribute("data-visible")).toBe(false);
    });
  });
});
